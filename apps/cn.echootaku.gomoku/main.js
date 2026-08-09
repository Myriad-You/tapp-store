(function (root, factory) {
  var core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  if (root) root.GomokuCore = core;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var SIZE = 15;
  var MAX_MOVES = SIZE * SIZE;
  var COLORS = ['black', 'white'];

  function opposite(color) { return color === 'black' ? 'white' : 'black'; }
  function inBounds(row, col) { return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < SIZE && col >= 0 && col < SIZE; }
  function boardFromMoves(moves) {
    if (!Array.isArray(moves)) return null;
    var board = Array.from({ length: SIZE }, function () { return Array(SIZE).fill(null); });
    for (var i = 0; i < moves.length; i += 1) {
      var move = moves[i];
      if (!move || !inBounds(move.row, move.col) || COLORS.indexOf(move.color) < 0 || board[move.row][move.col]) return null;
      board[move.row][move.col] = move.color;
    }
    return board;
  }
  function winningLine(board, row, col, color) {
    var directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (var d = 0; d < directions.length; d += 1) {
      var line = [{ row: row, col: col }];
      var dr = directions[d][0], dc = directions[d][1];
      var step;
      for (step = 1; step < 5; step += 1) {
        var r1 = row + dr * step, c1 = col + dc * step;
        if (!inBounds(r1, c1) || board[r1][c1] !== color) break;
        line.push({ row: r1, col: c1 });
      }
      for (step = 1; step < 5; step += 1) {
        var r2 = row - dr * step, c2 = col - dc * step;
        if (!inBounds(r2, c2) || board[r2][c2] !== color) break;
        line.unshift({ row: r2, col: c2 });
      }
      if (line.length >= 5) return line;
    }
    return [];
  }
  function newGame(round) {
    return { round: round || 1, phase: 'playing', turn: 'black', moves: [], winner: null, finishReason: null, lastMove: null, winLine: [] };
  }
  function applyMove(game, row, col, actor) {
    if (!game || game.phase !== 'playing') return { ok: false, reason: 'finished' };
    if (!inBounds(row, col)) return { ok: false, reason: 'bounds' };
    var board = boardFromMoves(game.moves);
    if (!board || board[row][col]) return { ok: false, reason: 'occupied' };
    var color = game.turn;
    var move = { row: row, col: col, color: color, actor: actor || null };
    var next = JSON.parse(JSON.stringify(game));
    next.moves.push(move); next.lastMove = move;
    board[row][col] = color;
    var line = winningLine(board, row, col, color);
    if (line.length >= 5) {
      next.phase = 'finished'; next.winner = color; next.finishReason = 'line'; next.winLine = line;
    } else if (next.moves.length === MAX_MOVES) {
      next.phase = 'finished'; next.winner = null; next.finishReason = 'draw'; next.winLine = [];
    } else next.turn = opposite(color);
    return { ok: true, game: next };
  }
  function validActor(value) { return value === null || (typeof value === 'string' && value.length > 0 && value.length <= 320); }
  function validateState(input) {
    if (!input || input.protocol !== 1 || input.kind !== 'state' || !Number.isInteger(input.seq) || input.seq < 1) return null;
    if (!validActor(input.hostActor) || !input.hostActor || !input.players || !validActor(input.players.black) || !validActor(input.players.white)) return null;
    if (input.players.black && input.players.white && input.players.black === input.players.white) return null;
    if (input.hostActor !== input.players.black && input.hostActor !== input.players.white) return null;
    if (!Number.isInteger(input.round) || input.round < 1 || input.round > 100000) return null;
    if (['lobby', 'playing', 'finished'].indexOf(input.phase) < 0 || COLORS.indexOf(input.turn) < 0) return null;
    if (!Array.isArray(input.moves) || input.moves.length > MAX_MOVES || !input.ready || typeof input.ready !== 'object' || Array.isArray(input.ready)) return null;
    if (input.phase !== 'lobby' && (!input.players.black || !input.players.white)) return null;
    if (input.phase === 'lobby' && (input.moves.length || input.turn !== 'black' || input.winner !== null || input.finishReason !== null || input.lastMove !== null)) return null;
    var readyActors = Object.keys(input.ready);
    for (var readyIndex = 0; readyIndex < readyActors.length; readyIndex += 1) {
      var readyActor = readyActors[readyIndex];
      if ((readyActor !== input.players.black && readyActor !== input.players.white) || typeof input.ready[readyActor] !== 'boolean') return null;
    }
    var seen = Object.create(null), board = Array.from({ length: SIZE }, function () { return Array(SIZE).fill(null); });
    for (var i = 0; i < input.moves.length; i += 1) {
      var m = input.moves[i];
      if (!m || !inBounds(m.row, m.col) || m.color !== COLORS[i % 2] || !validActor(m.actor)) return null;
      var key = m.row + ':' + m.col;
      if (seen[key]) return null;
      seen[key] = true; board[m.row][m.col] = m.color;
      var expectedActor = input.players[m.color];
      if (!expectedActor || m.actor !== expectedActor) return null;
      if (winningLine(board, m.row, m.col, m.color).length >= 5 && (i !== input.moves.length - 1 || input.phase !== 'finished' || input.finishReason !== 'line')) return null;
    }
    if (input.lastMove) {
      var last = input.moves[input.moves.length - 1];
      if (!last || last.row !== input.lastMove.row || last.col !== input.lastMove.col || last.color !== input.lastMove.color || last.actor !== input.lastMove.actor) return null;
    } else if (input.moves.length) return null;
    var winner = input.winner;
    if (winner !== null && COLORS.indexOf(winner) < 0) return null;
    if (input.phase === 'playing' && (winner !== null || input.finishReason !== null || input.turn !== COLORS[input.moves.length % 2])) return null;
    if (input.phase === 'finished') {
      if (['line', 'resign', 'draw'].indexOf(input.finishReason) < 0) return null;
      if (input.finishReason === 'line') {
        if (!input.lastMove || winner !== input.lastMove.color || input.turn !== input.lastMove.color || winningLine(board, input.lastMove.row, input.lastMove.col, winner).length < 5) return null;
      }
      if (input.finishReason === 'draw' && (winner !== null || input.moves.length !== MAX_MOVES || !input.lastMove || input.turn !== input.lastMove.color)) return null;
      if (input.finishReason === 'resign' && (COLORS.indexOf(winner) < 0 || winner !== opposite(input.turn))) return null;
    }
    var clean = JSON.parse(JSON.stringify(input));
    clean.winLine = input.phase === 'finished' && input.finishReason === 'line' ? winningLine(board, input.lastMove.row, input.lastMove.col, winner) : [];
    return clean;
  }
  function senderFrom(value) {
    if (!value || typeof value !== 'object') return '';
    return value.sender_actor || value.senderActor || '';
  }
  function nicknameFromActor(actor) {
    var value = typeof actor === 'string' ? actor.trim() : '';
    if (!value) return '';
    if (value.charAt(0) === '@' && value.indexOf('@', 1) > 1) return value.slice(1, value.indexOf('@', 1));
    var clean = value.replace(/\/+$/, '');
    var slash = clean.lastIndexOf('/');
    var label = slash >= 0 ? clean.slice(slash + 1) : clean;
    try { return decodeURIComponent(label); } catch (_) { return label; }
  }
  function decodeFederationEnvelope(raw, expectedType) {
    if (!raw || typeof raw !== 'object') return null;
    var outer = raw;
    var data = raw.data && typeof raw.data === 'object' ? raw.data : raw;
    var message = data.message && typeof data.message === 'object' ? data.message : data;
    var content = message.content && typeof message.content === 'object' ? message.content : message;
    var messageType = content.message_type || message.message_type || data.message_type || outer.message_type;
    var payload = content.payload !== undefined ? content.payload : (message.payload !== undefined ? message.payload : (data.payload !== undefined ? data.payload : null));
    if (messageType !== expectedType || !payload || typeof payload !== 'object') return null;
    return { payload: payload, sender: senderFrom(message) || senderFrom(data) || senderFrom(outer), room: outer.roomId || outer.room_id || data.roomId || data.room_id || '' };
  }
  return { SIZE: SIZE, MAX_MOVES: MAX_MOVES, opposite: opposite, inBounds: inBounds, boardFromMoves: boardFromMoves, winningLine: winningLine, newGame: newGame, applyMove: applyMove, validateState: validateState, decodeFederationEnvelope: decodeFederationEnvelope, nicknameFromActor: nicknameFromActor };
});

(function () {
  'use strict';
  if (typeof Tapp === 'undefined' || typeof document === 'undefined') return;
  var C = globalThis.GomokuCore;
  var MSG_TYPE = 'gomoku.v1';
  var STATS_KEY = 'gomoku.stats.v1';
  var SESSION_KEY = 'gomoku.session.v1';
  var els = {};
  var cells = [];
  var offMessage = null, offTheme = null, offLocale = null;
  var roomTask = Promise.resolve();
  var mode = 'local', myActor = '', myDisplayName = '', roomId = '', shareRoomId = '', hostActor = '', isHost = false;
  var identityState = 'loading';
  var state = null, localGame = C.newGame(1), stats = { black: 0, white: 0, draws: 0 };
  var savedSession = null, seenNonces = Object.create(null), memberNames = Object.create(null), busy = false, destroyed = false;

  function $(id) { return document.getElementById(id); }
  function t(key, vars) {
    try { return Tapp.i18n && Tapp.i18n.t ? Tapp.i18n.t(key, vars || {}) : key; } catch (_) { return key; }
  }
  function actorLabel(actor) {
    if (!actor) return t('room.waiting');
    var label = (actor === myActor && myDisplayName) || memberNames[actor] || C.nicknameFromActor(actor) || actor;
    return label.length > 34 ? label.slice(0, 31) + '…' : label;
  }
  function errorText(error) { return String(error && error.message ? error.message : error || 'Unknown error').slice(0, 180); }
  function notice(key, vars, isError) {
    els.notice.textContent = t(key, vars); els.notice.classList.toggle('error', !!isError);
  }
  function renderIdentity() {
    var node = $('identity-text');
    if (!node) return;
    node.textContent = myActor ? actorLabel(myActor) : t('identity.' + identityState);
    node.title = myActor || '';
  }
  function setBusy(value) {
    busy = value;
    ['create-room', 'join-room', 'resume-room', 'invite-player', 'ready', 'swap-colors', 'resign', 'rematch', 'dissolve-room', 'leave-room'].forEach(function (id) { if ($(id)) $(id).disabled = value; });
  }
  async function runBusy(action) {
    if (busy) return;
    setBusy(true);
    try { await action(); } catch (error) { notice('status.error', { message: errorText(error) }, true); }
    finally { setBusy(false); render(); }
  }
  function makeNonce() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }
  function rememberNonce(nonce) {
    if (!nonce || seenNonces[nonce]) return false;
    seenNonces[nonce] = Date.now();
    var keys = Object.keys(seenNonces);
    if (keys.length > 512) keys.sort(function (a, b) { return seenNonces[a] - seenNonces[b]; }).slice(0, 128).forEach(function (key) { delete seenNonces[key]; });
    return true;
  }
  function queueRoomTask(task) {
    var next = roomTask.then(task, task);
    roomTask = next.catch(function () {});
    return next;
  }
  function blankLobby(host) {
    return { protocol: 1, kind: 'state', seq: 0, round: 1, hostActor: host, players: { black: host, white: null }, ready: {}, phase: 'lobby', turn: 'black', moves: [], winner: null, finishReason: null, lastMove: null, winLine: [] };
  }
  function activeGame() { return mode === 'local' ? localGame : state; }
  function myColor() {
    if (!state) return null;
    if (state.players.black === myActor) return 'black';
    if (state.players.white === myActor) return 'white';
    return null;
  }
  function setMode(next) {
    mode = next;
    els.localTab.classList.toggle('active', next === 'local'); els.onlineTab.classList.toggle('active', next === 'online');
    els.localTab.setAttribute('aria-current', next === 'local' ? 'page' : 'false'); els.onlineTab.setAttribute('aria-current', next === 'online' ? 'page' : 'false');
    els.localPanel.classList.toggle('hidden', next !== 'local'); els.onlinePanel.classList.toggle('hidden', next !== 'online');
    render();
  }
  function applyStaticI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (node) { node.textContent = t(node.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (node) { node.setAttribute('aria-label', t(node.getAttribute('data-i18n-aria'))); });
    els.board.setAttribute('aria-label', t('board.label'));
    renderIdentity();
  }
  function renderBoard() {
    var game = activeGame();
    var locked = mode === 'online' && !!roomId && !!game && game.phase === 'lobby';
    var previewEnabled = !!game && game.phase === 'playing' && (mode === 'local' || (!!myColor() && game.turn === myColor() && !busy));
    els.board.classList.toggle('turn-black', !!game && game.turn === 'black');
    els.board.classList.toggle('turn-white', !!game && game.turn === 'white');
    els.board.classList.toggle('preview-enabled', previewEnabled);
    els.board.classList.toggle('locked', locked);
    els.board.setAttribute('aria-disabled', locked ? 'true' : 'false');
    els.board.inert = locked;
    var board = C.boardFromMoves(game && game.moves ? game.moves : []) || C.boardFromMoves([]);
    var last = game && game.lastMove;
    var winning = Object.create(null);
    (game && game.winLine || []).forEach(function (p) { winning[p.row + ':' + p.col] = true; });
    for (var r = 0; r < C.SIZE; r += 1) for (var c = 0; c < C.SIZE; c += 1) {
      var cell = cells[r * C.SIZE + c], color = board[r][c];
      cell.className = 'cell' + (color ? ' ' + color : '') + (last && last.row === r && last.col === c ? ' last' : '') + (winning[r + ':' + c] ? ' win' : '');
      cell.setAttribute('aria-label', t('board.cell', { row: r + 1, col: c + 1, state: color ? t('color.' + color) : t('board.empty') }));
      cell.setAttribute('aria-disabled', canPlace(r, c) ? 'false' : 'true');
    }
  }
  function statusKey(game) {
    if (!game) return 'status.lobby';
    if (game.phase === 'lobby') return game.players && !game.players.white ? 'status.waitingPlayer' : 'status.lobby';
    if (game.phase === 'finished') {
      if (!game.winner) return 'status.draw';
      if (mode === 'online' && myColor()) return game.winner === myColor() ? 'status.youWin' : 'status.youLose';
      return game.winner === 'black' ? 'status.blackWin' : 'status.whiteWin';
    }
    if (mode === 'online' && myColor()) return game.turn === myColor() ? 'status.yourTurn' : 'status.opponentTurn';
    return game.turn === 'black' ? 'status.blackTurn' : 'status.whiteTurn';
  }
  function renderRoom() {
    var inRoom = mode === 'online' && !!roomId;
    els.onlineLobby.classList.toggle('hidden', inRoom); els.roomPanel.classList.toggle('hidden', !inRoom);
    els.resumeRoom.classList.toggle('hidden', !canResumeRoom() || inRoom);
    if (!inRoom || !state) return;
    els.activeRoom.textContent = shareRoomId || roomId;
    els.blackPlayer.textContent = actorLabel(state.players.black); els.blackPlayer.title = state.players.black || '';
    els.whitePlayer.textContent = actorLabel(state.players.white); els.whitePlayer.title = state.players.white || '';
    var blackIsReady = !!state.players.black && !!state.ready[state.players.black];
    var whiteIsReady = !!state.players.white && !!state.ready[state.players.white];
    els.blackReady.textContent = t(!state.players.black ? 'room.waiting' : blackIsReady ? 'room.readyBadge' : 'room.notReady');
    els.whiteReady.textContent = t(!state.players.white ? 'room.waiting' : whiteIsReady ? 'room.readyBadge' : 'room.notReady');
    els.blackReady.classList.toggle('ready', blackIsReady);
    els.whiteReady.classList.toggle('ready', whiteIsReady);
    els.blackReady.classList.toggle('hidden', state.phase === 'playing');
    els.whiteReady.classList.toggle('hidden', state.phase === 'playing');
    var mine = myColor(), mineReady = mine && state.ready[myActor];
    els.ready.textContent = t(mineReady ? 'room.cancelReady' : 'room.ready');
    els.ready.classList.toggle('hidden', state.phase === 'playing' || !mine);
    els.swapColors.classList.toggle('hidden', state.phase !== 'lobby' || !mine || !state.players.black || !state.players.white);
    els.resign.classList.toggle('hidden', state.phase !== 'playing' || !mine);
    els.rematch.classList.toggle('hidden', state.phase !== 'finished' || !mine);
    $('dissolve-room').classList.toggle('hidden', !isHost);
    $('leave-room').classList.toggle('hidden', isHost);
    els.invitePlayer.disabled = busy || !isHost || !!state.players.white;
  }
  function renderGameGuards() {
    var game = activeGame();
    var locked = mode === 'online' && !!roomId && !!game && game.phase === 'lobby';
    var waitingTurn = mode === 'online' && !!game && game.phase === 'playing' && !!myColor() && game.turn !== myColor();
    els.lobbyLock.classList.toggle('hidden', !locked);
    els.turnAlert.classList.toggle('visible', waitingTurn);
    if (locked) {
      var blackReady = !!game.players.black && !!game.ready[game.players.black];
      var whiteReady = !!game.players.white && !!game.ready[game.players.white];
      els.lockBlackStatus.textContent = t(!game.players.black ? 'room.waiting' : blackReady ? 'room.readyBadge' : 'room.notReady');
      els.lockWhiteStatus.textContent = t(!game.players.white ? 'room.waiting' : whiteReady ? 'room.readyBadge' : 'room.notReady');
      els.lockBlackStatus.classList.toggle('ready', blackReady);
      els.lockWhiteStatus.classList.toggle('ready', whiteReady);
    }
  }
  function render() {
    if (!els.board) return;
    var game = activeGame();
    els.modeLabel.textContent = mode === 'local' ? t('mode.local') : t('mode.online') + (game ? ' · ' + t('status.round', { round: game.round }) : '');
    els.gameStatus.textContent = t(statusKey(game));
    var turn = game && game.turn || 'black';
    els.turnLabel.textContent = t('color.' + turn); els.turnChip.querySelector('.mini-stone').className = 'mini-stone ' + turn;
    els.turnChip.classList.toggle('hidden', !game || game.phase === 'finished');
    els.roundLabel.textContent = t('status.round', { round: game && game.round || 1 });
    els.blackWins.textContent = stats.black; els.whiteWins.textContent = stats.white; els.draws.textContent = stats.draws;
    renderBoard(); renderRoom(); renderGameGuards();
  }
  function placementResult(row, col) {
    var game = activeGame();
    if (!game || game.phase !== 'playing' || !C.inBounds(row, col)) return 'blocked';
    var board = C.boardFromMoves(game.moves);
    if (!board) return 'blocked';
    if (board[row][col]) return 'occupied';
    if (mode === 'local') return 'allowed';
    return !!myColor() && game.turn === myColor() && !busy ? 'allowed' : 'blocked';
  }
  function canPlace(row, col) { return placementResult(row, col) === 'allowed'; }
  async function saveStats() { try { await Tapp.storage.set(STATS_KEY, stats); } catch (_) {} }
  async function saveSession() {
    if (!roomId || !state) return;
    savedSession = { roomId: roomId, shareRoomId: shareRoomId || roomId, hostActor: hostActor, isHost: isHost, state: state, savedAt: Date.now() };
    try { await Tapp.storage.set(SESSION_KEY, savedSession); } catch (_) {}
  }
  async function clearSession() { savedSession = null; try { await Tapp.storage.set(SESSION_KEY, null); } catch (_) {} }
  async function recordResult(game) {
    if (!game) return;
    if (game.winner === 'black') stats.black += 1; else if (game.winner === 'white') stats.white += 1; else stats.draws += 1;
    await saveStats();
  }
  function place(row, col) {
    var placement = placementResult(row, col);
    if (placement !== 'allowed') { notice(placement === 'occupied' ? 'status.occupied' : 'status.notYourTurn', null, true); return; }
    if (mode === 'local') {
      var applied = C.applyMove(localGame, row, col, null);
      if (applied.ok) { localGame = applied.game; if (localGame.phase === 'finished') recordResult(localGame); render(); }
      return;
    }
    submitIntent({ action: 'move', row: row, col: col }).catch(function (error) { notice('status.error', { message: errorText(error) }, true); });
  }
  function newLocal() { localGame = C.newGame((localGame.round || 0) + 1); notice('status.localReset'); render(); }

  function sameActiveRoom(candidate) {
    if (!candidate) return true;
    candidate = String(candidate);
    if (candidate === roomId || candidate === shareRoomId) return true;
    if (candidate.indexOf('@') >= 0) return false;
    return [roomId, shareRoomId].some(function (active) { return active && String(active).split('@')[0] === candidate; });
  }
  function decodeEnvelope(raw) {
    return C.decodeFederationEnvelope(raw, MSG_TYPE);
  }
  function messageList(response) {
    if (Array.isArray(response)) return response;
    if (!response || typeof response !== 'object') return [];
    if (Array.isArray(response.messages)) return response.messages;
    if (Array.isArray(response.items)) return response.items;
    if (response.data) return messageList(response.data);
    return [];
  }
  function memberList(response) {
    if (Array.isArray(response)) return response;
    if (!response || typeof response !== 'object') return [];
    if (Array.isArray(response.members)) return response.members;
    if (response.data) return memberList(response.data);
    return [];
  }
  function memberDisplayName(member) {
    if (!member || typeof member !== 'object') return '';
    var value = member.display_name || member.displayName || member.name || member.username || member.preferred_username || '';
    return typeof value === 'string' ? value.trim().slice(0, 80) : '';
  }
  function roomOwner(detail) {
    if (!detail || typeof detail !== 'object') return '';
    var owner = detail.owner_actor || detail.ownerActor || detail.owner || '';
    if (owner && typeof owner === 'object') owner = owner.actor_url || owner.actor || owner.id || '';
    return typeof owner === 'string' ? owner.trim() : '';
  }
  async function fetchRoomOwner(id) {
    if (!Tapp.federation || typeof Tapp.federation.getRoom !== 'function') throw new Error('Federation room detail API unavailable');
    var owner = roomOwner(await Tapp.federation.getRoom(id));
    if (!owner) throw new Error('Room owner unavailable');
    return owner;
  }
  async function refreshMemberNames() {
    if (!roomId || !Tapp.federation || typeof Tapp.federation.getRoomMembers !== 'function') return;
    var targetRoom = roomId;
    var response = await Tapp.federation.getRoomMembers(targetRoom);
    if (targetRoom !== roomId) return;
    memberList(response).forEach(function (member) {
      var actor = member && (member.actor_url || member.actor || member.actor_id || member.id || '');
      if (actor) memberNames[actor] = memberDisplayName(member) || C.nicknameFromActor(actor);
    });
    renderIdentity(); render();
  }
  async function sendPayload(payload) {
    if (destroyed) return;
    if (!roomId || !Tapp.federation || typeof Tapp.federation.sendRoomMessage !== 'function') throw new Error('Federation message API unavailable');
    return Tapp.federation.sendRoomMessage(roomId, { message_type: MSG_TYPE, payload: payload });
  }
  async function emitState() {
    if (destroyed || !isHost || !state) return;
    state.seq += 1; state.protocol = 1; state.kind = 'state'; state.hostActor = hostActor;
    render(); await saveSession(); await sendPayload(state);
  }
  async function submitIntent(intent) {
    if (!roomId || !myActor) return;
    var payload = { protocol: 1, kind: 'intent', nonce: makeNonce(), action: intent.action };
    Object.keys(intent).forEach(function (key) { if (key !== 'action') payload[key] = intent[key]; });
    if (state) { if (payload.seq === undefined) payload.seq = state.seq; if (payload.round === undefined) payload.round = state.round; }
    if (isHost) await queueRoomTask(function () { return handleIntent(payload, myActor); }); else await sendPayload(payload);
  }
  async function handleIntent(intent, sender) {
    if (destroyed || !isHost || !state || !sender || !intent || intent.protocol !== 1 || intent.kind !== 'intent' || !rememberNonce(intent.nonce)) return;
    if (intent.action === 'hello' || intent.action === 'sync') {
      if (!state.players.white && sender !== state.players.black) { state.players.white = sender; state.ready[sender] = false; }
      await emitState(); refreshMemberNames().catch(function () {}); return;
    }
    var color = state.players.black === sender ? 'black' : state.players.white === sender ? 'white' : null;
    if (!color) return;
    if (intent.action === 'ready') {
      if (state.phase === 'playing' || intent.round !== state.round || typeof intent.ready !== 'boolean') return;
      state.ready[sender] = intent.ready;
      if (state.players.black && state.players.white && state.ready[state.players.black] && state.ready[state.players.white]) {
        if (state.phase === 'finished') {
          var previousBlack = state.players.black; state.players.black = state.players.white; state.players.white = previousBlack; state.round += 1;
        }
        state.phase = 'playing'; state.turn = 'black'; state.moves = []; state.winner = null; state.finishReason = null; state.lastMove = null; state.winLine = [];
        state.ready[state.players.black] = false; state.ready[state.players.white] = false;
      }
      await emitState(); return;
    }
    if (intent.action === 'swap' && state.phase === 'lobby' && state.players.black && state.players.white && intent.seq === state.seq) {
      var previousBlack = state.players.black;
      state.players.black = state.players.white; state.players.white = previousBlack;
      state.ready[state.players.black] = false; state.ready[state.players.white] = false;
      await emitState(); return;
    }
    if (intent.action === 'move') {
      if (state.phase !== 'playing' || state.turn !== color || intent.seq !== state.seq || intent.round !== state.round) return;
      var applied = C.applyMove(state, intent.row, intent.col, sender);
      if (!applied.ok) return;
      var preserved = { protocol: 1, kind: 'state', seq: state.seq, round: state.round, hostActor: hostActor, players: state.players, ready: state.ready };
      state = Object.assign(preserved, applied.game);
      await emitState(); return;
    }
    if (intent.action === 'resign' && state.phase === 'playing' && intent.seq === state.seq && intent.round === state.round) {
      state.phase = 'finished'; state.winner = C.opposite(color); state.finishReason = 'resign'; state.winLine = [];
      await emitState();
    }
  }
  async function applyRemoteState(payload, sender) {
    var next = C.validateState(payload);
    if (!next || !sender || !hostActor || sender !== hostActor || next.hostActor !== hostActor) { notice('status.protocol', null, true); return false; }
    if (state && next.seq <= state.seq) return false;
    state = next;
    await saveSession(); render(); notice('status.synced'); return true;
  }
  function wireMessages() {
    if (offMessage || !Tapp.federation || typeof Tapp.federation.onMessage !== 'function') return;
    offMessage = Tapp.federation.onMessage(function (event) {
      queueRoomTask(async function () {
        var decoded = decodeEnvelope(event) || decodeEnvelope(event && event.data);
        if (!decoded || !sameActiveRoom(decoded.room)) return;
        if (decoded.payload.kind === 'intent') await handleIntent(decoded.payload, decoded.sender);
        else if (decoded.payload.kind === 'state') await applyRemoteState(decoded.payload, decoded.sender);
      }).catch(function (error) { console.warn('[联邦五子棋] message', error); });
    });
  }
  async function subscribe(id) {
    if (!Tapp.federation || typeof Tapp.federation.subscribeRoom !== 'function') throw new Error('Federation subscribe API unavailable');
    await Tapp.federation.subscribeRoom(id); wireMessages();
  }
  async function loadLatestState(id) {
    if (!Tapp.federation || typeof Tapp.federation.getRoomMessages !== 'function') return false;
    var response = await Tapp.federation.getRoomMessages(id, undefined, 100);
    var list = messageList(response), best = null;
    for (var i = 0; i < list.length; i += 1) {
      var decoded = decodeEnvelope(list[i]);
      if (!decoded || decoded.payload.kind !== 'state') continue;
      var candidate = C.validateState(decoded.payload);
      if (candidate && hostActor && decoded.sender === hostActor && candidate.hostActor === hostActor && (!best || candidate.seq > best.payload.seq)) best = { payload: candidate, sender: decoded.sender };
    }
    return best ? applyRemoteState(best.payload, best.sender) : false;
  }
  async function createRoom() {
    if (!myActor || !Tapp.federation || typeof Tapp.federation.createRoom !== 'function') throw new Error(t('online.permission'));
    var result = await Tapp.federation.createRoom({ name: t('app.title') + ' · ' + actorLabel(myActor), description: t('rules.body'), is_public: true, max_members: 2, invite_policy: 'open', governance_type: 'owner' });
    var id = result && (result.room_id || result.id);
    if (!id) throw new Error('Missing room_id');
    roomId = id; shareRoomId = id.indexOf('@') >= 0 || !result.home_server ? id : id + '@' + result.home_server;
    hostActor = myActor; isHost = true; seenNonces = Object.create(null); memberNames = Object.create(null); state = blankLobby(myActor); state.ready[myActor] = false;
    await subscribe(roomId); await emitState(); await refreshMemberNames().catch(function () {}); notice('status.roomCreated'); render();
  }
  async function joinRoom(id) {
    id = String(id || '').trim(); if (!/^rm_[^\s@]+@[^\s@]+$/.test(id)) { notice('status.invalidRoom', null, true); return; }
    if (!myActor || !Tapp.federation) throw new Error(t('online.permission'));
    var joined = typeof Tapp.federation.joinRoom === 'function' ? await Tapp.federation.joinRoom(id) : null;
    var joinedRoomId = joined && (joined.room_id || joined.id) || id;
    var owner;
    try { owner = await fetchRoomOwner(joinedRoomId); }
    catch (error) {
      if (typeof Tapp.federation.leaveRoom === 'function') { try { await Tapp.federation.leaveRoom(joinedRoomId); } catch (_) {} }
      throw error;
    }
    roomId = joinedRoomId; shareRoomId = id; hostActor = owner; isHost = hostActor === myActor; state = null; seenNonces = Object.create(null); memberNames = Object.create(null);
    await subscribe(roomId); await loadLatestState(roomId);
    if (isHost) { if (!state) state = blankLobby(myActor); await emitState(); } else await submitIntent({ action: 'hello' });
    await refreshMemberNames().catch(function () {}); notice('status.roomJoined'); render();
  }
  function canResumeRoom() {
    return !!(savedSession && savedSession.roomId && myActor && Tapp.federation && typeof Tapp.federation.getRoom === 'function' && typeof Tapp.federation.subscribeRoom === 'function');
  }
  async function resumeRoom() {
    if (!canResumeRoom()) return;
    var restoringRoomId = savedSession.roomId;
    var restoringShareId = savedSession.shareRoomId || restoringRoomId;
    var restoringOwner = await fetchRoomOwner(restoringRoomId);
    roomId = restoringRoomId; shareRoomId = restoringShareId; hostActor = restoringOwner; isHost = hostActor === myActor; state = null; seenNonces = Object.create(null); memberNames = Object.create(null);
    var storedState = C.validateState(savedSession.state);
    if (!storedState || storedState.hostActor !== hostActor) { await clearSession(); throw new Error('Saved session is invalid'); }
    await subscribe(roomId); await loadLatestState(roomId);
    if (!state || storedState.seq > state.seq) state = storedState;
    if (isHost) await emitState(); else await submitIntent({ action: 'sync' });
    await refreshMemberNames().catch(function () {});
    render();
  }
  async function leaveRoom() {
    if (state && state.phase === 'playing' && Tapp.ui && typeof Tapp.ui.confirm === 'function' && !(await Tapp.ui.confirm(t('confirm.leave')))) return;
    var leaving = roomId;
    if (leaving && Tapp.federation && typeof Tapp.federation.unsubscribeRoom === 'function') await Tapp.federation.unsubscribeRoom(leaving);
    if (leaving && Tapp.federation && typeof Tapp.federation.leaveRoom === 'function') await Tapp.federation.leaveRoom(leaving);
    roomId = ''; shareRoomId = ''; hostActor = ''; isHost = false; state = null; memberNames = Object.create(null); await clearSession(); notice('status.left'); render();
  }
  async function dissolveRoom() {
    if (!roomId || !isHost || !Tapp.federation || typeof Tapp.federation.deleteRoom !== 'function') return;
    if (Tapp.ui && typeof Tapp.ui.confirm === 'function' && !(await Tapp.ui.confirm(t('confirm.dissolve')))) return;
    var deleting = roomId;
    await Tapp.federation.deleteRoom(deleting);
    if (Tapp.federation && typeof Tapp.federation.unsubscribeRoom === 'function') {
      try { await Tapp.federation.unsubscribeRoom(deleting); } catch (_) {}
    }
    roomId = ''; shareRoomId = ''; hostActor = ''; isHost = false; state = null; memberNames = Object.create(null);
    await clearSession(); notice('status.dissolved'); render();
  }
  async function invite() {
    var actor = els.actorId.value.trim();
    if (!(/^@?[^\s@]+@[^\s@]+$/.test(actor) || /^https:\/\/[^\s/]+\/users\/[^\s/]+\/?$/.test(actor))) { notice('status.invalidActor', null, true); return; }
    await Tapp.federation.inviteMember(roomId, { actor: actor, role: 'member' }); els.actorId.value = ''; notice('status.invited');
  }
  async function copyRoom() {
    var value = shareRoomId || roomId;
    var copied = false, clipboardError = null;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(value); copied = true; }
    } catch (error) { clipboardError = error; }
    if (!copied) {
      var input = document.createElement('textarea'); input.value = value; input.setAttribute('readonly', 'readonly'); input.style.position = 'fixed'; input.style.left = '-9999px'; input.style.opacity = '0'; document.body.appendChild(input); input.focus(); input.select(); input.setSelectionRange(0, value.length);
      try { copied = !!(document.execCommand && document.execCommand('copy')); } catch (_) { copied = false; }
      input.remove();
    }
    if (!copied) throw clipboardError || new Error('Clipboard unavailable');
    notice('status.copied');
  }
  async function confirmResign() {
    if (Tapp.ui && typeof Tapp.ui.confirm === 'function' && !(await Tapp.ui.confirm(t('confirm.resign')))) return;
    await submitIntent({ action: 'resign' }); notice('status.resigned');
  }
  function makeBoard() {
    var fragment = document.createDocumentFragment();
    for (var row = 0; row < C.SIZE; row += 1) for (var col = 0; col < C.SIZE; col += 1) {
      var cell = document.createElement('button'); cell.type = 'button'; cell.className = 'cell'; cell.setAttribute('role', 'gridcell');
      cell.dataset.row = row; cell.dataset.col = col; cell.tabIndex = row === 7 && col === 7 ? 0 : -1;
      cell.addEventListener('click', function (event) { place(Number(event.currentTarget.dataset.row), Number(event.currentTarget.dataset.col)); });
      cell.addEventListener('keydown', boardKeydown); cells.push(cell); fragment.appendChild(cell);
    }
    els.board.appendChild(fragment);
  }
  function boardKeydown(event) {
    var cell = event.currentTarget, row = Number(cell.dataset.row), col = Number(cell.dataset.col), nextRow = row, nextCol = col;
    if (event.key === 'ArrowUp') nextRow -= 1; else if (event.key === 'ArrowDown') nextRow += 1; else if (event.key === 'ArrowLeft') nextCol -= 1; else if (event.key === 'ArrowRight') nextCol += 1; else if (event.key === 'Home') nextCol = 0; else if (event.key === 'End') nextCol = C.SIZE - 1; else if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); place(row, col); return; } else return;
    event.preventDefault(); nextRow = Math.max(0, Math.min(C.SIZE - 1, nextRow)); nextCol = Math.max(0, Math.min(C.SIZE - 1, nextCol));
    cells.forEach(function (item) { item.tabIndex = -1; }); var next = cells[nextRow * C.SIZE + nextCol]; next.tabIndex = 0; next.focus();
  }
  function applyTheme(theme) {
    var dark = theme === 'dark' || (theme && theme.mode === 'dark'); document.documentElement.classList.toggle('dark', dark);
  }
  function cacheElements() {
    var map = { board:'board', notice:'notice', turnAlert:'turn-alert', lobbyLock:'lobby-lock', lockBlackStatus:'lock-black-status', lockWhiteStatus:'lock-white-status', localTab:'local-tab', onlineTab:'online-tab', localPanel:'local-panel', onlinePanel:'online-panel', onlineLobby:'online-lobby', roomPanel:'room-panel', resumeRoom:'resume-room', activeRoom:'active-room-id', blackPlayer:'black-player', whitePlayer:'white-player', blackReady:'black-ready', whiteReady:'white-ready', ready:'ready', swapColors:'swap-colors', resign:'resign', rematch:'rematch', invitePlayer:'invite-player', actorId:'actor-id', modeLabel:'mode-label', gameStatus:'game-status', turnChip:'turn-chip', turnLabel:'turn-label', roundLabel:'round-label', blackWins:'black-wins', whiteWins:'white-wins', draws:'draws' };
    Object.keys(map).forEach(function (key) { els[key] = $(map[key]); });
  }
  function bindEvents() {
    els.localTab.addEventListener('click', function () { setMode('local'); }); els.onlineTab.addEventListener('click', function () { setMode('online'); });
    $('new-local').addEventListener('click', newLocal); $('create-room').addEventListener('click', function () { runBusy(createRoom); });
    $('join-room').addEventListener('click', function () { runBusy(function () { return joinRoom($('room-id').value); }); });
    els.resumeRoom.addEventListener('click', function () { runBusy(resumeRoom); }); $('copy-room').addEventListener('click', function () { runBusy(copyRoom); });
    els.invitePlayer.addEventListener('click', function () { runBusy(invite); }); els.ready.addEventListener('click', function () { runBusy(function () { return submitIntent({ action: 'ready', ready: !(state && state.ready[myActor]) }); }); });
    els.swapColors.addEventListener('click', function () { runBusy(function () { return submitIntent({ action: 'swap', seq: state && state.seq }); }); });
    els.rematch.addEventListener('click', function () { runBusy(function () { return submitIntent({ action: 'ready', ready: !(state && state.ready[myActor]) }); }); }); els.resign.addEventListener('click', function () { runBusy(confirmResign); });
    $('dissolve-room').addEventListener('click', function () { runBusy(dissolveRoom); });
    $('leave-room').addEventListener('click', function () { runBusy(leaveRoom); });
  }
  async function loadIdentity() {
    try {
      if (!Tapp.federation || typeof Tapp.federation.getIdentity !== 'function') throw new Error('unavailable');
      var role = Tapp.user && typeof Tapp.user.getRole === 'function' ? await Tapp.user.getRole() : '';
      if (role === 'guest') throw new Error('guest');
      var identity = await Tapp.federation.getIdentity(); myActor = identity && (identity.actor_url || identity.actor || identity.actor_id || identity.id || '');
      if (!myActor) throw new Error('guest');
      myDisplayName = memberDisplayName(identity) || C.nicknameFromActor(myActor);
      identityState = 'online'; renderIdentity(); $('connection-dot').classList.add('online');
    } catch (error) {
      myActor = ''; myDisplayName = ''; identityState = errorText(error) === 'guest' ? 'guest' : 'unavailable'; renderIdentity(); $('connection-dot').classList.add('error');
      $('create-room').disabled = true; $('join-room').disabled = true; $('online-help').textContent = t('online.permission');
    }
  }
  async function init() {
    cacheElements(); applyStaticI18n(); makeBoard(); bindEvents();
    try {
      var stored = await Promise.all([Tapp.storage.get(STATS_KEY), Tapp.storage.get(SESSION_KEY)]);
      if (stored[0] && typeof stored[0] === 'object') stats = { black: Number(stored[0].black) || 0, white: Number(stored[0].white) || 0, draws: Number(stored[0].draws) || 0 };
      if (stored[1] && typeof stored[1] === 'object') savedSession = stored[1];
    } catch (_) {}
    await loadIdentity(); wireMessages();
    try {
      if (Tapp.ui && typeof Tapp.ui.getTheme === 'function') applyTheme(await Tapp.ui.getTheme());
      if (Tapp.ui && typeof Tapp.ui.onThemeChange === 'function') offTheme = Tapp.ui.onThemeChange(applyTheme);
      if (Tapp.ui && typeof Tapp.ui.onLocaleChange === 'function') offLocale = Tapp.ui.onLocaleChange(function () { applyStaticI18n(); render(); });
    } catch (_) {}
    render();
  }
  Tapp.lifecycle.onReady(function () { init().catch(function (error) { console.error('[联邦五子棋] init', error); }); });
  Tapp.lifecycle.onDestroy(function () {
    destroyed = true;
    if (offMessage) offMessage(); if (offTheme) offTheme(); if (offLocale) offLocale();
    if (roomId && Tapp.federation && typeof Tapp.federation.unsubscribeRoom === 'function') Tapp.federation.unsubscribeRoom(roomId).catch(function () {});
    offMessage = offTheme = offLocale = null;
  });
  Tapp.lifecycle.onPause(function () { if (roomId) saveSession(); });
  Tapp.lifecycle.onResume(function () { if (!destroyed && roomId && !isHost) loadLatestState(roomId).catch(function () {}); });
})();
