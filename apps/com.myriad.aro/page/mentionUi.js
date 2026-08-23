var share = require('./scope.js');

// ==================== @ Mentions UI ====================
// Extracted from helpers.js. Depends on: helpers (esc, avatar, normalize*, matchesSearch), state, lang.
// Load after helpers.js, before chat/views.

// ==================== @ Mentions ====================
/**
 * Active mention query under the caret: @{query} started at a word boundary.
 * Returns { start, end, query } or null.
 */
function getActiveMentionAtCaret(input) {
  if (!input) return null;
  var val = String(input.value || '');
  var caret = input.selectionStart;
  if (caret == null || caret < 0) caret = val.length;
  if (caret > val.length) caret = val.length;
  var i = caret - 1;
  while (i >= 0) {
    var ch = val.charAt(i);
    if (ch === '@') {
      // Must start a token: start of string or whitespace / common openers
      if (i === 0 || /[\s\n([{（【「『"']/.test(val.charAt(i - 1))) {
        var query = val.slice(i + 1, caret);
        // Multi-line or embedded spaces → not an active mention token
        if (/[\n\r]/.test(query)) return null;
        return { start: i, end: caret, query: query };
      }
      return null;
    }
    // Hit whitespace before finding @ → not inside a mention token
    if (/\s/.test(ch)) return null;
    // Keep walking for handle-like chars only
    if (!/[\w.\-\u00C0-\u024F\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(ch)) return null;
    i--;
  }
  return null;
}

/** Candidates for @ picker: room active members (not self) or DM peer. */
function getMentionCandidates() {
  var list = [];
  if (state.activeKind === 'room') {
    (state.members || []).forEach(function (m) {
      var status = m.membership_status || m.status || 'active';
      if (status !== 'active') return;
      if (state.localActorUrl && sameActorUrl(m.actor_url, state.localActorUrl)) return;
      var name = (m.display_name || m.username || (m.actor_url || '').split('/').pop() || '').trim();
      if (!name) return;
      list.push({
        actor_url: m.actor_url || '',
        name: name,
        username: (m.username || '').trim(),
        avatar_url: m.avatar_url || '',
        role: m.role || 'member',
      });
    });
  } else if (state.activeKind === 'channel') {
    var ch = state.channelDetail;
    if (ch && ch.remote_actor_url) {
      var dn = (ch.remote_actor_name || (ch.remote_actor_url || '').split('/').pop() || '?').trim();
      list.push({
        actor_url: ch.remote_actor_url,
        name: dn || '?',
        username: '',
        avatar_url: ch.remote_actor_avatar || '',
        role: '',
      });
    }
  }
  // Stable sort by display name
  list.sort(function (a, b) {
    return String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' });
  });
  return list;
}

function filterMentionCandidates(candidates, query) {
  var q = normalizeSearchQuery(query || '');
  if (!q) return candidates || [];
  return (candidates || []).filter(function (c) {
    return matchesSearch(q, [c.name, c.username, c.actor_url, c.role]);
  });
}

/**
 * Pull structured mentions from free text against a candidate list.
 * Matches `@DisplayName` / `@username` with a trailing boundary.
 */
function extractMentionsFromText(text, candidates) {
  text = text == null ? '' : String(text);
  if (!text || !candidates || !candidates.length) return [];
  // Longer names first so "Alice Bob" wins over "Alice"
  var sorted = candidates.slice().sort(function (a, b) {
    var an = Math.max((a.name || '').length, (a.username || '').length);
    var bn = Math.max((b.name || '').length, (b.username || '').length);
    return bn - an;
  });
  var found = [];
  var seen = {};
  /** Character ranges already claimed by a longer match (avoid @Alice inside @Alice Bob). */
  var ranges = [];
  function rangeFree(start, end) {
    for (var r = 0; r < ranges.length; r++) {
      if (start < ranges[r].end && end > ranges[r].start) return false;
    }
    return true;
  }
  function pushMention(c, matchedName, start, end) {
    if (!rangeFree(start, end)) return;
    var key = normalizeFederationUrl(c.actor_url) || c.actor_url || matchedName;
    if (!key || seen[key]) {
      // Still claim range so shorter nested names cannot re-match
      ranges.push({ start: start, end: end });
      return;
    }
    seen[key] = true;
    ranges.push({ start: start, end: end });
    found.push({
      actor_url: c.actor_url || '',
      name: matchedName || c.name,
      display_name: c.name || matchedName,
      username: c.username || '',
    });
  }
  sorted.forEach(function (c) {
    var tokens = [];
    if (c.name) tokens.push(c.name);
    if (c.username && c.username !== c.name) tokens.push(c.username);
    tokens.forEach(function (tok) {
      if (!tok) return;
      var needle = '@' + tok;
      var idx = 0;
      while (idx < text.length) {
        var at = text.indexOf(needle, idx);
        if (at < 0) break;
        var afterIdx = at + needle.length;
        var after = afterIdx < text.length ? text.charAt(afterIdx) : '';
        // Boundary: end, whitespace, or common punctuation
        if (!after || /[\s.,!?;:，。！？、)\]}>」』）】"']/.test(after)) {
          // Leading boundary for the @
          var before = at > 0 ? text.charAt(at - 1) : '';
          if (!before || /[\s\n([{（【「『"']/.test(before)) {
            pushMention(c, tok, at, afterIdx);
          }
        }
        idx = at + 1;
      }
    });
  });
  return found;
}

/**
 * Render message body with @mention highlights.
 * Uses payload.mentions when present; falls back to live candidates for display.
 * Safe: only known names are wrapped; everything else is escaped.
 */
function formatMessageTextHtml(text, payload) {
  text = text == null ? '' : String(text);
  if (!text) return '';

  var nameList = [];
  var actorByName = {};
  function addName(name, actor) {
    name = name == null ? '' : String(name).trim();
    if (!name) return;
    if (!actorByName[name]) {
      nameList.push(name);
      actorByName[name] = actor || '';
    }
  }
  if (payload && Array.isArray(payload.mentions)) {
    payload.mentions.forEach(function (m) {
      if (!m) return;
      addName(m.display_name || m.name, m.actor_url);
      if (m.username) addName(m.username, m.actor_url);
      if (m.name && m.name !== m.display_name) addName(m.name, m.actor_url);
    });
  }
  // Fallback: match current conversation candidates so older plain-text @ still highlight
  if (nameList.length === 0 && typeof getMentionCandidates === 'function') {
    getMentionCandidates().forEach(function (c) {
      addName(c.name, c.actor_url);
      if (c.username) addName(c.username, c.actor_url);
    });
    // Also include self so "@me" style self-tags from others can highlight if name matches
    if (state.activeKind === 'room' && state.members) {
      state.members.forEach(function (m) {
        var st = m.membership_status || m.status || 'active';
        if (st !== 'active') return;
        addName(m.display_name || m.username || '', m.actor_url);
        if (m.username) addName(m.username, m.actor_url);
      });
    }
  }
  nameList.sort(function (a, b) { return b.length - a.length; });

  if (nameList.length === 0) return esc(text);

  var html = '';
  var i = 0;
  while (i < text.length) {
    if (text.charAt(i) === '@') {
      var matchedName = null;
      for (var n = 0; n < nameList.length; n++) {
        var tok = nameList[n];
        var full = '@' + tok;
        if (text.substr(i, full.length) === full) {
          var afterIdx = i + full.length;
          var after = afterIdx < text.length ? text.charAt(afterIdx) : '';
          if (!after || /[\s.,!?;:，。！？、)\]}>」』）】"'\n]/.test(after)) {
            matchedName = tok;
            break;
          }
        }
      }
      if (matchedName) {
        var actor = actorByName[matchedName] || '';
        html += '<span class="msg-mention"'
          + (actor ? ' data-actor="' + esc(actor) + '"' : '')
          + ' title="' + esc('@' + matchedName) + '">'
          + '@' + esc(matchedName) + '</span>';
        i += matchedName.length + 1;
        continue;
      }
    }
    // Emit escaped run until next @ (or end)
    var nextAt = text.indexOf('@', i + 1);
    var end = nextAt < 0 ? text.length : nextAt;
    // If current char is not @ (failed match), take at least one char
    if (text.charAt(i) === '@' && end === i) end = i + 1;
    if (end === i) end = i + 1;
    html += esc(text.slice(i, end));
    i = end;
  }
  return html;
}

// --- Mention picker state / UI ---
var _mentionPicker = {
  open: false,
  items: [],
  index: 0,
  active: null, // { start, end, query }
  el: null,
};

function ensureMentionPickerEl() {
  if (_mentionPicker.el && document.body.contains(_mentionPicker.el)) {
    return _mentionPicker.el;
  }
  var wrap = document.querySelector('#chat-container .input-float-wrap');
  if (!wrap) return null;
  var existing = $('mention-picker');
  if (existing) {
    _mentionPicker.el = existing;
    return existing;
  }
  var el = document.createElement('div');
  el.id = 'mention-picker';
  el.className = 'mention-picker';
  el.setAttribute('role', 'listbox');
  el.setAttribute('aria-label', (typeof lang !== 'undefined' && lang.mentionPicker) || 'Mentions');
  el.hidden = true;
  // Insert above the input bar
  var inputBar = $('input-bar');
  if (inputBar && inputBar.parentNode === wrap) {
    wrap.insertBefore(el, inputBar);
  } else {
    wrap.appendChild(el);
  }
  _mentionPicker.el = el;
  return el;
}

function closeMentionPicker() {
  _mentionPicker.open = false;
  _mentionPicker.items = [];
  _mentionPicker.index = 0;
  _mentionPicker.active = null;
  var el = _mentionPicker.el || $('mention-picker');
  if (el) {
    el.hidden = true;
    el.innerHTML = '';
    el.classList.remove('mention-picker-open');
  }
}

function renderMentionPicker() {
  var el = ensureMentionPickerEl();
  if (!el) return;
  var items = _mentionPicker.items || [];
  if (!_mentionPicker.open || items.length === 0) {
    closeMentionPicker();
    return;
  }
  if (_mentionPicker.index < 0) _mentionPicker.index = 0;
  if (_mentionPicker.index >= items.length) _mentionPicker.index = items.length - 1;

  var html = '';
  items.forEach(function (c, idx) {
    var active = idx === _mentionPicker.index;
    var roleBit = c.role && c.role !== 'member'
      ? '<span class="mention-item-role">' + esc(typeof roleLabel === 'function' ? roleLabel(c.role) : c.role) + '</span>'
      : '';
    var sub = c.username && c.username !== c.name
      ? '<span class="mention-item-sub">@' + esc(c.username) + '</span>'
      : (c.actor_url
        ? '<span class="mention-item-sub">' + esc((c.actor_url || '').split('/').pop() || '') + '</span>'
        : '');
    html += '<button type="button" class="mention-item' + (active ? ' mention-item-active' : '') + '"'
      + ' role="option" aria-selected="' + (active ? 'true' : 'false') + '"'
      + ' data-mention-idx="' + idx + '">'
      + '<span class="mention-item-avatar">' + avatarContentHtml(c.avatar_url || '', c.name) + '</span>'
      + '<span class="mention-item-body">'
      + '<span class="mention-item-name">' + esc(c.name) + roleBit + '</span>'
      + sub
      + '</span>'
      + '</button>';
  });
  el.innerHTML = html;
  el.hidden = false;
  el.classList.add('mention-picker-open');
  el.setAttribute('aria-label', (typeof lang !== 'undefined' && lang.mentionPicker) || 'Mentions');

  el.querySelectorAll('.mention-item').forEach(function (btn) {
    btn.addEventListener('mousedown', function (e) {
      // mousedown so we insert before textarea blur
      e.preventDefault();
      e.stopPropagation();
      var idx = parseInt(btn.getAttribute('data-mention-idx'), 10);
      if (!isNaN(idx)) insertMentionCandidate(idx);
    });
  });

  // Keep active row visible
  var activeBtn = el.querySelector('.mention-item-active');
  if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
    try { activeBtn.scrollIntoView({ block: 'nearest' }); } catch (eScr) { /* ignore */ }
  }
}

function openOrUpdateMentionPicker(active) {
  if (!active || !state.activeId) {
    closeMentionPicker();
    return;
  }
  // Locked composer: no mentions
  if (typeof isChannelComposerLocked === 'function' && isChannelComposerLocked()) {
    closeMentionPicker();
    return;
  }
  if (typeof isRoomComposerLocked === 'function' && isRoomComposerLocked()) {
    closeMentionPicker();
    return;
  }
  var all = getMentionCandidates();
  var filtered = filterMentionCandidates(all, active.query);
  if (filtered.length === 0) {
    // Show empty state only when user has started filtering; bare `@` with no members → close
    if (!active.query && all.length === 0) {
      closeMentionPicker();
      return;
    }
    // Keep open with empty message when query matches nothing
    _mentionPicker.open = true;
    _mentionPicker.active = active;
    _mentionPicker.items = [];
    _mentionPicker.index = 0;
    var elEmpty = ensureMentionPickerEl();
    if (elEmpty) {
      elEmpty.innerHTML = '<div class="mention-empty">'
        + esc((typeof lang !== 'undefined' && (lang.mentionEmpty || lang.searchNoResults)) || 'No matches')
        + '</div>';
      elEmpty.hidden = false;
      elEmpty.classList.add('mention-picker-open');
    }
    return;
  }
  // Preserve selection when list shrinks
  var prev = _mentionPicker.items[_mentionPicker.index];
  _mentionPicker.open = true;
  _mentionPicker.active = active;
  _mentionPicker.items = filtered;
  _mentionPicker.index = 0;
  if (prev) {
    for (var i = 0; i < filtered.length; i++) {
      if (sameActorUrl(filtered[i].actor_url, prev.actor_url)
        || filtered[i].name === prev.name) {
        _mentionPicker.index = i;
        break;
      }
    }
  }
  renderMentionPicker();
}

function insertMentionCandidate(idx) {
  var input = $('msg-input');
  if (!input || !_mentionPicker.open) return;
  var items = _mentionPicker.items || [];
  var c = items[idx];
  var active = _mentionPicker.active;
  if (!c || !active) {
    closeMentionPicker();
    return;
  }
  var val = String(input.value || '');
  var insertName = c.name || c.username || '?';
  // Prefer username for @handle feel when display name has spaces and username is simple
  if (c.username && /\s/.test(c.name) && !/\s/.test(c.username)) {
    insertName = c.username;
  }
  var before = val.slice(0, active.start);
  var after = val.slice(active.end);
  // Leading space not needed (token starts at @). Trailing space for continued typing.
  var insert = '@' + insertName + ' ';
  input.value = before + insert + after;
  var caret = before.length + insert.length;
  try {
    input.focus();
    input.setSelectionRange(caret, caret);
  } catch (eFocus) { /* ignore */ }
  closeMentionPicker();
  if (typeof autoResizeInput === 'function') autoResizeInput(input);
  if (typeof updateSendState === 'function') updateSendState();
}

/**
 * Handle input event for @ detection. Call from msg-input 'input'.
 */
function onMentionInput(input) {
  if (!input || input.disabled) {
    closeMentionPicker();
    return;
  }
  var active = getActiveMentionAtCaret(input);
  if (!active) {
    closeMentionPicker();
    return;
  }
  openOrUpdateMentionPicker(active);
}

/**
 * Keyboard while mention picker is open.
 * Returns true if the event was consumed (caller should preventDefault / skip send).
 */
function onMentionKeydown(e) {
  if (!_mentionPicker.open) return false;
  var key = e.key;
  if (key === 'Escape') {
    e.preventDefault();
    closeMentionPicker();
    return true;
  }
  if (key === 'ArrowDown') {
    e.preventDefault();
    if (_mentionPicker.items.length === 0) return true;
    _mentionPicker.index = (_mentionPicker.index + 1) % _mentionPicker.items.length;
    renderMentionPicker();
    return true;
  }
  if (key === 'ArrowUp') {
    e.preventDefault();
    if (_mentionPicker.items.length === 0) return true;
    _mentionPicker.index = (_mentionPicker.index - 1 + _mentionPicker.items.length) % _mentionPicker.items.length;
    renderMentionPicker();
    return true;
  }
  if (key === 'Enter' || key === 'Tab') {
    if (_mentionPicker.items.length === 0) {
      // Empty: let Enter send only if Tab not pressed; Tab closes
      if (key === 'Tab') {
        e.preventDefault();
        closeMentionPicker();
        return true;
      }
      closeMentionPicker();
      return false; // allow send
    }
    e.preventDefault();
    insertMentionCandidate(_mentionPicker.index);
    return true;
  }
  return false;
}


// ==================== Shared scope ====================
// Republish the names this file's siblings read. See page/scope.js.
share.value({
  closeMentionPicker: closeMentionPicker,
  extractMentionsFromText: extractMentionsFromText,
  formatMessageTextHtml: formatMessageTextHtml,
  getMentionCandidates: getMentionCandidates,
  onMentionInput: onMentionInput,
  onMentionKeydown: onMentionKeydown,
});
