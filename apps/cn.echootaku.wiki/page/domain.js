'use strict';

const HARD_VALUE_BYTES = 1024 * 1024;
const OWNER_QUOTA_BYTES = 8 * 1024 * 1024;
const SOFT_BUDGET_BYTES = 6 * 1024 * 1024;
const MAX_ARTICLE_BYTES = 768 * 1024;
const MAX_ARTICLES = 800;

function utf8Bytes(value) {
  var text = typeof value === 'string' ? value : JSON.stringify(value);
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  return encodeURIComponent(text).replace(/%[0-9A-F]{2}|./gi, 'x').length;
}

function cleanString(value, max) {
  var result = String(value == null ? '' : value).trim();
  return typeof max === 'number' ? result.slice(0, max) : result;
}

function resolveRoleUi(role) {
  var resolved = !!(role && role.resolved);
  return {
    canRead: true,
    canManage: resolved && !!role.isAdmin,
    showPending: !resolved,
  };
}

function sanitizeExternalUrl(input) {
  try {
    var parsed = new URL(String(input || '').trim());
    if (parsed.protocol !== 'https:') return '';
    if (!parsed.hostname || parsed.username || parsed.password) return '';
    return parsed.href;
  } catch (_error) {
    return '';
  }
}

function validateMediaUrl(input) {
  var url = sanitizeExternalUrl(input);
  if (!url) return { ok: false, reason: 'https-only' };
  var pathname;
  try { pathname = new URL(url).pathname.toLowerCase(); } catch (_error) { return { ok: false, reason: 'invalid' }; }
  if (/\.(?:avif|gif|jpe?g|png|svg|webp)$/.test(pathname)) {
    return { ok: true, kind: 'image', url: url };
  }
  if (/\.(?:m4v|mov|mp4|ogv|webm)$/.test(pathname)) {
    return { ok: true, kind: 'video', url: url };
  }
  return { ok: false, reason: 'unsupported-type' };
}

function validateArticle(value, _catalogItems) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('article must be an object');
  var id = cleanString(value.id, 96);
  var slug = cleanString(value.slug, 80).toLowerCase();
  var title = cleanString(value.title, 160);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,95}$/.test(id)) throw new Error('article id is invalid');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('slug must use lowercase letters, numbers and hyphens');
  if (!title) throw new Error('title is required');
  var tags = Array.isArray(value.tags) ? value.tags : [];
  tags = tags.map(function (tag) { return cleanString(tag, 32); }).filter(Boolean);
  tags = tags.filter(function (tag, index) { return tags.indexOf(tag) === index; }).slice(0, 12);
  var parentId = value.parentId == null || value.parentId === '' ? null : cleanString(value.parentId, 96);
  if (parentId === id) throw new Error('article cannot be its own parent');
  var order = Number.isFinite(Number(value.order)) ? Math.max(0, Math.floor(Number(value.order))) : 0;
  var article = {
    id: id,
    slug: slug,
    title: title,
    summary: cleanString(value.summary, 500),
    tags: tags,
    parentId: parentId,
    order: order,
    markdown: String(value.markdown == null ? '' : value.markdown),
  };
  if (utf8Bytes(article) >= HARD_VALUE_BYTES || utf8Bytes(article) > MAX_ARTICLE_BYTES) {
    throw new Error('article exceeds the safe size below the 1 MiB storage value limit');
  }
  return article;
}

function assessQuota(options) {
  options = options || {};
  var quota = Number(options.quota) > 0 ? Number(options.quota) : OWNER_QUOTA_BYTES;
  var used = Math.max(0, Number(options.used) || 0);
  var writeBytes = Math.max(0, Number(options.writeBytes) || 0);
  var largestValueBytes = Math.max(0, Number(
    options.largestValueBytes == null ? writeBytes : options.largestValueBytes
  ) || 0);
  var reserveBytes = Math.max(0, Number(options.reserveBytes) || 0);
  var projected = used + writeBytes;
  var ratio = projected / quota;
  var level = ratio >= 0.95 ? 'critical' : ratio >= 0.85 ? 'warning' : ratio >= 0.70 ? 'watch' : 'normal';
  return {
    allowed: largestValueBytes < HARD_VALUE_BYTES && projected + reserveBytes <= quota,
    softExceeded: projected > SOFT_BUDGET_BYTES,
    used: used,
    projected: projected,
    quota: quota,
    largestValueBytes: largestValueBytes,
    reserveBytes: reserveBytes,
    ratio: ratio,
    level: level,
  };
}

function buildBackup(snapshot) {
  snapshot = snapshot || {};
  if (Array.isArray(snapshot.issues) && snapshot.issues.length) {
    throw new Error('snapshot contains unreadable articles');
  }
  var articles = Array.isArray(snapshot.articles) ? snapshot.articles : [];
  var seenIds = new Set();
  return {
    schema: 1,
    appId: 'cn.echootaku.wiki',
    exportedAt: cleanString(snapshot.exportedAt) || new Date().toISOString(),
    articles: articles.map(function (item) {
      var article = validateArticle(item, []);
      if (seenIds.has(article.id)) throw new Error('backup contains a duplicate article id');
      seenIds.add(article.id);
      return Object.assign(article, {
        updatedAt: cleanString(item.updatedAt) || cleanString(snapshot.exportedAt) || new Date().toISOString(),
        status: 'published',
      });
    }),
  };
}

function parseBackup(input) {
  var value = input;
  if (typeof input === 'string') {
    try { value = JSON.parse(input); } catch (_error) { throw new Error('backup JSON is invalid'); }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('backup must be an object');
  if (value.schema !== 1) throw new Error('unsupported backup schema');
  if (!Array.isArray(value.articles)) throw new Error('backup articles must be an array');
  if (value.articles.length > MAX_ARTICLES) throw new Error('backup contains too many articles');
  var validated = [];
  for (var i = 0; i < value.articles.length; i += 1) {
    var article = validateArticle(value.articles[i], []);
    if (validated.some(function (item) { return item.id === article.id; })) {
      throw new Error('backup contains a duplicate article id');
    }
    validated.push(Object.assign(article, {
      updatedAt: cleanString(value.articles[i].updatedAt) || cleanString(value.exportedAt) || new Date().toISOString(),
      status: 'published',
    }));
  }
  return {
    schema: 1,
    appId: 'cn.echootaku.wiki',
    exportedAt: cleanString(value.exportedAt) || new Date().toISOString(),
    articles: validated,
  };
}

function safeDownloadFilename(name, extension) {
  var ext = cleanString(extension, 8).replace(/[^a-z0-9]/gi, '').toLowerCase() || 'txt';
  var result = String(name == null ? '' : name)
    .replace(/[\\/]+/g, '-')
    .replace(/\.{2,}/g, '')
    .replace(/[<>:"|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[-.\s]+|[-.\s]+$/g, '')
    .slice(0, 96);
  if (!result) result = 'wiki-backup';
  if (!new RegExp('\\.' + ext + '$', 'i').test(result)) result += '.' + ext;
  return result;
}

module.exports = {
  HARD_VALUE_BYTES,
  MAX_ARTICLE_BYTES,
  MAX_ARTICLES,
  OWNER_QUOTA_BYTES,
  SOFT_BUDGET_BYTES,
  assessQuota,
  buildBackup,
  parseBackup,
  resolveRoleUi,
  safeDownloadFilename,
  sanitizeExternalUrl,
  validateArticle,
  validateMediaUrl,
  utf8Bytes,
};
