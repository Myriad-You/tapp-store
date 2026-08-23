var share = require('./scope.js');

// ==================== Feed UI cards (list item HTML) ====================
// Extracted from views.js for load order clarity + smaller views surface.
// Depends on: helpers (esc, lang, avatar…), state, SVG_ICONS / platform helpers.
// Interaction helpers (resolveObjectId, isOwnTimelineItem, …) live in views.js
// and are resolved at call time, once the whole page layer has loaded.

/** Max characters shown on list cards (detail modal shows full body). */
var FEED_CARD_TEXT_MAX = 280;

function truncateFeedCardText(text, maxChars) {
  text = String(text || '');
  maxChars = maxChars || FEED_CARD_TEXT_MAX || 280;
  if (text.length <= maxChars) return { text: text, truncated: false };
  var cut = text.slice(0, maxChars);
  var sp = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf(' '));
  if (sp > maxChars * 0.55) cut = cut.slice(0, sp);
  return { text: cut.replace(/\s+$/, '') + '…', truncated: true };
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
  var canOpenPost = !!(objectId || text || (attachments && attachments.length));
  var h = '<div class="feed-item'
    + (isRepostCard ? ' is-repost' : '')
    + (inReplyTo && !isRepostCard ? ' is-reply' : '')
    + (canOpenPost ? ' is-openable' : '')
    + '" data-object-id="' + esc(objectId) + '"'
    + (item.activity_id ? ' data-activity-id="' + esc(String(item.activity_id)) + '"' : '')
    + (canOpenPost ? ' role="button" tabindex="0" data-action-open-post="1"' : '')
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
    var trunc = truncateFeedCardText(text, FEED_CARD_TEXT_MAX);
    var textCls = 'feed-item-text' + (trunc.truncated ? ' is-clamped' : '');
    if (linkUrl) {
      h += '<div class="' + textCls + '"><a href="' + esc(linkUrl) + '" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline">' + esc(trunc.text) + '</a></div>';
    } else {
      h += '<div class="' + textCls + '">' + esc(trunc.text) + '</div>';
    }
    if (trunc.truncated) {
      h += '<button type="button" class="feed-item-more" data-action-open-post="1">'
        + esc(lang.postShowMore || 'Show more') + '</button>';
    }
  }
  // Nested quote chain: truncated on list; click opens original / parent detail.
  if (isQuoteRepost && contentJson) {
    var quoted = contentJson['mfp:quotedObject'] || contentJson.mfp_quotedObject || null;
    if (quoted && typeof quoted === 'object') {
      h += renderQuotedObjectHtml(quoted, 0, { interactive: true, full: false });
    } else if (contentJson.quoteUrl || contentJson.inReplyTo || contentJson['mfp:quotedObjectId']) {
      var fallbackId = contentJson['mfp:quotedObjectId'] || contentJson.quoteUrl
        || contentJson.inReplyTo || '';
      h += renderQuotedObjectHtml({
        id: fallbackId,
        type: 'Note',
        content_preview: lang.quoteRepostQuoted || 'Quoted post',
      }, 0, { interactive: true, full: false });
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
  var dateTitle = '';
  try { dateStr = timeAgo(item.published_at); } catch (e) {}
  try {
    if (item.published_at) {
      var dPub = new Date(item.published_at);
      if (!isNaN(dPub.getTime())) dateTitle = dPub.toLocaleString();
    }
  } catch (eTs) {}
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
  var pubObjectId = item.object_id || '';
  if (!pubObjectId && item.content_json && item.content_json.id) pubObjectId = String(item.content_json.id);
  var canOpenPub = !!(pubObjectId || preview || (attachments && attachments.length));
  var h = '<div class="feed-item' + (isRepost ? ' is-repost' : '') + (canOpenPub ? ' is-openable' : '') + '"'
    + (pubObjectId ? ' data-object-id="' + esc(String(pubObjectId)) + '"' : '')
    + (item.activity_id ? ' data-activity-id="' + esc(String(item.activity_id)) + '"' : '')
    + (canOpenPub ? ' role="button" tabindex="0" data-action-open-post="1"' : '')
    + '>';
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
  if (dateStr) {
    h += '<span class="feed-item-sep">&middot;</span><span class="feed-item-time"'
      + (dateTitle ? ' title="' + esc(dateTitle) + '"' : '') + '>' + esc(dateStr) + '</span>';
  }
  h += '</div>';
  if (preview && (!titleLine || preview !== titleLine || isRepost)) {
    var pTrunc = truncateFeedCardText(preview, FEED_CARD_TEXT_MAX);
    h += '<div class="feed-item-text' + (pTrunc.truncated ? ' is-clamped' : '') + '">' + esc(pTrunc.text) + '</div>';
    if (pTrunc.truncated) {
      h += '<button type="button" class="feed-item-more" data-action-open-post="1">'
        + esc(lang.postShowMore || 'Show more') + '</button>';
    }
  }
  // Quote-repost: truncated nested quote on list; click opens original.
  if (isRepost) {
    var pubCj = item.content_json || item.content || item.object || null;
    if (pubCj && pubCj.object && typeof pubCj.object === 'object'
      && !pubCj.content && !(pubCj.source && pubCj.source.content)) {
      pubCj = pubCj.object;
    }
    var pubQuoted = pubCj && (pubCj['mfp:quotedObject'] || pubCj.mfp_quotedObject);
    if (pubQuoted && typeof pubQuoted === 'object') {
      h += renderQuotedObjectHtml(pubQuoted, 0, { interactive: true, full: false });
    } else if (summary && summary !== preview) {
      var qText = summary.replace(/^↪\s*/, '');
      var qOid = (pubCj && (pubCj['mfp:quotedObjectId'] || pubCj.quoteUrl || pubCj.inReplyTo))
        || item.object_id || '';
      if (qText && !looksLikeBareUrl(qText)) {
        h += renderQuotedObjectHtml({
          id: qOid,
          type: 'Note',
          content_preview: qText,
        }, 0, { interactive: true, full: false });
      }
    }
  }
  // Same media strip as timeline so Note images/videos appear on 已发布.
  h += renderTimelineMedia(attachments);
  if (titleLine && item.content_type && item.content_type !== 'note' && !isRepost) {
    h += '<div class="feed-item-meta" style="font-size:11px;color:var(--text-secondary,#888)">' + esc(publishedTypeLabel(item.content_type)) + '</div>';
  }
  // Federation object / activity id for external share (intent only).
  var shareObjectId = '';
  if (item.object_id) shareObjectId = String(item.object_id);
  else if (item.activity_id) shareObjectId = String(item.activity_id);
  else if (item.note_id) shareObjectId = String(item.note_id);
  else if (item.url && /^https?:\/\//i.test(String(item.url))) shareObjectId = String(item.url);
  var shareUrl = '';
  if (item.url && /^https?:\/\//i.test(String(item.url))) shareUrl = String(item.url);
  else if (shareObjectId && /^https?:\/\//i.test(shareObjectId)) shareUrl = shareObjectId;
  var shareAuthor = '';
  try {
    if (state.identity) {
      shareAuthor = state.identity.display_name || '';
      if (!shareAuthor && state.identity.username) {
        shareAuthor = '@' + state.identity.username
          + (state.identity.domain ? '@' + state.identity.domain : '');
      }
    }
  } catch (eId) {}
  h += '<div class="feed-item-actions">';
  if (shareObjectId || shareUrl || preview) {
    h += '<button type="button" class="feed-item-action feed-item-action-share" data-action-share="' + esc(shareObjectId || shareUrl || '') + '"'
      + ' data-object-id="' + esc(shareObjectId || '') + '"'
      + ' data-share-url="' + esc(shareUrl || shareObjectId || '') + '"'
      + ' data-share-author="' + esc(shareAuthor || '') + '"'
      + ' title="' + esc(lang.shareBtn || 'Share') + '"'
      + ' aria-label="' + esc(lang.shareBtn || 'Share') + '">'
      + '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>'
      + '</button>';
  }
  h += '<button type="button" class="feed-item-action feed-item-action-danger" data-action-unpublish data-content-type="' + esc(item.content_type) + '" data-content-id="' + esc(item.content_id) + '"'
    + ' title="' + esc(lang.removeBtn || 'Remove') + '"'
    + ' aria-label="' + esc(lang.removeBtn || 'Remove') + '">'
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
  // Counting out the first minute second by second reads as a stopwatch, and a
  // server clock a little ahead of ours would otherwise render "-4s".
  if (sec < 60) return lang.timeNow || 'now';
  var min = Math.floor(sec / 60);
  if (min < 60) return min + 'm';
  var hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'h';
  var day = Math.floor(hr / 24);
  if (day < 30) return day + 'd';
  try { return d.toLocaleDateString(currentLocale, { month: 'short', day: 'numeric' }); } catch (e) { return day + 'd'; }
}


// ==================== Shared scope ====================
// Republish the names this file's siblings read. See page/scope.js.
share.value({
  actorLabelFromUrl: actorLabelFromUrl,
  extractNoteAttachments: extractNoteAttachments,
  publishedTypeLabel: publishedTypeLabel,
  renderActorItem: renderActorItem,
  renderPublishedItem: renderPublishedItem,
  renderTimelineItem: renderTimelineItem,
  renderTimelineMedia: renderTimelineMedia,
  stripHtmlPreview: stripHtmlPreview,
  timeAgo: timeAgo,
  truncateFeedCardText: truncateFeedCardText,
});
