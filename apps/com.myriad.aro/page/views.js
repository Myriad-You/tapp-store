// ==================== Feed View (merged Timeline + Profile) ====================
async function loadFeed() {
  renderFederationIdentity();
  updateFeedProfileHeader();
  return loadFeedSubTab();
}

function formatFeedBadgeCount(n) {
  if (n > 99) return '99+';
  return String(n);
}

/** Sync following/followers/published/bookmarks counts into nav + mobile tab badges. Hidden when 0. */
function updateFeedCountBadges() {
  var pairs = [
    { count: (state.following && state.following.length) || 0, ids: ['feed-badge-following', 'feed-mobile-badge-following'] },
    { count: (state.followers && state.followers.length) || 0, ids: ['feed-badge-followers', 'feed-mobile-badge-followers'] },
    { count: (state.published && state.published.length) || 0, ids: ['feed-badge-published', 'feed-mobile-badge-published'] },
    { count: (state.bookmarks && state.bookmarks.length) || 0, ids: ['feed-badge-bookmarks', 'feed-mobile-badge-bookmarks'] }
  ];
  if (state.isGuest) {
    pairs.forEach(function (p) { p.count = 0; });
  }
  pairs.forEach(function (p) {
    p.ids.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      if (p.count === 0) {
        el.hidden = true;
        el.textContent = '0';
      } else {
        el.hidden = false;
        el.textContent = formatFeedBadgeCount(p.count);
      }
    });
  });
}

/** Normalize list API shapes: {items}, bare array, or double-wrapped data. */
function unwrapListResponse(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.items)) return res.items;
  if (res.data) {
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.data.items)) return res.data.items;
  }
  return [];
}

function updateFeedProfileHeader() {
  if (state.isGuest) {
    state.following = [];
    state.followers = [];
    state.published = [];
    state.bookmarks = [];
    updateFeedCountBadges();
    updateFeedHeader();
    return;
  }
  Promise.all([
    Tapp.federation.getFollowing().catch(function () { return { items: [] }; }),
    Tapp.federation.getFollowers().catch(function () { return { items: [] }; }),
    Tapp.federation.getPublished().catch(function () { return { items: [] }; })
  ]).then(function (results) {
    state.following = unwrapListResponse(results[0]);
    state.followers = unwrapListResponse(results[1]);
    state.published = unwrapListResponse(results[2]);
    updateFeedCountBadges();
    updateFeedHeader();
    // If user is already on followers/following/published, re-render with fresh counts.
    if (state.currentView === 'feed' && state.feedSubTab !== 'timeline') {
      renderFeedContent();
    }
  });
}

async function loadFeedSubTab() {
  var sub = state.feedSubTab;
  if (typeof updateFeedPlusVisibility === 'function') updateFeedPlusVisibility();

  state.feedLoading = true;
  state.feedError = null;
  updateFeedLoadingState();
  updateFeedHeader();
  renderFeedContent();

  try {
    if (sub === 'timeline') {
      var res = null;
      var feedErr = null;
      if (Tapp.federation && typeof Tapp.federation.getFeed === 'function') {
        try {
          res = await Tapp.federation.getFeed();
        } catch (eFeed) {
          feedErr = eFeed;
          console.warn('[Aro] getFeed failed, trying getTimeline', eFeed);
        }
      }
      if (!res && Tapp.federation && typeof Tapp.federation.getTimeline === 'function') {
        try {
          res = await Tapp.federation.getTimeline();
        } catch (eTl) {
          if (!feedErr) feedErr = eTl;
          else console.warn('[Aro] getTimeline also failed', eTl);
        }
      }
      if (!res && feedErr) throw feedErr;
      state.timeline = unwrapListResponse(res);
    } else if (sub === 'following') {
      // Parallel followers fetch so mutual / "follows you" badges resolve.
      var resFollowPair = await Promise.all([
        Tapp.federation.getFollowing(),
        Tapp.federation.getFollowers().catch(function () { return { items: [] }; }),
      ]);
      state.following = unwrapListResponse(resFollowPair[0]);
      var folSide = unwrapListResponse(resFollowPair[1]);
      if (folSide.length || !(state.followers && state.followers.length)) {
        state.followers = folSide;
      }
      updateFeedCountBadges();
    } else if (sub === 'followers') {
      // Parallel following fetch so follow-back / mutual badges resolve.
      var resFollowerPair = await Promise.all([
        Tapp.federation.getFollowers(),
        Tapp.federation.getFollowing().catch(function () { return { items: [] }; }),
      ]);
      state.followers = unwrapListResponse(resFollowerPair[0]);
      var folSide2 = unwrapListResponse(resFollowerPair[1]);
      if (folSide2.length || !(state.following && state.following.length)) {
        state.following = folSide2;
      }
      updateFeedCountBadges();
    } else if (sub === 'published') {
      var res = await Tapp.federation.getPublished();
      state.published = unwrapListResponse(res);
      updateFeedCountBadges();
    } else if (sub === 'bookmarks') {
      if (typeof Tapp.federation.getBookmarks === 'function') {
        var resBm = await Tapp.federation.getBookmarks();
        state.bookmarks = unwrapListResponse(resBm);
      } else {
        state.bookmarks = [];
      }
      updateFeedCountBadges();
    } else if (sub === 'settings' || sub === 'backup') {
      // Local settings + backup page — no network list load
      state.feedError = null;
    }
    if (state.feedSubTab !== sub) return;
    state.feedLoaded[sub] = true;
    state.feedError = null;
  } catch (e) {
    if (state.feedSubTab !== sub) return;
    // Mark loaded so UI never sticks on blank/skeleton; show error empty state.
    state.feedLoaded[sub] = true;
    state.feedError = getErrorMessage(e) || lang.feedLoadFail || lang.disconnected || '加载失败';
    console.error('[Aro] loadFeedSubTab error:', e);
  } finally {
    if (state.feedSubTab === sub) {
      state.feedLoading = false;
      updateFeedLoadingState();
      updateFeedHeader();
      renderFeedContent();
    }
  }
}

function updateFeedLoadingState() {
  ['refresh-feed-btn', 'refresh-feed-mobile-btn'].forEach(function (id) {
    var refreshBtn = $(id);
    if (!refreshBtn) return;
    refreshBtn.classList.toggle('feed-refresh-loading', !!state.feedLoading);
    refreshBtn.disabled = !!state.feedLoading;
  });
}

function getFeedTitle(sub) {
  if (state.isGuest) return lang.publicFeed || lang.feedTimeline || 'Home';
  if (sub === 'following') return lang.feedFollowing || 'Following';
  if (sub === 'followers') return lang.feedFollowers || 'Followers';
  if (sub === 'published') return lang.feedPublished || 'Published';
  if (sub === 'bookmarks') return lang.feedBookmarks || 'Bookmarks';
  if (sub === 'settings' || sub === 'backup') return lang.settingsTitle || lang.feedSettings || 'Settings';
  return lang.feedTimeline || 'Home';
}

/**
 * Header subtitle — always non-empty for the active tab.
 * Keys: feedHint* (primary) / feedMeta* / feedSub* aliases.
 */
function getFeedHint(sub) {
  if (state.isGuest) {
    return lang.feedHintGuest || lang.feedMetaGuest || lang.publicFeed
      || 'Public posts from this site';
  }
  if (sub === 'following') {
    return lang.feedHintFollowing || lang.feedMetaFollowing || lang.feedSubFollowing
      || lang.feedFollowing || 'People you follow';
  }
  if (sub === 'followers') {
    return lang.feedHintFollowers || lang.feedMetaFollowers || lang.feedSubFollowers
      || lang.feedFollowers || 'People who follow you';
  }
  if (sub === 'settings' || sub === 'backup') {
    return lang.feedHintSettings || lang.settingsHint
      || 'Posting defaults, privacy, and chat backup';
  }
  if (sub === 'published') {
    return lang.feedHintPublished || lang.feedMetaPublished || lang.feedSubPublished
      || lang.feedPublished || "Notes you've published";
  }
  if (sub === 'bookmarks') {
    return lang.feedHintBookmarks || lang.feedMetaBookmarks || lang.feedSubBookmarks
      || lang.feedBookmarks || "Posts you've bookmarked";
  }
  return lang.feedHintTimeline || lang.feedMetaTimeline || lang.feedSubTimeline
    || lang.feedTimeline || 'Posts from people you follow';
}

function updateFeedHeader() {
  var title = $('feed-section-title');
  var meta = $('feed-section-meta');
  var sub = state.feedSubTab;
  var pageTitle = getFeedTitle(sub);
  if (title) title.textContent = pageTitle;
  if (!meta) return;
  // Never leave subtitle blank: helper, loading, or helper · count
  var hint = getFeedHint(sub) || pageTitle || '—';
  if (sub === 'backup') {
    meta.textContent = hint;
    return;
  }
  var allItems = getFeedItems(sub) || [];
  var items = filterFeedItems(sub, allItems);
  var q = normalizeSearchQuery((state.search && state.search.feed) || '');
  if (state.feedLoading && !state.feedLoaded[sub]) {
    meta.textContent = lang.feedLoading || hint;
  } else if (state.feedLoaded[sub] && allItems.length > 0) {
    if (q) {
      meta.textContent = (items.length + ' / ' + allItems.length) + (lang.feedItems ? ' ' + lang.feedItems : '');
    } else {
      var countText = allItems.length + ' ' + (lang.feedItems || '');
      meta.textContent = countText ? (hint + ' · ' + countText) : hint;
    }
  } else {
    meta.textContent = hint;
  }
}

function getFeedItems(sub) {
  if (sub === 'following') return state.following;
  if (sub === 'followers') return state.followers;
  if (sub === 'published') return state.published;
  if (sub === 'bookmarks') return state.bookmarks;
  return state.timeline;
}

function actorSearchParts(actor) {
  if (!actor) return [];
  var handle = actor.username
    ? '@' + actor.username + (actor.domain ? '@' + actor.domain : '')
    : '';
  return [
    actor.display_name,
    actor.username,
    actor.domain,
    handle,
    actor.actor_url,
    actor.bio,
  ];
}

function timelineItemSearchParts(item) {
  var actor = (item && item.actor) || {};
  var contentJson = (item && (item.content_json || item.content || item.object)) || null;
  if (contentJson && contentJson.object && typeof contentJson.object === 'object'
      && !contentJson.content && !(contentJson.source && contentJson.source.content)
      && !contentJson.summary && !contentJson.name) {
    contentJson = contentJson.object;
  }
  var text = '';
  if (contentJson) {
    text = stripHtmlPreview(
      contentJson.title ||
      contentJson.name ||
      (contentJson.source && typeof contentJson.source === 'object' && contentJson.source.content) ||
      contentJson.content ||
      contentJson.summary ||
      contentJson.content_preview ||
      ''
    );
  }
  if (!text && item && item.content_preview) text = stripHtmlPreview(item.content_preview);
  return actorSearchParts(actor).concat([text, item && item.content_preview]);
}

function publishedItemSearchParts(item) {
  if (!item) return [];
  return [
    item.title,
    item.name,
    item.content_preview,
    item.summary,
    item.content_type,
    item.content_id,
    publishedTypeLabel(item.content_type),
  ];
}

/** Apply current feed search query (and home preferences) to a sub-tab list. */
function filterFeedItems(sub, items) {
  items = items || [];
  if (!items.length) return items;
  // Home: optionally hide reposts (Announce activities)
  if (sub === 'timeline' || !sub) {
    var s = state.aroSettings || (typeof loadAroSettings === 'function' ? loadAroSettings() : null);
    if (s && s.showRepostsInHome === false) {
      items = items.filter(function (item) {
        return item && item.activity_type !== 'Announce';
      });
    }
  }
  var q = normalizeSearchQuery((state.search && state.search.feed) || '');
  if (!q) return items;
  return items.filter(function (item) {
    if (sub === 'following' || sub === 'followers') {
      return matchesSearch(q, actorSearchParts(item));
    }
    if (sub === 'published') {
      return matchesSearch(q, publishedItemSearchParts(item));
    }
    return matchesSearch(q, timelineItemSearchParts(item));
  });
}

/** Empty-state title ≈ page title; dedicated emptyTitle* preferred when present. */
function getFeedEmptyTitle(sub) {
  if (sub === 'following') {
    return lang.emptyTitleFollowing || getFeedTitle(sub) || 'Not following anyone';
  }
  if (sub === 'followers') {
    return lang.emptyTitleFollowers || getFeedTitle(sub) || 'No followers yet';
  }
  if (sub === 'published') {
    return lang.emptyTitlePublished || getFeedTitle(sub) || 'Nothing published';
  }
  if (sub === 'bookmarks') {
    return lang.emptyTitleBookmarks || getFeedTitle(sub) || 'No bookmarks yet';
  }
  return lang.emptyTitleTimeline || getFeedTitle(sub) || 'No posts yet';
}

function getFeedEmptyText(sub) {
  if (sub === 'following') {
    return lang.emptyFollowing
      || 'Tap + then Follow to add someone by handle or profile link.';
  }
  if (sub === 'followers') {
    return lang.emptyFollowers
      || 'Share your profile link so others can follow you.';
  }
  if (sub === 'published') {
    return lang.emptyPublished
      || 'Switch to Home and tap + to publish a note or media.';
  }
  if (sub === 'bookmarks') {
    return lang.feedEmptyBookmarks
      || 'No bookmarks yet — tap the bookmark icon on a post';
  }
  return lang.emptyTimeline
    || 'Follow people or publish a post to fill your home feed.';
}

function showFeedEmpty(message, kind) {
  var empty = $('feed-empty');
  if (!empty) {
    console.warn('[Aro] #feed-empty missing');
    return;
  }
  var main = empty.closest('.feed-main');
  if (main) main.classList.add('feed-empty-visible');
  // Inline style on page.html is display:none — force visible flex layout.
  empty.style.display = 'flex';
  empty.style.visibility = 'visible';
  empty.hidden = false;
  empty.removeAttribute('hidden');
  empty.classList.toggle('feed-empty-error', kind === 'error');
  empty.classList.toggle('feed-empty-loading', kind === 'loading');
  // Always show title + body for default empty (not only on error)
  var title = $('feed-empty-title');
  if (title) {
    title.style.display = 'block';
    title.hidden = false;
    if (kind === 'error') {
      title.textContent = lang.feedLoadFail || lang.disconnected || 'Load failed';
    } else if (kind === 'loading') {
      title.textContent = getFeedTitle(state.feedSubTab);
    } else {
      title.textContent = getFeedEmptyTitle(state.feedSubTab) || getFeedTitle(state.feedSubTab);
    }
  }
  var text = $('feed-empty-text');
  if (text) {
    text.style.display = 'block';
    text.hidden = false;
    if (kind === 'loading') {
      text.textContent = lang.feedLoading || message || '…';
    } else {
      text.textContent = message || getFeedEmptyText(state.feedSubTab);
    }
  }
  var retry = $('feed-empty-retry');
  if (retry) {
    retry.textContent = lang.feedRetry || 'Try again';
    retry.style.display = kind === 'error' ? '' : 'none';
    if (!retry.dataset.bound) {
      retry.dataset.bound = '1';
      retry.addEventListener('click', function () { loadFeedSubTab(); });
    }
  }
}

function renderFeedSkeleton() {
  var sub = state.feedSubTab;
  var actorLike = sub === 'following' || sub === 'followers';
  var html = '';
  for (var i = 0; i < (actorLike ? 5 : 4); i++) {
    html += '<div class="feed-skeleton-item' + (actorLike ? ' feed-skeleton-actor' : '') + '">'
      + '<div class="feed-skeleton-avatar"></div>'
      + '<div class="feed-skeleton-body">'
      + '<div class="feed-skeleton-line feed-skeleton-line-short"></div>'
      + (actorLike
        ? '<div class="feed-skeleton-line feed-skeleton-line-mid"></div>'
        : '<div class="feed-skeleton-line"></div><div class="feed-skeleton-line feed-skeleton-line-mid"></div>')
      + '</div>'
      + '</div>';
  }
  return html;
}

function bindFeedContentActions(content) {
  content.querySelectorAll('[data-action-unfollow]').forEach(function (btn) {
    btn.addEventListener('click', function (e) { e.stopPropagation(); doUnfollow(btn.dataset.actionUnfollow); });
  });
  content.querySelectorAll('[data-action-unpublish]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      doUnpublish(btn.dataset.contentType, btn.dataset.contentId);
    });
  });
  content.querySelectorAll('[data-action-delete-post]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      doDeleteTimelinePost({
        content_type: btn.dataset.contentType || '',
        content_id: btn.dataset.contentId || '',
        activity_id: btn.dataset.activityId || '',
        object_id: btn.dataset.objectId || '',
      });
    });
  });
  content.querySelectorAll('[data-action-like]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      doToggleLike(btn.dataset.actionLike, btn.dataset.liked === '1');
    });
  });
  content.querySelectorAll('[data-action-bookmark]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      doToggleBookmark(btn.dataset.actionBookmark, btn.dataset.bookmarked === '1');
    });
  });
  content.querySelectorAll('[data-action-announce]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var oid = btn.dataset.actionAnnounce;
      var isAnnounced = btn.dataset.announced === '1';
      if (isAnnounced) {
        doUnannounce(oid);
      } else {
        openQuoteRepostModal(oid);
      }
    });
  });
  content.querySelectorAll('[data-action-reply]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleReplyComposer(btn.dataset.actionReply);
    });
  });
  content.querySelectorAll('[data-action-reply-cancel]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      state.replyOpenObjectId = null;
      renderFeedContent();
    });
  });
  content.querySelectorAll('[data-action-reply-submit]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var oid = btn.dataset.actionReplySubmit;
      var card = btn.closest('.feed-item');
      var box = card ? card.querySelector('.feed-reply-box textarea') : null;
      var text = box ? box.value : '';
      doSubmitReply(oid, text);
    });
  });
  content.querySelectorAll('[data-action-share]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      openShareModal(btn.dataset.actionShare || '', {
        objectId: btn.dataset.objectId || btn.dataset.actionShare || '',
        linkUrl: btn.dataset.shareUrl || '',
        author: btn.dataset.shareAuthor || '',
      });
    });
  });
  content.querySelectorAll('[data-action-follow-back]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      doFollowBack(btn.dataset.actionFollowBack);
    });
  });
  content.querySelectorAll('[data-action-copy-actor]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var text = btn.dataset.actionCopyActor || '';
      if (!text) return;
      if (typeof copyTextToClipboard === 'function') {
        copyTextToClipboard(text, { showMessage: false });
      }
    });
  });
}

/** True when timeline item was authored by the local identity. */
function isOwnTimelineItem(item) {
  if (!item || state.isGuest) return false;
  var actor = item.actor || {};
  if (actor.is_local) return true;
  var myActor = typeof getIdentityActorUrl === 'function' ? getIdentityActorUrl() : (state.localActorUrl || '');
  var actorUrl = typeof normalizeFederationUrl === 'function'
    ? normalizeFederationUrl(actor.actor_url)
    : String(actor.actor_url || '').trim();
  if (myActor && actorUrl && myActor === actorUrl) return true;
  // Fallback: username (+ domain when both present)
  var identity = state.identity || {};
  var myUser = identity.username || '';
  var theirUser = actor.username || '';
  if (myUser && theirUser && myUser === theirUser) {
    var myDomain = identity.domain || '';
    var theirDomain = actor.domain || '';
    if (!myDomain || !theirDomain || myDomain === theirDomain) return true;
  }
  return false;
}

/** Unwrap content_json / object envelope to the AP object. */
function timelineContentObject(item) {
  if (!item) return null;
  var cj = item.content_json || item.content || item.object || null;
  if (cj && cj.object && typeof cj.object === 'object'
      && !cj.content && !(cj.source && cj.source.content)
      && !cj.summary && !cj.name && !cj['mfp:contentId']) {
    cj = cj.object;
  }
  return cj;
}

/** Extract unpublish target from a timeline item (note / library / report / …). */
function extractPublishTarget(item) {
  var cj = timelineContentObject(item);
  var contentType = '';
  var contentId = '';
  if (cj) {
    contentType = cj['mfp:contentType'] || cj.mfp_contentType || cj.content_type || '';
    contentId = cj['mfp:contentId'] || cj.mfp_contentId || cj.content_id || '';
    if (!contentId && cj.id && typeof cj.id === 'string') {
      var idPath = String(cj.id).split('?')[0].replace(/\/+$/, '');
      var segs = idPath.split('/').filter(Boolean);
      contentId = segs.length ? segs[segs.length - 1] : '';
      if (!contentType) {
        var prev = segs.length >= 2 ? segs[segs.length - 2] : '';
        if (prev === 'notes') contentType = 'note';
        else if (prev === 'reports') contentType = 'report';
        else if (prev === 'library') contentType = 'library';
        else if (prev === 'tapps') contentType = 'tapp';
        else if (prev === 'articles' && segs.length >= 3 && segs[segs.length - 3] === 'brew') contentType = 'brew-article';
      }
    }
  }
  if (!contentType && item.object_type) {
    // Timeline stores MFP content type on object_type for local Creates.
    var ot = String(item.object_type);
    if (ot === 'note' || ot === 'report' || ot === 'library' || ot === 'tapp' || ot === 'brew-article') {
      contentType = ot;
    } else if (ot === 'Note') contentType = 'note';
    else if (ot === 'Article' && contentId) contentType = contentType || 'report';
    else if (ot === 'Collection') contentType = contentType || 'library';
    else if (ot === 'Application') contentType = contentType || 'tapp';
  }
  if (!contentType) contentType = 'note';
  return {
    content_type: contentType,
    content_id: contentId || '',
    activity_id: item && item.activity_id ? String(item.activity_id) : '',
  };
}

function resolveObjectId(item) {
  if (!item) return '';
  if (item.object_id) return String(item.object_id);
  var cj = item.content_json || item.content || item.object || null;
  if (cj && cj.object && typeof cj.object === 'object'
      && !cj.content && !(cj.source && cj.source.content)
      && !cj.summary && !cj.name) {
    cj = cj.object;
  }
  if (cj && cj.id) return String(cj.id);
  if (cj && cj.url && typeof cj.url === 'string') return cj.url;
  return '';
}

function applyInteractionToLists(objectId, patch) {
  function patchItem(it) {
    if (!it) return;
    var oid = resolveObjectId(it);
    if (oid !== objectId) return;
    Object.keys(patch).forEach(function (k) { it[k] = patch[k]; });
  }
  (state.timeline || []).forEach(patchItem);
  (state.bookmarks || []).forEach(patchItem);
}

/** In-flight guards — prevent double-tap races on like/bookmark/announce (X-style). */
var feedInteractionBusy = Object.create(null);

function feedInteractionKey(kind, objectId) {
  return String(kind || '') + '::' + String(objectId || '');
}

function isFeedInteractionBusy(kind, objectId) {
  return !!feedInteractionBusy[feedInteractionKey(kind, objectId)];
}

function setFeedInteractionBusy(kind, objectId, busy) {
  var k = feedInteractionKey(kind, objectId);
  if (busy) feedInteractionBusy[k] = true;
  else delete feedInteractionBusy[k];
  // Light DOM feedback without full re-render (dataset compare — no CSS.escape needed)
  try {
    var attr = kind === 'like' ? 'actionLike'
      : kind === 'bookmark' ? 'actionBookmark'
      : kind === 'announce' ? 'actionAnnounce'
      : '';
    var sel = kind === 'like' ? '[data-action-like]'
      : kind === 'bookmark' ? '[data-action-bookmark]'
      : kind === 'announce' ? '[data-action-announce]'
      : '';
    if (!sel || !attr) return;
    var target = String(objectId);
    document.querySelectorAll(sel).forEach(function (btn) {
      if (String(btn.dataset[attr] || '') !== target) return;
      btn.classList.toggle('is-busy', !!busy);
      btn.disabled = !!busy;
      btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    });
  } catch (eBusy) { /* ignore */ }
}

/** Patch like/bookmark button DOM in place (avoids full list re-render flicker). */
function patchInteractionButtons(objectId, patch) {
  if (!objectId || !patch) return;
  try {
    var cards = document.querySelectorAll('.feed-item[data-object-id]');
    cards.forEach(function (card) {
      if (card.getAttribute('data-object-id') !== String(objectId)) return;
      if (patch.liked_by_me != null) {
        var likeBtn = card.querySelector('[data-action-like]');
        if (likeBtn) {
          var liked = !!patch.liked_by_me;
          likeBtn.dataset.liked = liked ? '1' : '0';
          likeBtn.classList.toggle('is-active', liked);
          likeBtn.classList.toggle('is-liked', liked);
          likeBtn.setAttribute('aria-pressed', liked ? 'true' : 'false');
          likeBtn.setAttribute('title', liked ? (lang.unlikeBtn || 'Unlike') : (lang.likeBtn || 'Like'));
          likeBtn.setAttribute('aria-label', liked ? (lang.unlikeBtn || 'Unlike') : (lang.likeBtn || 'Like'));
          if (patch.like_count != null) {
            var lc = likeBtn.querySelector('.feed-item-action-count');
            var n = Math.max(0, Number(patch.like_count) || 0);
            if (n > 0) {
              if (!lc) {
                lc = document.createElement('span');
                lc.className = 'feed-item-action-count';
                likeBtn.appendChild(lc);
              }
              lc.textContent = String(n);
            } else if (lc) {
              lc.remove();
            }
          }
        }
      }
      if (patch.bookmarked_by_me != null || patch.is_bookmarked != null) {
        var bmBtn = card.querySelector('[data-action-bookmark]');
        if (bmBtn) {
          var bookmarked = !!(patch.bookmarked_by_me != null ? patch.bookmarked_by_me : patch.is_bookmarked);
          bmBtn.dataset.bookmarked = bookmarked ? '1' : '0';
          bmBtn.classList.toggle('is-active', bookmarked);
          bmBtn.classList.toggle('is-bookmarked', bookmarked);
          bmBtn.setAttribute('aria-pressed', bookmarked ? 'true' : 'false');
          bmBtn.setAttribute('title', bookmarked ? (lang.unbookmarkBtn || 'Remove bookmark') : (lang.bookmarkBtn || 'Bookmark'));
          bmBtn.setAttribute('aria-label', bookmarked ? (lang.unbookmarkBtn || 'Remove bookmark') : (lang.bookmarkBtn || 'Bookmark'));
        }
      }
      if (patch.announced_by_me != null) {
        var anBtn = card.querySelector('[data-action-announce]');
        if (anBtn) {
          var announced = !!patch.announced_by_me;
          anBtn.dataset.announced = announced ? '1' : '0';
          anBtn.classList.toggle('is-active', announced);
          anBtn.classList.toggle('is-announced', announced);
          anBtn.setAttribute('aria-pressed', announced ? 'true' : 'false');
          anBtn.setAttribute('title', announced ? (lang.unrepostBtn || 'Undo repost') : (lang.repostBtn || 'Repost'));
          anBtn.setAttribute('aria-label', announced ? (lang.unrepostBtn || 'Undo repost') : (lang.repostBtn || 'Repost'));
          if (patch.announce_count != null) {
            var ac = anBtn.querySelector('.feed-item-action-count');
            var an = Math.max(0, Number(patch.announce_count) || 0);
            if (an > 0) {
              if (!ac) {
                ac = document.createElement('span');
                ac.className = 'feed-item-action-count';
                anBtn.appendChild(ac);
              }
              ac.textContent = String(an);
            } else if (ac) {
              ac.remove();
            }
          }
        }
      }
    });
  } catch (ePatch) { /* ignore */ }
}

async function doToggleLike(objectId, currentlyLiked) {
  if (!objectId || state.isGuest) return;
  if (!Tapp.federation || typeof Tapp.federation.like !== 'function') return;
  if (isFeedInteractionBusy('like', objectId)) return;
  setFeedInteractionBusy('like', objectId, true);
  // Optimistic
  var next = !currentlyLiked;
  var prevCount = ((findFeedItem(objectId) || {}).like_count || 0);
  var nextCount = Math.max(0, prevCount + (next ? 1 : -1));
  applyInteractionToLists(objectId, {
    liked_by_me: next,
    like_count: nextCount
  });
  patchInteractionButtons(objectId, { liked_by_me: next, like_count: nextCount });
  try {
    var res = next
      ? await Tapp.federation.like(objectId)
      : await Tapp.federation.unlike(objectId);
    var data = (res && res.data) || res || {};
    var finalPatch = {
      liked_by_me: data.liked_by_me != null ? data.liked_by_me : next,
      like_count: data.like_count != null ? data.like_count : nextCount,
      bookmarked_by_me: data.bookmarked_by_me,
      announced_by_me: data.announced_by_me,
      announce_count: data.announce_count,
      reply_count: data.reply_count
    };
    applyInteractionToLists(objectId, finalPatch);
    patchInteractionButtons(objectId, finalPatch);
  } catch (e) {
    applyInteractionToLists(objectId, {
      liked_by_me: currentlyLiked,
      like_count: prevCount
    });
    patchInteractionButtons(objectId, { liked_by_me: currentlyLiked, like_count: prevCount });
    notifyError(lang.likeFail || 'Like failed', e);
  } finally {
    setFeedInteractionBusy('like', objectId, false);
  }
}

async function doToggleBookmark(objectId, currentlyBookmarked) {
  if (!objectId || state.isGuest) return;
  if (!Tapp.federation || typeof Tapp.federation.bookmark !== 'function') return;
  if (isFeedInteractionBusy('bookmark', objectId)) return;
  setFeedInteractionBusy('bookmark', objectId, true);
  var next = !currentlyBookmarked;
  applyInteractionToLists(objectId, {
    bookmarked_by_me: next,
    is_bookmarked: next
  });
  patchInteractionButtons(objectId, { bookmarked_by_me: next, is_bookmarked: next });
  try {
    var res = next
      ? await Tapp.federation.bookmark(objectId)
      : await Tapp.federation.unbookmark(objectId);
    var data = (res && res.data) || res || {};
    var finalBm = data.bookmarked_by_me != null ? data.bookmarked_by_me : next;
    applyInteractionToLists(objectId, {
      bookmarked_by_me: finalBm,
      is_bookmarked: finalBm
    });
    patchInteractionButtons(objectId, { bookmarked_by_me: finalBm, is_bookmarked: finalBm });
    // Refresh bookmarks list if open or after unbookmark
    state.feedLoaded.bookmarks = false;
    if (state.feedSubTab === 'bookmarks') {
      await loadFeedSubTab();
    } else if (typeof Tapp.federation.getBookmarks === 'function') {
      Tapp.federation.getBookmarks().then(function (r) {
        state.bookmarks = unwrapListResponse(r);
        updateFeedCountBadges();
      }).catch(function () {});
    }
  } catch (e) {
    applyInteractionToLists(objectId, {
      bookmarked_by_me: currentlyBookmarked,
      is_bookmarked: currentlyBookmarked
    });
    patchInteractionButtons(objectId, {
      bookmarked_by_me: currentlyBookmarked,
      is_bookmarked: currentlyBookmarked
    });
    notifyError(lang.bookmarkFail || 'Bookmark failed', e);
  } finally {
    setFeedInteractionBusy('bookmark', objectId, false);
  }
}

var quoteRepostObjectId = null;
var quoteRepostSubmitting = false;

function feedItemPreviewText(item) {
  if (!item) return '';
  var cj = item.content_json || item.content || item.object || null;
  if (cj && cj.object && typeof cj.object === 'object'
      && !cj.content && !(cj.source && cj.source.content)
      && !cj.summary && !cj.name) {
    cj = cj.object;
  }
  var text = '';
  if (cj) {
    text = stripHtmlPreview(
      (cj.source && typeof cj.source === 'object' && cj.source.content) ||
      cj.content ||
      cj.summary ||
      cj.name ||
      cj.content_preview ||
      ''
    );
  }
  if (!text && item.content_preview) text = stripHtmlPreview(item.content_preview);
  return String(text || '').trim();
}

/** Max nested quote cards rendered in feed / modal (matches backend). */
var MAX_QUOTE_RENDER_DEPTH = 3;

function attributedToLabel(attributed) {
  if (!attributed) return '';
  if (typeof attributed === 'string') {
    return actorLabelFromUrl(attributed) || attributed;
  }
  if (typeof attributed === 'object') {
    return attributed.name || attributed.preferredUsername || attributed.username
      || actorLabelFromUrl(attributed.id || attributed.url || '') || '';
  }
  return '';
}

function quotedObjectText(quoted) {
  if (!quoted || typeof quoted !== 'object') return '';
  return stripHtmlPreview(
    (quoted.source && quoted.source.content) ||
    quoted.content_preview ||
    quoted.content ||
    quoted.summary ||
    quoted.name ||
    ''
  );
}

/**
 * Render nested mfp:quotedObject chain as distinct cards.
 * Each level is a snapshot embedded at repost time (not a live pointer).
 */
function renderQuotedObjectHtml(quoted, depth) {
  depth = depth || 0;
  if (!quoted || typeof quoted !== 'object') return '';
  if (depth >= MAX_QUOTE_RENDER_DEPTH) {
    return '<div class="feed-item-quoted feed-item-quoted-truncated" data-quote-depth="' + depth + '">'
      + esc(lang.quoteRepostTruncated || 'Earlier quotes not shown') + '</div>';
  }
  var author = attributedToLabel(quoted.attributedTo);
  var text = quotedObjectText(quoted);
  var isNestedRepost = quoted['mfp:kind'] === 'repost' || quoted.mfp_kind === 'repost'
    || quoted['mfp:contentType'] === 'repost';
  var label = isNestedRepost
    ? (lang.quoteRepostNested || lang.quoteRepostQuoted || 'Quoted repost')
    : (lang.quoteRepostQuoted || 'Quoted post');
  // Soft fill only — no border chrome; nested levels stay flat cards.
  var h = '<div class="feed-item-quoted' + (isNestedRepost ? ' is-nested-repost' : '') + '" data-quote-depth="' + depth + '">';
  h += '<div class="feed-item-quoted-meta">';
  if (author) {
    h += '<span class="feed-item-quoted-author">' + esc(author) + '</span>';
    h += '<span class="feed-item-quoted-kind">' + esc(label) + '</span>';
  } else {
    h += '<span class="feed-item-quoted-kind">' + esc(label) + '</span>';
  }
  h += '</div>';
  if (text && !looksLikeBareUrl(text)) {
    h += '<div class="feed-item-quoted-text">' + esc(String(text).slice(0, 280)) + '</div>';
  } else if (text && looksLikeBareUrl(text)) {
    // Prefer human label over raw activity URL
    h += '<div class="feed-item-quoted-text" style="opacity:.75">'
      + esc(lang.quoteRepostQuoted || 'Quoted post') + '</div>';
  } else if (quoted.id && !looksLikeBareUrl(String(quoted.id))) {
    h += '<div class="feed-item-quoted-text feed-item-quoted-id">' + esc(String(quoted.id).slice(0, 80)) + '</div>';
  } else {
    h += '<div class="feed-item-quoted-text" style="opacity:.75">'
      + esc(lang.quoteRepostQuoted || 'Quoted post') + '</div>';
  }
  var inner = quoted['mfp:quotedObject'] || quoted.mfp_quotedObject || null;
  if (inner && typeof inner === 'object') {
    h += renderQuotedObjectHtml(inner, depth + 1);
  } else if (quoted['mfp:quoteTruncated'] || quoted.mfp_quoteTruncated) {
    h += '<div class="feed-item-quoted-truncated">'
      + esc(lang.quoteRepostTruncated || 'Earlier quotes not shown') + '</div>';
  }
  h += '</div>';
  return h;
}

/** True when s is essentially a bare http(s) URL (not prose). */
function looksLikeBareUrl(s) {
  s = String(s || '').trim();
  if (!s || s.length > 240) return false;
  if (/\s/.test(s)) return false;
  return /^https?:\/\//i.test(s);
}

function openQuoteRepostModal(objectId) {
  if (!objectId || state.isGuest) return;
  if (!Tapp.federation || typeof Tapp.federation.announce !== 'function') return;
  quoteRepostObjectId = objectId;
  var dlg = $('quote-repost-dialog');
  var ta = $('quote-repost-text');
  var preview = $('quote-repost-preview');
  if (ta) ta.value = '';
  if (preview) {
    var item = findFeedItem(objectId);
    var cj = typeof timelineContentObject === 'function' ? timelineContentObject(item) : null;
    var text = feedItemPreviewText(item);
    var body = '';
    // Single snapshot card only (no outer chrome + inner card double wrap).
    // If quoting a repost, prefer its embedded original so we don't fake an extra nest level.
    if (cj && (cj['mfp:kind'] === 'repost' || cj.mfp_kind === 'repost' || item && item.object_type === 'repost')) {
      var nested = cj['mfp:quotedObject'] || cj.mfp_quotedObject || null;
      if (nested && typeof nested === 'object') {
        body = renderQuotedObjectHtml(nested, 0);
      } else {
        body = renderQuotedObjectHtml({
          id: resolveObjectId(item) || objectId,
          attributedTo: (item && item.actor && item.actor.actor_url) || (cj && cj.attributedTo) || '',
          content_preview: text,
          type: 'Note'
        }, 0);
      }
    } else if (text || (cj && cj.id)) {
      body = renderQuotedObjectHtml({
        id: objectId,
        attributedTo: (item && item.actor && item.actor.actor_url) || (cj && cj.attributedTo) || '',
        content_preview: text || '',
        type: 'Note'
      }, 0);
    }
    if (body) {
      preview.hidden = false;
      preview.innerHTML = body;
    } else {
      preview.hidden = true;
      preview.innerHTML = '';
    }
  }
  applyQuoteRepostLabels();
  if (dlg) {
    showAroOverlay(dlg);
  }
  if (ta) {
    try { ta.focus(); } catch (e) {}
  }
}

function closeQuoteRepostModal() {
  quoteRepostObjectId = null;
  quoteRepostSubmitting = false;
  var dlg = $('quote-repost-dialog');
  var ta = $('quote-repost-text');
  var preview = $('quote-repost-preview');
  if (ta) ta.value = '';
  if (preview) { preview.hidden = true; preview.innerHTML = ''; }
  if (!dlg) return;
  if (typeof aroDismiss === 'function') {
    aroDismiss(dlg, { ms: 160 });
  } else {
    dlg.style.display = 'none';
    dlg.hidden = true;
  }
}

function applyQuoteRepostLabels() {
  var el;
  el = $('quote-repost-title'); if (el) el.textContent = lang.quoteRepostTitle || lang.repostBtn || 'Quote repost';
  el = $('quote-repost-close'); if (el) el.setAttribute('aria-label', lang.composeCancel || lang.close || 'Close');
  el = $('quote-repost-text'); if (el) el.placeholder = lang.quoteRepostPlaceholder || 'Add a comment…';
  el = $('quote-repost-cancel'); if (el) el.textContent = lang.replyCancel || lang.composeCancel || 'Cancel';
  el = $('quote-repost-submit'); if (el) el.textContent = lang.quoteRepostSubmit || lang.repostBtn || 'Repost';
}

// ---------------------------------------------------------------------------
// External share intent (X-inspired; host compose if available, never server post)
// ---------------------------------------------------------------------------
var shareModalState = { objectId: '', linkUrl: '', author: '', intentUrl: '' };

function buildLocalXIntentUrl(text, url) {
  var params = [];
  var t = String(text || '').trim();
  if (t) params.push('text=' + encodeURIComponent(t));
  if (url) params.push('url=' + encodeURIComponent(String(url)));
  return 'https://x.com/intent/tweet' + (params.length ? '?' + params.join('&') : '');
}

function composeShareTextFromItem(objectId, opts) {
  opts = opts || {};
  var item = objectId ? findFeedItem(objectId) : null;
  var preview = feedItemPreviewText(item) || '';
  var author = opts.author || '';
  if (!author && item && item.actor) {
    author = item.actor.display_name || '';
    if (!author && item.actor.username) {
      author = '@' + item.actor.username + (item.actor.domain ? '@' + item.actor.domain : '');
    }
  }
  var link = opts.linkUrl || '';
  if (!link && item) {
    var cj = timelineContentObject(item);
    if (cj && typeof cj.url === 'string' && cj.url) link = cj.url;
    else if (objectId && /^https?:\/\//i.test(objectId)) link = objectId;
  }
  var parts = [];
  if (author) parts.push(author + ':');
  if (preview) parts.push(preview);
  var body = parts.join(' ').trim();
  if (!body) body = lang.shareDefaultText || 'Shared from Myriad federation';
  // Soft cap for local compose (host may recompose with exact max).
  if (body.length > 240) body = body.slice(0, 237) + '…';
  return { text: body, url: link || objectId || '', author: author };
}

function updateShareCharCount() {
  var ta = $('feed-share-text');
  var el = $('feed-share-chars');
  if (!ta || !el) return;
  var n = String(ta.value || '').length;
  el.textContent = String(n);
  el.classList.toggle('is-over', n > 280);
}

function applyShareModalLabels() {
  var el;
  el = $('feed-share-title'); if (el) el.textContent = lang.shareTitle || lang.shareBtn || 'Share';
  el = $('feed-share-close'); if (el) el.setAttribute('aria-label', lang.composeCancel || lang.close || 'Close');
  el = $('feed-share-hint'); if (el) el.textContent = lang.shareHint
    || 'Copy text or open an external share link. Myriad never posts for you.';
  el = $('feed-share-text'); if (el) el.placeholder = lang.sharePlaceholder || 'Share text…';
  el = $('feed-share-copy'); if (el) el.textContent = lang.shareCopyText || 'Copy text';
  el = $('feed-share-copy-link'); if (el) el.textContent = lang.shareCopyLink || 'Copy link';
  el = $('feed-share-x'); if (el) el.textContent = lang.shareOpenX || 'Open X';
  el = $('feed-share-cancel'); if (el) el.textContent = lang.close || lang.composeCancel || 'Close';
  el = $('feed-share-mode'); if (el) {
    el.hidden = false;
    el.textContent = lang.shareModeIntent || 'Intent only';
  }
}

async function openShareModal(objectId, opts) {
  opts = opts || {};
  var composed = composeShareTextFromItem(objectId, opts);
  shareModalState = {
    objectId: objectId || opts.objectId || '',
    linkUrl: composed.url || opts.linkUrl || '',
    author: composed.author || opts.author || '',
    intentUrl: '',
  };
  applyShareModalLabels();
  var ta = $('feed-share-text');
  if (ta) ta.value = composed.text;
  updateShareCharCount();

  // Optional status probe (host PR #225) — show intent-only mode; refuse can_post.
  var modeEl = $('feed-share-mode');
  if (Tapp.federation && typeof Tapp.federation.getExternalShareStatus === 'function') {
    try {
      var stRes = await Tapp.federation.getExternalShareStatus();
      var st = (stRes && stRes.data) || stRes || {};
      if (st && st.can_post === true) {
        console.warn('[Aro] host reported can_post; refusing server-side post path');
      }
      if (modeEl) {
        modeEl.hidden = false;
        if (st && st.mode === 'intent') {
          modeEl.textContent = lang.shareModeIntent || 'Intent only';
        } else if (st && st.mode) {
          modeEl.textContent = String(st.mode);
        }
      }
    } catch (eSt) {
      /* local fallback still fine */
    }
  }

  // Prefer host compose (same rules as /api/x/share) when bridge is present.
  if (Tapp.federation && typeof Tapp.federation.composeExternalShare === 'function') {
    try {
      var res = await Tapp.federation.composeExternalShare({
        text: composed.text,
        url: shareModalState.linkUrl || undefined,
        max_length: 280,
      });
      var data = (res && res.data) || res || {};
      if (data && data.text) {
        if (ta) ta.value = data.text;
        updateShareCharCount();
      }
      if (data && data.intent_url) {
        shareModalState.intentUrl = String(data.intent_url);
      }
      if (data && data.mode && data.mode !== 'intent') {
        console.warn('[Aro] external share mode is not intent; ignoring post path');
        shareModalState.intentUrl = '';
      }
      if (data && data.can_post === true) {
        console.warn('[Aro] compose returned can_post; clearing intent to force local');
        shareModalState.intentUrl = '';
      }
    } catch (eCompose) {
      console.warn('[Aro] composeExternalShare failed; using local intent', eCompose);
    }
  }
  if (!shareModalState.intentUrl) {
    shareModalState.intentUrl = buildLocalXIntentUrl(
      ta ? ta.value : composed.text,
      shareModalState.linkUrl,
    );
  }

  var dlg = $('feed-share-dialog');
  if (dlg) showAroOverlay(dlg);
  if (ta) {
    try { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } catch (eF) {}
  }
}

function closeShareModal() {
  shareModalState = { objectId: '', linkUrl: '', author: '', intentUrl: '' };
  var dlg = $('feed-share-dialog');
  var ta = $('feed-share-text');
  if (ta) ta.value = '';
  if (!dlg) return;
  if (typeof aroDismiss === 'function') {
    aroDismiss(dlg, { ms: 160 });
  } else {
    dlg.style.display = 'none';
    dlg.hidden = true;
  }
}

async function doShareCopyText() {
  var ta = $('feed-share-text');
  var text = ta ? String(ta.value || '') : '';
  if (!text) return;
  await copyTextToClipboard(text, { showMessage: false });
}

async function doShareCopyLink() {
  var link = shareModalState.linkUrl || shareModalState.objectId || '';
  if (!link) {
    try {
      Tapp.ui.showNotification({
        title: lang.shareNoLink || 'No link available',
        type: 'warning',
      });
    } catch (e0) {}
    return;
  }
  await copyTextToClipboard(link, { showMessage: false });
}

function doShareOpenX() {
  var ta = $('feed-share-text');
  var text = ta ? String(ta.value || '').trim() : '';
  var url = shareModalState.intentUrl;
  // Rebuild if user edited text after open
  if (text) {
    url = buildLocalXIntentUrl(text, shareModalState.linkUrl);
    shareModalState.intentUrl = url;
  }
  if (!url) {
    try {
      Tapp.ui.showNotification({
        title: lang.shareFail || "Couldn't open share link",
        type: 'error',
      });
    } catch (e1) {}
    return;
  }
  try {
    var opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      // Sandbox may block window.open — fall back to copy intent URL
      copyTextToClipboard(url, { showMessage: false });
      try {
        Tapp.ui.showNotification({
          title: lang.shareCopiedIntent || 'Share link copied — paste in your browser',
          type: 'info',
        });
      } catch (e2) {}
      return;
    }
    try {
      Tapp.ui.showNotification({
        title: lang.shareOpenedX || 'Opened X share',
        message: lang.shareModeIntent || 'Intent only — you complete the post',
        type: 'success',
      });
    } catch (e3) {}
  } catch (eOpen) {
    copyTextToClipboard(url, { showMessage: false });
    try {
      Tapp.ui.showNotification({
        title: lang.shareCopiedIntent || 'Share link copied — paste in your browser',
        type: 'info',
      });
    } catch (e4) {}
  }
}

/** Build a Set of actor URLs the local user is following (accepted). */
function followingActorUrlSet() {
  var set = {};
  (state.following || []).forEach(function (a) {
    if (!a) return;
    var u = typeof normalizeFederationUrl === 'function'
      ? normalizeFederationUrl(a.actor_url)
      : String(a.actor_url || '').trim();
    if (u) set[u] = a;
    if (a.actor_url) set[String(a.actor_url)] = a;
  });
  return set;
}

function isActorInFollowing(actorUrl) {
  if (!actorUrl) return false;
  var set = followingActorUrlSet();
  var u = typeof normalizeFederationUrl === 'function'
    ? normalizeFederationUrl(actorUrl)
    : String(actorUrl).trim();
  return !!(set[u] || set[String(actorUrl)]);
}

async function doFollowBack(actorUrl) {
  if (!actorUrl || state.isGuest) return;
  if (!Tapp.federation || typeof Tapp.federation.follow !== 'function') return;
  try {
    await Tapp.federation.follow(actorUrl);
    try {
      Tapp.ui.showNotification({
        title: lang.followBtn || 'Follow',
        message: lang.followQueued || 'Follow request sent.',
        type: 'success',
      });
    } catch (e0) {}
    state.feedLoaded.following = false;
    // Refresh following + current tab
    try {
      var res = await Tapp.federation.getFollowing();
      state.following = unwrapListResponse(res);
      updateFeedNavBadges();
    } catch (e1) {}
    if (state.feedSubTab === 'followers' || state.feedSubTab === 'following') {
      renderFeedContent();
    }
  } catch (e) {
    notifyError(lang.followFail || "Couldn't follow", e);
  }
}

async function doSubmitQuoteRepost() {
  var objectId = quoteRepostObjectId;
  if (!objectId || state.isGuest || quoteRepostSubmitting) return;
  if (!Tapp.federation || typeof Tapp.federation.announce !== 'function') return;
  var ta = $('quote-repost-text');
  var content = ta ? String(ta.value || '').trim() : '';
  if (!content) {
    try {
      Tapp.ui.showNotification({
        title: lang.quoteRepostNeedContent || 'Write something before reposting',
        type: 'warning'
      });
    } catch (e0) {
      notifyError(lang.quoteRepostNeedContent || 'Write something before reposting');
    }
    if (ta) try { ta.focus(); } catch (e1) {}
    return;
  }
  quoteRepostSubmitting = true;
  var submitBtn = $('quote-repost-submit');
  if (submitBtn) submitBtn.disabled = true;
  // Optimistic
  applyInteractionToLists(objectId, {
    announced_by_me: true,
    announce_count: Math.max(0, ((findFeedItem(objectId) || {}).announce_count || 0) + 1)
  });
  renderFeedContent();
  try {
    var res = await Tapp.federation.announce(objectId, content);
    var data = (res && res.data) || res || {};
    if (data && data.success === false) {
      throw new Error(data.error || lang.quoteRepostFail || lang.repostFail || 'Repost failed');
    }
    applyInteractionToLists(objectId, {
      announced_by_me: data.announced_by_me != null ? data.announced_by_me : true,
      announce_count: data.announce_count != null ? data.announce_count : undefined
    });
    closeQuoteRepostModal();
    state.feedLoaded.timeline = false;
    if (state.feedSubTab === 'timeline') {
      try { await loadFeedSubTab(); } catch (e2) { renderFeedContent(); }
    } else {
      renderFeedContent();
    }
    try {
      Tapp.ui.showNotification({
        title: lang.repostSuccess || 'Reposted',
        type: 'success'
      });
    } catch (e3) {}
  } catch (e) {
    applyInteractionToLists(objectId, {
      announced_by_me: false,
      announce_count: Math.max(0, ((findFeedItem(objectId) || {}).announce_count || 0) - 1)
    });
    renderFeedContent();
    notifyError(lang.quoteRepostFail || lang.repostFail || 'Repost failed', e);
  } finally {
    quoteRepostSubmitting = false;
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function doUnannounce(objectId) {
  if (!objectId || state.isGuest) return;
  if (!Tapp.federation || typeof Tapp.federation.unannounce !== 'function') return;
  if (isFeedInteractionBusy('announce', objectId)) return;
  setFeedInteractionBusy('announce', objectId, true);
  var prevCount = ((findFeedItem(objectId) || {}).announce_count || 0);
  var nextCount = Math.max(0, prevCount - 1);
  applyInteractionToLists(objectId, {
    announced_by_me: false,
    announce_count: nextCount
  });
  patchInteractionButtons(objectId, { announced_by_me: false, announce_count: nextCount });
  try {
    var res = await Tapp.federation.unannounce(objectId);
    var data = (res && res.data) || res || {};
    var finalPatch = {
      announced_by_me: data.announced_by_me != null ? data.announced_by_me : false,
      announce_count: data.announce_count != null ? data.announce_count : nextCount
    };
    applyInteractionToLists(objectId, finalPatch);
    patchInteractionButtons(objectId, finalPatch);
    state.feedLoaded.timeline = false;
  } catch (e) {
    applyInteractionToLists(objectId, {
      announced_by_me: true,
      announce_count: prevCount
    });
    patchInteractionButtons(objectId, { announced_by_me: true, announce_count: prevCount });
    notifyError(lang.unrepostFail || lang.repostFail || 'Undo repost failed', e);
  } finally {
    setFeedInteractionBusy('announce', objectId, false);
  }
}

function toggleReplyComposer(objectId) {
  if (!objectId || state.isGuest) return;
  if (state.replyOpenObjectId === objectId) {
    state.replyOpenObjectId = null;
  } else {
    state.replyOpenObjectId = objectId;
  }
  renderFeedContent();
}

async function doSubmitReply(objectId, text) {
  if (!objectId || state.isGuest) return;
  text = String(text || '').trim();
  if (!text) return;
  if (!Tapp.federation || typeof Tapp.federation.createNote !== 'function') {
    notifyError(lang.replyFail || 'Reply failed');
    return;
  }
  try {
    var raw = await Tapp.federation.createNote({
      text: text,
      visibility: (typeof getDefaultPostVisibility === 'function' ? getDefaultPostVisibility() : 'public'),
      in_reply_to: objectId
    });
    var publishRes = unwrapPublishResult(raw);
    if (publishRes && publishRes.success === false) {
      throw new Error(publishRes.error || lang.replyFail || 'Reply failed');
    }
    state.replyOpenObjectId = null;
    applyInteractionToLists(objectId, {
      reply_count: ((findFeedItem(objectId) || {}).reply_count || 0) + 1
    });
    state.feedLoaded.timeline = false;
    state.feedLoaded.published = false;
    try {
      Tapp.ui.showNotification({
        title: lang.replySuccess || 'Reply posted',
        type: 'success'
      });
    } catch (e2) {}
    if (state.feedSubTab === 'timeline') {
      await loadFeedSubTab();
    } else {
      renderFeedContent();
    }
  } catch (e) {
    notifyError(lang.replyFail || 'Reply failed', e);
  }
}

function findFeedItem(objectId) {
  // Include published so share compose from 已发布 can resolve preview text.
  var lists = [state.timeline, state.bookmarks, state.published];
  for (var i = 0; i < lists.length; i++) {
    var list = lists[i] || [];
    for (var j = 0; j < list.length; j++) {
      if (resolveObjectId(list[j]) === objectId) return list[j];
    }
  }
  return null;
}

function renderFeedContent() {
  var content = $('feed-content');
  var empty = $('feed-empty');
  if (!content) return;
  var main = content.closest('.feed-main');
  if (main) main.classList.remove('feed-empty-visible');

  var sub = state.feedSubTab;
  var searchBar = document.querySelector('.feed-search-bar');

  // Profile → settings (includes backup subsection)
  if (sub === 'settings' || sub === 'backup') {
    if (searchBar) searchBar.style.display = 'none';
    if (empty) empty.style.display = 'none';
    if (typeof renderSettingsPage === 'function') {
      renderSettingsPage();
    } else if (typeof renderBackupPage === 'function') {
      renderBackupPage();
    } else {
      content.innerHTML = '<div class="settings-page"><div class="backup-card"><p class="backup-card-desc">'
        + esc(lang.settingsTitle || 'Settings') + '</p></div></div>';
    }
    return;
  }
  if (searchBar) searchBar.style.display = '';

  var allItems = getFeedItems(sub) || [];
  var items = filterFeedItems(sub, allItems);
  var hasLoaded = !!state.feedLoaded[sub];
  var q = normalizeSearchQuery((state.search && state.search.feed) || '');
  var html = '';

  if (state.feedLoading && !hasLoaded) {
    content.innerHTML = renderFeedSkeleton();
    if (empty) empty.style.display = 'none';
    return;
  }

  if (state.feedError) {
    content.innerHTML = '';
    if (empty) empty.style.display = 'none';
    showFeedEmpty(state.feedError, 'error');
    return;
  }

  if (!allItems || allItems.length === 0) {
    content.innerHTML = '';
    // Prefer empty UI even before first load completes (avoids pure white main).
    showFeedEmpty(getFeedEmptyText(sub), hasLoaded ? 'empty' : (state.feedLoading ? 'loading' : 'empty'));
    return;
  }

  if (items.length === 0 && q) {
    content.innerHTML = searchNoResultsHtml();
    if (empty) empty.style.display = 'none';
    return;
  }

  if (empty) empty.style.display = 'none';

  if (sub === 'timeline' || sub === 'bookmarks') {
    items.forEach(function (item) {
      html += renderTimelineItem(item);
    });
  } else if (sub === 'following') {
    items.forEach(function (actor) {
      html += renderActorItem(actor, 'following');
    });
  } else if (sub === 'followers') {
    items.forEach(function (actor) {
      html += renderActorItem(actor, 'followers');
    });
  } else if (sub === 'published') {
    items.forEach(function (item) {
      html += renderPublishedItem(item);
    });
  }

  content.innerHTML = html;
  bindFeedContentActions(content);
}

function stripHtmlPreview(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim();
}

function extractNoteAttachments(contentJson) {
  if (!contentJson) return [];
  var atts = contentJson.attachment || contentJson.attachments || [];
  if (!Array.isArray(atts)) {
    if (atts && typeof atts === 'object') atts = [atts];
    else return [];
  }
  return atts.filter(function (a) { return a && a.url; });
}

function renderTimelineMedia(attachments) {
  if (!attachments || !attachments.length) return '';
  var multi = attachments.length >= 2;
  var h = '<div class="feed-item-media' + (multi ? ' feed-item-media-grid' : ' feed-item-media-single') + '">';
  attachments.forEach(function (att) {
    var url = att.url;
    var mime = (att.mediaType || att.media_type || '').toLowerCase();
    var type = (att.type || '').toLowerCase();
    var isVideo = type === 'video' || mime.indexOf('video/') === 0;
    if (multi) {
      h += '<div class="feed-media-cell">';
      if (isVideo) {
        h += '<video src="' + esc(url) + '" controls playsinline preload="metadata"></video>';
      } else {
        h += '<img src="' + esc(url) + '" alt="" loading="lazy" />';
      }
      h += '</div>';
    } else if (isVideo) {
      h += '<video src="' + esc(url) + '" controls playsinline preload="metadata"></video>';
    } else {
      h += '<img src="' + esc(url) + '" alt="" loading="lazy" />';
    }
  });
  h += '</div>';
  return h;
}

function actorLabelFromUrl(url) {
  if (!url) return '';
  try {
    var path = String(url).replace(/\/+$/, '');
    var seg = path.split('/').pop() || '';
    return seg || url;
  } catch (e) {
    return String(url);
  }
}

function renderTimelineItem(item) {
  var actor = item.actor || {};
  var name = actor.display_name || actor.username || actorLabelFromUrl(actor.actor_url) || '?';
  var handle = actor.username
    ? '@' + actor.username + (actor.domain ? '@' + actor.domain : '')
    : (actor.actor_url ? actor.actor_url : '');
  var rawTs = item.created_at || item.received_at || item.timestamp || '';
  var ts = '';
  try { ts = timeAgo(rawTs); } catch (e) {}
  var tsTitle = '';
  try {
    if (rawTs) {
      var dTs = new Date(rawTs);
      if (!isNaN(dTs.getTime())) tsTitle = dTs.toLocaleString();
    }
  } catch (eTs) {}
  // content_json is normally the AP object; tolerate full Create envelope or aliases.
  var contentJson = item.content_json || item.content || item.object || null;
  if (contentJson && contentJson.object && typeof contentJson.object === 'object'
      && !contentJson.content && !(contentJson.source && contentJson.source.content)
      && !contentJson.summary && !contentJson.name) {
    contentJson = contentJson.object;
  }
  var text = '';
  var linkUrl = '';
  var inReplyTo = '';
  if (contentJson) {
    text = stripHtmlPreview(
      contentJson.title ||
      contentJson.name ||
      (contentJson.source && typeof contentJson.source === 'object' && contentJson.source.content) ||
      contentJson.content ||
      contentJson.summary ||
      contentJson.content_preview ||
      ''
    );
    // Prefer explicit external link; ignore AP Note self-url (otherwise whole body becomes a hyperlink).
    linkUrl = contentJson.link || '';
    if (!linkUrl && contentJson.url && typeof contentJson.url === 'string') {
      var selfId = contentJson.id || '';
      if (contentJson.url !== selfId && contentJson.type && contentJson.type !== 'Note'
          && contentJson['mfp:kind'] !== 'repost' && contentJson.mfp_kind !== 'repost') {
        linkUrl = contentJson.url;
      }
    }
    if (typeof linkUrl !== 'string') linkUrl = '';
    // Ring brew entries often put source as a string name
    if (!text && contentJson.summary) text = stripHtmlPreview(contentJson.summary);
    inReplyTo = contentJson.inReplyTo || contentJson.in_reply_to || '';
    if (typeof inReplyTo !== 'string') inReplyTo = '';
  }
  if (!text && item.content_preview) text = stripHtmlPreview(item.content_preview);
  var attachments = extractNoteAttachments(contentJson);
  // Media-only Note: still show a short placeholder so the card is not blank.
  if (!text && attachments.length) {
    text = lang.composeMedia || '📎';
  }
  var objectId = resolveObjectId(item);
  var liked = !!(item.liked_by_me);
  var bookmarked = !!(item.bookmarked_by_me || item.is_bookmarked);
  var announced = !!(item.announced_by_me);
  var likeCount = item.like_count || 0;
  var replyCount = item.reply_count || 0;
  var announceCount = item.announce_count || 0;
  var canInteract = !state.isGuest && !!objectId;
  // Own Create posts (notes / library / report shares) can be quick-deleted.
  var isOwn = typeof isOwnTimelineItem === 'function' && isOwnTimelineItem(item);
  var publishTarget = isOwn && typeof extractPublishTarget === 'function' ? extractPublishTarget(item) : null;
  var canDelete = !state.isGuest && isOwn && item.activity_type !== 'Announce'
    && publishTarget && (publishTarget.content_id || publishTarget.activity_id);
  var isQuoteRepost = !!(contentJson && (
    contentJson['mfp:kind'] === 'repost' ||
    contentJson.mfp_kind === 'repost' ||
    item.object_type === 'repost'
  ));
  var isAnnounce = item.activity_type === 'Announce';
  var isRepostCard = isQuoteRepost || isAnnounce;
  // Never turn repost/note commentary into a single giant link.
  if (isRepostCard || (contentJson && (contentJson.type === 'Note' || contentJson['mfp:kind'] === 'repost'))) {
    linkUrl = contentJson && contentJson.link ? String(contentJson.link) : '';
  }
  var h = '<div class="feed-item' + (isRepostCard ? ' is-repost' : '') + (inReplyTo && !isRepostCard ? ' is-reply' : '') + '" data-object-id="' + esc(objectId) + '"'
    + (item.activity_id ? ' data-activity-id="' + esc(String(item.activity_id)) + '"' : '')
    + '>';
  h += '<div class="feed-item-avatar">' + avatarContentHtml(actor.avatar_url || '', name) + '</div>';
  h += '<div class="feed-item-body">';
  if (isRepostCard) {
    h += '<div class="feed-item-repost-label">'
      + '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>'
      + '<span>' + esc(isQuoteRepost
        ? (lang.quoteRepostLabel || lang.quoteRepostTitle || 'Quote repost')
        : (lang.repostLabel || lang.repostBtn || 'Repost')) + '</span>'
      + (name ? '<span class="feed-item-repost-by">' + esc(name) + '</span>' : '')
      + '</div>';
  } else if (inReplyTo) {
    h += '<div class="feed-item-inreply">'
      + '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M20 20v-7a4 4 0 00-4-4H4"/></svg>'
      + '<span>' + esc(lang.inReplyTo || 'Replying to a post') + '</span></div>';
  }
  h += '<div class="feed-item-header">';
  h += '<span class="feed-item-name">' + esc(name) + '</span>';
  if (handle) h += '<span class="feed-item-handle">' + esc(handle) + '</span>';
  if (actor.domain) {
    h += '<span class="feed-item-domain" title="' + esc(actor.domain) + '">' + esc(actor.domain) + '</span>';
  }
  if (ts) {
    h += '<span class="feed-item-sep">&middot;</span><span class="feed-item-time"'
      + (tsTitle ? ' title="' + esc(tsTitle) + '"' : '') + '>' + esc(ts) + '</span>';
  }
  h += '</div>';
  if (text) {
    if (linkUrl) {
      h += '<div class="feed-item-text"><a href="' + esc(linkUrl) + '" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline">' + esc(text) + '</a></div>';
    } else {
      h += '<div class="feed-item-text">' + esc(text) + '</div>';
    }
  }
  // Nested quote chain: each level is an embedded snapshot (mfp:quotedObject).
  if (isQuoteRepost && contentJson) {
    var quoted = contentJson['mfp:quotedObject'] || contentJson.mfp_quotedObject || null;
    if (quoted && typeof quoted === 'object') {
      h += renderQuotedObjectHtml(quoted, 0);
    } else if (contentJson.quoteUrl || contentJson.inReplyTo || contentJson['mfp:quotedObjectId']) {
      // Never dump raw activity URL as the card body — show a readable label.
      h += '<div class="feed-item-quoted"><div class="feed-item-quoted-meta">'
        + esc(lang.quoteRepostQuoted || 'Quoted post') + '</div>'
        + '<div class="feed-item-quoted-text" style="opacity:.75">'
        + esc(lang.quoteRepostQuoted || 'Quoted post') + '</div></div>';
    }
  }
  h += renderTimelineMedia(attachments);
  // Action bar: interactions for signed-in users; share is always available (external intent).
  var showShare = !!objectId || !!linkUrl || !!text;
  if (canInteract || canDelete || showShare) {
    h += '<div class="feed-item-actions">';
    if (canInteract) {
    // Reply
    h += '<button type="button" class="feed-item-action" data-action-reply="' + esc(objectId) + '" title="' + esc(lang.replyBtn || 'Reply') + '" aria-label="' + esc(lang.replyBtn || 'Reply') + '">'
      + '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4z"/></svg>'
      + (replyCount ? '<span class="feed-item-action-count">' + esc(String(replyCount)) + '</span>' : '')
      + '</button>';
    // Repost
    h += '<button type="button" class="feed-item-action' + (announced ? ' is-active is-announced' : '') + '" data-action-announce="' + esc(objectId) + '" data-announced="' + (announced ? '1' : '0') + '" aria-pressed="' + (announced ? 'true' : 'false') + '" title="' + esc(announced ? (lang.unrepostBtn || 'Undo repost') : (lang.repostBtn || 'Repost')) + '" aria-label="' + esc(announced ? (lang.unrepostBtn || 'Undo repost') : (lang.repostBtn || 'Repost')) + '">'
      + '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>'
      + (announceCount ? '<span class="feed-item-action-count">' + esc(String(announceCount)) + '</span>' : '')
      + '</button>';
    // Like
    h += '<button type="button" class="feed-item-action' + (liked ? ' is-active is-liked' : '') + '" data-action-like="' + esc(objectId) + '" data-liked="' + (liked ? '1' : '0') + '" aria-pressed="' + (liked ? 'true' : 'false') + '" title="' + esc(liked ? (lang.unlikeBtn || 'Unlike') : (lang.likeBtn || 'Like')) + '" aria-label="' + esc(liked ? (lang.unlikeBtn || 'Unlike') : (lang.likeBtn || 'Like')) + '">'
      + (liked
        ? '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="currentColor" stroke-width="1.5"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 000-7.8z"/></svg>'
        : '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 000-7.8z"/></svg>')
      + (likeCount ? '<span class="feed-item-action-count">' + esc(String(likeCount)) + '</span>' : '')
      + '</button>';
    // Bookmark
    h += '<button type="button" class="feed-item-action' + (bookmarked ? ' is-active is-bookmarked' : '') + '" data-action-bookmark="' + esc(objectId) + '" data-bookmarked="' + (bookmarked ? '1' : '0') + '" aria-pressed="' + (bookmarked ? 'true' : 'false') + '" title="' + esc(bookmarked ? (lang.unbookmarkBtn || 'Remove bookmark') : (lang.bookmarkBtn || 'Bookmark')) + '" aria-label="' + esc(bookmarked ? (lang.unbookmarkBtn || 'Remove bookmark') : (lang.bookmarkBtn || 'Bookmark')) + '">'
      + (bookmarked
        ? '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>'
        : '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>')
      + '</button>';
    }
    // Share external (compose + optional X intent URL — never server post)
    if (showShare) {
      h += '<button type="button" class="feed-item-action feed-item-action-share" data-action-share="' + esc(objectId || '') + '"'
        + ' data-object-id="' + esc(objectId || '') + '"'
        + ' data-share-url="' + esc(linkUrl || objectId || '') + '"'
        + ' data-share-author="' + esc(name || handle || '') + '"'
        + ' title="' + esc(lang.shareBtn || 'Share') + '"'
        + ' aria-label="' + esc(lang.shareBtn || 'Share') + '">'
        + '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>'
        + '</button>';
    }
    // Delete own post (timeline quick-delete)
    if (canDelete) {
      h += '<button type="button" class="feed-item-action feed-item-action-danger" data-action-delete-post'
        + ' data-content-type="' + esc(publishTarget.content_type || '') + '"'
        + ' data-content-id="' + esc(publishTarget.content_id || '') + '"'
        + ' data-activity-id="' + esc(publishTarget.activity_id || '') + '"'
        + ' data-object-id="' + esc(objectId) + '"'
        + ' title="' + esc(lang.deletePost || 'Delete') + '"'
        + ' aria-label="' + esc(lang.deletePost || 'Delete') + '">'
        + '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>'
        + '</button>';
    }
    h += '</div>';
    if (canInteract && state.replyOpenObjectId === objectId) {
      h += '<div class="feed-reply-box" data-reply-for="' + esc(objectId) + '">';
      h += '<textarea placeholder="' + esc(lang.replyPlaceholder || 'Write a reply…') + '" rows="3"></textarea>';
      h += '<div class="feed-reply-actions">';
      h += '<button type="button" class="feed-reply-cancel" data-action-reply-cancel="' + esc(objectId) + '">' + esc(lang.replyCancel || 'Cancel') + '</button>';
      h += '<button type="button" class="feed-reply-submit" data-action-reply-submit="' + esc(objectId) + '">' + esc(lang.replySubmit || 'Reply') + '</button>';
      h += '</div></div>';
    }
  }
  h += '</div></div>';
  return h;
}

function pendingStatusLabel(status) {
  if (!status || status === 'accepted') return '';
  if (status === 'pending') return lang.pendingConfirm || lang.pending || 'pending';
  return status;
}

function renderActorItem(actor, context) {
  // username may be null for unresolved remote actors — fall back to actor_url.
  var name = actor.display_name || actor.username || actorLabelFromUrl(actor.actor_url) || '?';
  var handle = actor.username
    ? '@' + actor.username + (actor.domain ? '@' + actor.domain : '')
    : (actor.actor_url || actor.domain || '');
  var domain = actor.domain || '';
  if (!domain && actor.actor_url) {
    try {
      domain = new URL(actor.actor_url).hostname || '';
    } catch (eDom) { domain = ''; }
  }
  var isFollowingThem = isActorInFollowing(actor.actor_url);
  // Mutual: they follow you (followers list) and you follow them; or following list where they also follow back.
  var followsYou = false;
  if (context === 'followers') {
    followsYou = true;
  } else if (context === 'following') {
    var followers = state.followers || [];
    for (var fi = 0; fi < followers.length; fi++) {
      var f = followers[fi];
      if (!f) continue;
      var fu = typeof normalizeFederationUrl === 'function'
        ? normalizeFederationUrl(f.actor_url)
        : String(f.actor_url || '').trim();
      var au = typeof normalizeFederationUrl === 'function'
        ? normalizeFederationUrl(actor.actor_url)
        : String(actor.actor_url || '').trim();
      if (fu && au && fu === au) { followsYou = true; break; }
      if (f.actor_url && actor.actor_url && String(f.actor_url) === String(actor.actor_url)) {
        followsYou = true; break;
      }
    }
  }
  var isMutual = isFollowingThem && followsYou;
  var h = '<div class="feed-item feed-actor-item' + (isMutual ? ' is-mutual' : '') + '"'
    + (actor.actor_url ? ' data-actor-url="' + esc(actor.actor_url) + '"' : '') + '>';
  h += '<div class="feed-item-avatar">' + avatarContentHtml(actor.avatar_url || '', name) + '</div>';
  h += '<div class="feed-item-body">';
  h += '<div class="feed-item-header">';
  h += '<span class="feed-item-name">' + esc(name) + '</span>';
  if (handle) h += '<span class="feed-item-handle">' + esc(handle) + '</span>';
  h += '</div>';
  // Secondary meta row: domain + relationship badges (X-style graph clarity)
  h += '<div class="feed-actor-meta">';
  if (domain) {
    h += '<span class="feed-actor-domain" title="' + esc(domain) + '">' + esc(domain) + '</span>';
  }
  if (isMutual) {
    h += '<span class="aro-badge aro-badge-mutual" title="' + esc(lang.mutualFollow || 'You follow each other') + '">'
      + esc(lang.mutualFollow || 'Mutual') + '</span>';
  } else if (context === 'followers' && isFollowingThem) {
    h += '<span class="aro-badge aro-badge-following-them">' + esc(lang.followingBadge || 'Following') + '</span>';
  } else if (context === 'following' && followsYou) {
    h += '<span class="aro-badge aro-badge-follows-you">' + esc(lang.followsYouBadge || 'Follows you') + '</span>';
  }
  if (actor.status && actor.status !== 'accepted') {
    h += '<span class="aro-badge aro-badge-pending">' + esc(pendingStatusLabel(actor.status)) + '</span>';
  }
  h += '</div>';
  if (actor.bio) h += '<div class="feed-item-text feed-actor-bio">' + esc(actor.bio) + '</div>';
  // Actions — copy handle/url for graph clarity + follow/unfollow
  h += '<div class="feed-item-actions">';
  var copyTarget = handle || actor.actor_url || '';
  if (copyTarget) {
    h += '<button type="button" class="feed-item-action" data-action-copy-actor="' + esc(copyTarget) + '"'
      + ' title="' + esc(lang.copyHandle || lang.copied || 'Copy handle') + '"'
      + ' aria-label="' + esc(lang.copyHandle || 'Copy handle') + '">'
      + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>'
      + '<span>' + esc(lang.copyHandle || 'Copy') + '</span></button>';
  }
  if (context === 'following') {
    h += '<button type="button" class="feed-item-action feed-item-action-danger" data-action-unfollow="' + esc(actor.actor_url || '') + '"'
      + ' title="' + esc(lang.unfollowBtn || 'Unfollow') + '"'
      + ' aria-label="' + esc(lang.unfollowBtn || 'Unfollow') + '">'
      + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>'
      + '<span>' + esc(lang.unfollowBtn || 'Unfollow') + '</span></button>';
  } else if (context === 'followers' && !state.isGuest) {
    if (isFollowingThem) {
      h += '<button type="button" class="feed-item-action feed-item-action-danger" data-action-unfollow="' + esc(actor.actor_url || '') + '"'
        + ' title="' + esc(lang.unfollowBtn || 'Unfollow') + '"'
        + ' aria-label="' + esc(lang.unfollowBtn || 'Unfollow') + '">'
        + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>'
        + '<span>' + esc(lang.unfollowBtn || 'Unfollow') + '</span></button>';
    } else if (actor.actor_url) {
      h += '<button type="button" class="feed-item-action feed-item-action-primary" data-action-follow-back="' + esc(actor.actor_url || '') + '"'
        + ' title="' + esc(lang.followBackBtn || lang.followBtn || 'Follow back') + '"'
        + ' aria-label="' + esc(lang.followBackBtn || lang.followBtn || 'Follow back') + '">'
        + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>'
        + '<span>' + esc(lang.followBackBtn || lang.followBtn || 'Follow back') + '</span></button>';
    }
  }
  h += '</div></div></div>';
  return h;
}

/** 已发布内容的可读类型名 */
function publishedTypeLabel(type) {
  var map = {
    'note': lang.composePost,
    'tapp': lang.attachTapp,
    'brew-article': lang.attachBrew,
    'library': lang.attachLibrary,
    'report': lang.attachReport,
    'repost': lang.quoteRepostLabel || lang.repostBtn || 'Repost',
  };
  return map[type] || type || '';
}

function renderPublishedItem(item) {
  var isRepost = item.content_type === 'repost' || item.content_type === 'announce';
  var typeIcons = { 'report': SVG_ICONS.report, 'brew-article': SVG_ICONS.memo, 'tapp': SVG_ICONS.tapp, 'library': SVG_ICONS.library, 'note': SVG_ICONS.page, 'repost': SVG_ICONS.page };
  var icon = typeIcons[item.content_type] || SVG_ICONS.page;
  var dateStr = '';
  try { dateStr = timeAgo(item.published_at); } catch (e) {}
  // Prefer title as header line when useful; body uses summary/content_preview.
  // attachments come from list_published (joined Create object) — same shape as Note AP.
  var attachments = extractNoteAttachments(item);
  var titleLine = stripHtmlPreview(item.title || item.name || '');
  var preview = stripHtmlPreview(item.content_preview || '');
  var summary = stripHtmlPreview(item.summary || '');
  if (isRepost) {
    // Commentary is the body; quoted snippet lives in summary (backend: "↪ …").
    if (!preview) preview = titleLine || summary;
    if (!titleLine) titleLine = publishedTypeLabel('repost');
  } else {
    if (!preview && titleLine) preview = titleLine;
    if (!preview && summary) preview = summary;
  }
  // Media-only Note: still show a short placeholder so the card is not blank.
  if (!preview && attachments.length) {
    preview = lang.composeMedia || '📎';
  }
  if (!preview) preview = stripHtmlPreview(item.content_id || '');
  if (looksLikeBareUrl(preview)) {
    preview = publishedTypeLabel(item.content_type) || (lang.composePost || 'Post');
  }
  var h = '<div class="feed-item' + (isRepost ? ' is-repost' : '') + '">';
  if (isRepost) {
    h += '<div class="feed-item-avatar">' + icon + '</div>';
  } else {
    h += '<div class="feed-item-icon">' + icon + '</div>';
  }
  h += '<div class="feed-item-body">';
  if (isRepost) {
    h += '<div class="feed-item-repost-label">'
      + '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>'
      + '<span>' + esc(lang.quoteRepostLabel || lang.repostBtn || 'Repost') + '</span></div>';
  }
  h += '<div class="feed-item-header">';
  h += '<span class="feed-item-name">' + esc(titleLine || publishedTypeLabel(item.content_type)) + '</span>';
  if (dateStr) h += '<span class="feed-item-sep">&middot;</span><span class="feed-item-time">' + esc(dateStr) + '</span>';
  h += '</div>';
  if (preview && (!titleLine || preview !== titleLine || isRepost)) {
    h += '<div class="feed-item-text">' + esc(preview) + '</div>';
  }
  // Quoted snippet for reposts (backend summary)
  if (isRepost && summary && summary !== preview) {
    var qText = summary.replace(/^↪\s*/, '');
    if (qText && !looksLikeBareUrl(qText)) {
      h += '<div class="feed-item-quoted"><div class="feed-item-quoted-meta">'
        + esc(lang.quoteRepostQuoted || 'Quoted post') + '</div>'
        + '<div class="feed-item-quoted-text">' + esc(qText.slice(0, 280)) + '</div></div>';
    }
  }
  // Same media strip as timeline so Note images/videos appear on 已发布.
  h += renderTimelineMedia(attachments);
  if (titleLine && item.content_type && item.content_type !== 'note' && !isRepost) {
    h += '<div class="feed-item-meta" style="font-size:11px;color:var(--text-secondary,#888)">' + esc(publishedTypeLabel(item.content_type)) + '</div>';
  }
  h += '<div class="feed-item-actions">';
  h += '<button class="feed-item-action feed-item-action-danger" data-action-unpublish data-content-type="' + esc(item.content_type) + '" data-content-id="' + esc(item.content_id) + '">'
    + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>'
    + esc(lang.removeBtn) + '</button>';
  h += '</div></div></div>';
  return h;
}

function timeAgo(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  var now = new Date();
  var sec = Math.floor((now - d) / 1000);
  if (sec < 60) return sec + 's';
  var min = Math.floor(sec / 60);
  if (min < 60) return min + 'm';
  var hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'h';
  var day = Math.floor(hr / 24);
  if (day < 30) return day + 'd';
  try { return d.toLocaleDateString(currentLocale, { month: 'short', day: 'numeric' }); } catch (e) { return day + 'd'; }
}

function switchFeedSubTab(sub) {
  if (state.feedSubTab === 'settings' && sub !== 'settings' && typeof ensureHistoryState === 'function') {
    try {
      var hs = ensureHistoryState();
      hs.browseArchiveId = null;
      hs.browseConversationId = null;
      hs.browseQuery = '';
    } catch (eHs) { /* ignore */ }
  }
  // Migrate legacy backup tab id
  if (sub === 'backup') sub = 'settings';
  state.feedSubTab = sub;
  updateFeedHeader();
  // Update sidebar nav
  document.querySelectorAll('.feed-nav-item').forEach(function (btn) {
    btn.classList.toggle('feed-nav-active', btn.dataset.sub === sub);
  });
  // Update mobile tabs + keep active chip in view (horizontal scroller)
  var activeMobileTab = null;
  document.querySelectorAll('.feed-mobile-tab').forEach(function (btn) {
    var on = btn.dataset.sub === sub;
    btn.classList.toggle('feed-mobile-tab-active', on);
    if (btn.setAttribute) btn.setAttribute('aria-selected', on ? 'true' : 'false');
    if (on) activeMobileTab = btn;
  });
  if (activeMobileTab && typeof activeMobileTab.scrollIntoView === 'function') {
    try {
      activeMobileTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    } catch (eScroll) {
      try { activeMobileTab.scrollIntoView(false); } catch (e2) { /* ignore */ }
    }
  }
  // Contextual + must recompute immediately on tab change (before async load).
  if (typeof updateFeedPlusVisibility === 'function') updateFeedPlusVisibility();
  // Leaving Post tab: collapse composer so it doesn't linger under other tabs.
  if (sub !== 'timeline' && typeof closeComposer === 'function') closeComposer();
  if (sub !== 'following' && typeof closeFollowDialog === 'function') closeFollowDialog();
  loadFeedSubTab();
}

/**
 * After Follow, remote auto-Accept may land a few seconds later (delivery worker
 * ~15s, or same-instance local Accept is immediate). Poll following list so the
 * pending badge clears to "following" without a manual refresh.
 */
async function refreshFollowingUntilAccepted(targetHint, maxAttempts, intervalMs) {
  var attempts = Math.max(1, maxAttempts || 6);
  var delay = intervalMs || 2500;
  var hint = String(targetHint || '').trim().toLowerCase();
  for (var i = 0; i < attempts; i++) {
    try {
      if (state.currentView === 'feed' && state.feedSubTab === 'following') {
        await loadFeedSubTab();
      } else {
        var res = await Tapp.federation.getFollowing();
        state.following = unwrapListResponse(res);
        updateFeedCountBadges();
        if (state.currentView === 'feed' && state.feedSubTab === 'following') {
          renderFeedContent();
        }
      }
      updateFeedProfileHeader();
      var list = state.following || [];
      var pendingLeft = list.filter(function (a) {
        if (!a || a.status !== 'pending') return false;
        if (!hint) return true;
        var url = String(a.actor_url || '').toLowerCase();
        var handle = ((a.username || '') + '@' + (a.domain || '')).toLowerCase();
        return url.indexOf(hint) !== -1 || handle.indexOf(hint.replace(/^@/, '')) !== -1 || hint.indexOf(url) !== -1;
      });
      // Done when no pending match for this target (accepted / gone).
      if (!pendingLeft.length) return true;
    } catch (ePoll) {
      console.warn('[Aro] follow status poll failed', ePoll);
    }
    if (i < attempts - 1) {
      await new Promise(function (r) { setTimeout(r, delay); });
    }
  }
  return false;
}

async function doFollow() {
  var input = $('feed-follow-input');
  var btn = $('feed-follow-btn');
  if (!input) return;
  var target = input.value.trim();
  if (!target) return;
  if (btn) { btn.disabled = true; }
  try {
    var followRes = await Tapp.federation.follow(target);
    input.value = '';
    if (typeof closeFollowDialog === 'function') closeFollowDialog();
    // Refresh following list; auto-accept is remote (no manual approve UI).
    if (state.feedSubTab !== 'following') {
      state.feedSubTab = 'following';
      switchFeedSubTab('following');
    } else {
      loadFeedSubTab();
    }
    updateFeedProfileHeader();
    // Same-instance / fast Accept may already be accepted in the API response.
    var immediateStatus = '';
    try {
      immediateStatus = (followRes && (followRes.status || (followRes.data && followRes.data.status))) || '';
    } catch (eSt) { immediateStatus = ''; }
    try {
      Tapp.ui.showNotification({
        title: lang.followBtn || 'Follow',
        message: immediateStatus === 'accepted'
          ? (lang.feedFollowing || lang.followQueued || '')
          : (lang.followQueued || ''),
        type: 'info'
      });
    } catch (e2) { /* ignore */ }
    // If still pending, poll until Accept lands (or give up quietly).
    if (immediateStatus !== 'accepted') {
      refreshFollowingUntilAccepted(target, 8, 2000).catch(function () { /* ignore */ });
    }
  } catch (e) {
    notifyError(lang.followFail, e);
  } finally {
    if (btn) btn.disabled = false;
  }
}

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

// ==================== Rings View ====================
async function loadRings() {
  try {
    var res = await Tapp.federation.getRings();
    state.rings = (res && res.rings) || [];
    state.activeRingId = null;
    renderRingsSidebar();
    hideRingDetail();
  } catch (e) { console.error('[Aro] loadRings error:', e); }
}

function renderRingsSidebar() {
  var list = $('ring-list');
  if (!list) return;
  if (state.rings.length === 0) {
    list.innerHTML = '<div class="conv-empty conv-empty-fill"><span id="ring-empty-text">'
      + esc(lang.emptyRings || 'No rings yet')
      + '<br><span style="font-size:11px;opacity:.75">' + esc(lang.createRingTitle || '') + '</span></span></div>';
    return;
  }
  var q = normalizeSearchQuery((state.search && state.search.ring) || '');
  var rings = !q ? state.rings : state.rings.filter(function (ring) {
    return matchesSearch(q, [
      ring.ring_name,
      ring.ring_id,
      ring.ring_type,
      ringTypeLabel(ring.ring_type),
    ]);
  });
  if (rings.length === 0) {
    list.innerHTML = searchNoResultsHtml();
    return;
  }
  var typeIcons = { 'brew-recommend': SVG_ICONS.coffee, 'tapp-store': SVG_ICONS.puzzle, 'library-exchange': SVG_ICONS.library, 'instance-directory': SVG_ICONS.globe };
  var html = '';
  rings.forEach(function (ring) {
    var icon = typeIcons[ring.ring_type] || SVG_ICONS.ring;
    var name = ring.ring_name || ring.ring_id;
    var peerText = (ring.peer_count || 0) + ' ' + lang.peers;
    var activeClass = state.activeRingId === ring.ring_id ? ' conv-active' : '';
    html += '<button class="conv-item' + activeClass + '" data-ring-id="' + esc(ring.ring_id) + '">'
      + '<span class="conv-accent" aria-hidden="true"></span>'
      + '<div class="conv-avatar avatar-room" style="border-radius:12px;font-size:16px">' + icon + '</div>'
      + '<div class="conv-info">'
      + '<div class="conv-top"><span class="conv-name">' + esc(name) + '</span></div>'
      + '<div class="conv-bottom"><span class="conv-preview">' + esc(ringTypeLabel(ring.ring_type)) + ' · ' + esc(peerText) + '</span></div>'
      + '</div>'
      + '</button>';
  });
  list.innerHTML = html;
  list.querySelectorAll('.conv-item').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openRingDetail(btn.dataset.ringId);
    });
  });
}

function updateRingCreateCategoryVisibility() {
  var type = (typeof getAroSelectValue === 'function'
    ? getAroSelectValue('ring-type-select')
    : (($('ring-type-select') || {}).value)) || 'brew-recommend';
  var wrap = $('ring-brew-category-wrap');
  if (!wrap) return;
  if (type === 'brew-recommend') {
    wrap.style.display = 'flex';
    loadBrewCategoriesForRingCreate();
  } else {
    wrap.style.display = 'none';
  }
}

function loadBrewCategoriesForRingCreate() {
  var select = $('ring-brew-category-select');
  var freeText = $('ring-brew-category-input');
  if (!select) return;
  if (typeof initAroSelect === 'function') initAroSelect(select);
  // Keep the "all" option; rebuild the rest via custom select API
  var allLabel = (lang.ringBrewCategoryAll || 'All my categories');
  var baseOpts = [{ value: '', label: allLabel, id: 'ring-brew-category-all' }];
  if (typeof setAroSelectOptions === 'function') {
    setAroSelectOptions(select, baseOpts, '');
  }
  if (freeText) {
    freeText.value = '';
    freeText.style.display = 'none';
  }
  if (typeof Tapp === 'undefined' || !Tapp.brewList || typeof Tapp.brewList.categories !== 'function') {
    // Fallback: free-text only
    if (freeText) freeText.style.display = '';
    select.style.display = 'none';
    return;
  }
  select.style.display = '';
  Tapp.brewList.categories().then(function (cats) {
    var list = Array.isArray(cats) ? cats : (cats && cats.categories) || [];
    var opts = [{ value: '', label: allLabel, id: 'ring-brew-category-all' }];
    list.forEach(function (c) {
      var name = (c && (c.name || c)) || '';
      if (!name) return;
      opts.push({ value: name, label: name });
    });
    if (typeof setAroSelectOptions === 'function') {
      setAroSelectOptions(select, opts, '');
    }
    // If no categories from API, allow free-text
    if (list.length === 0 && freeText) {
      freeText.style.display = '';
    }
  }).catch(function () {
    if (freeText) freeText.style.display = '';
    select.style.display = 'none';
  });
}

async function doCreateRing() {
  if (!requireAdminAction()) return;
  var input = $('ring-name-input');
  var btn = $('create-ring-btn');
  if (!input) return;
  var name = input.value.trim();
  if (!name) return;
  var type = (typeof getAroSelectValue === 'function'
    ? getAroSelectValue('ring-type-select')
    : (($('ring-type-select') || {}).value)) || 'brew-recommend';
  var req = { name: name, ring_type: type };
  if (type === 'brew-recommend') {
    var catSelect = $('ring-brew-category-select');
    var catInput = $('ring-brew-category-input');
    var cat = '';
    if (catSelect && catSelect.style.display !== 'none') {
      cat = ((typeof getAroSelectValue === 'function'
        ? getAroSelectValue(catSelect)
        : catSelect.value) || '').trim();
    }
    if (!cat && catInput && catInput.style.display !== 'none') {
      cat = (catInput.value || '').trim();
    }
    if (cat) req.category = cat;
  }
  if (btn) { btn.disabled = true; btn.textContent = lang.creating; }
  try {
    await Tapp.federation.createRing(req);
    input.value = '';
    var catSel = $('ring-brew-category-select');
    if (catSel && typeof setAroSelectValue === 'function') setAroSelectValue(catSel, '', true);
    else if (catSel) catSel.value = '';
    var catIn = $('ring-brew-category-input');
    if (catIn) catIn.value = '';
    var d = $('ring-create-dialog');
    if (d) aroDismiss(d, { ms: 170 });
    loadRings();
  } catch (e) {
    notifyError(lang.createRingFail, e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = lang.createRingBtn; }
  }
}

async function doLeaveRing(ringId) {
  if (!requireAdminAction()) return;
  try {
    await Tapp.federation.leaveRing(ringId);
    hideRingDetail();
    loadRings();
  } catch (e) {
    notifyError(lang.leaveRingFail, e);
  }
}

/** Copy the active ring's id for sharing with another instance. */
async function copyRingId() {
  var ring = state.ringDetail;
  var ringId = (ring && ring.ring_id) || state.activeRingId || '';
  if (!ringId) {
    try { Tapp.ui.showNotification({ title: lang.copyFail, type: 'error' }); } catch (e0) {}
    return;
  }
  var ok = await copyTextToClipboard(ringId, { silent: true });
  try {
    Tapp.ui.showNotification({
      title: ok ? (lang.ringIdCopied || lang.copied) : lang.copyFail,
      message: ok ? ringId : undefined,
      type: ok ? 'success' : 'error',
    });
  } catch (e1) {}
}

// ==================== Ring Detail (inline panel) ====================
function openRingDetail(ringId) {
  state.activeRingId = ringId;
  state.ringDetail = null;
  state.ringPeers = [];
  // Update sidebar active
  var list = $('ring-list');
  if (list) list.querySelectorAll('.conv-item').forEach(function (btn) {
    btn.classList.toggle('conv-active', btn.dataset.ringId === ringId);
  });
  // Show detail panel
  $('ring-empty-state').style.display = 'none';
  var detail = $('ring-detail');
  if (detail) {
    detail.style.display = '';
    aroPlayEnter(detail, 'aro-panel-enter');
  }
  // Optimistic ring_id fill (full detail arrives from loadRingDetail)
  var idLabelEl = $('ring-id-label');
  if (idLabelEl) idLabelEl.textContent = lang.ringId || 'Ring ID';
  var idValueEl = $('ring-id-value');
  if (idValueEl) {
    idValueEl.textContent = ringId || '';
    idValueEl.setAttribute('title', ringId || '');
  }
  var idCopyBtn = $('ring-id-copy');
  if (idCopyBtn) {
    idCopyBtn.disabled = !ringId;
    idCopyBtn.setAttribute('title', lang.copy || 'Copy');
  }
  // Mobile
  $('ring-sidebar').classList.add('sidebar-hidden-mobile');
  var main = detail ? detail.closest('.panel-main') : null;
  if (main) {
    main.classList.add('panel-main-show-mobile');
    aroPlayEnter(main, 'aro-panel-enter');
  }
  loadRingDetail(ringId);
}

function hideRingDetail() {
  state.activeRingId = null;
  state.ringDetail = null;
  state.ringPeers = [];
  var detail = $('ring-detail');
  if (detail) {
    detail.style.display = 'none';
    detail.classList.remove('aro-panel-enter');
  }
  var empty = $('ring-empty-state');
  if (empty) {
    empty.style.display = '';
    aroPlayEnter(empty, 'aro-panel-enter');
  }
  var sidebar = $('ring-sidebar');
  if (sidebar) {
    sidebar.classList.remove('sidebar-hidden-mobile');
    aroPlayEnter(sidebar, 'aro-panel-enter');
  }
  var main = detail ? detail.closest('.panel-main') : null;
  if (main) main.classList.remove('panel-main-show-mobile');
}

async function loadRingDetail(ringId) {
  try {
    var results = await Promise.all([
      Tapp.federation.getRing(ringId),
      Tapp.federation.getRingPeers(ringId)
    ]);
    if (state.activeRingId !== ringId) return; // user closed
    state.ringDetail = results[0];
    state.ringPeers = (results[1] && results[1].peers) || [];
    renderRingDetail();
  } catch (e) {
    console.error('[Aro] loadRingDetail error:', e);
  }
}

function renderRingDetail() {
  var ring = state.ringDetail;
  if (!ring) return;
  var typeIcons = { 'brew-recommend': SVG_ICONS.coffee, 'tapp-store': SVG_ICONS.puzzle, 'library-exchange': SVG_ICONS.library, 'instance-directory': SVG_ICONS.globe };
  var iconEl = $('ring-detail-icon');
  if (iconEl) iconEl.innerHTML = typeIcons[ring.ring_type] || SVG_ICONS.ring;
  var nameEl = $('ring-detail-name');
  // Prefer display name; ring_id is always shown separately in the id bar
  if (nameEl) nameEl.textContent = ring.ring_name || ring.ring_id;
  var metaEl = $('ring-detail-meta');
  if (metaEl) {
    var parts = [];
    parts.push('<span class="meta-badge">' + esc(ringTypeLabel(ring.ring_type)) + '</span>');
    parts.push('<span class="meta-badge">' + esc(state.ringPeers.length + ' ' + lang.peers) + '</span>');
    var ringCat = ring.gossip_config && (ring.gossip_config.category || ring.gossip_config.brew_category);
    if (ringCat) {
      parts.push('<span class="meta-badge">' + esc(String(ringCat)) + '</span>');
    }
    if (ring.last_sync_at) {
      try { parts.push('<span class="meta-badge">' + esc(timeAgo(ring.last_sync_at)) + '</span>'); } catch (e) {}
    }
    metaEl.innerHTML = parts.join('');
  }

  // Always show ring_id (separate from title) for cross-instance sharing
  var ringId = ring.ring_id || state.activeRingId || '';
  var idLabelEl = $('ring-id-label');
  if (idLabelEl) idLabelEl.textContent = lang.ringId || 'Ring ID';
  var idValueEl = $('ring-id-value');
  if (idValueEl) {
    idValueEl.textContent = ringId;
    idValueEl.setAttribute('title', ringId);
  }
  var idCopyBtn = $('ring-id-copy');
  if (idCopyBtn) {
    idCopyBtn.disabled = !ringId;
    idCopyBtn.setAttribute('title', lang.copy || 'Copy');
    idCopyBtn.setAttribute('aria-label', (lang.copy || 'Copy') + ' ' + (lang.ringId || 'Ring ID'));
  }

  // Sync / leave labels
  var syncLabel = $('ring-sync-label');
  if (syncLabel) syncLabel.textContent = lang.syncBtn;
  var leaveLabel = $('ring-leave-label');
  if (leaveLabel) leaveLabel.textContent = lang.leaveBtn;

  // Peer input
  var peerInput = $('ring-peer-input');
  if (peerInput) peerInput.placeholder = lang.addPeerPlaceholder;
  var addPeerBtn = $('ring-add-peer-btn');
  if (addPeerBtn) addPeerBtn.textContent = lang.addPeerBtn;
  applyAdminControls();

  // Render peers as member-item style
  var peersList = $('ring-peers-list');
  var peersEmpty = $('ring-peers-empty');
  if (!peersList) return;

  if (state.ringPeers.length === 0) {
    peersList.innerHTML = '';
    if (peersEmpty) { peersEmpty.style.display = ''; peersEmpty.querySelector('span').textContent = lang.emptyPeers; }
    return;
  }
  if (peersEmpty) peersEmpty.style.display = 'none';

  var html = '';
  state.ringPeers.forEach(function (peer) {
    var url = peer.actor_url || peer.peer_url || peer.url || peer;
    var urlStr = typeof url === 'string' ? url : JSON.stringify(url);
    var initial = SVG_ICONS.globe;
    html += '<div class="member-item">'
      + '<div class="member-avatar" style="border-radius:6px;font-size:12px">' + initial + '</div>'
      + '<div class="member-info">'
      + '<div class="member-name">' + esc(urlStr) + '</div>'
      + '</div>'
      + (state.isAdmin ? '<button class="member-kick ring-peer-remove-btn" data-peer-url="' + esc(typeof url === 'string' ? url : '') + '" title="Remove">'
      + '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>'
      + '</button>' : '')
      + '</div>';
  });
  peersList.innerHTML = html;
  applyAdminControls();

  peersList.querySelectorAll('.ring-peer-remove-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      doRemovePeer(btn.dataset.peerUrl);
    });
  });
}

async function doAddPeer() {
  if (!requireAdminAction()) return;
  var input = $('ring-peer-input');
  var btn = $('ring-add-peer-btn');
  if (!input || !state.activeRingId) return;
  var peerUrl = input.value.trim();
  if (!peerUrl) return;
  if (btn) btn.disabled = true;
  try {
    await Tapp.federation.addPeer(state.activeRingId, { peer: peerUrl });
    input.value = '';
    loadRingDetail(state.activeRingId);
  } catch (e) {
    notifyError(lang.addPeerFail, e);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function doRemovePeer(peerUrl) {
  if (!requireAdminAction()) return;
  if (!state.activeRingId || !peerUrl) return;
  try {
    await Tapp.federation.removePeer(state.activeRingId, peerUrl);
    loadRingDetail(state.activeRingId);
  } catch (e) {
    notifyError(lang.removePeerFail, e);
  }
}

async function doTriggerSync() {
  if (!requireAdminAction()) return;
  if (!state.activeRingId) return;
  var btn = $('ring-sync-btn');
  var statusEl = $('ring-sync-status');
  if (btn) btn.disabled = true;
  if (statusEl) { statusEl.style.display = ''; statusEl.className = 'ring-sync-bar'; statusEl.textContent = lang.syncing; }
  try {
    await Tapp.federation.triggerSync(state.activeRingId);
    if (statusEl) { statusEl.className = 'ring-sync-bar ring-sync-ok'; statusEl.textContent = lang.syncSuccess; }
    // Refresh detail after sync
    loadRingDetail(state.activeRingId);
  } catch (e) {
    if (statusEl) { statusEl.className = 'ring-sync-bar ring-sync-err'; statusEl.textContent = lang.syncFail + errorSuffix(e); }
  } finally {
    if (btn) btn.disabled = false;
    // Auto-hide status after 3s
    setTimeout(function () {
      if (statusEl) statusEl.style.display = 'none';
    }, 3000);
  }
}

// ==================== Event Binding ====================
function bindEvents() {
  // Aro nav
  document.querySelectorAll('.aro-nav-item').forEach(function (btn) {
    btn.addEventListener('click', function () { switchView(btn.dataset.view); });
  });

  // Ring create dialog
  var ringCreateOpenBtn = $('ring-create-open-btn');
  if (ringCreateOpenBtn) ringCreateOpenBtn.addEventListener('click', function () {
    if (!requireAdminAction()) return;
