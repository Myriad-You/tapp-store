var share = require('./scope.js');

// ==================== Feed composer + draft ====================
// Extracted from views.js. Depends on helpers, state, federation publish APIs.
// Load before views.js.

// ==================== Feed composer (freeform Note) ====================
var composeAttachments = []; // { file, previewUrl, kind: 'image'|'video' }
var COMPOSE_DRAFT_KEY = 'aro_compose_draft';
/** Track whether last storage restore lacked attachable files. */
var composeDraftTextOnly = false;

/**
 * Contextual + menu (owner feed only):
 * - timeline  → Post only
 * - following → Follow only
 * - followers / published / guest / non-feed → no +
 */
function canComposePost() {
  return !state.isGuest
    && state.currentView === 'feed'
    && state.feedSubTab === 'timeline';
}

function canFollowFromFeed() {
  return !state.isGuest
    && state.currentView === 'feed'
    && state.feedSubTab === 'following';
}

function isComposeBusy() {
  var publishBtn = $('feed-compose-publish');
  return !!(publishBtn && publishBtn.disabled);
}

function getComposeText() {
  var ta = $('feed-compose-text');
  return ta ? String(ta.value || '') : '';
}

function composeHasContent() {
  return !!(getComposeText().trim() || composeAttachments.length);
}

function setComposeDraftHint(visible) {
  var hint = $('feed-compose-draft-hint');
  if (!hint) return;
  if (visible) {
    hint.textContent = lang.composeDraftRestored || 'Draft restored';
    hint.hidden = false;
  } else {
    hint.hidden = true;
    hint.textContent = '';
  }
}

function setComposeDraftNotice(visible) {
  var notice = $('feed-compose-draft-notice');
  if (!notice) return;
  if (visible) {
    notice.textContent = lang.composeDraftTextOnly || 'Draft kept text only';
    notice.hidden = false;
  } else {
    notice.hidden = true;
    notice.textContent = '';
  }
}

function clearComposeForm() {
  var ta = $('feed-compose-text');
  if (ta) ta.value = '';
  composeAttachments.forEach(function (a) {
    if (a.previewUrl) try { URL.revokeObjectURL(a.previewUrl); } catch (e) {}
  });
  composeAttachments = [];
  renderComposePreviews();
  setComposeDraftHint(false);
  setComposeDraftNotice(false);
  composeDraftTextOnly = false;
}

function clearComposeDraftStorage() {
  try {
    if (Tapp.storage && typeof Tapp.storage.remove === 'function') {
      Tapp.storage.remove(COMPOSE_DRAFT_KEY).catch(function () {});
    }
  } catch (e) { /* ignore */ }
}

/**
 * Persist draft to Tapp.storage.
 * Files cannot be reliably serialized — save text + fileNames metadata.
 * Same-session attachments stay in memory (composeAttachments).
 */
function saveComposeDraftFromForm() {
  if (!composeHasContent()) {
    clearComposeDraftStorage();
    return;
  }
  var payload = {
    text: getComposeText(),
    savedAt: Date.now(),
    fileNames: composeAttachments.map(function (a) {
      return (a.file && a.file.name) || a.name || '';
    }).filter(Boolean)
  };
  try {
    if (Tapp.storage && typeof Tapp.storage.set === 'function') {
      Tapp.storage.set(COMPOSE_DRAFT_KEY, payload).catch(function () {});
    }
  } catch (e) { /* ignore */ }
}

/**
 * Restore draft from storage when form is empty (e.g. after reload).
 * Session attachments already in memory are kept as-is.
 * @returns {Promise<boolean>} true if anything was restored
 */
async function restoreComposeDraft() {
  var ta = $('feed-compose-text');
  var hasSession = !!(ta && ta.value.trim()) || composeAttachments.length > 0;
  if (hasSession) {
    // Session still has content (dialog closed without clear).
    if (composeHasContent()) setComposeDraftHint(true);
    setComposeDraftNotice(composeDraftTextOnly && !composeAttachments.length);
    return composeHasContent();
  }
  var draft = null;
  try {
    if (Tapp.storage && typeof Tapp.storage.get === 'function') {
      draft = await Tapp.storage.get(COMPOSE_DRAFT_KEY);
    }
  } catch (e) { draft = null; }
  if (!draft || typeof draft !== 'object') return false;
  var text = typeof draft.text === 'string' ? draft.text : '';
  var names = Array.isArray(draft.fileNames) ? draft.fileNames : [];
  if (!text.trim() && !names.length) return false;
  if (ta && text) ta.value = text;
  // File blobs are not durable across reloads; only text is restored.
  composeDraftTextOnly = names.length > 0;
  setComposeDraftHint(true);
  setComposeDraftNotice(composeDraftTextOnly);
  return true;
}

function updateComposeButtonVisibility() {
  updateFeedPlusVisibility();
}

function updateFeedPlusVisibility() {
  var showPost = canComposePost();
  var showFollow = canFollowFromFeed();
  // showPlus = !isGuest && feed && (timeline || following) — equivalent to either action
  var showPlus = showPost || showFollow;
  var display = showPlus ? '' : 'none';

  var wrap = $('feed-plus-wrap');
  if (wrap) wrap.style.display = display;
  var wrapMobile = $('feed-plus-wrap-mobile');
  if (wrapMobile) wrapMobile.style.display = display;

  document.querySelectorAll('[data-feed-plus="post"]').forEach(function (el) {
    if (showPost) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  });
  document.querySelectorAll('[data-feed-plus="follow"]').forEach(function (el) {
    if (showFollow) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  });

  if (!showPlus) closeFeedPlusMenu();
}

function closeFeedPlusMenu() {
  ['feed-plus-menu', 'feed-plus-menu-mobile'].forEach(function (id) {
    var menu = $(id);
    if (!menu || menu.hidden) return;
    menu.classList.remove('open');
    menu.classList.remove('aro-leaving');
    menu.hidden = true;
  });
  ['feed-plus-btn', 'feed-plus-mobile-btn'].forEach(function (id) {
    var btn = $(id);
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
}

function openFeedPlusMenu(anchorBtn) {
  if (!anchorBtn) return;
  var menuId = anchorBtn.getAttribute('aria-controls') || 'feed-plus-menu';
  var menu = $(menuId);
  if (!menu) return;

  // Close the other instance first
  closeFeedPlusMenu();

  menu.hidden = false;
  menu.classList.remove('aro-leaving');
  menu.classList.add('open');
  anchorBtn.setAttribute('aria-expanded', 'true');

  // Focus first visible item
  var first = menu.querySelector('.feed-plus-item:not([hidden])');
  if (first) {
    try { first.focus(); } catch (e) { /* ignore */ }
  }
}

function toggleFeedPlusMenu(anchorBtn) {
  if (!anchorBtn) return;
  var menuId = anchorBtn.getAttribute('aria-controls') || 'feed-plus-menu';
  var menu = $(menuId);
  if (menu && !menu.hidden && menu.classList.contains('open')) {
    closeFeedPlusMenu();
  } else {
    openFeedPlusMenu(anchorBtn);
  }
}

function handleFeedPlusAction(action) {
  closeFeedPlusMenu();
  if (action === 'post') {
    openComposer();
  } else if (action === 'follow') {
    openFollowDialog();
  }
}

function openFollowDialog() {
  if (!canFollowFromFeed()) return;
  var d = $('feed-follow-dialog');
  if (!d) return;
  showAroOverlay(d);
  var input = $('feed-follow-input');
  if (input) {
    try { input.focus(); } catch (e) { /* ignore */ }
  }
}

function closeFollowDialog() {
  var d = $('feed-follow-dialog');
  if (!d || d.style.display === 'none') return;
  aroDismiss(d, { ms: 160 });
}

function openComposer() {
  if (!canComposePost()) return;
  closeFeedPlusMenu();
  var d = $('feed-compose-dialog');
  if (!d) return;
  // Already open: just refocus, don't re-flash draft hints.
  if (d.style.display !== 'none' && !d.classList.contains('aro-leaving')) {
    var taOpen = $('feed-compose-text');
    if (taOpen) {
      try { taOpen.focus(); } catch (e) { /* ignore */ }
    }
    return;
  }
  showAroOverlay(d);
  // Restore draft (storage or in-session), then focus.
  Promise.resolve(restoreComposeDraft()).then(function () {
    var ta = $('feed-compose-text');
    if (ta) {
      try { ta.focus(); } catch (e) { /* ignore */ }
    }
  }).catch(function () {
    var ta = $('feed-compose-text');
    if (ta) {
      try { ta.focus(); } catch (e) { /* ignore */ }
    }
  });
}

/**
 * Close compose dialog.
 * @param {{ clear?: boolean }} opts  clear=true after successful publish (wipe form + storage).
 *   Default: auto-save draft when there is content (do not silent-drop).
 */
function closeComposer(opts) {
  opts = opts || {};
  if (isComposeBusy() && !opts.clear) return;
  var d = $('feed-compose-dialog');
  if (opts.clear) {
    clearComposeForm();
    clearComposeDraftStorage();
  } else {
    // Auto-save on dismiss when user has typed / attached.
    saveComposeDraftFromForm();
    // Keep form values in DOM for same-session re-open; only hide draft banners.
    setComposeDraftHint(false);
    // Keep text-only notice state for next open if attachments still missing.
  }
  if (!d || d.style.display === 'none') return;
  aroDismiss(d, { ms: 160 });
}

function renderComposePreviews() {
  var box = $('feed-compose-previews');
  if (!box) return;
  if (!composeAttachments.length) {
    box.innerHTML = '';
    return;
  }
  var h = '';
  composeAttachments.forEach(function (a, idx) {
    h += '<div class="feed-compose-preview">';
    if (a.kind === 'video') {
      h += '<video src="' + esc(a.previewUrl) + '" muted></video>';
    } else {
      h += '<img src="' + esc(a.previewUrl) + '" alt="" />';
    }
    h += '<button type="button" class="feed-compose-preview-remove" data-compose-remove="' + idx + '" aria-label="' + esc(lang.remove || 'Remove') + '">&times;</button>';
    h += '</div>';
  });
  box.innerHTML = h;
  box.querySelectorAll('[data-compose-remove]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var i = parseInt(btn.getAttribute('data-compose-remove'), 10);
      if (isNaN(i) || i < 0 || i >= composeAttachments.length) return;
      var removed = composeAttachments.splice(i, 1)[0];
      if (removed && removed.previewUrl) try { URL.revokeObjectURL(removed.previewUrl); } catch (e) {}
      renderComposePreviews();
    });
  });
}

function addComposeFiles(fileList, forceKind) {
  if (!fileList || !fileList.length) return;
  var maxImage = 10 * 1024 * 1024;
  var maxVideo = 50 * 1024 * 1024;
  for (var i = 0; i < fileList.length; i++) {
    if (composeAttachments.length >= 8) break;
    var file = fileList[i];
    var mime = (file.type || '').toLowerCase();
    var kind = forceKind || (mime.indexOf('video/') === 0 ? 'video' : 'image');
    if (kind === 'image' && mime && mime.indexOf('image/') !== 0) {
      notifyError(lang.mediaUnsupported || 'Unsupported');
      continue;
    }
    if (kind === 'video' && mime && mime.indexOf('video/') !== 0) {
      notifyError(lang.mediaUnsupported || 'Unsupported');
      continue;
    }
    var max = kind === 'video' ? maxVideo : maxImage;
    if (file.size > max) {
      notifyError(lang.mediaTooLarge || lang.fileTooLarge || 'Too large');
      continue;
    }
    composeAttachments.push({
      file: file,
      previewUrl: URL.createObjectURL(file),
      kind: kind
    });
  }
  renderComposePreviews();
}

function fileToDataUrl(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () { resolve(reader.result); };
    reader.onerror = function () { reject(new Error('read failed')); };
    reader.readAsDataURL(file);
  });
}

/**
 * Client-side check mirroring host/backend media URL shape.
 * Path: /media/federation/{userId}/{filename} with safe single-segment name.
 */
function isValidFederationMediaUrl(url) {
  if (!url || typeof url !== 'string') return false;
  var trimmed = url.trim();
  if (!trimmed) return false;
  // Reject before URL() normalizes ".." away
  if (trimmed.indexOf('..') >= 0) return false;
  try {
    var u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (u.pathname.indexOf('..') >= 0) return false;
    var m = u.pathname.match(/^\/media\/federation\/(\d+)\/([A-Za-z0-9._-]+)$/);
    return !!(m && m[1] && m[2]);
  } catch (e) {
    return false;
  }
}

function unwrapUploadMediaResult(res) {
  if (!res) return null;
  // Bridge may return { url } or nested { data: { url } }
  if (res.url) return res;
  if (res.data && res.data.url) return res.data;
  return res;
}

function unwrapPublishResult(res) {
  if (!res) return null;
  if (res.activity_id || res.content_id || typeof res.delivered_queued === 'number') return res;
  if (res.data && (res.data.activity_id || res.data.content_id)) return res.data;
  return res;
}

async function uploadComposeMedia(entry) {
  var file = entry.file;
  // Re-check raw size before data-URL conversion (aligns with backend limits).
  var maxImage = 10 * 1024 * 1024;
  var maxVideo = 50 * 1024 * 1024;
  var kind = entry.kind === 'video' ? 'video' : 'image';
  var maxBytes = kind === 'video' ? maxVideo : maxImage;
  if (file && typeof file.size === 'number' && file.size > maxBytes) {
    throw new Error(lang.mediaTooLarge || lang.fileTooLarge || 'File too large');
  }
  if (typeof Tapp.federation.uploadMedia === 'function') {
    var dataUrl = await fileToDataUrl(file);
    var res = await Tapp.federation.uploadMedia({
      data: dataUrl,
      name: file.name || 'upload.bin',
      mime: file.type || (entry.kind === 'video' ? 'video/mp4' : 'image/jpeg')
    });
    var uploaded = unwrapUploadMediaResult(res);
    if (!uploaded || !isValidFederationMediaUrl(uploaded.url)) {
      console.error('[Aro] uploadMedia returned invalid URL', res);
      throw new Error(lang.composeBadMediaUrl || 'Invalid media URL after upload');
    }
    return uploaded;
  }
  // Fallback: publish path unavailable
  console.error('[Aro] uploadMedia not available on Tapp.federation');
  throw new Error('uploadMedia not available');
}

/**
 * Soft-check that the published note (and media) appears on timeline/published.
 * Non-blocking: only warns via toast/console; never fails the publish UX.
 */
function softVerifyPublishedNote(publishRes, expectedAttachments) {
  var contentId = publishRes && (publishRes.content_id || publishRes.contentId);
  var activityId = publishRes && (publishRes.activity_id || publishRes.activityId);
  if (!contentId && !activityId) return;

  var attempts = 0;
  var maxAttempts = 4;
  var delayMs = 700;
  var wantMedia = !!(expectedAttachments && expectedAttachments.length);

  function noteMatches(item) {
    if (!item) return false;
    var cj = item.content_json || item.content || {};
    var cid = (cj['mfp:contentId'] || cj.content_id || item.content_id || '');
    var aid = item.activity_id || (cj.id) || '';
    if (contentId && String(cid) === String(contentId)) return true;
    if (activityId && String(aid).indexOf(String(activityId)) >= 0) return true;
    if (activityId && String(item.activity_id || '') === String(activityId)) return true;
    return false;
  }

  function itemHasMedia(item) {
    var atts = extractNoteAttachments(item.content_json || item.content || null);
    return atts && atts.length > 0 && atts.every(function (a) { return a && a.url; });
  }

  function tick() {
    attempts += 1;
    Promise.all([
      (typeof Tapp.federation.getTimeline === 'function'
        ? Tapp.federation.getTimeline().catch(function (e) {
            console.warn('[Aro] soft-verify getTimeline', e);
            return null;
          })
        : Promise.resolve(null)),
      (typeof Tapp.federation.getPublished === 'function'
        ? Tapp.federation.getPublished().catch(function (e) {
            console.warn('[Aro] soft-verify getPublished', e);
            return null;
          })
        : Promise.resolve(null))
    ]).then(function (pair) {
      var timelineItems = (pair[0] && pair[0].items) || [];
      var publishedItems = (pair[1] && pair[1].items) || [];
      var found =
        timelineItems.find(noteMatches) ||
        publishedItems.find(noteMatches) ||
        null;

      if (found) {
        if (wantMedia && !itemHasMedia(found)) {
          console.warn('[Aro] soft-verify: note found but attachments missing on feed', found);
          try {
            Tapp.ui.showNotification({
              title: lang.composeMediaMissingOnFeed || lang.composeTimelineMissing || 'Media missing',
              type: 'warning'
            });
          } catch (e2) {}
        }
        return;
      }

      if (attempts < maxAttempts) {
        setTimeout(tick, delayMs);
        return;
      }

      console.warn('[Aro] soft-verify: published note not on timeline/published within timeout', {
        contentId: contentId,
        activityId: activityId
      });
      try {
        Tapp.ui.showNotification({
          title: lang.composeTimelineMissing || 'Not on timeline yet',
          type: 'warning'
        });
      } catch (e3) {}
    }).catch(function (e) {
      console.warn('[Aro] soft-verify failed', e);
    });
  }

  setTimeout(tick, delayMs);
}

async function publishComposeNote() {
  if (state.isGuest) return;
  var ta = $('feed-compose-text');
  var text = ta ? ta.value.trim() : '';
  if (!text && !composeAttachments.length) {
    notifyError(lang.composeEmpty || 'Empty');
    return;
  }
  var publishBtn = $('feed-compose-publish');
  var cancelBtn = $('feed-compose-cancel');
  var setBusy = function (busy) {
    if (publishBtn) {
      publishBtn.disabled = busy;
      publishBtn.textContent = busy
        ? (lang.composePublishing || '…')
        : (lang.composePublish || 'Publish');
    }
    if (cancelBtn) cancelBtn.disabled = busy;
  };
  setBusy(true);
  try {
    var attachments = [];
    var uploadedCount = 0;
    for (var i = 0; i < composeAttachments.length; i++) {
      if (publishBtn) publishBtn.textContent = lang.composeUploading || '…';
      try {
        var uploaded = await uploadComposeMedia(composeAttachments[i]);
      } catch (upErr) {
        console.error('[Aro] media upload failed at index', i, upErr);
        if (uploadedCount > 0) {
          notifyError(lang.composeUploadPartial || lang.composeUploadFail || lang.composeFail || 'Fail', upErr);
        } else {
          notifyError(lang.composeUploadFail || lang.composeFail || 'Fail', upErr);
        }
        // Do not half-publish: abort without createNote.
        return;
      }
      if (!isValidFederationMediaUrl(uploaded.url)) {
        console.error('[Aro] rejecting bad attachment URL before createNote', uploaded);
        notifyError(lang.composeBadMediaUrl || lang.composeFail || 'Bad URL');
        return;
      }
      attachments.push({
        url: uploaded.url,
        media_type: uploaded.media_type || uploaded.mediaType || composeAttachments[i].file.type,
        name: uploaded.name || composeAttachments[i].file.name
      });
      uploadedCount += 1;
    }
    if (publishBtn) publishBtn.textContent = lang.composePublishing || '…';
    var rawPublish;
    var postVis = (typeof getDefaultPostVisibility === 'function' ? getDefaultPostVisibility() : 'public');
    if (typeof Tapp.federation.createNote === 'function') {
      rawPublish = await Tapp.federation.createNote({
        text: text,
        attachments: attachments,
        visibility: postVis
      });
    } else if (typeof Tapp.federation.publish === 'function') {
      rawPublish = await Tapp.federation.publish({
        content_type: 'note',
        text: text,
        attachments: attachments,
        visibility: postVis
      });
    } else {
      console.error('[Aro] createNote/publish not available');
      throw new Error('createNote not available');
    }
    var publishRes = unwrapPublishResult(rawPublish);
    if (publishRes && publishRes.success === false) {
      console.error('[Aro] publish response success=false', publishRes);
      throw new Error(publishRes.error || lang.composeFail || 'Publish failed');
    }

    // Success: wipe draft + form (do not re-save published content).
    closeComposer({ clear: true });
    var successTitle = attachments.length > 0
      ? (lang.composeSuccessMedia || lang.composeSuccess || 'OK')
      : (lang.composeSuccess || 'OK');
    var successMsg;
    var queued = publishRes && (publishRes.delivered_queued != null
      ? publishRes.delivered_queued
      : publishRes.deliveredQueued);
    if (typeof queued === 'number' && queued > 0) {
      successMsg = String(lang.composeDeliveryQueued || 'Delivering to {n} followers')
        .replace('{n}', String(queued));
    }
    try {
      Tapp.ui.showNotification({
        title: successTitle,
        message: successMsg || undefined,
        type: 'success'
      });
    } catch (e2) {}

    // Force reload author timeline + published so the new note is visible.
    state.feedLoaded.timeline = false;
    state.feedLoaded.published = false;
    if (state.feedSubTab !== 'timeline') {
      switchFeedSubTab('timeline');
    } else {
      loadFeedSubTab();
    }
    updateFeedProfileHeader();

    // Non-blocking soft verify (timeline/media presence).
    softVerifyPublishedNote(publishRes, attachments);
  } catch (e) {
    console.error('[Aro] publishComposeNote failed', e);
    notifyError(lang.composeFail || lang.unpublishFail || 'Fail', e);
  } finally {
    setBusy(false);
  }
}

async function doUnfollow(actorUrl) {
  try {
    await Tapp.federation.unfollow(actorUrl);
    loadFeedSubTab();
    updateFeedProfileHeader();
  } catch (e) {
    notifyError(lang.unfollowFail, e);
  }
}

async function doUnpublish(contentType, contentId) {
  try {
    await Tapp.federation.unpublish({ content_type: contentType, content_id: contentId });
    // Keep published + timeline caches coherent after unpublish.
    if (contentType && contentId && state.published) {
      state.published = (state.published || []).filter(function (it) {
        return !(it.content_type === contentType && String(it.content_id) === String(contentId));
      });
    }
    if (contentType && contentId && state.timeline) {
      state.timeline = (state.timeline || []).filter(function (it) {
        var t = typeof extractPublishTarget === 'function' ? extractPublishTarget(it) : null;
        if (t && t.content_type === contentType && String(t.content_id) === String(contentId)) return false;
        return true;
      });
    }
    state.feedLoaded.published = false;
    state.feedLoaded.timeline = false;
    loadFeedSubTab();
    updateFeedProfileHeader();
  } catch (e) {
    notifyError(lang.unpublishFail, e);
  }
}

/** Quick-delete own post from Home timeline (confirm + optimistic remove + unpublish). */
async function doDeleteTimelinePost(target) {
  target = target || {};
  var contentType = target.content_type || '';
  var contentId = target.content_id || '';
  var activityId = target.activity_id || '';
  var objectId = target.object_id || '';
  if (!contentId && !activityId) return;
  if (typeof aroConfirm === 'function') {
    var ok = await aroConfirm(lang.deletePostConfirm || 'Delete this post?', true);
    if (!ok) return;
  }
  // Optimistic: drop from timeline (and published if present).
  var prevTimeline = state.timeline ? state.timeline.slice() : null;
  var prevPublished = state.published ? state.published.slice() : null;
  state.timeline = (state.timeline || []).filter(function (it) {
    if (activityId && it.activity_id && String(it.activity_id) === String(activityId)) return false;
    if (objectId && resolveObjectId(it) === objectId) return false;
    if (contentType && contentId) {
      var t = typeof extractPublishTarget === 'function' ? extractPublishTarget(it) : null;
      if (t && t.content_type === contentType && String(t.content_id) === String(contentId)) return false;
    }
    return true;
  });
  if (contentType && contentId && state.published) {
    state.published = (state.published || []).filter(function (it) {
      return !(it.content_type === contentType && String(it.content_id) === String(contentId));
    });
  }
  renderFeedContent();
  try {
    var req = {};
    if (contentType) req.content_type = contentType;
    if (contentId) req.content_id = contentId;
    if (activityId) req.activity_id = activityId;
    await Tapp.federation.unpublish(req);
    state.feedLoaded.published = false;
    updateFeedProfileHeader();
  } catch (e) {
    if (prevTimeline) state.timeline = prevTimeline;
    if (prevPublished) state.published = prevPublished;
    state.feedLoaded.timeline = false;
    renderFeedContent();
    notifyError(lang.deletePostFail || lang.unpublishFail, e);
  }
}


// ==================== Shared scope ====================
// Republish the names this file's siblings read. See page/scope.js.
share.value({
  addComposeFiles: addComposeFiles,
  closeComposer: closeComposer,
  closeFeedPlusMenu: closeFeedPlusMenu,
  closeFollowDialog: closeFollowDialog,
  doDeleteTimelinePost: doDeleteTimelinePost,
  doUnfollow: doUnfollow,
  doUnpublish: doUnpublish,
  handleFeedPlusAction: handleFeedPlusAction,
  publishComposeNote: publishComposeNote,
  setComposeDraftNotice: setComposeDraftNotice,
  toggleFeedPlusMenu: toggleFeedPlusMenu,
  unwrapPublishResult: unwrapPublishResult,
  updateComposeButtonVisibility: updateComposeButtonVisibility,
  updateFeedPlusVisibility: updateFeedPlusVisibility,
});
share.live({
  composeAttachments: [function () { return composeAttachments; }, function (v) { composeAttachments = v; }],
  composeDraftTextOnly: [function () { return composeDraftTextOnly; }, function (v) { composeDraftTextOnly = v; }],
});
