// Page layer entry. The modules below share one scope through page/scope.js and
// are required in dependency order: i18n and state first, helpers before the
// views that call it, api before the surfaces that talk to the host.
require('./i18n.js');
require('./state.js');
require('./helpers.js');
require('./shareUi.js');
require('./mentionUi.js');
require('./attachments.js');
require('./msgUi.js');
require('./chat.js');
require('./members.js');
require('./history.js');
require('./files.js');
require('./msgSync.js');
require('./e2eUi.js');
require('./roomUi.js');
require('./createUi.js');
require('./api.js');
require('./feedUi.js');
require('./feedCompose.js');
require('./ringsUi.js');
require('./views.js');
require('./events.js');

// ==================== Init ====================
async function init() {
  if (typeof disposePageSession === 'function') disposePageSession();
  if (typeof getPageDisposables === 'function') getPageDisposables();
  try {
    var user = await Tapp.context.getUser();
    var actorUrl = user ? normalizeFederationUrl(user.actor_url) : '';
    if (actorUrl) state.localActorUrl = actorUrl;
  } catch (e) { /* ignore */ }

  try {
    var localeRes = await Tapp.ui.getLocale();
    if (localeRes) setLocale(localeRes);
  } catch (e) { /* ignore */ }

  try {
    var settings = await Tapp.settings.getAll();
    if (settings && settings.pollInterval) {
      state.pollInterval = Math.max(5, Math.min(120, settings.pollInterval)) * 1000;
    }
    if (settings && typeof settings.notifyOnMessage !== 'undefined') {
      state.notifyOnMessage = !!settings.notifyOnMessage;
    }
  } catch (e) { /* ignore */ }

  // Client aro.settings (visibility defaults, feed prefs, etc.)
  try {
    if (typeof loadAroSettings === 'function') loadAroSettings();
    // Optional: merge from Tapp.storage if localStorage was empty
    if (Tapp.storage && typeof Tapp.storage.get === 'function') {
      var storedAro = await Tapp.storage.get('aro.settings');
      if (storedAro && typeof storedAro === 'object') {
        var hasLocal = false;
        try { hasLocal = !!(typeof localStorage !== 'undefined' && localStorage.getItem('aro.settings')); } catch (eL) {}
        if (!hasLocal && typeof saveAroSettings === 'function') {
          saveAroSettings(storedAro);
        }
      }
    }
  } catch (eAroSet) { /* ignore */ }

  // Load tapp acceptance states from storage
  try {
    var allStorage = await Tapp.storage.getAll();
    if (allStorage) {
      Object.keys(allStorage).forEach(function (k) {
        if (k.indexOf('tapp_accept_') === 0) {
          state.tappAcceptMap[k] = allStorage[k];
        }
      });
    }
  } catch (e) { /* ignore */ }

  await loadUserRole();
  await loadFederationIdentity();
  applyLabels();

  // -- Populate feed profile header from user context + federation identity --
  try {
    var user = await Tapp.context.getUser();
    if (user) {
      synthesizeFederationIdentityFromUser(user);
      // Merge federation identity avatar/name when context is empty
      if (state.identity) {
        if (!user.avatar_url && !user.avatar && state.identity.avatar_url) {
          user.avatar_url = state.identity.avatar_url;
          user.avatar = state.identity.avatar_url;
        }
        if (!user.display_name && state.identity.display_name) {
          user.display_name = state.identity.display_name;
        }
      }
      renderFeedProfileUser(user);
      // Update nav feed tab avatar + username
      var navAvatar = $('nav-feed-avatar');
      if (navAvatar) {
        var navAvatarUrl = user.avatar_url || user.avatar || '';
        navAvatar.innerHTML = avatarContentHtml(navAvatarUrl, user.display_name || user.username || '?');
      }
      var navName = $('nav-feed-label');
      if (navName) navName.textContent = user.display_name || user.username || '';
    } else if (state.identity) {
      renderFeedProfileUser({
        username: state.identity.username,
        display_name: state.identity.display_name || state.identity.username,
        avatar_url: state.identity.avatar_url || '',
        avatar: state.identity.avatar_url || '',
      });
      var navAvatarFallback = $('nav-feed-avatar');
      if (navAvatarFallback) {
        navAvatarFallback.innerHTML = avatarContentHtml(
          state.identity.avatar_url || '',
          state.identity.display_name || state.identity.username || '?'
        );
      }
      var navNameFallback = $('nav-feed-label');
      if (navNameFallback) {
        navNameFallback.textContent = state.identity.display_name || state.identity.username || '';
      }
    }
  } catch (e) {
    if (state.identity) {
      try {
        renderFeedProfileUser({
          username: state.identity.username,
          display_name: state.identity.display_name || state.identity.username,
          avatar_url: state.identity.avatar_url || '',
          avatar: state.identity.avatar_url || '',
        });
      } catch (e2) { /* ignore */ }
    }
  }
  // Last resort: never leave avatar as bare "?" with empty name when we have something.
  try {
    var nameEl = document.querySelector('[data-feed-display-name]');
    var av = document.querySelector('[data-feed-avatar]');
    if (nameEl && !String(nameEl.textContent || '').trim()) {
      var fallbackName = (state.identity && (state.identity.display_name || state.identity.username))
        || (state.isGuest ? (lang.guest || '访客') : (lang.me || '我'));
      nameEl.textContent = fallbackName;
      if (av && (!av.innerHTML || av.textContent === '?' || av.textContent.trim() === '?')) {
        av.textContent = (fallbackName[0] || '?').toUpperCase();
      }
      var navName = $('nav-feed-label');
      if (navName && !String(navName.textContent || '').trim()) navName.textContent = fallbackName;
      var navAv = $('nav-feed-avatar');
      if (navAv && (navAv.textContent || '').trim() === '?') {
        navAv.textContent = (fallbackName[0] || '?').toUpperCase();
      }
    }
  } catch (e3) { /* ignore */ }
  renderFederationIdentity();
  applyAdminControls();
  applyRoleControls();

  // Seal any leftover fixed overlays before binding (reinstall / hot reload / partial dismiss).
  // Prevents a full-screen click shield that blocks feed scroll + taps.
  try {
    if (typeof sealAroInteractionSurfaces === 'function') {
      sealAroInteractionSurfaces({ keepChat: false, keepConfirm: true });
    } else if (typeof dismissTransientUi === 'function') {
      dismissTransientUi({ keepChat: false });
    }
  } catch (eSealBoot) { /* ignore */ }

  bindEvents();
  if (!state.isGuest) {
    bindRealtimeListeners();
    await loadConversations();
  }
  await loadFeed();

  // Handle launch params
  var launchParams = window._TAPP_LAUNCH_PARAMS || {};
  if (!state.isGuest && launchParams.view && ['messages', 'feed', 'rings'].indexOf(launchParams.view) !== -1) {
    switchView(launchParams.view);
  } else if (launchParams.view === 'timeline' || launchParams.view === 'profile') {
    switchView('feed');
  }
  if (!state.isGuest && launchParams.channel) {
    switchView('messages');
    openConversation('channel', launchParams.channel);
  } else if (!state.isGuest && launchParams.room) {
    switchView('messages');
    openConversation('room', launchParams.room);
  }

  applyDialogLabels();

  // Second seal after first paint/data — openQuotedPostDetail etc. must not leave PE shields.
  try {
    if (typeof sealAroInteractionSurfaces === 'function') {
      sealAroInteractionSurfaces({ keepChat: true, keepConfirm: true });
    }
  } catch (eSealReady) { /* ignore */ }

  // ARO-14: track locale subscription for destroy
  var unsubLocale = Tapp.ui.onLocaleChange(function (newLocale) {
    setLocale(newLocale);
    applyLabels();
    applyDialogLabels();
    renderConvList();
    renderChatHeader();
    renderMembers();
    renderFederationIdentity();
    if (state.currentView === 'feed') { renderFeedContent(); }
    else if (state.currentView === 'rings') { renderRingsSidebar(); if (state.activeRingId) renderRingDetail(); }
  });
  if (typeof getPageDisposables === 'function') {
    getPageDisposables().add(typeof unsubLocale === 'function' ? unsubLocale : function () {});
  }
}

// ==================== Entry ====================
if (window._TAPP_MODE === 'page' || window._TAPP_HAS_HTML) {
  Tapp.lifecycle.onReady(function () {
    init();
  });

  Tapp.lifecycle.onDestroy(function () {
    stopPolling();
    unsubscribeRealtime();
    if (typeof disposePageSession === 'function') disposePageSession();
  });
}
