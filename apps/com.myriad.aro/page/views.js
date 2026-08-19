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

/**
 * One-time event delegation for #feed-content.
 * Replaces per-render querySelectorAll + addEventListener (hot path on every feed paint).
 */
function bindFeedContentActions(content) {
  if (!content || content.dataset.feedDelegatesBound === '1') return;
  content.dataset.feedDelegatesBound = '1';

  function resolveFeedItemFromCard(card) {
    if (!card) return null;
    var oid = card.getAttribute('data-object-id') || '';
    var item = oid && typeof findAnyFeedItemByObjectId === 'function'
      ? findAnyFeedItemByObjectId(oid)
      : null;
    if (!item && oid && typeof findFeedItem === 'function') item = findFeedItem(oid);
    if (!item) {
      var lists = [state.timeline, state.bookmarks, state.published, state.feedItems];
      for (var li = 0; li < lists.length && !item; li++) {
        var arr = lists[li];
        if (!Array.isArray(arr)) continue;
        for (var i = 0; i < arr.length; i++) {
          var it = arr[i];
          if (!it) continue;
          var rid = typeof resolveObjectId === 'function' ? resolveObjectId(it) : (it.object_id || '');
          if (rid && String(rid) === String(oid)) { item = it; break; }
          if (it.activity_id && card.getAttribute('data-activity-id')
            && String(it.activity_id) === String(card.getAttribute('data-activity-id'))) {
            item = it; break;
          }
        }
      }
    }
    return item;
  }

  function openFeedCard(card) {
    if (!card) return;
    var oid = card.getAttribute('data-object-id') || '';
    var item = resolveFeedItemFromCard(card);
    if (item && typeof openFeedPostDetail === 'function') {
      openFeedPostDetail(item);
    } else if (oid && typeof openQuotedPostDetail === 'function') {
      openQuotedPostDetail(oid, null, {
        title: lang.postDetailTitle || lang.quoteViewTitle || 'Post',
      });
    }
  }

  content.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    var unfollow = t.closest('[data-action-unfollow]');
    if (unfollow && content.contains(unfollow)) {
      e.stopPropagation();
      doUnfollow(unfollow.dataset.actionUnfollow);
      return;
    }
    var unpublish = t.closest('[data-action-unpublish]');
    if (unpublish && content.contains(unpublish)) {
      e.stopPropagation();
      doUnpublish(unpublish.dataset.contentType, unpublish.dataset.contentId);
      return;
    }
    var delPost = t.closest('[data-action-delete-post]');
    if (delPost && content.contains(delPost)) {
      e.stopPropagation();
      doDeleteTimelinePost({
        content_type: delPost.dataset.contentType || '',
        content_id: delPost.dataset.contentId || '',
        activity_id: delPost.dataset.activityId || '',
        object_id: delPost.dataset.objectId || '',
      });
      return;
    }
    var likeBtn = t.closest('[data-action-like]');
    if (likeBtn && content.contains(likeBtn)) {
      e.stopPropagation();
      doToggleLike(likeBtn.dataset.actionLike, likeBtn.dataset.liked === '1');
      return;
    }
    var bmBtn = t.closest('[data-action-bookmark]');
    if (bmBtn && content.contains(bmBtn)) {
      e.stopPropagation();
      doToggleBookmark(bmBtn.dataset.actionBookmark, bmBtn.dataset.bookmarked === '1');
      return;
    }
    var annBtn = t.closest('[data-action-announce]');
    if (annBtn && content.contains(annBtn)) {
      e.stopPropagation();
      var oidA = annBtn.dataset.actionAnnounce;
      if (annBtn.dataset.announced === '1') doUnannounce(oidA);
      else openQuoteRepostModal(oidA);
      return;
    }
    var replyBtn = t.closest('[data-action-reply]');
    if (replyBtn && content.contains(replyBtn)) {
      e.stopPropagation();
      toggleReplyComposer(replyBtn.dataset.actionReply);
      return;
    }
    var replyCancel = t.closest('[data-action-reply-cancel]');
    if (replyCancel && content.contains(replyCancel)) {
      e.stopPropagation();
      state.replyOpenObjectId = null;
      // Force paint (fingerprint would otherwise skip)
      state._feedRenderFp = '';
      renderFeedContent();
      return;
    }
    var replySubmit = t.closest('[data-action-reply-submit]');
    if (replySubmit && content.contains(replySubmit)) {
      e.stopPropagation();
      var oidR = replySubmit.dataset.actionReplySubmit;
      var cardR = replySubmit.closest('.feed-item');
      var box = cardR ? cardR.querySelector('.feed-reply-box textarea') : null;
      doSubmitReply(oidR, box ? box.value : '');
      return;
    }
    var shareBtn = t.closest('[data-action-share]');
    if (shareBtn && content.contains(shareBtn)) {
      e.stopPropagation();
      openShareModal(shareBtn.dataset.actionShare || '', {
        objectId: shareBtn.dataset.objectId || shareBtn.dataset.actionShare || '',
        linkUrl: shareBtn.dataset.shareUrl || '',
        author: shareBtn.dataset.shareAuthor || '',
      });
      return;
    }
    var followBack = t.closest('[data-action-follow-back]');
    if (followBack && content.contains(followBack)) {
      e.stopPropagation();
      doFollowBack(followBack.dataset.actionFollowBack);
      return;
    }
    var copyActor = t.closest('[data-action-copy-actor]');
    if (copyActor && content.contains(copyActor)) {
      e.stopPropagation();
      var text = copyActor.dataset.actionCopyActor || '';
      if (text && typeof copyTextToClipboard === 'function') {
        copyTextToClipboard(text, { showMessage: false });
      }
      return;
    }

    // Nested quote card
    var quoteCard = t.closest('.feed-item-quoted.is-clickable[data-quote-object-id]');
    if (quoteCard && content.contains(quoteCard)) {
      e.preventDefault();
      e.stopPropagation();
      var qoid = quoteCard.getAttribute('data-quote-object-id') || '';
      var textEl = quoteCard.querySelector(':scope > .feed-item-quoted-text');
      var authorEl = quoteCard.querySelector(':scope > .feed-item-quoted-meta .feed-item-quoted-author');
      openQuotedPostDetail(qoid, {
        id: qoid,
        type: 'Note',
        content_preview: textEl ? textEl.textContent : '',
        attributedTo: authorEl ? authorEl.textContent : '',
      });
      return;
    }

    // "Show more" control
    var moreBtn = t.closest('button.feed-item-more[data-action-open-post], [data-action-open-post].feed-item-more');
    if (moreBtn && content.contains(moreBtn)) {
      e.preventDefault();
      e.stopPropagation();
      openFeedCard(moreBtn.closest('.feed-item'));
      return;
    }

    // Windowed list: show more
    var loadMore = t.closest('[data-feed-load-more], #feed-load-more');
    if (loadMore && content.contains(loadMore)) {
      e.preventDefault();
      e.stopPropagation();
      if (!state.feedVisible) state.feedVisible = {};
      var subMore = state.feedSubTab || 'timeline';
      var cur = state.feedVisible[subMore] || FEED_LIST_PAGE;
      state.feedVisible[subMore] = cur + FEED_LIST_PAGE;
      state._feedRenderFp = '';
      renderFeedContent();
      return;
    }

    // Open post detail from card body (not from nested interactive chrome)
    var card = t.closest('.feed-item[data-action-open-post]');
    if (card && content.contains(card)) {
      if (t.closest(
        'button, a, video, audio, input, textarea, select, .feed-item-actions, .feed-reply-box, .feed-item-quoted.is-clickable'
      )) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      openFeedCard(card);
    }
  });

  content.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target;
    if (!t || !t.closest) return;
    var quoteCard = t.closest('.feed-item-quoted.is-clickable[data-quote-object-id]');
    if (quoteCard && content.contains(quoteCard) && (t === quoteCard || quoteCard.contains(document.activeElement))) {
      e.preventDefault();
      quoteCard.click();
      return;
    }
    var card = t.closest('.feed-item[data-action-open-post]');
    if (card && content.contains(card) && (t === card || t.getAttribute('tabindex') != null)) {
      if (t.closest('button, a, input, textarea')) return;
      e.preventDefault();
      openFeedCard(card);
    }
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

function quotedObjectId(quoted) {
  if (!quoted || typeof quoted !== 'object') return '';
  var id = quoted.id || quoted['mfp:quotedObjectId'] || quoted.mfp_quotedObjectId
    || quoted.quoteUrl || quoted.url || '';
  return id ? String(id) : '';
}

/**
 * Render nested mfp:quotedObject chain as distinct cards.
 * Each level is a snapshot embedded at repost time (not a live pointer).
 * Full body (no 280-char clamp); clickable to open original when id present.
 * @param {object} quoted
 * @param {number} [depth]
 * @param {{ interactive?: boolean, full?: boolean }} [opts]
 */
function renderQuotedObjectHtml(quoted, depth, opts) {
  depth = depth || 0;
  opts = opts || {};
  var interactive = opts.interactive !== false;
  var full = opts.full !== false;
  if (!quoted || typeof quoted !== 'object') return '';
  if (depth >= MAX_QUOTE_RENDER_DEPTH) {
    return '<div class="feed-item-quoted feed-item-quoted-truncated" data-quote-depth="' + depth + '">'
      + esc(lang.quoteRepostTruncated || 'Earlier quotes not shown') + '</div>';
  }
  var author = attributedToLabel(quoted.attributedTo);
  var text = quotedObjectText(quoted);
  var qid = quotedObjectId(quoted);
  var isNestedRepost = quoted['mfp:kind'] === 'repost' || quoted.mfp_kind === 'repost'
    || quoted['mfp:contentType'] === 'repost';
  var label = isNestedRepost
    ? (lang.quoteRepostNested || lang.quoteRepostQuoted || 'Quoted repost')
    : (lang.quoteRepostQuoted || 'Quoted post');
  var clickable = interactive && !!qid;
  // Soft fill only — no border chrome; nested levels stay flat cards.
  var h = '<div class="feed-item-quoted'
    + (isNestedRepost ? ' is-nested-repost' : '')
    + (clickable ? ' is-clickable' : '')
    + '" data-quote-depth="' + depth + '"'
    + (qid ? ' data-quote-object-id="' + esc(qid) + '"' : '')
    + (clickable ? ' role="button" tabindex="0" title="'
      + esc(lang.quoteOpenOriginal || lang.quoteRepostQuoted || 'View original') + '"' : '')
    + '>';
  h += '<div class="feed-item-quoted-meta">';
  if (author) {
    h += '<span class="feed-item-quoted-author">' + esc(author) + '</span>';
    h += '<span class="feed-item-quoted-kind">' + esc(label) + '</span>';
  } else {
    h += '<span class="feed-item-quoted-kind">' + esc(label) + '</span>';
  }
  if (clickable) {
    h += '<span class="feed-item-quoted-open">'
      + esc(lang.quoteOpenHint || 'View') + '</span>';
  }
  h += '</div>';
  if (text && !looksLikeBareUrl(text)) {
    // List cards clamp; detail modal (full:true) shows complete body.
    var body = full ? String(text) : truncateFeedCardText(String(text), 160).text;
    h += '<div class="feed-item-quoted-text' + (full ? '' : ' is-clamped') + '">' + esc(body) + '</div>';
  } else if (text && looksLikeBareUrl(text)) {
    // Prefer human label over raw activity URL
    h += '<div class="feed-item-quoted-text" style="opacity:.75">'
      + esc(lang.quoteRepostQuoted || 'Quoted post') + '</div>';
  } else if (qid && !looksLikeBareUrl(qid)) {
    h += '<div class="feed-item-quoted-text feed-item-quoted-id">' + esc(String(qid).slice(0, 120)) + '</div>';
  } else {
    h += '<div class="feed-item-quoted-text" style="opacity:.75">'
      + esc(lang.quoteRepostQuoted || 'Quoted post') + '</div>';
  }
  // Media on quote cards (when snapshot includes attachments)
  var qAtts = typeof extractNoteAttachments === 'function' ? extractNoteAttachments(quoted) : [];
  if (qAtts.length && typeof renderTimelineMedia === 'function') {
    h += renderTimelineMedia(qAtts);
  }
  var inner = quoted['mfp:quotedObject'] || quoted.mfp_quotedObject || null;
  if (inner && typeof inner === 'object') {
    h += renderQuotedObjectHtml(inner, depth + 1, opts);
  } else if (quoted['mfp:quoteTruncated'] || quoted.mfp_quoteTruncated) {
    h += '<div class="feed-item-quoted-truncated">'
      + esc(lang.quoteRepostTruncated || 'Earlier quotes not shown') + '</div>';
  }
  h += '</div>';
  return h;
}

/** Find a feed item by object id across timeline / bookmarks / published. */
function findAnyFeedItemByObjectId(objectId) {
  if (!objectId) return null;
  var lists = [
    state.timeline,
    state.bookmarks,
    state.published,
    state.feedItems,
  ];
  for (var li = 0; li < lists.length; li++) {
    var arr = lists[li];
    if (!Array.isArray(arr)) continue;
    for (var i = 0; i < arr.length; i++) {
      var it = arr[i];
      if (!it) continue;
      var oid = typeof resolveObjectId === 'function' ? resolveObjectId(it) : (it.object_id || '');
      if (oid && String(oid) === String(objectId)) return it;
      var cj = typeof timelineContentObject === 'function' ? timelineContentObject(it) : null;
      if (cj && cj.id && String(cj.id) === String(objectId)) return it;
    }
  }
  return null;
}

// FEED_CARD_TEXT_MAX + truncateFeedCardText live in feedUi.js

/**
 * Open post / quote detail modal.
 * Works without following the author: local feed item → snapshot → getObject.
 * @param {string} objectId
 * @param {object} [snapshot]
 * @param {{ actor?: object, title?: string, item?: object }} [opts]
 */
async function openQuotedPostDetail(objectId, snapshot, opts) {
  if (!objectId && !(snapshot && typeof snapshot === 'object') && !(opts && opts.item)) return;
  opts = opts || {};
  var dlg = $('quote-view-dialog');
  var bodyEl = $('quote-view-body');
  var titleEl = $('quote-view-title');
  if (titleEl) {
    titleEl.textContent = opts.title
      || lang.postDetailTitle
      || lang.quoteViewTitle
      || lang.quoteRepostQuoted
      || 'Post';
  }
  if (bodyEl) {
    bodyEl.innerHTML = '<div class="quote-view-loading">'
      + esc(lang.loading || 'Loading…') + '</div>';
  }
  if (dlg && typeof showAroOverlay === 'function') {
    showAroOverlay(dlg);
  } else if (dlg) {
    // Fallback open triad (must match showAroOverlay — bare display:'' reverts to CSS none)
    try { dlg.classList.remove('aro-leaving'); } catch (eRm) { /* ignore */ }
    dlg.hidden = false;
    try { dlg.removeAttribute('hidden'); } catch (eH) { /* ignore */ }
    dlg.style.pointerEvents = 'auto';
    dlg.style.display = 'flex';
  }

  var object = snapshot && typeof snapshot === 'object' ? snapshot : null;
  var actor = opts.actor || null;
  var source = snapshot ? 'snapshot' : 'feed';

  // Prefer explicit feed item (clicking a timeline card).
  if (opts.item) {
    var itemCj = typeof timelineContentObject === 'function'
      ? timelineContentObject(opts.item)
      : null;
    if (itemCj && typeof itemCj === 'object') {
      object = itemCj;
      source = 'feed';
    } else if (!object) {
      var prev = typeof feedItemPreviewText === 'function'
        ? feedItemPreviewText(opts.item)
        : (opts.item.content_preview || '');
      object = {
        id: objectId || resolveObjectId(opts.item) || '',
        type: 'Note',
        content_preview: prev,
        content: prev,
        attributedTo: (opts.item.actor && opts.item.actor.actor_url) || '',
      };
      source = 'feed';
    }
    if (!actor && opts.item.actor) actor = opts.item.actor;
    if (!objectId) objectId = resolveObjectId(opts.item) || objectId;
  }

  // Prefer live local feed item when present (may have richer fields).
  var localItem = objectId ? findAnyFeedItemByObjectId(objectId) : null;
  if (localItem) {
    var cj = typeof timelineContentObject === 'function' ? timelineContentObject(localItem) : null;
    if (cj && typeof cj === 'object') {
      // Keep richer of the two (local may have more fields)
      object = Object.assign({}, object || {}, cj);
      source = 'feed';
    }
    if (!actor && localItem.actor) actor = localItem.actor;
  }

  // Host API: resolve public object without follow (local DB or remote public).
  // Only when we lack a solid body.
  var hasBody = object && (quotedObjectText(object) || (extractNoteAttachments(object) || []).length);
  if (objectId && !hasBody && typeof Tapp !== 'undefined' && Tapp.federation
    && typeof Tapp.federation.getObject === 'function') {
    try {
      var res = await Tapp.federation.getObject(objectId);
      var data = res && res.data ? res.data : res;
      if (data && data.object && typeof data.object === 'object') {
        object = data.object;
        source = data.source || 'api';
        if (data.actor) actor = data.actor;
      }
    } catch (eFetch) {
      console.warn('[Aro] getObject failed, using snapshot', eFetch);
    }
  } else if (objectId && hasBody && typeof Tapp !== 'undefined' && Tapp.federation
    && typeof Tapp.federation.getObject === 'function') {
    // Background enrich (non-blocking) — optional fuller remote body
    try {
      var res2 = await Tapp.federation.getObject(objectId);
      var data2 = res2 && res2.data ? res2.data : res2;
      if (data2 && data2.object && typeof data2.object === 'object') {
        var remoteText = quotedObjectText(data2.object);
        var localText = quotedObjectText(object);
        if (remoteText && remoteText.length > (localText || '').length) {
          object = data2.object;
          source = data2.source || 'api';
          if (data2.actor) actor = data2.actor;
        }
      }
    } catch (eBg) { /* ignore */ }
  }

  if (!object) {
    object = {
      id: objectId || '',
      type: 'Note',
      content_preview: lang.quoteViewUnavailable || 'This post could not be loaded',
    };
  }
  if (bodyEl) {
    bodyEl.innerHTML = renderQuoteViewDetailHtml(object, actor, source);
    bindQuotedObjectClicks(bodyEl);
  }
}

/** Open detail for a timeline / published feed card. */
function openFeedPostDetail(item) {
  if (!item) return;
  var objectId = typeof resolveObjectId === 'function' ? resolveObjectId(item) : (item.object_id || '');
  var cj = typeof timelineContentObject === 'function' ? timelineContentObject(item) : null;
  openQuotedPostDetail(objectId, cj || null, {
    item: item,
    actor: item.actor || null,
    title: lang.postDetailTitle || lang.quoteViewTitle || 'Post',
  });
}

/** Bind click/keyboard on quote cards within a container (feed or detail modal). */
function bindQuotedObjectClicks(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('.feed-item-quoted.is-clickable[data-quote-object-id]').forEach(function (card) {
    if (card._aroQuoteBound) return;
    card._aroQuoteBound = true;
    function openQuote(e) {
      var target = e.target.closest('.feed-item-quoted.is-clickable[data-quote-object-id]');
      if (!target || target !== card) return;
      e.preventDefault();
      e.stopPropagation();
      var oid = card.getAttribute('data-quote-object-id') || '';
      var textEl = card.querySelector(':scope > .feed-item-quoted-text');
      var authorEl = card.querySelector(':scope > .feed-item-quoted-meta .feed-item-quoted-author');
      var snap = {
        id: oid,
        type: 'Note',
        content_preview: textEl ? textEl.textContent : '',
        attributedTo: authorEl ? authorEl.textContent : '',
      };
      openQuotedPostDetail(oid, snap);
    }
    card.addEventListener('click', openQuote);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') openQuote(e);
    });
  });
}

function renderQuoteViewDetailHtml(object, actor, source) {
  var author = '';
  if (actor) {
    author = actor.display_name || actor.username
      || (actor.actor_url ? actorLabelFromUrl(actor.actor_url) : '') || '';
  }
  if (!author) author = attributedToLabel(object.attributedTo);
  var handle = '';
  if (actor && actor.username) {
    handle = '@' + actor.username + (actor.domain ? '@' + actor.domain : '');
  }
  var text = quotedObjectText(object);
  var h = '<div class="quote-view-card">';
  h += '<div class="quote-view-header">';
  if (author) h += '<span class="quote-view-name">' + esc(author) + '</span>';
  if (handle) h += '<span class="quote-view-handle">' + esc(handle) + '</span>';
  h += '</div>';
  if (text && !looksLikeBareUrl(text)) {
    h += '<div class="quote-view-text">' + esc(text) + '</div>';
  } else {
    h += '<div class="quote-view-text quote-view-muted">'
      + esc(lang.quoteViewEmpty || lang.quoteRepostQuoted || 'Post') + '</div>';
  }
  var atts = typeof extractNoteAttachments === 'function' ? extractNoteAttachments(object) : [];
  if (atts.length && typeof renderTimelineMedia === 'function') {
    h += renderTimelineMedia(atts);
  }
  // Nested chain if this object is itself a repost
  var nested = object['mfp:quotedObject'] || object.mfp_quotedObject || null;
  if (nested && typeof nested === 'object') {
    h += '<div class="quote-view-nested-label">'
      + esc(lang.quoteRepostQuoted || 'Quoted post') + '</div>';
    h += renderQuotedObjectHtml(nested, 0, { interactive: true, full: true });
  }
  var oid = quotedObjectId(object);
  if (oid && /^https?:\/\//i.test(oid)) {
    h += '<div class="quote-view-link-row">'
      + '<a class="quote-view-link" href="' + esc(oid) + '" target="_blank" rel="noopener noreferrer">'
      + esc(lang.quoteOpenExternal || 'Open link') + '</a></div>';
  }
  if (source && source !== 'api') {
    h += '<div class="quote-view-source">'
      + esc((lang.quoteViewSource || 'Source: {s}').replace('{s}', source)) + '</div>';
  }
  h += '</div>';
  return h;
}

function closeQuotedPostDetail() {
  var dlg = $('quote-view-dialog');
  if (!dlg) return;
  if (typeof aroDismiss === 'function') {
    aroDismiss(dlg, { ms: 160 });
  } else {
    dlg.style.display = 'none';
    dlg.hidden = true;
  }
  var bodyEl = $('quote-view-body');
  if (bodyEl) bodyEl.innerHTML = '';
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
  // Published rows use content_preview/title rather than timeline Note shape.
  var preview = feedItemPreviewText(item) || '';
  if (!preview && item) {
    preview = stripHtmlPreview(item.content_preview || item.summary || item.title || item.name || '') || '';
  }
  var author = opts.author || '';
  if (!author && item && item.actor) {
    author = item.actor.display_name || '';
    if (!author && item.actor.username) {
      author = '@' + item.actor.username + (item.actor.domain ? '@' + item.actor.domain : '');
    }
  }
  var link = opts.linkUrl || '';
  if (!link && item) {
    var cj = typeof timelineContentObject === 'function' ? timelineContentObject(item) : null;
    if (cj && typeof cj.url === 'string' && cj.url) link = cj.url;
    else if (item.url && /^https?:\/\//i.test(String(item.url))) link = String(item.url);
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
  var ok = await copyTextToClipboard(text, { showMessage: false, silent: true });
  if (ok !== false) {
    try {
      Tapp.ui.showNotification({
        title: lang.shareCopiedText || lang.copied || 'Copied',
        type: 'success',
      });
    } catch (e0) {}
  }
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
  var ok = await copyTextToClipboard(link, { showMessage: false, silent: true });
  if (ok !== false) {
    try {
      Tapp.ui.showNotification({
        title: lang.shareCopiedIntent || lang.copied || 'Copied',
        type: 'success',
      });
    } catch (e1) {}
  }
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

var followBackBusy = {};

async function doFollowBack(actorUrl) {
  if (!actorUrl || state.isGuest) return;
  if (!Tapp.federation || typeof Tapp.federation.follow !== 'function') return;
  var busyKey = String(actorUrl);
  if (followBackBusy[busyKey]) return;
  followBackBusy[busyKey] = true;
  // Mark matching buttons busy (dataset match — no CSS.escape)
  try {
    document.querySelectorAll('[data-action-follow-back]').forEach(function (btn) {
      if (String(btn.dataset.actionFollowBack || '') !== busyKey) return;
      btn.classList.add('is-busy');
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
    });
  } catch (eB) {}
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
  } finally {
    delete followBackBusy[busyKey];
    try {
      document.querySelectorAll('[data-action-follow-back]').forEach(function (btn) {
        if (String(btn.dataset.actionFollowBack || '') !== busyKey) return;
        btn.classList.remove('is-busy');
        btn.disabled = false;
        btn.setAttribute('aria-busy', 'false');
      });
    } catch (eF) {}
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

/** Initial / step size for feed list windowing (DOM cap). */
var FEED_LIST_PAGE = 60;

/** Cheap fingerprint so identical feed lists skip full DOM rewrite. */
function feedListFingerprint(sub, items, q, loading, err, visible) {
  var n = (items && items.length) || 0;
  var head = '';
  var tail = '';
  if (n > 0) {
    var a = items[0] || {};
    var b = items[n - 1] || {};
    head = a.object_id || a.content_id || a.actor_url || a.id || a.username || '';
    tail = b.object_id || b.content_id || b.actor_url || b.id || b.username || '';
  }
  return [sub || '', n, q || '', loading ? 1 : 0, err ? String(err).slice(0, 40) : '', head, tail, visible || 0].join('|');
}

function ensureFeedVisibleCount(sub, total) {
  if (!state.feedVisible) state.feedVisible = {};
  var cur = state.feedVisible[sub];
  if (cur == null || cur < FEED_LIST_PAGE) cur = FEED_LIST_PAGE;
  // Clamp if list shrank
  if (total != null && cur > total) cur = total;
  state.feedVisible[sub] = cur;
  return cur;
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
    state._feedRenderFp = '';
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
    state._feedRenderFp = '';
    content.innerHTML = renderFeedSkeleton();
    if (empty) empty.style.display = 'none';
    return;
  }

  if (state.feedError) {
    state._feedRenderFp = '';
    content.innerHTML = '';
    if (empty) empty.style.display = 'none';
    showFeedEmpty(state.feedError, 'error');
    return;
  }

  if (!allItems || allItems.length === 0) {
    state._feedRenderFp = '';
    content.innerHTML = '';
    // Prefer empty UI even before first load completes (avoids pure white main).
    showFeedEmpty(getFeedEmptyText(sub), hasLoaded ? 'empty' : (state.feedLoading ? 'loading' : 'empty'));
    return;
  }

  if (items.length === 0 && q) {
    state._feedRenderFp = '';
    content.innerHTML = searchNoResultsHtml();
    if (empty) empty.style.display = 'none';
    return;
  }

  if (empty) empty.style.display = 'none';

  // Window long lists so first paint stays cheap (show more expands in place)
  var visible = ensureFeedVisibleCount(sub, items.length);
  var windowed = items.length > visible ? items.slice(0, visible) : items;
  var hasMoreFeed = items.length > windowed.length;

  // Skip identical list paint (poll / tab re-entry with same data)
  var fp = feedListFingerprint(sub, items, q, state.feedLoading, null, visible);
  if (fp && fp === state._feedRenderFp && content.childNodes.length > 0
    && !content.querySelector('.feed-skeleton, .aro-search-empty')
    && !!content.querySelector('.feed-load-more') === hasMoreFeed) {
    return;
  }
  state._feedRenderFp = fp;

  if (sub === 'timeline' || sub === 'bookmarks') {
    windowed.forEach(function (item) {
      html += renderTimelineItem(item);
    });
  } else if (sub === 'following') {
    windowed.forEach(function (actor) {
      html += renderActorItem(actor, 'following');
    });
  } else if (sub === 'followers') {
    windowed.forEach(function (actor) {
      html += renderActorItem(actor, 'followers');
    });
  } else if (sub === 'published') {
    windowed.forEach(function (item) {
      html += renderPublishedItem(item);
    });
  }

  if (hasMoreFeed) {
    var remain = items.length - windowed.length;
    html += '<div class="feed-load-more-wrap">'
      + '<button type="button" class="feed-load-more" id="feed-load-more" data-feed-load-more="1">'
      + esc((lang.feedShowMore || lang.historyLoadMore || 'Show more') + ' (' + remain + ')')
      + '</button></div>';
  }

  content.innerHTML = html;
  bindFeedContentActions(content);
}

// Feed card HTML lives in page/feedUi.js (Page entry graph).

function switchFeedSubTab(sub) {
  // Reset window when changing tabs so we don't inherit a huge visible count
  if (sub && state.feedVisible) state.feedVisible[sub] = FEED_LIST_PAGE;
  state._feedRenderFp = '';
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

// → feedCompose.js

// → ringsUi.js

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
    var d = $('ring-create-dialog');
    if (d) {
      showAroOverlay(d);
    }
    if (typeof updateRingCreateCategoryVisibility === 'function') updateRingCreateCategoryVisibility();
  });
  if (typeof initRingCreateSelects === 'function') initRingCreateSelects();
  else if (typeof initAroSelect === 'function') {
    initAroSelect('ring-type-select');
    initAroSelect('ring-brew-category-select');
  }
  var ringTypeSelect = $('ring-type-select');
  if (ringTypeSelect) ringTypeSelect.addEventListener('change', function () {
    if (typeof updateRingCreateCategoryVisibility === 'function') updateRingCreateCategoryVisibility();
  });
  var ringCreateClose = $('ring-create-close');
  if (ringCreateClose) ringCreateClose.addEventListener('click', function () {
    var d = $('ring-create-dialog');
    if (d) aroDismiss(d, { ms: 170 });
  });
  var ringCreateOverlay = $('ring-create-dialog');
  if (ringCreateOverlay) ringCreateOverlay.addEventListener('click', function (e) {
    if (e.target === ringCreateOverlay) aroDismiss(ringCreateOverlay, { ms: 170 });
  });

  // Ring create submit
  var createRingBtn = $('create-ring-btn');
  if (createRingBtn) createRingBtn.addEventListener('click', doCreateRing);
  var ringNameInput = $('ring-name-input');
  if (ringNameInput) ringNameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doCreateRing(); }
  });

  // Ring detail inline panel events
  var ringBackBtn = $('ring-back-btn');
  if (ringBackBtn) ringBackBtn.addEventListener('click', hideRingDetail);
  var ringIdCopyBtn = $('ring-id-copy');
  if (ringIdCopyBtn) ringIdCopyBtn.addEventListener('click', copyRingId);
  var ringSyncBtn = $('ring-sync-btn');
  if (ringSyncBtn) ringSyncBtn.addEventListener('click', doTriggerSync);
  var ringManageBtn = $('ring-manage-btn');
  if (ringManageBtn) ringManageBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var dd = $('ring-manage-dropdown');
    if (dd) dd.classList.toggle('open');
  });
  var ringLeaveBtn2 = $('ring-leave-btn');
  if (ringLeaveBtn2) ringLeaveBtn2.addEventListener('click', async function () {
    var dd = $('ring-manage-dropdown'); if (dd) dd.classList.remove('open');
    if (state.activeRingId && (await aroConfirm(lang.leaveRingConfirm, true))) {
      doLeaveRing(state.activeRingId);
    }
  });
  // Close ring manage menu on outside click
  pageListen(document, 'click', function (e) {
    var dd = $('ring-manage-dropdown');
    if (!dd || !dd.classList.contains('open')) return;
    var wrap = dd.closest('.manage-wrap') || dd.parentElement;
    if (wrap && wrap.contains(e.target)) return;
    dd.classList.remove('open');
  });
  var ringAddPeerBtn = $('ring-add-peer-btn');
  if (ringAddPeerBtn) ringAddPeerBtn.addEventListener('click', doAddPeer);
  var ringPeerInput = $('ring-peer-input');
  if (ringPeerInput) ringPeerInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doAddPeer(); }
  });

  // Feed: refresh, tabs, follow, stat clicks
  var refreshFeedBtn = $('refresh-feed-btn');
  if (refreshFeedBtn) refreshFeedBtn.addEventListener('click', function () { loadFeed(); });
  var refreshFeedMobileBtn = $('refresh-feed-mobile-btn');
  if (refreshFeedMobileBtn) refreshFeedMobileBtn.addEventListener('click', function () { loadFeed(); });
  document.querySelectorAll('.feed-nav-item').forEach(function (btn) {
    btn.addEventListener('click', function () { switchFeedSubTab(btn.dataset.sub); });
  });
  document.querySelectorAll('.feed-mobile-tab').forEach(function (btn) {
    btn.addEventListener('click', function () { switchFeedSubTab(btn.dataset.sub); });
  });
  // Messenger sidebar: 最近 / 私信 / 群聊 (no closed tab/chip)
  // Prefer bar-level delegation so re-renders / i18n text swaps never drop handlers.
  var convTabsBar = $('conv-tabs-bar') || document.querySelector('.conv-tabs-bar');
  if (convTabsBar && convTabsBar.dataset.convTabsBound !== '1') {
    convTabsBar.dataset.convTabsBound = '1';
    convTabsBar.addEventListener('click', function (e) {
      var tabBtn = e.target && e.target.closest ? e.target.closest('.conv-tab') : null;
      if (tabBtn && convTabsBar.contains(tabBtn)) {
        e.preventDefault();
        if (typeof setConvTab === 'function') {
          setConvTab(tabBtn.getAttribute('data-conv-tab') || 'recent');
        }
      }
    });
  } else {
    document.querySelectorAll('.conv-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (typeof setConvTab === 'function') setConvTab(btn.getAttribute('data-conv-tab') || 'recent');
      });
    });
  }
  // Conversation list: stable delegation (also re-asserted in renderConvList)
  if (typeof bindConvListClicks === 'function') bindConvListClicks();
  var feedFollowBtn = $('feed-follow-btn');
  if (feedFollowBtn) feedFollowBtn.addEventListener('click', doFollow);
  var feedFollowInput = $('feed-follow-input');
  if (feedFollowInput) feedFollowInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doFollow(); }
  });
  var feedFollowClose = $('feed-follow-dialog-close');
  if (feedFollowClose) feedFollowClose.addEventListener('click', closeFollowDialog);
  var feedFollowOverlay = $('feed-follow-dialog');
  if (feedFollowOverlay) feedFollowOverlay.addEventListener('click', function (e) {
    if (e.target === feedFollowOverlay) closeFollowDialog();
  });

  // Unified feed + menu (Post / Follow)
  function onFeedPlusClick(e) {
    e.stopPropagation();
    toggleFeedPlusMenu(e.currentTarget);
  }
  var feedPlusBtn = $('feed-plus-btn');
  if (feedPlusBtn) feedPlusBtn.addEventListener('click', onFeedPlusClick);
  var feedPlusMobileBtn = $('feed-plus-mobile-btn');
  if (feedPlusMobileBtn) feedPlusMobileBtn.addEventListener('click', onFeedPlusClick);
  document.querySelectorAll('[data-feed-plus]').forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.stopPropagation();
      handleFeedPlusAction(item.getAttribute('data-feed-plus'));
    });
  });
  pageListen(document, 'click', function (e) {
    var t = e.target;
    if (t && (t.closest('#feed-plus-wrap') || t.closest('#feed-plus-wrap-mobile'))) return;
    closeFeedPlusMenu();
  });
  pageListen(document, 'keydown', function (e) {
    if (e.key !== 'Escape') return;
    var menuOpen = document.querySelector('.feed-plus-menu.open');
    if (menuOpen) {
      e.preventDefault();
      closeFeedPlusMenu();
      return;
    }
    var shareDlg = $('feed-share-dialog');
    if (shareDlg && shareDlg.style.display !== 'none') {
      e.preventDefault();
      if (typeof closeShareModal === 'function') closeShareModal();
      return;
    }
    var quoteViewDlg = $('quote-view-dialog');
    if (quoteViewDlg && quoteViewDlg.style.display !== 'none' && !quoteViewDlg.hidden) {
      e.preventDefault();
      if (typeof closeQuotedPostDetail === 'function') closeQuotedPostDetail();
      return;
    }
    var quoteDlg = $('quote-repost-dialog');
    if (quoteDlg && quoteDlg.style.display !== 'none') {
      e.preventDefault();
      if (typeof closeQuoteRepostModal === 'function') closeQuoteRepostModal();
      return;
    }
    var composeDlg = $('feed-compose-dialog');
    if (composeDlg && composeDlg.style.display !== 'none') {
      e.preventDefault();
      closeComposer();
      return;
    }
    var followDlg = $('feed-follow-dialog');
    if (followDlg && followDlg.style.display !== 'none') {
      e.preventDefault();
      closeFollowDialog();
    }
  });

  // Quote-repost composer (modal)
  var quoteCancel = $('quote-repost-cancel');
  if (quoteCancel) quoteCancel.addEventListener('click', function () {
    if (typeof closeQuoteRepostModal === 'function') closeQuoteRepostModal();
  });
  var quoteClose = $('quote-repost-close');
  if (quoteClose) quoteClose.addEventListener('click', function () {
    if (typeof closeQuoteRepostModal === 'function') closeQuoteRepostModal();
  });
  var quoteOverlay = $('quote-repost-dialog');
  if (quoteOverlay) quoteOverlay.addEventListener('click', function (e) {
    if (e.target === quoteOverlay && typeof closeQuoteRepostModal === 'function') closeQuoteRepostModal();
  });
  var quoteSubmit = $('quote-repost-submit');
  if (quoteSubmit) quoteSubmit.addEventListener('click', function () {
    if (typeof doSubmitQuoteRepost === 'function') doSubmitQuoteRepost();
  });
  var quoteTa = $('quote-repost-text');
  if (quoteTa) quoteTa.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (typeof doSubmitQuoteRepost === 'function') doSubmitQuoteRepost();
    }
  });

  // Quote original post viewer (no follow required)
  var qvClose = $('quote-view-close');
  if (qvClose) qvClose.addEventListener('click', function () {
    if (typeof closeQuotedPostDetail === 'function') closeQuotedPostDetail();
  });
  var qvDismiss = $('quote-view-dismiss');
  if (qvDismiss) qvDismiss.addEventListener('click', function () {
    if (typeof closeQuotedPostDetail === 'function') closeQuotedPostDetail();
  });
  var qvOverlay = $('quote-view-dialog');
  if (qvOverlay) qvOverlay.addEventListener('click', function (e) {
    if (e.target === qvOverlay && typeof closeQuotedPostDetail === 'function') closeQuotedPostDetail();
  });

  // External share modal (intent only — no server post)
  var shareCancel = $('feed-share-cancel');
  if (shareCancel) shareCancel.addEventListener('click', function () {
    if (typeof closeShareModal === 'function') closeShareModal();
  });
  var shareClose = $('feed-share-close');
  if (shareClose) shareClose.addEventListener('click', function () {
    if (typeof closeShareModal === 'function') closeShareModal();
  });
  var shareOverlay = $('feed-share-dialog');
  if (shareOverlay) shareOverlay.addEventListener('click', function (e) {
    if (e.target === shareOverlay && typeof closeShareModal === 'function') closeShareModal();
  });
  var shareCopy = $('feed-share-copy');
  if (shareCopy) shareCopy.addEventListener('click', function () {
    if (typeof doShareCopyText === 'function') doShareCopyText();
  });
  var shareCopyLink = $('feed-share-copy-link');
  if (shareCopyLink) shareCopyLink.addEventListener('click', function () {
    if (typeof doShareCopyLink === 'function') doShareCopyLink();
  });
  var shareX = $('feed-share-x');
  if (shareX) shareX.addEventListener('click', function () {
    if (typeof doShareOpenX === 'function') doShareOpenX();
  });
  var shareTa = $('feed-share-text');
  if (shareTa) shareTa.addEventListener('input', function () {
    if (typeof updateShareCharCount === 'function') updateShareCharCount();
  });

  // Feed freeform note composer (modal)
  var composeCancel = $('feed-compose-cancel');
  if (composeCancel) composeCancel.addEventListener('click', function () { closeComposer(); });
  var composeDialogClose = $('feed-compose-dialog-close');
  if (composeDialogClose) composeDialogClose.addEventListener('click', function () { closeComposer(); });
  var composeOverlay = $('feed-compose-dialog');
  if (composeOverlay) composeOverlay.addEventListener('click', function (e) {
    if (e.target === composeOverlay) closeComposer();
  });
  var composePublish = $('feed-compose-publish');
  if (composePublish) composePublish.addEventListener('click', publishComposeNote);
  var composeImageBtn = $('feed-compose-image-btn');
  var composeImageInput = $('feed-compose-image-input');
  if (composeImageBtn && composeImageInput) {
    composeImageBtn.addEventListener('click', function () { composeImageInput.click(); });
    composeImageInput.addEventListener('change', function () {
      addComposeFiles(composeImageInput.files, 'image');
      composeImageInput.value = '';
      // New attach clears "text-only draft" notice for this session.
      if (composeAttachments.length) {
        composeDraftTextOnly = false;
        setComposeDraftNotice(false);
      }
    });
  }
  var composeVideoBtn = $('feed-compose-video-btn');
  var composeVideoInput = $('feed-compose-video-input');
  if (composeVideoBtn && composeVideoInput) {
    composeVideoBtn.addEventListener('click', function () { composeVideoInput.click(); });
    composeVideoInput.addEventListener('change', function () {
      addComposeFiles(composeVideoInput.files, 'video');
      composeVideoInput.value = '';
      if (composeAttachments.length) {
        composeDraftTextOnly = false;
        setComposeDraftNotice(false);
      }
    });
  }
  document.querySelectorAll('[data-fed-toggle]').forEach(function (summary) {
    summary.addEventListener('click', function (e) {
      if (e.target && (e.target.closest('[data-copy-fed]') || e.target.closest('[data-fed-toggle-button]'))) return;
      toggleFeedProfileSummary(summary.closest('[data-fed-profile]'));
    });
    summary.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleFeedProfileSummary(summary.closest('[data-fed-profile]'));
      }
    });
  });
  document.querySelectorAll('[data-fed-toggle-button]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleFeedProfileDetails(btn.closest('[data-fed-profile]'));
    });
  });
  document.querySelectorAll('[data-copy-fed]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      copyFederationIdentity(btn.dataset.copyFed);
    });
  });
  pageListen(document, 'click', function (e) {
    if (e.target && e.target.closest('[data-fed-profile]')) return;
    closeFeedProfilePopovers();
  });
  pageListen(window, 'resize', function () { closeFeedProfilePopovers(); });

  // Messenger events
  var sendBtn = $('send-btn');
  if (sendBtn) sendBtn.addEventListener('click', doSend);

  var attachBtn = $('attach-btn');
  if (attachBtn) attachBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleAttachMenu(); });

  if (typeof bindStickerUi === 'function') bindStickerUi();

  var attachImageInput = $('attach-image-input');
  if (attachImageInput) attachImageInput.addEventListener('change', function () { if (this.files[0]) handleFileSelect(this.files[0], 'image'); });

  var attachFileInput = $('attach-file-input');
  if (attachFileInput) attachFileInput.addEventListener('change', function () { if (this.files[0]) handleFileSelect(this.files[0]); });

  var input = $('msg-input');
  if (input) {
    input.addEventListener('keydown', function (e) {
      // @ mention picker steals arrows / Enter / Tab / Escape when open
      if (typeof onMentionKeydown === 'function' && onMentionKeydown(e)) return;
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
    input.addEventListener('input', function () {
      autoResizeInput(this);
      updateSendState();
      if (typeof onMentionInput === 'function') onMentionInput(this);
    });
    // Caret moved with arrows without typing — refresh active @ token
    input.addEventListener('keyup', function (e) {
      if (!e) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
        if (typeof onMentionInput === 'function') onMentionInput(this);
      }
    });
    input.addEventListener('blur', function () {
      // Delay so mousedown on picker can fire first
      setTimeout(function () {
        if (typeof closeMentionPicker === 'function') closeMentionPicker();
      }, 180);
    });
    input.addEventListener('click', function () {
      if (typeof onMentionInput === 'function') onMentionInput(this);
    });
    // Paste image from clipboard (screenshot / copy image) → attach preview
    input.addEventListener('paste', function (e) {
      if (!state.activeId || state.sending) return;
      if (typeof isChannelComposerLocked === 'function' && isChannelComposerLocked()) return;
      if (typeof isRoomComposerLocked === 'function' && isRoomComposerLocked()) return;
      var cd = e.clipboardData || (e.originalEvent && e.originalEvent.clipboardData);
      if (!cd) return;
      var file = null;
      // Prefer items (image/*) so we don't steal text-only pastes
      if (cd.items && cd.items.length) {
        for (var i = 0; i < cd.items.length; i++) {
          var it = cd.items[i];
          if (it && it.kind === 'file' && it.type && it.type.indexOf('image/') === 0) {
            file = it.getAsFile();
            if (file) break;
          }
        }
      }
      if (!file && cd.files && cd.files.length) {
        for (var j = 0; j < cd.files.length; j++) {
          if (cd.files[j] && cd.files[j].type && cd.files[j].type.indexOf('image/') === 0) {
            file = cd.files[j];
            break;
          }
        }
      }
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof handleFileSelect === 'function') {
        // Ensure a filename for screenshots that often arrive as image.png or empty
        if (!file.name || file.name === 'image.png' || file.name === 'blob') {
          try {
            var ext = (file.type && file.type.split('/')[1]) || 'png';
            var named = new File([file], 'paste-' + Date.now() + '.' + ext, {
              type: file.type || 'image/png',
            });
            handleFileSelect(named, 'image');
            return;
          } catch (eName) { /* fall through */ }
        }
        handleFileSelect(file, 'image');
      }
    });
  }
  updateSendState();

  var backBtn = $('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      // Invalidate in-flight open/poll so leaving chat cannot flash stale messages.
      state.openGen = (state.openGen || 0) + 1;
      state.chatOpening = false;
      if (typeof clearRosterConfirmTimers === 'function') clearRosterConfirmTimers();
      state.rosterConfirmToken = (state.rosterConfirmToken || 0) + 1;
      // History/files live under #chat-main (siblings of #chat-container), and on mobile
      // .history-overlay is position:fixed;z-index:90 — must seal BEFORE hiding chat shell.
      if (typeof dismissTransientUi === 'function') {
        dismissTransientUi({ keepChat: false });
      } else {
        try { if (typeof closeChatHistory === 'function') closeChatHistory(); } catch (eH) { /* ignore */ }
        try { if (typeof closeRoomFiles === 'function') closeRoomFiles(); } catch (eF) { /* ignore */ }
        try { if (typeof closeInvitePopover === 'function') closeInvitePopover(); } catch (eI) { /* ignore */ }
        try { if (typeof closeAttachMenu === 'function') closeAttachMenu(); } catch (eA) { /* ignore */ }
        try { if (typeof closeManageDropdown === 'function') closeManageDropdown(); } catch (eM) { /* ignore */ }
      }
      // Hard-seal fixed history/files immediately (close helpers may animate; PE must die now).
      try {
        ['chat-history-overlay', 'room-files-overlay'].forEach(function (id) {
          var el = $(id);
          if (!el) return;
          if (typeof forceHideInteractive === 'function') forceHideInteractive(el);
          else {
            el.style.pointerEvents = 'none';
            el.style.display = 'none';
            el.hidden = true;
          }
        });
      } catch (eSealHist) { /* ignore */ }
      var sidebar = $('sidebar');
      var chat = $('chat-container');
      var members = $('member-panel');
      var empty = $('empty-state');
      // Paint list first (instant), then hide chat — feels snappier on mobile.
      if (sidebar) {
        sidebar.classList.remove('sidebar-hidden-mobile');
        sidebar.style.pointerEvents = '';
      }
      if (chat) {
        chat.style.display = 'none';
        chat.classList.remove('aro-panel-enter');
      }
      if (members) {
        members.style.display = 'none';
        members.classList.remove('member-open-mobile');
        members.classList.remove('member-expanded-tablet');
        // Closed mobile sheet must not intercept list clicks (CSS PE none may lose to inline auto).
        members.style.pointerEvents = 'none';
      }
      if (empty) {
        empty.style.display = '';
      }
      // Animate list return only on narrow layouts where sidebar was fully hidden.
      var isMobileNav = false;
      try {
        isMobileNav = !!(window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
      } catch (eMm) { /* ignore */ }
      if (isMobileNav && sidebar && typeof aroPlayEnter === 'function') {
        aroPlayEnter(sidebar, 'aro-panel-enter');
      }
      if (empty && typeof aroPlayEnter === 'function') {
        aroPlayEnter(empty, 'aro-panel-enter');
      }
      clearPendingAttach();
      closeAttachMenu();
      if (typeof clearQuote === 'function') clearQuote();
      closeMsgMenu();
      stopPolling();
      unsubscribeRealtime();
      state.activeKind = null;
      state.activeId = null;
      state.messages = [];
      state.messagesFp = '';
      state.messagesSrcFp = '';
      state.skipMsgAppear = false;
      state.channelDetail = null;
      state.roomDetail = null;
      state.members = [];
      state.chatLoadError = null;
      renderConvList();
      updateSendState();
    });
  }

  var memberBackBtn = $('member-back-btn');
  if (memberBackBtn) {
    memberBackBtn.addEventListener('click', function () {
      closeMemberPanel();
    });
  }

  // Create dialog events
  var createBtn = $('create-btn');
  if (createBtn) createBtn.addEventListener('click', showCreateDialog);
  var emptyStartBtn = $('empty-start-btn');
  if (emptyStartBtn) emptyStartBtn.addEventListener('click', function () {
    if (typeof showCreateDialog === 'function') showCreateDialog();
  });

  var overlay = $('create-dialog');
  if (overlay) overlay.addEventListener('click', function (e) {
    if (e.target === overlay) hideCreateDialog();
  });

  var closeDialogBtn = $('create-dialog-close');
  if (closeDialogBtn) closeDialogBtn.addEventListener('click', hideCreateDialog);

  var tabChannel = $('create-tab-channel');
  if (tabChannel) tabChannel.addEventListener('click', function () { switchCreateTab('channel'); });

  var tabRoom = $('create-tab-room');
  if (tabRoom) tabRoom.addEventListener('click', function () { switchCreateTab('room'); });

  var createChannelBtn = $('create-channel-btn');
  if (createChannelBtn) createChannelBtn.addEventListener('click', doCreateChannel);

  var createRoomBtn = $('create-room-btn');
  if (createRoomBtn) createRoomBtn.addEventListener('click', doCreateRoom);
  var joinRoomIdBtn = $('join-room-id-btn');
  if (joinRoomIdBtn) joinRoomIdBtn.addEventListener('click', doJoinRoomById);
  if (typeof bindRoomAvatarUi === 'function') bindRoomAvatarUi();

  // Enter key in create inputs
  var channelInput = $('create-channel-input');
  if (channelInput) channelInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doCreateChannel(); }
  });
  var roomInput = $('create-room-input');
  if (roomInput) roomInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doCreateRoom(); }
  });
  var joinRoomIdInput = $('join-room-id-input');
  if (joinRoomIdInput) joinRoomIdInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doJoinRoomById(); }
  });

  // Invite popover events
  var inviteToggle = $('invite-toggle');
  if (inviteToggle) inviteToggle.addEventListener('click', toggleInvitePopover);

  // List search (client-side filter)
  bindListSearch('conv-search', 'conv', function () {
    if (typeof renderConvList === 'function') renderConvList();
  });
  bindListSearch('ring-search', 'ring', function () {
    if (typeof renderRingsSidebar === 'function') renderRingsSidebar();
  });
  bindListSearch('feed-search', 'feed', function () {
    if (typeof renderFeedContent === 'function') renderFeedContent();
    if (typeof updateFeedHeader === 'function') updateFeedHeader();
  });
  bindListSearch('member-search', 'member', function () {
    if (typeof renderMembers === 'function') renderMembers();
  });

  // Chat history browser (search / filter / load older)
  if (typeof bindChatHistoryUi === 'function') bindChatHistoryUi();
  // Room files panel (group attachment library)
  if (typeof bindRoomFilesUi === 'function') bindRoomFilesUi();

  // Edit room dialog events
  var editRoomOverlay = $('edit-room-dialog');
  if (editRoomOverlay) editRoomOverlay.addEventListener('click', function (e) {
    if (e.target === editRoomOverlay) hideEditRoomDialog();
  });
  var editRoomCloseBtn = $('edit-room-close');
  if (editRoomCloseBtn) editRoomCloseBtn.addEventListener('click', hideEditRoomDialog);
  var editRoomSaveBtn = $('edit-room-save');
  if (editRoomSaveBtn) editRoomSaveBtn.addEventListener('click', doSaveRoom);
  var editRoomIdCopy = $('edit-room-id-copy');
  if (editRoomIdCopy) editRoomIdCopy.addEventListener('click', function () {
    var id = state.roomDetail
      ? (typeof shareableRoomId === 'function'
        ? shareableRoomId(state.roomDetail)
        : state.roomDetail.room_id)
      : '';
    if (!id) return;
    if (typeof copyTextToClipboard === 'function') {
      copyTextToClipboard(id, { okTitle: lang.copied || 'Copied' });
    } else if (typeof fallbackCopyText === 'function') {
      fallbackCopyText(id);
    }
  });

  // Esc closes topmost messenger overlays/menus (menus → pickers → dialogs)
  pageListen(document, 'keydown', function (e) {
    if (e.key !== 'Escape' && e.keyCode !== 27) return;
    // Message context menu
    if (typeof closeMsgMenu === 'function' && typeof _msgMenu !== 'undefined' && _msgMenu) {
      closeMsgMenu();
      e.preventDefault();
      return;
    }
    // Attach menu
    if (typeof closeAttachMenu === 'function' && typeof _attachMenu !== 'undefined' && _attachMenu) {
      closeAttachMenu();
      e.preventDefault();
      return;
    }
    // Invite popover
    if (typeof closeInvitePopover === 'function' && typeof _invitePopover !== 'undefined' && _invitePopover && _invitePopover.style.display !== 'none') {
      closeInvitePopover();
      e.preventDefault();
      return;
    }
    // Chat history panel
    if (typeof isChatHistoryOpen === 'function' && isChatHistoryOpen()) {
      closeChatHistory();
      e.preventDefault();
      return;
    }
    // Room files panel
    if (typeof isRoomFilesOpen === 'function' && isRoomFilesOpen()) {
      closeRoomFiles();
      e.preventDefault();
      return;
    }
    // Manage dropdown
    var manageDd = $('manage-dropdown');
    if (manageDd && manageDd.classList.contains('open')) {
      closeManageDropdown();
      e.preventDefault();
      return;
    }
    // Topmost dismissable overlay (forward / picker / confirm)
    var overlays = document.querySelectorAll('.forward-overlay, .picker-overlay, .confirm-overlay');
    if (overlays.length) {
      var top = overlays[overlays.length - 1];
      if (top.classList.contains('confirm-overlay')) {
        var cancelBtn = top.querySelector('.confirm-btn-cancel');
        if (cancelBtn) cancelBtn.click();
      } else {
        aroDismiss(top, { remove: true, ms: 160 });
      }
      e.preventDefault();
      return;
    }
    // Create / edit room dialogs
    var createDlg = $('create-dialog');
    if (createDlg && createDlg.style.display !== 'none') {
      hideCreateDialog();
      e.preventDefault();
      return;
    }
    var editDlg = $('edit-room-dialog');
    if (editDlg && editDlg.style.display !== 'none') {
      hideEditRoomDialog();
      e.preventDefault();
    }
  });

  // ARO-14: document-level guards that used to bind at module load
  if (typeof registerManageDropdownOutsideGuard === 'function') registerManageDropdownOutsideGuard();
  if (typeof registerInvitePopoverOutsideGuard === 'function') registerInvitePopoverOutsideGuard();
  if (typeof registerMsgMenuOutsideGuards === 'function') registerMsgMenuOutsideGuards();
}

