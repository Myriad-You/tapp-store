var share = require('./scope.js');

// ==================== Share / library card presentation ====================
// Extracted from helpers.js. Used by msgUi + feed cards.
// Load after helpers.js, before msgUi.js.

function resolveShareCardView(msgType, payload) {
  payload = payload || {};
  var untitled = lang.shareUntitled || 'Untitled';
  var title = '';
  var description = '';
  var image = String(payload.image || payload.cover || '').trim();

  if (msgType === 'report') {
    title = String(payload.summary || payload.title || '').trim();
    description = String(payload.description || '').trim();
    if (!description) {
      if (payload.platform && payload.content_preview && payload.content_preview !== payload.summary) {
        description = payload.platform + ' · ' + payload.content_preview;
      } else {
        description = String(payload.content_preview || payload.platform || '').trim();
        if (description === title) description = String(payload.platform || '').trim();
      }
    } else if (payload.summary && description === title) {
      description = String(payload.platform || '').trim();
    }
  } else if (msgType === 'library') {
    title = String(payload.title || payload.summary || payload.name || '').trim();
    description = String(payload.description || '').trim();
    if (!description) {
      var libParts = [];
      if (payload.platform_id) libParts.push(String(payload.platform_id));
      var itemKind = payload.item_type || (payload.content_type && payload.content_type !== 'library' ? payload.content_type : '');
      if (itemKind) libParts.push(String(itemKind));
      description = libParts.join(' · ');
    }
    if (!image) image = String(payload.thumbnail || '').trim();
  } else if (msgType === 'tapp') {
    title = String(payload.title || payload.tapp_name || payload.name || '').trim();
    description = String(payload.description || payload.tapp_id || '').trim();
    if (description === title) description = String(payload.tapp_id || '').trim();
  } else if (msgType === 'brew') {
    title = String(payload.title || payload.name || '').trim();
    description = String(payload.description || '').trim();
  } else {
    title = String(payload.title || payload.summary || payload.name || '').trim();
    description = String(payload.description || '').trim();
  }

  if (!title) {
    // Last-resort fallbacks — never blank
    if (msgType === 'tapp' && payload.tapp_id) title = String(payload.tapp_id);
    else if (msgType === 'library' && payload.item_id) title = String(payload.item_id);
    else if (msgType === 'report' && payload.report_id) title = String(payload.report_id);
    else if (msgType === 'brew' && payload.brew_id) title = 'Brew #' + payload.brew_id;
    else title = shareTypeLabel(msgType) || untitled;
  }
  if (description === title) description = '';
  return { title: title, description: description, image: image };
}

/* ---------------------------------------------------------------------------
 * Media (library) share cards — image-forward layout with sender attribution.
 * A game/anime/music share carries its own cover art, so it renders as a poster
 * card rather than the compact icon+title row. Playtime / watch progress / the
 * sender's rating travel as flat snapshot fields so recipients render without a
 * re-fetch (mirrors frontend LibraryGrid + libraryWatchProgress conventions).
 * ------------------------------------------------------------------------- */

/** Parse a non-negative integer, tolerating strings; null when not usable. */
function mediaInt(value) {
  if (value == null || value === '') return null;
  var n = typeof value === 'number' ? value : Number(value);
  if (!isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/** Parse "5/12", "5/?", "5" style progress → {cur,total|null} | null. */
function parseProgressStr(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') {
    var only = mediaInt(raw);
    return only == null ? null : { cur: only, total: null };
  }
  if (typeof raw !== 'string') return null;
  var s = raw.trim();
  if (!s) return null;
  var m = s.match(/^(\d+)\s*\/\s*(\d+|\?)$/);
  if (m) {
    var total = m[2] === '?' ? null : Number(m[2]);
    return { cur: Number(m[1]), total: (total && total > 0) ? total : null };
  }
  var n = s.match(/^(\d+)$/);
  if (n) return { cur: Number(n[1]), total: null };
  return null;
}

/** anime / video / tv_series are episode-tracked; book is chapter-tracked. */
function isAnimeLikeType(itemType) {
  return itemType === 'anime' || itemType === 'tv_series' || itemType === 'video';
}

/** Episode/chapter total from Bangumi/MAL-shaped metadata. */
function mediaEpisodeTotal(meta) {
  if (!meta || typeof meta !== 'object') return null;
  var subject = (meta.subject && typeof meta.subject === 'object') ? meta.subject : {};
  var node = (meta.node && typeof meta.node === 'object') ? meta.node : {};
  return mediaInt(subject.eps) != null ? mediaInt(subject.eps)
    : (mediaInt(node.num_episodes) != null ? mediaInt(node.num_episodes)
      : mediaInt(meta.num_episodes));
}

/**
 * Extract structured sender stats from a live library item at share time.
 * @returns {{playtimeMin:(number|null), rating:(number|null),
 *            progressCur:(number|null), progressTotal:(number|null)}}
 */
function extractLibraryStats(itemType, meta) {
  var out = { playtimeMin: null, rating: null, progressCur: null, progressTotal: null };
  if (!meta || typeof meta !== 'object') meta = {};
  var ls = (meta.list_status && typeof meta.list_status === 'object') ? meta.list_status : {};

  // Playtime (games): Steam stores minutes in playtime_forever.
  var pt = mediaInt(meta.playtime_forever);
  if (pt == null) pt = mediaInt(meta.playtime);
  if (pt != null && pt > 0) out.playtimeMin = pt;

  // Rating: Bangumi `rate` / MAL `list_status.score` (0 == unrated).
  var rate = meta.rate != null ? Number(meta.rate) : Number(ls.score);
  if (isFinite(rate) && rate > 0) out.rating = Math.round(rate * 10) / 10;

  // Watch/read progress (anime-like → episodes, book → chapters).
  var parts = parseProgressStr(meta.progress);
  if (isAnimeLikeType(itemType)) {
    if (!parts) {
      var watched = mediaInt(meta.ep_status);
      if (watched == null) watched = mediaInt(ls.num_episodes_watched);
      if (watched == null) watched = mediaInt(meta.num_episodes_watched);
      if (watched != null) parts = { cur: watched, total: mediaEpisodeTotal(meta) };
    } else if (parts.total == null) {
      var total = mediaEpisodeTotal(meta);
      if (total != null) parts.total = total;
    }
  } else if (itemType === 'book') {
    var ch = mediaInt(meta.ep_status);
    if (ch == null) ch = mediaInt(ls.num_chapters_read);
    if (ch == null) ch = mediaInt(meta.num_chapters_read);
    if (ch != null) parts = { cur: ch, total: null };
    else if (parts && parts.total == null) parts = { cur: parts.cur, total: null };
  } else {
    parts = null; // games/music carry no episode progress
  }
  // Suppress a meaningless 0 with no total (wishlist / untouched).
  if (parts && !(parts.cur === 0 && parts.total == null)) {
    out.progressCur = parts.cur;
    out.progressTotal = parts.total;
  }
  return out;
}

/**
 * Artist + album for a music item, from Netease-shaped (`ar`/`al`) or flat
 * (`artist`/`album`) metadata. Empty strings when unknown.
 */
function extractMusicMeta(meta) {
  var out = { artist: '', album: '' };
  if (!meta || typeof meta !== 'object') return out;
  var ar = meta.ar || meta.artists || meta.artist;
  if (Array.isArray(ar)) {
    out.artist = ar.map(function (a) { return (a && (a.name || (typeof a === 'string' ? a : ''))) || ''; })
      .filter(Boolean).join(', ');
  } else if (typeof ar === 'string') {
    out.artist = ar.trim();
  }
  if (meta.al && typeof meta.al === 'object') out.album = String(meta.al.name || '').trim();
  else if (typeof meta.album === 'string') out.album = meta.album.trim();
  return out;
}

/** Localized playtime label: hours once past an hour, minutes below. */
function formatPlaytime(min) {
  var n = Number(min);
  if (!isFinite(n) || n <= 0) return '';
  if (n < 60) return (lang.mediaMinutes || '{v}m').replace('{v}', String(Math.round(n)));
  return (lang.mediaHours || '{v}h').replace('{v}', String(Math.round(n / 60)));
}

/** Localized watch/read progress label from stored cur/total. */
function formatWatchProgress(cur, total, itemType) {
  var c = mediaInt(cur);
  if (c == null) return '';
  var t = mediaInt(total);
  var isBook = itemType === 'book';
  if (t != null && t > 0) {
    return (isBook ? (lang.mediaCh || '{c}/{t}') : (lang.mediaEp || '{c}/{t}'))
      .replace('{c}', String(c)).replace('{t}', String(t));
  }
  return (isBook ? (lang.mediaChOnly || '{c}') : (lang.mediaEpOnly || '{c}'))
    .replace('{c}', String(c));
}

/**
 * Render model for a library media card, read from a message payload's flat
 * snapshot fields. `stat` is the sender-attributed line (playtime OR progress).
 */
function libraryMediaView(payload) {
  payload = payload || {};
  var base = resolveShareCardView('library', payload);
  var itemType = String(payload.item_type || payload.content_type || '').trim();
  if (itemType === 'library') itemType = '';
  var ratingText = '';
  var rating = Number(payload.rating);
  if (isFinite(rating) && rating > 0) ratingText = String(Math.round(rating * 10) / 10);

  var stat = null;
  var ptText = formatPlaytime(payload.playtime_min);
  if (ptText) {
    stat = { icon: SVG_ICONS.gamepad, text: ptText };
  } else {
    var progText = formatWatchProgress(payload.progress_cur, payload.progress_total, itemType);
    if (progText) stat = { icon: SVG_ICONS.playCircle, text: progText };
  }
  return {
    image: base.image,
    title: base.title,
    description: base.description,
    itemType: itemType,
    platform: String(payload.platform_id || '').trim(),
    ratingText: ratingText,
    artist: String(payload.artist || '').trim(),
    album: String(payload.album || '').trim(),
    stat: stat,
  };
}

/** Best-guess cover orientation before the image loads (games ship banners). */
function mediaCoverOrient(itemType) {
  return itemType === 'game' ? 'landscape' : 'portrait';
}

/** Localized content-kind label ("Game" / "番剧" / …); '' when unknown. */
function mediaKindLabel(itemType) {
  var t = String(itemType || '').trim();
  if (!t) return '';
  var k = lang['mediaKind_' + t];
  if (k) return k;
  var fallback = {
    game: 'Game', anime: 'Anime', music: 'Music',
    tv_series: 'TV', book: 'Book', video: 'Video',
  };
  return fallback[t] || (t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' '));
}

/**
 * 应用内确认对话框（沙箱 iframe 中原生 confirm() 会被浏览器拦截并静默返回 false）。
 * 返回 Promise<boolean>。
 */

// ==================== Shared scope ====================
// Republish the names this file's siblings read. See page/scope.js.
share.value({
  extractLibraryStats: extractLibraryStats,
  extractMusicMeta: extractMusicMeta,
  libraryMediaView: libraryMediaView,
  mediaCoverOrient: mediaCoverOrient,
  mediaKindLabel: mediaKindLabel,
  resolveShareCardView: resolveShareCardView,
});
