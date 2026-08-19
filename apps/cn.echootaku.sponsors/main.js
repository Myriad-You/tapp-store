var SPONSORS_SNAPSHOT_KEY = 'sponsors.snapshot.v1';
var sponsorsGeneration = 0;
var sponsorsState = { snapshot: null, filter: 'all', search: '', view: 'cosmos', selectedStarId: '', starLayout: [], visibleSources: ['github', 'patreon', 'afdian'], animationEnabled: true, paused: false, zoom: 1, depth: 3, pointerX: 0, pointerY: 0, cosmosImage: null, cosmosImageUrl: '' };
var sponsorsCosmosFrame = 0;

var SPONSOR_SOURCES = {
  github: { id: 'github', mark: 'GH', name: 'GitHub Sponsors', mode: 'native', setupUrlId: 'github-token' },
  patreon: { id: 'patreon', mark: 'P', name: 'Patreon', mode: 'native', setupUrlId: 'patreon-token' },
  afdian: { id: 'afdian', mark: 'AF', name: '爱发电', mode: 'native', setupUrlId: 'afdian-token' }
};
var SPONSOR_SOURCE_SETTINGS = { github: 'showGithub', patreon: 'showPatreon', afdian: 'showAfdian' };

function sponsorText(value) { return String(value == null ? '' : value); }
function sponsorBoundedText(value, limit) { return Array.from(sponsorText(value)).slice(0, limit || 256).join(''); }
function sponsorMinor(value) { var amount = Number(value); return Number.isFinite(amount) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.round(amount))) : 0; }
function sponsorEscape(value) { return sponsorText(value).replace(/[&<>'"]/g, function (character) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]; }); }
function sponsorTranslate(key, params) { try { return Tapp.i18n.t(key, params || {}); } catch (error) { return key; } }
function sponsorLocale() { try { return Tapp.i18n.getLocale() || undefined; } catch (error) { return undefined; } }
function sponsorDisplayName(item) {
  return item && item.private ? sponsorTranslate('privateSponsor') : sponsorText(item && item.name || sponsorTranslate('unknownSponsor'));
}
function sponsorApplyTheme(root, theme) {
  var normalized = theme === 'dark' ? 'dark' : 'light';
  if (root) { root.dataset.theme = normalized; }
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.tappTheme = normalized;
    document.documentElement.classList.toggle('dark', normalized === 'dark');
  }
}
function sponsorInitials(name) {
  var parts = sponsorText(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) { return '?'; }
  return parts.slice(0, 2).map(function (part) { return Array.from(part)[0] || ''; }).join('').toUpperCase();
}
function sponsorPayload(response) {
  var value = response;
  for (var depth = 0; depth < 4; depth += 1) {
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch (error) { break; } }
    if (!value || typeof value !== 'object') { break; }
    if (value.body !== undefined) { value = value.body; continue; }
    if (value.result !== undefined) { value = value.result; continue; }
    break;
  }
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch (error) { return {}; } }
  return value && typeof value === 'object' ? value : {};
}
function sponsorError(error) {
  var message = sponsorBoundedText(error && error.message ? error.message : error, 300);
  if (/credential|凭据|401|403|unauthorized|forbidden/i.test(message)) { return sponsorTranslate('credentialMissing'); }
  return message || sponsorTranslate('syncFailed');
}
function sponsorIsReachabilityError(error) {
  var message = sponsorText(error && error.message ? error.message : error);
  return /request timeout|timed?\s*out|timeout|超时|failed to connect|connection refused|network error/i.test(message);
}
function sponsorMoney(minor, currency) {
  if (!Number.isFinite(Number(minor))) { return '—'; }
  try { return new Intl.NumberFormat(sponsorLocale(), { style: 'currency', currency: currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(Number(minor) / (currency === 'JPY' ? 1 : 100)); }
  catch (error) { return currency + ' ' + (Number(minor) / 100).toFixed(2); }
}

function normalizeGithubNode(node, index) {
  var entity = node && node.sponsorEntity;
  var isPrivate = !entity || node.privacyLevel === 'PRIVATE';
  var isActive = node && node.isActive !== false;
  var isOneTime = Boolean(node && node.isOneTimePayment);
  var tierAmount = sponsorMinor(node && node.tier && node.tier.monthlyPriceInCents);
  var name = isPrivate ? '' : sponsorBoundedText(entity.name || entity.login, 120);
  return {
    id: 'github:' + sponsorBoundedText(entity && entity.login ? entity.login : 'private-' + index + '-' + (node.createdAt || ''), 180),
    source: 'github', name: name, handle: isPrivate ? '' : sponsorBoundedText(entity.login, 80), private: isPrivate,
    recurring: isActive && !isOneTime, oneTime: isOneTime, amountMinor: isActive || isOneTime ? tierAmount : 0, currency: 'USD',
    tier: sponsorBoundedText(node.tier && node.tier.name, 160), since: sponsorBoundedText(node.createdAt, 40), status: isActive ? 'active' : 'inactive'
  };
}

async function githubLifetimeValues(login) {
  var values = {}; var after = ''; var page = 0; var connection;
  do {
    var response = page
      ? await Tapp.api('githubLifetimeNext', { login: login, after: after })
      : await Tapp.api('githubLifetimeFirst', { login: login });
    var payload = sponsorPayload(response);
    if (Array.isArray(payload.errors) && payload.errors.length) { throw new Error(payload.errors.map(function (item) { return item.message; }).join('; ')); }
    connection = payload.data && payload.data.user && payload.data.user.lifetimeReceivedSponsorshipValues;
    if (!connection) { break; }
    (connection.nodes || []).forEach(function (node) {
      var sponsor = node && node.sponsor;
      var sponsorLogin = sponsorText(sponsor && sponsor.login).trim().toLocaleLowerCase();
      if (sponsorLogin) { values[sponsorLogin] = sponsorMinor(node.amountInCents); }
    });
    after = connection.pageInfo && connection.pageInfo.endCursor;
    page += 1;
  } while (connection.pageInfo && connection.pageInfo.hasNextPage && after && page < 5);
  return values;
}

async function syncGithub(config) {
  var login = sponsorText(config.githubLogin).trim();
  if (!login) { throw new Error(sponsorTranslate('githubLoginMissing')); }
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(login)) { throw new Error(sponsorTranslate('githubLoginInvalid')); }
  var items = []; var after = ''; var page = 0; var connection = null;
  do {
    var response;
    if (page) { response = await Tapp.api('githubSponsorsNext', { login: login, after: after }); }
    else { response = await Tapp.api('githubSponsorsFirst', { login: login }); }
    var payload = sponsorPayload(response);
    if (Array.isArray(payload.errors) && payload.errors.length) { throw new Error(payload.errors.map(function (item) { return item.message; }).join('; ')); }
    connection = payload.data && payload.data.user && payload.data.user.sponsorshipsAsMaintainer;
    if (!connection) { throw new Error(sponsorTranslate('githubAccountUnavailable')); }
    items = items.concat((Array.isArray(connection.nodes) ? connection.nodes : []).map(function (node, index) { return normalizeGithubNode(node, items.length + index); }));
    after = connection.pageInfo && connection.pageInfo.endCursor;
    page += 1;
  } while (connection.pageInfo && connection.pageInfo.hasNextPage && after && page < 5);
  try {
    var lifetimeValues = await githubLifetimeValues(login);
    items.forEach(function (item) {
      var lifetime = item.private ? 0 : lifetimeValues[sponsorText(item.handle).toLocaleLowerCase()];
      if (Number.isFinite(lifetime) && lifetime > 0) { item.lifetimeMinor = lifetime; }
    });
  } catch (error) {
    // 累计金额是增强数据；权限不足或字段暂不可用时保留基础赞助名单。
  }
  return items;
}

function patreonUsers(payload) {
  var users = {};
  (payload.included || []).forEach(function (item) { if (item && item.type === 'user') { users[item.id] = item.attributes || {}; } });
  return users;
}
function normalizePatreonMember(item, users, currency) {
  var attributes = item.attributes || {};
  var relation = item.relationships && item.relationships.user && item.relationships.user.data;
  var user = relation && users[relation.id] || {};
  var isPrivate = !sponsorText(attributes.full_name || user.full_name).trim();
  return {
    id: 'patreon:' + sponsorBoundedText(item.id, 180), source: 'patreon',
    name: isPrivate ? '' : sponsorBoundedText(attributes.full_name || user.full_name, 120), handle: '', private: isPrivate,
    recurring: attributes.patron_status === 'active_patron', amountMinor: sponsorMinor(attributes.currently_entitled_amount_cents), currency: currency,
    tier: '', since: sponsorBoundedText(attributes.last_charge_date, 40), status: sponsorBoundedText(attributes.patron_status || 'unknown', 40),
    lifetimeMinor: sponsorMinor(attributes.campaign_lifetime_support_cents || attributes.lifetime_support_cents)
  };
}
async function syncPatreon(config) {
  var campaignResponse = await Tapp.api('patreonCampaigns', {});
  var campaignPayload = sponsorPayload(campaignResponse);
  if (Array.isArray(campaignPayload.errors) && campaignPayload.errors.length) { throw new Error(campaignPayload.errors.map(function (item) { return item.detail || item.title; }).join('; ')); }
  var campaigns = Array.isArray(campaignPayload.data) ? campaignPayload.data : [];
  if (!campaigns.length) { throw new Error(sponsorTranslate('patreonCampaignUnavailable')); }
  if (campaigns.length > 1) { throw new Error(sponsorTranslate('patreonCampaignAmbiguous', { count: campaigns.length })); }
  var campaignId = sponsorText(campaigns[0] && campaigns[0].id).trim();
  var currency = sponsorText(campaigns[0] && campaigns[0].attributes && campaigns[0].attributes.currency).trim().toUpperCase();
  if (!/^\d+$/.test(campaignId)) { throw new Error(sponsorTranslate('patreonCampaignUnavailable')); }
  if (!/^[A-Z]{3}$/.test(currency)) { throw new Error(sponsorTranslate('patreonCurrencyUnavailable')); }
  var items = []; var cursor = ''; var page = 0; var payload;
  do {
    var response;
    if (page) { response = await Tapp.api('patreonMembersNext', { campaignId: campaignId, cursor: encodeURIComponent(cursor) }); }
    else { response = await Tapp.api('patreonMembersFirst', { campaignId: campaignId }); }
    payload = sponsorPayload(response);
    if (Array.isArray(payload.errors) && payload.errors.length) { throw new Error(payload.errors.map(function (item) { return item.detail || item.title; }).join('; ')); }
    var users = patreonUsers(payload);
    items = items.concat((Array.isArray(payload.data) ? payload.data : []).map(function (item) { return normalizePatreonMember(item, users, currency); }));
    cursor = payload.meta && payload.meta.pagination && payload.meta.pagination.cursors && payload.meta.pagination.cursors.next;
    page += 1;
  } while (cursor && page < 5);
  return items;
}

function sponsorUnixDate(value) {
  var seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) { return ''; }
  var date = new Date(seconds * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}
function normalizeAfdianSponsor(item, index) {
  var user = item && item.user || {};
  var plan = item && item.current_plan || {};
  var hasPlan = Boolean(sponsorText(plan.name).trim());
  var oneTime = hasPlan && Number(plan.permanent) === 1;
  var amount = Number(plan.show_price || plan.price || 0);
  var userId = sponsorText(user.user_id).trim();
  return {
    id: 'afdian:' + sponsorBoundedText(userId || 'unknown-' + index, 180), source: 'afdian',
    name: sponsorBoundedText(user.name, 120), handle: sponsorBoundedText(userId, 128), private: false,
    recurring: hasPlan && !oneTime, oneTime: oneTime,
    amountMinor: sponsorMinor(Number.isFinite(amount) ? amount * 100 : 0), currency: 'CNY',
    tier: sponsorBoundedText(plan.name, 160), since: sponsorUnixDate(item.create_time || item.first_pay_time), lastSupportedAt: sponsorUnixDate(item.last_pay_time),
    status: hasPlan ? 'active' : 'inactive',
    lifetimeMinor: sponsorMinor((Number(item.all_sum_amount) || 0) * 100)
  };
}

async function syncAfdian(config) {
  var userId = sponsorText(config.afdianUserId).trim();
  if (!userId) { throw new Error(sponsorTranslate('afdianUserIdMissing')); }
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(userId)) { throw new Error(sponsorTranslate('afdianUserIdInvalid')); }
  var items = []; var page = 1; var totalPage = 1;
  do {
    var query = JSON.stringify({ page: page, per_page: 100 });
    var response = await Tapp.api('afdianSponsors', { query: query });
    var payload = sponsorPayload(response);
    if (Number(payload.ec) !== 200) { throw new Error(sponsorText(payload.em) || sponsorTranslate('afdianApiFailed', { code: payload.ec || 'unknown' })); }
    var data = payload.data || {};
    var list = Array.isArray(data.list) ? data.list : [];
    items = items.concat(list.map(function (item, index) { return normalizeAfdianSponsor(item, items.length + index); }));
    totalPage = Math.max(1, Number(data.total_page) || 1);
    page += 1;
  } while (page <= totalPage && page <= 50);
  return items;
}

async function sponsorSettings() {
  var settings = await Tapp.settings.getAll();
  return {
    githubLogin: settings.githubLogin || '', afdianUserId: settings.afdianUserId || '',
    showGithub: settings.showGithub !== false, showPatreon: settings.showPatreon !== false, showAfdian: settings.showAfdian !== false
  };
}
function applySponsorSettings(config) {
  sponsorsState.visibleSources = Object.keys(SPONSOR_SOURCES).filter(function (source) { return config[SPONSOR_SOURCE_SETTINGS[source]] !== false; });
  if (sponsorsState.filter !== 'all' && sponsorsState.visibleSources.indexOf(sponsorsState.filter) === -1) { sponsorsState.filter = 'all'; }
}
function previousItemsFor(source) { return ((sponsorsState.snapshot && sponsorsState.snapshot.supporters) || []).filter(function (item) { return item.source === source; }); }
function previousSourceFor(source) { return sponsorsState.snapshot && sponsorsState.snapshot.sources && sponsorsState.snapshot.sources[source]; }
async function syncSponsorSource(source, config, options) {
  options = options || {};
  var previousSource = previousSourceFor(source);
  if (source === 'patreon' && previousSource && previousSource.manualOnly && !options.manualPatreon) {
    return { source: source, status: 'paused', items: previousItemsFor(source), messageKey: 'patreonManualOnly', manualOnly: true };
  }
  try {
    var items = source === 'github' ? await syncGithub(config) : source === 'patreon' ? await syncPatreon(config) : await syncAfdian(config);
    return { source: source, status: 'ready', items: items, messageKey: 'syncedCount', messageParams: { count: items.length }, manualOnly: false };
  } catch (error) {
    var manualOnly = source === 'patreon' && sponsorIsReachabilityError(error);
    return { source: source, status: manualOnly ? 'paused' : 'error', items: previousItemsFor(source), message: manualOnly ? '' : sponsorError(error), messageKey: manualOnly ? 'patreonManualOnly' : '', manualOnly: manualOnly };
  }
}
async function syncSponsors(options) {
  options = options || {};
  var generation = ++sponsorsGeneration;
  if (sponsorsState.snapshot && sponsorsState.snapshot.demo === true) {
    sponsorsState.snapshot = null;
    await Tapp.storage.remove(SPONSORS_SNAPSHOT_KEY);
  }
  var config = await sponsorSettings();
  applySponsorSettings(config);
  var results = await Promise.all(sponsorsState.visibleSources.map(function (source) { return syncSponsorSource(source, config, options); }));
  if (generation !== sponsorsGeneration) { return sponsorsState.snapshot; }
  var resultBySource = {};
  results.forEach(function (result) { resultBySource[result.source] = result; });
  var supporters = Object.keys(SPONSOR_SOURCES).reduce(function (all, source) { return all.concat(resultBySource[source] ? resultBySource[source].items : previousItemsFor(source)); }, []);
  var sourceStates = {};
  Object.keys(SPONSOR_SOURCES).forEach(function (source) {
    var result = resultBySource[source];
    sourceStates[source] = result
      ? { status: result.status, message: result.message || '', messageKey: result.messageKey || '', messageParams: result.messageParams || null, count: result.items.length, manualOnly: Boolean(result.manualOnly) }
      : previousSourceFor(source) || { status: 'setup', messageKey: 'configureSource', count: previousItemsFor(source).length };
  });
  var candidate = {
    version: 1, updatedAt: Date.now(), supporters: supporters,
    sources: sourceStates
  };
  await Tapp.storage.set(SPONSORS_SNAPSHOT_KEY, candidate);
  if (generation === sponsorsGeneration) { sponsorsState.snapshot = candidate; }
  return candidate;
}

function sourceCardHtml(source) {
  var state = sponsorsState.snapshot && sponsorsState.snapshot.sources && sponsorsState.snapshot.sources[source.id];
  var status = state && state.status || (source.mode === 'bridge' ? 'bridge' : 'setup');
  var statusLabel = status === 'ready' ? sponsorTranslate('connected') : status === 'bridge' ? sponsorTranslate('bridgeNeeded') : status === 'paused' ? sponsorTranslate('manualOnly') : status === 'error' ? sponsorTranslate('attention') : sponsorTranslate('setupNeeded');
  var message = state && state.messageKey ? sponsorTranslate(state.messageKey, state.messageParams || {}) : state && state.message || (source.mode === 'bridge' ? sponsorTranslate(source.id + 'Bridge') : sponsorTranslate('configureSource'));
  var action = source.setupUrlId ? '<button class="source-credential-link" type="button" data-open-credential-url="' + sponsorEscape(source.setupUrlId) + '">' + sponsorEscape(sponsorTranslate('openCredentialPage')) + '<span aria-hidden="true">↗</span></button>' : '';
  return '<article class="source-card"><div class="source-card-head"><div class="source-name"><span class="source-mark" aria-hidden="true">' + source.mark + '</span><span>' + sponsorEscape(source.name) + '</span></div><span class="source-status ' + sponsorEscape(status) + '">' + sponsorEscape(statusLabel) + '</span></div><p>' + sponsorEscape(message) + '</p>' + action + '</article>';
}
function supporterCardHtml(item) {
  var displayName = sponsorDisplayName(item);
  var meta = SPONSOR_SOURCES[item.source].name + (item.tier ? ' · ' + item.tier : '') + (item.private ? ' · ' + sponsorTranslate('private') : '');
  var amount = item.recurring && item.amountMinor > 0 ? sponsorMoney(item.amountMinor, item.currency) : sponsorTranslate(item.recurring ? 'active' : item.oneTime ? 'oneTime' : 'inactive');
  return '<article class="supporter-card"><div class="supporter-avatar" aria-hidden="true">' + sponsorEscape(sponsorInitials(displayName)) + '</div><div class="supporter-main"><strong>' + sponsorEscape(displayName) + '</strong><span>' + sponsorEscape(meta) + '</span></div><div class="supporter-amount"><strong>' + sponsorEscape(amount) + '</strong><span>' + sponsorEscape(item.recurring ? sponsorTranslate('perMonth') : sponsorTranslate('support')) + '</span></div></article>';
}
function filteredSupporters() {
  var items = visibleSupporters();
  var query = sponsorsState.search.trim().toLocaleLowerCase();
  return items.filter(function (item) {
    if (sponsorsState.filter !== 'all' && item.source !== sponsorsState.filter) { return false; }
    return !query || [sponsorDisplayName(item), item.handle, item.source, SPONSOR_SOURCES[item.source].name].join(' ').toLocaleLowerCase().indexOf(query) !== -1;
  });
}
function visibleSupporters() {
  return ((sponsorsState.snapshot && sponsorsState.snapshot.supporters) || []).filter(function (item) { return SPONSOR_SOURCES[item.source] && sponsorsState.visibleSources.indexOf(item.source) !== -1; });
}
var SPONSOR_STAR_COLORS = { github: [196, 181, 253], patreon: [251, 113, 133], afdian: [103, 232, 249] };
var SPONSOR_NATURAL_STAR_COLORS = [[255, 244, 224], [232, 241, 255], [255, 255, 255], [221, 231, 255], [255, 229, 204]];
function sponsorHash(value) {
  var hash = 2166136261;
  var text = sponsorText(value);
  for (var index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
function sponsorStarValue(item) {
  var lifetime = Number(item && item.lifetimeMinor);
  return Number.isFinite(lifetime) && lifetime > 0 ? lifetime : Math.max(0, Number(item && item.amountMinor) || 0);
}
function sponsorStarLayout(items, width, height) {
  var maxLight = {}; var maxSize = {};
  items.forEach(function (item) {
    var currency = item.currency || 'XXX';
    maxLight[currency] = Math.max(maxLight[currency] || 0, sponsorStarValue(item));
    maxSize[currency] = Math.max(maxSize[currency] || 0, Math.max(0, Number(item.amountMinor) || 0));
  });
  return items.map(function (item, index) {
    var seed = sponsorHash(item.id || item.name || index);
    var currency = item.currency || 'XXX';
    var lightValue = sponsorStarValue(item);
    var sizeValue = Math.max(0, Number(item.amountMinor) || 0);
    var brightness = lightValue > 0 ? 0.34 + 0.66 * (Math.log1p(lightValue) / Math.max(1, Math.log1p(maxLight[currency] || lightValue))) : 0.24;
    var sizeRatio = sizeValue > 0 ? Math.log1p(sizeValue) / Math.max(1, Math.log1p(maxSize[currency] || sizeValue)) : 0;
    var baseX = 0.10 + (seed % 10000) / 10000 * 0.80;
    var baseY = 0.09 + ((seed >>> 12) % 10000) / 10000 * 0.79;
    var zoom = Math.max(0.8, Math.min(1.6, sponsorsState.zoom || 1));
    return {
      item: item,
      x: width / 2 + (baseX * width - width / 2) * zoom,
      y: height / 2 + (baseY * height - height / 2) * zoom,
      radius: 1.8 + sizeRatio * 3.9,
      brightness: brightness,
      color: SPONSOR_NATURAL_STAR_COLORS[(seed >>> 5) % SPONSOR_NATURAL_STAR_COLORS.length],
      platformColor: SPONSOR_STAR_COLORS[item.source] || [255, 255, 255]
    };
  });
}
function sponsorCelestialCoordinates(item) {
  var seed = sponsorHash(item && (item.id || item.name));
  var hours = seed % 24; var minutes = (seed >>> 5) % 60; var seconds = ((seed >>> 11) % 600) / 10;
  var positive = ((seed >>> 18) & 1) === 1; var degrees = (seed >>> 19) % 70; var arcMinutes = (seed >>> 25) % 60; var arcSeconds = ((seed >>> 7) % 600) / 10;
  return {
    rightAscension: String(hours).padStart(2, '0') + 'h ' + String(minutes).padStart(2, '0') + 'm ' + seconds.toFixed(1) + 's',
    declination: (positive ? '+' : '−') + String(degrees).padStart(2, '0') + '° ' + String(arcMinutes).padStart(2, '0') + '′ ' + arcSeconds.toFixed(1) + '″',
    magnitude: (5.8 - Math.log10(Math.max(1, sponsorStarValue(item))) * 0.72).toFixed(2)
  };
}
function sponsorStarDetailHtml(item) {
  if (!item) { return '<p class="section-kicker" id="cosmos-title">' + sponsorEscape(sponsorTranslate('deepFieldObservatory')) + '</p><strong>' + sponsorEscape(sponsorTranslate('selectStar')) + '</strong><p id="cosmos-instructions">' + sponsorEscape(sponsorTranslate('cosmosInstructions')) + '</p>'; }
  var lifetime = Number(item.lifetimeMinor) || 0;
  var lightLabel = lifetime > 0 ? sponsorTranslate('platformLifetime') : sponsorTranslate('availableAmount');
  var lightAmount = sponsorMoney(lifetime > 0 ? lifetime : item.amountMinor, item.currency);
  var currentAmount = Number(item.amountMinor) > 0 ? sponsorMoney(item.amountMinor, item.currency) : '—';
  var coordinates = sponsorCelestialCoordinates(item);
  var since = item.since ? new Date(item.since).toLocaleDateString(sponsorLocale()) : '—';
  var lightPosition = Math.round(12 + 76 * Math.min(1, Math.log1p(sponsorStarValue(item)) / 12));
  var platformColor = 'rgb(' + (SPONSOR_STAR_COLORS[item.source] || [255,255,255]).join(',') + ')';
  return '<p class="section-kicker" id="cosmos-title">' + sponsorEscape(sponsorTranslate('supporterObservation')) + '</p><strong>' + sponsorEscape(sponsorDisplayName(item)) + '</strong><div class="star-detail-platform" style="--platform-color:' + platformColor + '"><i></i>' + sponsorEscape(SPONSOR_SOURCES[item.source].name) + '</div><p id="cosmos-instructions">' + sponsorEscape(sponsorTranslate('starBrightnessHint')) + '</p><div class="star-detail-grid"><div class="star-detail-row"><span>' + sponsorEscape(sponsorTranslate('currentSupport')) + '</span><strong>' + sponsorEscape(currentAmount) + '</strong></div><div class="star-detail-row"><span>' + sponsorEscape(lightLabel) + '</span><strong>' + sponsorEscape(lightAmount) + '</strong></div><div class="star-detail-row"><span>' + sponsorEscape(sponsorTranslate('supportType')) + '</span><strong>' + sponsorEscape(sponsorTranslate(item.recurring ? 'active' : item.oneTime ? 'oneTime' : 'inactive')) + '</strong></div><div class="star-detail-row"><span>' + sponsorEscape(sponsorTranslate('firstLight')) + '</span><strong>' + sponsorEscape(since) + '</strong></div></div><div class="luminosity-scale"><span>' + sponsorEscape(sponsorTranslate('relativeLuminosity')) + '</span><div class="luminosity-track" style="--light-position:' + lightPosition + '%"><i></i></div></div><div class="coordinate-block"><div class="star-detail-row"><span>' + sponsorEscape(sponsorTranslate('rightAscension')) + '</span><strong>' + sponsorEscape(coordinates.rightAscension) + '</strong></div><div class="star-detail-row"><span>' + sponsorEscape(sponsorTranslate('declination')) + '</span><strong>' + sponsorEscape(coordinates.declination) + '</strong></div><div class="star-detail-row"><span>' + sponsorEscape(sponsorTranslate('visualMagnitude')) + '</span><strong>' + sponsorEscape(coordinates.magnitude) + '</strong></div></div>';
}

var sponsorWidgetGenerations = new Map();
var sponsorWidgetInstances = new Map();
var sponsorWidgetPaperUrl = '';
var sponsorWidgetPaperPromise = null;
function sponsorWidgetSetText(scope, selector, value) {
  scope.querySelectorAll(selector).forEach(function (node) { node.textContent = sponsorText(value); });
}
function sponsorWidgetLoadPaperTexture() {
  if (sponsorWidgetPaperUrl) { return Promise.resolve(sponsorWidgetPaperUrl); }
  if (sponsorWidgetPaperPromise) { return sponsorWidgetPaperPromise; }
  if (!Tapp.assets || typeof Tapp.assets.getUrl !== 'function') { return Promise.resolve(''); }
  sponsorWidgetPaperPromise = Tapp.assets.getUrl('assets/observatory-paper.png').then(function (asset) {
    sponsorWidgetPaperUrl = asset && asset.url || '';
    return sponsorWidgetPaperUrl;
  }).catch(function () { return ''; }).finally(function () { sponsorWidgetPaperPromise = null; });
  return sponsorWidgetPaperPromise;
}
function sponsorWidgetVisibleSources(config) {
  return Object.keys(SPONSOR_SOURCES).filter(function (source) { return config[SPONSOR_SOURCE_SETTINGS[source]] !== false; });
}
function sponsorWidgetItems(snapshot, sources) {
  var items = snapshot && Array.isArray(snapshot.supporters) ? snapshot.supporters : [];
  return items.filter(function (item) { return item && SPONSOR_SOURCES[item.source] && sources.indexOf(item.source) !== -1; });
}
function sponsorWidgetMonthlyAmount(items) {
  var totals = {};
  items.forEach(function (item) {
    if (!item.recurring || !(Number(item.amountMinor) > 0)) { return; }
    var currency = /^[A-Z]{3}$/.test(sponsorText(item.currency)) ? item.currency : 'XXX';
    totals[currency] = sponsorMinor((totals[currency] || 0) + Number(item.amountMinor));
  });
  var currencies = Object.keys(totals).sort();
  return currencies.length ? currencies.map(function (currency) { return sponsorMoney(totals[currency], currency); }).join(' · ') : '—';
}
function sponsorWidgetFocus(items) {
  return items.slice().sort(function (left, right) {
    var activeDifference = Number(Boolean(right.recurring)) - Number(Boolean(left.recurring));
    if (activeDifference) { return activeDifference; }
    return sponsorHash(left.id || left.name) - sponsorHash(right.id || right.name);
  })[0] || null;
}
function sponsorWidgetRenderPlatforms(scope, items, sources) {
  var target = scope.querySelector('[data-platforms]');
  if (!target) { return; }
  target.replaceChildren();
  sources.forEach(function (source) {
    var row = document.createElement('span');
    var marker = document.createElement('i');
    var color = SPONSOR_STAR_COLORS[source] || [255, 255, 255];
    marker.style.setProperty('--platform-color', 'rgb(' + color.join(',') + ')');
    row.appendChild(marker);
    row.appendChild(document.createTextNode(SPONSOR_SOURCES[source].mark + ' ' + items.filter(function (item) { return item.source === source; }).length));
    target.appendChild(row);
  });
}
function sponsorWidgetRenderStars(scope, items, size) {
  var canvas = scope.querySelector('canvas[data-starfield]');
  if (!canvas || typeof canvas.getContext !== 'function') { return; }
  var bounds = canvas.getBoundingClientRect();
  var width = Math.max(1, Math.round(bounds.width || (size === '2x2' ? 176 : size === '4x2' ? 272 : 270)));
  var height = Math.max(1, Math.round(bounds.height || (size === '2x2' ? 68 : size === '4x2' ? 142 : 330)));
  var density = Math.max(1, Math.min(2, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1));
  canvas.width = Math.round(width * density); canvas.height = Math.round(height * density);
  var context = canvas.getContext('2d');
  if (!context) { return; }
  context.setTransform(density, 0, 0, density, 0, 0);
  context.clearRect(0, 0, width, height);
  var marginX = size === '2x2' ? 10 : size === '4x4' ? 22 : 16; var marginY = size === '2x2' ? 8 : 16;
  var plotWidth = Math.max(1, width - marginX * 2); var plotHeight = Math.max(1, height - marginY * 2);
  var columns = size === '4x4' ? 8 : 6; var rows = 4;
  context.lineWidth = 0.8;
  context.strokeStyle = 'rgba(232,221,200,.25)';
  for (var column = 0; column <= columns; column += 1) {
    var gridX = marginX + plotWidth * column / columns;
    context.beginPath(); context.moveTo(gridX, marginY); context.lineTo(gridX, marginY + plotHeight); context.stroke();
  }
  for (var rowIndex = 0; rowIndex <= rows; rowIndex += 1) {
    var gridY = marginY + plotHeight * rowIndex / rows;
    context.beginPath(); context.moveTo(marginX, gridY); context.lineTo(marginX + plotWidth, gridY); context.stroke();
  }
  if (size !== '2x2') {
    context.fillStyle = 'rgba(245,235,216,.8)';
    context.font = Math.max(8, 9 * Number(scope.style.getPropertyValue('--sponsor-widget-font-scale') || 1)) + 'px Consolas, monospace';
    context.textAlign = 'center'; context.textBaseline = 'top';
    for (var hour = 0; hour <= columns; hour += 1) { context.fillText(String(hour + 1).padStart(2, '0') + 'h', marginX + plotWidth * hour / columns, 2); }
    if (size === '4x4') {
      context.textAlign = 'left'; context.textBaseline = 'middle';
      for (var degree = 0; degree <= rows; degree += 1) { context.fillText('+' + String((rows - degree) * 10) + '°', 2, marginY + plotHeight * degree / rows); }
    }
  }
  var limit = size === '4x4' ? 20 : size === '4x2' ? 9 : 1;
  var maxByCurrency = {};
  items.forEach(function (item) {
    var currency = item.currency || 'XXX';
    maxByCurrency[currency] = Math.max(maxByCurrency[currency] || 0, sponsorStarValue(item));
  });
  var plotted = items.slice().sort(function (left, right) {
    var leftCurrency = left.currency || 'XXX'; var rightCurrency = right.currency || 'XXX';
    var leftRatio = Math.log1p(sponsorStarValue(left)) / Math.max(1, Math.log1p(maxByCurrency[leftCurrency] || 1));
    var rightRatio = Math.log1p(sponsorStarValue(right)) / Math.max(1, Math.log1p(maxByCurrency[rightCurrency] || 1));
    return rightRatio - leftRatio || sponsorHash(left.id || left.name) - sponsorHash(right.id || right.name);
  }).slice(0, limit).map(function (item, index) {
    var seed = sponsorHash(item.id || item.name || index);
    var currency = item.currency || 'XXX';
    var ratio = Math.log1p(sponsorStarValue(item)) / Math.max(1, Math.log1p(maxByCurrency[currency] || 1));
    return {
      item: item,
      x: marginX + plotWidth * (0.08 + (seed % 8400) / 10000),
      y: marginY + plotHeight * (0.09 + ((seed >>> 11) % 8200) / 10000),
      radius: 1.8 + ratio * (size === '4x4' ? 4.6 : size === '4x2' ? 3.6 : 2.8),
      brightness: 0.38 + ratio * 0.62
    };
  });
  if (plotted.length > 1) {
    context.strokeStyle = 'rgba(232,218,193,.28)'; context.lineWidth = 0.9;
    context.beginPath();
    plotted.slice().sort(function (left, right) { return left.x - right.x; }).forEach(function (star, index) { if (index) { context.lineTo(star.x, star.y); } else { context.moveTo(star.x, star.y); } });
    context.stroke();
  }
  if (!plotted.length) {
    context.fillStyle = 'rgba(242,231,211,.68)';
    context.font = Math.max(9, 11 * Number(scope.style.getPropertyValue('--sponsor-widget-font-scale') || 1)) + 'px "Microsoft YaHei", sans-serif';
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(sponsorTranslate('widgetEmpty'), width / 2, height / 2);
  }
  var focus = sponsorWidgetFocus(items);
  plotted.forEach(function (star, index) {
    context.save();
    context.globalAlpha = star.brightness;
    context.fillStyle = '#f4ead7'; context.shadowColor = '#fff4dc'; context.shadowBlur = star.radius * 3.4;
    context.beginPath(); context.arc(star.x, star.y, star.radius, 0, Math.PI * 2); context.fill();
    context.shadowBlur = 0; context.strokeStyle = 'rgba(246,235,215,.72)'; context.lineWidth = 0.55;
    context.beginPath(); context.moveTo(star.x - star.radius * 3.1, star.y); context.lineTo(star.x + star.radius * 3.1, star.y); context.moveTo(star.x, star.y - star.radius * 2.4); context.lineTo(star.x, star.y + star.radius * 2.4); context.stroke();
    context.restore();
    if (focus && star.item === focus) {
      context.strokeStyle = getComputedStyle(scope).getPropertyValue('--registration').trim() || '#a94f3f'; context.lineWidth = 1;
      context.beginPath(); context.arc(star.x, star.y, star.radius + 5, 0, Math.PI * 2); context.stroke();
    }
    if (size === '4x4') {
      context.fillStyle = 'rgba(247,235,213,.9)'; context.font = '10px Consolas, monospace'; context.textAlign = 'left'; context.textBaseline = 'middle';
      context.fillText('S' + String(index + 1), star.x + star.radius + 5, star.y);
    }
  });
}
async function renderSponsorWidget(container, props) {
  var generation = (sponsorWidgetGenerations.get(container) || 0) + 1;
  sponsorWidgetGenerations.set(container, generation);
  sponsorWidgetInstances.set(container, Object.assign({}, props || {}));
  var results = await Promise.all([
    Tapp.storage.get(SPONSORS_SNAPSHOT_KEY).catch(function () { return null; }),
    sponsorSettings().catch(function () { return { showGithub: true, showPatreon: true, showAfdian: true }; }),
    sponsorWidgetLoadPaperTexture()
  ]);
  if (generation !== sponsorWidgetGenerations.get(container)) { return; }
  var scope = container.querySelector('[data-widget-root]') || container;
  var snapshot = results[0]; var sources = sponsorWidgetVisibleSources(results[1]); var items = sponsorWidgetItems(snapshot, sources);
  var size = props && props.size || '4x2'; var theme = props && props.theme || 'light';
  var locale = sponsorLocale() || props && props.locale || 'zh-CN';
  var amount = sponsorWidgetMonthlyAmount(items); var focus = sponsorWidgetFocus(items);
  scope.dataset.size = size; scope.dataset.theme = theme;
  scope.setAttribute('lang', locale);
  scope.style.setProperty('--sponsor-widget-scale', String(props && props.scale || 1));
  scope.style.setProperty('--sponsor-widget-font-scale', String(props && props.fontScale || 1));
  if (results[2]) { scope.style.setProperty('--observatory-paper', 'url("' + results[2] + '")'); }
  scope.querySelectorAll('[data-i18n]').forEach(function (node) { node.textContent = sponsorTranslate(node.dataset.i18n); });
  sponsorWidgetSetText(scope, '[data-supporter-count]', items.length);
  sponsorWidgetSetText(scope, '[data-monthly-amount]', amount);
  sponsorWidgetSetText(scope, '[data-brightest-name]', focus ? sponsorDisplayName(focus) : '—');
  sponsorWidgetSetText(scope, '[data-brightest-amount]', focus ? sponsorMoney(sponsorStarValue(focus), focus.currency) : '—');
  var coordinates = focus ? sponsorCelestialCoordinates(focus) : null;
  sponsorWidgetSetText(scope, '[data-coordinate]', coordinates ? 'RA ' + coordinates.rightAscension + ' · DEC ' + coordinates.declination : 'RA — · DEC —');
  var updatedAt = snapshot && Number(snapshot.updatedAt);
  var updatedText = updatedAt ? sponsorTranslate('updatedAt', { time: size === '2x2' ? new Date(updatedAt).toLocaleDateString(locale) : new Date(updatedAt).toLocaleString(locale) }) : sponsorTranslate('neverSynced');
  sponsorWidgetSetText(scope, '[data-updated-at]', updatedText);
  sponsorWidgetRenderPlatforms(scope, items, sources);
  sponsorWidgetRenderStars(scope, items, size);
  scope.setAttribute('aria-label', sponsorTranslate('widgetSummary', { count: items.length, amount: amount, name: focus ? sponsorDisplayName(focus) : '—' }));
}
function drawSponsorBackground(context, width, height) {
  context.fillStyle = '#05070d'; context.fillRect(0, 0, width, height);
  var image = sponsorsState.cosmosImage;
  if (image && image.naturalWidth) {
    var scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * (1.01 + sponsorsState.depth * 0.012 + (sponsorsState.zoom - 1) * 0.05);
    var drawWidth = image.naturalWidth * scale; var drawHeight = image.naturalHeight * scale;
    var shiftX = sponsorsState.pointerX * 10; var shiftY = sponsorsState.pointerY * 8;
    context.globalAlpha = 0.64 + sponsorsState.depth * 0.035;
    context.drawImage(image, (width - drawWidth) / 2 + shiftX, (height - drawHeight) / 2 + shiftY, drawWidth, drawHeight);
    context.globalAlpha = 1;
  } else {
    for (var dustIndex = 0; dustIndex < 260; dustIndex += 1) {
      var dustSeed = sponsorHash('dust-' + dustIndex);
      context.fillStyle = 'rgba(255,255,255,' + (0.08 + (dustSeed % 8) / 100) + ')';
      context.beginPath(); context.arc((dustSeed % 1000) / 1000 * width, ((dustSeed >>> 10) % 1000) / 1000 * height, 0.35 + (dustSeed % 3) * 0.18, 0, Math.PI * 2); context.fill();
    }
  }
}
function drawSponsorCoordinateGrid(context, width, height) {
  context.save(); context.strokeStyle = 'rgba(205,218,235,.11)'; context.lineWidth = 0.65;
  [-0.22, 0.18, 0.58].forEach(function (offset) { context.beginPath(); context.ellipse(width / 2, height * (0.49 + offset), width * 0.62, height * 0.26, 0, 0, Math.PI * 2); context.stroke(); });
  [0.18, 0.38, 0.62, 0.82].forEach(function (position) { context.beginPath(); context.moveTo(width * position, 0); context.bezierCurveTo(width * (position - 0.08), height * 0.34, width * (position + 0.07), height * 0.69, width * position, height); context.stroke(); });
  context.restore();
}
function drawSponsorCosmos(canvas, layout, time) {
  var context = canvas.getContext && canvas.getContext('2d');
  if (!context) { return; }
  var width = Number(canvas.dataset.cssWidth) || 1; var height = Number(canvas.dataset.cssHeight) || 1;
  context.setTransform(Number(canvas.dataset.pixelRatio) || 1, 0, 0, Number(canvas.dataset.pixelRatio) || 1, 0, 0);
  context.clearRect(0, 0, width, height); drawSponsorBackground(context, width, height); drawSponsorCoordinateGrid(context, width, height);
  layout.forEach(function (star) {
    if (star.x < -30 || star.x > width + 30 || star.y < -30 || star.y > height + 30) { return; }
    var selected = sponsorsState.selectedStarId === star.item.id;
    var pulse = star.item.recurring ? 0.97 + Math.sin(time / 1100 + (sponsorHash(star.item.id) % 10)) * 0.03 : 1;
    var radius = star.radius * pulse;
    var color = star.color.join(',');
    var glow = context.createRadialGradient(star.x, star.y, 0, star.x, star.y, radius * (selected ? 6.6 : 5));
    glow.addColorStop(0, 'rgba(255,255,255,' + Math.min(1, star.brightness + 0.25) + ')');
    glow.addColorStop(0.08, 'rgba(' + color + ',' + star.brightness + ')');
    glow.addColorStop(1, 'rgba(' + color + ',0)');
    context.fillStyle = glow; context.beginPath(); context.arc(star.x, star.y, radius * (selected ? 6.6 : 5), 0, Math.PI * 2); context.fill();
    if (radius > 4) { context.strokeStyle = 'rgba(' + color + ',' + (0.22 + star.brightness * 0.26) + ')'; context.lineWidth = 0.7; context.beginPath(); context.moveTo(star.x - radius * 5, star.y); context.lineTo(star.x + radius * 5, star.y); context.moveTo(star.x, star.y - radius * 5); context.lineTo(star.x, star.y + radius * 5); context.stroke(); }
    context.fillStyle = 'rgba(255,255,255,' + Math.min(1, star.brightness + 0.2) + ')'; context.beginPath(); context.arc(star.x, star.y, Math.max(1.2, radius), 0, Math.PI * 2); context.fill();
    context.fillStyle = 'rgb(' + star.platformColor.join(',') + ')'; context.beginPath(); context.arc(star.x + radius + 3.5, star.y + radius + 3.5, 1.5, 0, Math.PI * 2); context.fill();
    if (selected) {
      var arm = radius + 13; var gap = radius + 6; context.strokeStyle = 'rgba(255,255,255,.88)'; context.lineWidth = 1;
      context.beginPath(); context.moveTo(star.x - arm, star.y); context.lineTo(star.x - gap, star.y); context.moveTo(star.x + gap, star.y); context.lineTo(star.x + arm, star.y); context.moveTo(star.x, star.y - arm); context.lineTo(star.x, star.y - gap); context.moveTo(star.x, star.y + gap); context.lineTo(star.x, star.y + arm); context.stroke();
    }
  });
}
function renderSponsorCosmos(root) {
  if (sponsorsCosmosFrame && typeof cancelAnimationFrame === 'function') { cancelAnimationFrame(sponsorsCosmosFrame); sponsorsCosmosFrame = 0; }
  var canvas = root.querySelector('[data-field="cosmos-canvas"]'); var stage = root.querySelector('[data-field="cosmos-stage"]');
  var items = filteredSupporters(); var rect = stage.getBoundingClientRect(); var width = Math.max(280, Math.round(rect.width)); var height = Math.max(320, Math.round(rect.height));
  var ratio = Math.min(1.5, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); canvas.dataset.cssWidth = width; canvas.dataset.cssHeight = height; canvas.dataset.pixelRatio = ratio;
  sponsorsState.starLayout = sponsorStarLayout(items, width, height);
  if (!items.some(function (item) { return item.id === sponsorsState.selectedStarId; })) { sponsorsState.selectedStarId = items.length ? items.slice().sort(function (a, b) { return sponsorStarValue(b) - sponsorStarValue(a); })[0].id : ''; }
  root.querySelector('[data-field="cosmos-empty"]').hidden = items.length > 0;
  root.querySelector('[data-field="cosmos-empty"]').textContent = items.length ? '' : sponsorTranslate('cosmosEmpty');
  var selected = items.find(function (item) { return item.id === sponsorsState.selectedStarId; });
  root.querySelector('[data-field="star-detail"]').innerHTML = sponsorStarDetailHtml(selected);
  root.querySelector('[data-field="zoom-level"]').textContent = Math.round(sponsorsState.zoom * 100) + '%';
  root.querySelector('[data-field="depth-level"]').textContent = sponsorsState.depth + ' / 7';
  var selectedStar = sponsorsState.starLayout.find(function (star) { return selected && star.item.id === selected.id; });
  var floatingLabel = root.querySelector('[data-field="star-floating-label"]');
  floatingLabel.hidden = !selectedStar;
  if (selectedStar) {
    floatingLabel.innerHTML = '<strong>' + sponsorEscape(sponsorDisplayName(selected)) + '</strong><span>' + sponsorEscape(sponsorTranslate('observedLight', { amount: sponsorMoney(sponsorStarValue(selected), selected.currency) })) + '</span>';
    var labelX = Math.min(width - 200, Math.max(12, selectedStar.x + 18)); var labelY = Math.min(height - 72, Math.max(12, selectedStar.y + 18));
    floatingLabel.style.transform = 'translate(' + Math.round(labelX) + 'px,' + Math.round(labelY) + 'px)';
  }
  var reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var animated = sponsorsState.animationEnabled && !sponsorsState.paused && !reduced && items.some(function (item) { return item.recurring; }) && typeof requestAnimationFrame === 'function';
  function paint(now) { drawSponsorCosmos(canvas, sponsorsState.starLayout, now || 0); if (animated && sponsorsState.view === 'cosmos' && typeof document !== 'undefined' && document.documentElement.contains(canvas)) { sponsorsCosmosFrame = requestAnimationFrame(paint); } }
  paint(0);
}
async function loadSponsorCosmosImage() {
  if (!Tapp.assets || typeof Tapp.assets.getUrl !== 'function' || typeof Image === 'undefined') { return null; }
  var asset = await Tapp.assets.getUrl('assets/deep-field-observatory.png'); var url = asset && asset.url;
  if (!url) { return null; }
  return new Promise(function (resolve) {
    var image = new Image();
    image.onload = function () { sponsorsState.cosmosImage = image; sponsorsState.cosmosImageUrl = url; resolve(image); };
    image.onerror = function () { if (Tapp.assets && typeof Tapp.assets.revoke === 'function') { try { Tapp.assets.revoke(url); } catch (error) {} } resolve(null); };
    image.src = url;
  });
}
function renderSponsorsPage(root) {
  if (!root) { return; }
  root.querySelectorAll('[data-i18n]').forEach(function (element) { element.textContent = sponsorTranslate(element.getAttribute('data-i18n')); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(function (element) { element.placeholder = sponsorTranslate(element.getAttribute('data-i18n-placeholder')); });
  root.querySelectorAll('[data-i18n-aria-label]').forEach(function (element) { element.setAttribute('aria-label', sponsorTranslate(element.getAttribute('data-i18n-aria-label'))); });
  var snapshot = sponsorsState.snapshot; var supporters = visibleSupporters();
  root.querySelector('[data-field="supporter-count"]').textContent = String(supporters.length);
  root.querySelector('[data-field="updated-at"]').textContent = snapshot ? sponsorTranslate('updatedAt', { time: new Date(snapshot.updatedAt).toLocaleString(sponsorLocale()) }) : sponsorTranslate('neverSynced');
  root.querySelector('[data-field="source-grid"]').innerHTML = sponsorsState.visibleSources.map(function (key) { return sourceCardHtml(SPONSOR_SOURCES[key]); }).join('');
  var totals = {};
  supporters.filter(function (item) { return item.recurring && item.amountMinor > 0; }).forEach(function (item) { totals[item.currency] = (totals[item.currency] || 0) + item.amountMinor; });
  var amountKeys = Object.keys(totals);
  root.querySelector('[data-field="amounts"]').innerHTML = amountKeys.length ? amountKeys.map(function (currency) { return '<strong>' + sponsorEscape(sponsorMoney(totals[currency], currency)) + '</strong>'; }).join('') : '<strong>—</strong>';
  root.querySelector('[data-field="active-source-count"]').textContent = String(sponsorsState.visibleSources.length);
  root.querySelector('[data-field="active-source-hint"]').textContent = sponsorsState.visibleSources.length ? sponsorsState.visibleSources.map(function (key) { return SPONSOR_SOURCES[key].name; }).join(' · ') : sponsorTranslate('noVisibleSources');
  var filters = ['all'].concat(sponsorsState.visibleSources);
  root.querySelector('[data-field="filters"]').innerHTML = filters.map(function (id) { var label = id === 'all' ? sponsorTranslate('all') : SPONSOR_SOURCES[id].name; return '<button class="filter-button" type="button" data-filter="' + id + '" aria-pressed="' + (sponsorsState.filter === id ? 'true' : 'false') + '">' + sponsorEscape(label) + '</button>'; }).join('');
  var visible = filteredSupporters();
  var noSources = sponsorsState.visibleSources.length === 0;
  root.querySelector('[data-field="supporter-list"]').innerHTML = visible.length ? visible.map(supporterCardHtml).join('') : '<div class="empty-state"><div><strong>' + sponsorEscape(noSources ? sponsorTranslate('noVisibleSources') : supporters.length ? sponsorTranslate('noMatches') : sponsorTranslate('emptyTitle')) + '</strong><p>' + sponsorEscape(noSources ? sponsorTranslate('enableSourceHint') : supporters.length ? sponsorTranslate('noMatchesHint') : sponsorTranslate('emptyHint')) + '</p></div></div>';
  var failures = snapshot && sponsorsState.visibleSources.filter(function (key) { return snapshot.sources && snapshot.sources[key] && snapshot.sources[key].status === 'error'; }).map(function (key) { return SPONSOR_SOURCES[key].name + ': ' + snapshot.sources[key].message; });
  var notices = failures || [];
  var notice = root.querySelector('[data-field="notice"]'); notice.hidden = !notices.length; notice.textContent = notices.join(' · ');
  root.querySelectorAll('[data-view]').forEach(function (button) { button.setAttribute('aria-pressed', sponsorsState.view === button.getAttribute('data-view') ? 'true' : 'false'); });
  root.querySelector('[data-field="cosmos-view"]').hidden = sponsorsState.view !== 'cosmos';
  root.querySelector('[data-field="supporter-list"]').hidden = sponsorsState.view !== 'list';
  if (sponsorsState.view === 'cosmos') { renderSponsorCosmos(root); }
  else if (sponsorsCosmosFrame && typeof cancelAnimationFrame === 'function') { cancelAnimationFrame(sponsorsCosmosFrame); sponsorsCosmosFrame = 0; }
}

async function initSponsorsPage(root) {
  if (!root || root.getAttribute('data-page-ready') === 'true') { return; }
  root.setAttribute('data-page-ready', 'true');
  var controller = new AbortController(); var signal = controller.signal;
  var syncButton = root.querySelector('[data-action="sync"]');
  function setActionsBusy(busy) {
    syncButton.disabled = busy; syncButton.setAttribute('aria-busy', busy ? 'true' : 'false');
  }
  syncButton.addEventListener('click', async function () {
    setActionsBusy(true);
    try { await syncSponsors({ manualPatreon: true }); renderSponsorsPage(root); }
    catch (error) { var notice = root.querySelector('[data-field="notice"]'); notice.hidden = false; notice.textContent = sponsorError(error); }
    finally { if (!signal.aborted) { setActionsBusy(false); } }
  }, { signal: signal });
  root.querySelector('[data-field="filters"]').addEventListener('click', function (event) { var button = event.target.closest('[data-filter]'); if (!button) { return; } sponsorsState.filter = button.getAttribute('data-filter'); renderSponsorsPage(root); }, { signal: signal });
  root.querySelector('.view-switch').addEventListener('click', function (event) { var button = event.target.closest('[data-view]'); if (!button) { return; } sponsorsState.view = button.getAttribute('data-view'); renderSponsorsPage(root); }, { signal: signal });
  root.querySelector('[data-field="source-grid"]').addEventListener('click', async function (event) {
    var button = event.target.closest('[data-open-credential-url]');
    if (!button) { return; }
    button.disabled = true; button.setAttribute('aria-busy', 'true');
    try { await Tapp.ui.openUrl({ id: button.getAttribute('data-open-credential-url') }); }
    catch (error) { var notice = root.querySelector('[data-field="notice"]'); notice.hidden = false; notice.textContent = sponsorTranslate('openCredentialPageFailed'); }
    finally { button.disabled = false; button.setAttribute('aria-busy', 'false'); }
  }, { signal: signal });
  root.querySelector('[data-field="search"]').addEventListener('input', function (event) { sponsorsState.search = event.target.value || ''; renderSponsorsPage(root); }, { signal: signal });
  root.querySelector('.observatory-controls').addEventListener('click', function (event) {
    var button = event.target.closest('[data-zoom]'); if (!button) { return; }
    var direction = button.getAttribute('data-zoom') === 'in' ? 1 : -1;
    sponsorsState.zoom = Math.max(0.8, Math.min(1.6, Math.round((sponsorsState.zoom + direction * 0.2) * 10) / 10));
    renderSponsorCosmos(root);
  }, { signal: signal });
  root.querySelector('[data-field="depth"]').addEventListener('input', function (event) { sponsorsState.depth = Math.max(1, Math.min(7, Number(event.target.value) || 3)); renderSponsorCosmos(root); }, { signal: signal });
  var cosmosCanvas = root.querySelector('[data-field="cosmos-canvas"]');
  cosmosCanvas.addEventListener('click', function (event) {
    var rect = cosmosCanvas.getBoundingClientRect(); var x = event.clientX - rect.left; var y = event.clientY - rect.top;
    var nearest = sponsorsState.starLayout.map(function (star) { return { star: star, distance: Math.hypot(star.x - x, star.y - y) }; }).sort(function (a, b) { return a.distance - b.distance; })[0];
    if (nearest && nearest.distance <= nearest.star.radius + 12) { sponsorsState.selectedStarId = nearest.star.item.id; renderSponsorCosmos(root); }
  }, { signal: signal });
  cosmosCanvas.addEventListener('pointermove', function (event) {
    var rect = cosmosCanvas.getBoundingClientRect(); var x = event.clientX - rect.left; var y = event.clientY - rect.top;
    sponsorsState.pointerX = (x / Math.max(1, rect.width) - 0.5) * -1; sponsorsState.pointerY = (y / Math.max(1, rect.height) - 0.5) * -1;
    cosmosCanvas.style.cursor = sponsorsState.starLayout.some(function (star) { return Math.hypot(star.x - x, star.y - y) <= star.radius + 10; }) ? 'pointer' : 'crosshair';
  }, { signal: signal });
  cosmosCanvas.addEventListener('pointerleave', function () { sponsorsState.pointerX = 0; sponsorsState.pointerY = 0; }, { signal: signal });
  cosmosCanvas.addEventListener('keydown', function (event) {
    if (!/^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown)$/.test(event.key) || !sponsorsState.starLayout.length) { return; }
    event.preventDefault(); var current = sponsorsState.starLayout.findIndex(function (star) { return star.item.id === sponsorsState.selectedStarId; });
    var direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    var next = (current + direction + sponsorsState.starLayout.length) % sponsorsState.starLayout.length;
    sponsorsState.selectedStarId = sponsorsState.starLayout[next].item.id; renderSponsorCosmos(root);
  }, { signal: signal });
  if (typeof window !== 'undefined') { window.addEventListener('resize', function () { if (sponsorsState.view === 'cosmos') { renderSponsorCosmos(root); } }, { signal: signal }); }
  var offStorage = Tapp.storage.onChanged(function (event) { if (event && event.key === SPONSORS_SNAPSHOT_KEY) { Tapp.storage.get(SPONSORS_SNAPSHOT_KEY).then(function (snapshot) { if (!signal.aborted && root.isConnected) { sponsorsState.snapshot = snapshot || null; renderSponsorsPage(root); } }).catch(function () {}); } });
  var offLocale = Tapp.ui && typeof Tapp.ui.onLocaleChange === 'function' ? Tapp.ui.onLocaleChange(function () { if (root.isConnected) { renderSponsorsPage(root); } }) : null;
  var offTheme = Tapp.ui && typeof Tapp.ui.onThemeChange === 'function' ? Tapp.ui.onThemeChange(function (theme) { if (root.isConnected) { sponsorApplyTheme(root, theme); } }) : null;
  var offAnimation = Tapp.animation && typeof Tapp.animation.onLevelChange === 'function' ? Tapp.animation.onLevelChange(function (level) { sponsorsState.animationEnabled = level !== 'none'; if (root.isConnected) { renderSponsorsPage(root); } }) : null;
  Tapp.lifecycle.onPause(function () { sponsorsState.paused = true; if (sponsorsCosmosFrame && typeof cancelAnimationFrame === 'function') { cancelAnimationFrame(sponsorsCosmosFrame); sponsorsCosmosFrame = 0; } });
  Tapp.lifecycle.onResume(function () { sponsorsState.paused = false; if (root.isConnected && sponsorsState.view === 'cosmos') { renderSponsorCosmos(root); } });
  Tapp.lifecycle.onDestroy(function () { sponsorsGeneration += 1; controller.abort(); if (sponsorsCosmosFrame && typeof cancelAnimationFrame === 'function') { cancelAnimationFrame(sponsorsCosmosFrame); sponsorsCosmosFrame = 0; } if (offStorage) { offStorage(); } if (offLocale) { offLocale(); } if (offTheme) { offTheme(); } if (typeof offAnimation === 'function') { offAnimation(); } if (sponsorsState.cosmosImageUrl && Tapp.assets && typeof Tapp.assets.revoke === 'function') { try { Tapp.assets.revoke(sponsorsState.cosmosImageUrl); } catch (error) {} } sponsorsState.cosmosImage = null; sponsorsState.cosmosImageUrl = ''; });
  var animationPromise = Tapp.animation && typeof Tapp.animation.shouldAnimate === 'function' ? Tapp.animation.shouldAnimate().catch(function () { return true; }) : Promise.resolve(true);
  var themePromise = Tapp.ui && typeof Tapp.ui.getTheme === 'function' ? Tapp.ui.getTheme().catch(function () { return 'light'; }) : Promise.resolve('light');
  var cosmosImagePromise = loadSponsorCosmosImage().catch(function () { return null; });
  var initialState = await Promise.all([Tapp.storage.get(SPONSORS_SNAPSHOT_KEY), sponsorSettings(), animationPromise, themePromise, cosmosImagePromise]);
  if (signal.aborted || !root.isConnected) { return; }
  var storedSnapshot = initialState[0];
  if (storedSnapshot && storedSnapshot.demo === true) {
    await Tapp.storage.remove(SPONSORS_SNAPSHOT_KEY);
    storedSnapshot = null;
  }
  if (signal.aborted || !root.isConnected) { return; }
  sponsorsState.snapshot = storedSnapshot;
  applySponsorSettings(initialState[1]);
  sponsorsState.animationEnabled = initialState[2] !== false;
  sponsorApplyTheme(root, initialState[3]);
  renderSponsorsPage(root);
}

if (Tapp.widgets) {
  Tapp.widgets['sponsor-glance'] = { render: renderSponsorWidget };
  var offSponsorWidgetLocale = Tapp.ui && typeof Tapp.ui.onLocaleChange === 'function' ? Tapp.ui.onLocaleChange(function (locale) {
    sponsorWidgetInstances.forEach(function (props, container) { if (container && container.isConnected) { renderSponsorWidget(container, Object.assign({}, props, { locale: locale })); } });
  }) : null;
  var offSponsorWidgetTheme = Tapp.ui && typeof Tapp.ui.onThemeChange === 'function' ? Tapp.ui.onThemeChange(function (theme) {
    sponsorWidgetInstances.forEach(function (props, container) {
      if (container && container.isConnected) { renderSponsorWidget(container, Object.assign({}, props, { theme: theme === 'dark' ? 'dark' : 'light' })); }
    });
  }) : null;
  Tapp.lifecycle.onDestroy(function () {
    sponsorWidgetInstances.clear(); sponsorWidgetGenerations.clear();
    if (typeof offSponsorWidgetLocale === 'function') { offSponsorWidgetLocale(); }
    if (typeof offSponsorWidgetTheme === 'function') { offSponsorWidgetTheme(); }
    if (sponsorWidgetPaperUrl && Tapp.assets && typeof Tapp.assets.revoke === 'function') { try { Tapp.assets.revoke(sponsorWidgetPaperUrl); } catch (error) {} }
    sponsorWidgetPaperUrl = ''; sponsorWidgetPaperPromise = null;
  });
}

if (Tapp.pages) {
  Tapp.pages['sponsor-roster'] = { render: function (container) { return initSponsorsPage(container || document.querySelector('[data-page-root]')); } };
  Tapp.lifecycle.onReady(function () { var root = typeof document !== 'undefined' && document.querySelector('[data-page-root]'); if (root) { initSponsorsPage(root); } });
}
