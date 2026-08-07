// com.myriad.doudizhu — 斗地主 (federation multiplayer)
// Host-owned seq + peer intents; pure rules also in Myriad frontend/src/tapp/examples/doudizhu/
// 斗地主 core — 规则纯模块见 examples/doudizhu/；对局逻辑在 page。
console.log('[斗地主] core loaded');

// ========== Page ==========
(function () {
  'use strict';

  var MSG_TYPE = 'doudizhu';
  var DECK_SIZE = 54;
  var HAND_SIZE = 17;
  var BOTTOM_SIZE = 3;
  var N = 3;
  var TURN_SECONDS = 30;
  var RANK_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','SJ','BJ'];
  var SUITS = ['S','H','D','C'];
  var STD_RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];

  function rankValue(rank) {
    if (rank === 'SJ') return 16;
    if (rank === 'BJ') return 17;
    var idx = RANK_ORDER.indexOf(rank);
    return idx + 3;
  }
  function cardId(suit, rank) { return suit + '-' + rank; }
  function createDeck() {
    var deck = [];
    for (var s = 0; s < SUITS.length; s++) {
      for (var r = 0; r < STD_RANKS.length; r++) {
        deck.push({ id: cardId(SUITS[s], STD_RANKS[r]), suit: SUITS[s], rank: STD_RANKS[r] });
      }
    }
    deck.push({ id: cardId('J','SJ'), suit: 'J', rank: 'SJ' });
    deck.push({ id: cardId('J','BJ'), suit: 'J', rank: 'BJ' });
    return deck;
  }
  function mulberry32(seed) {
    var t = seed >>> 0;
    return function () {
      t = (t + 0x6d2b79f5) >>> 0;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffleDeck(deck, seed) {
    var arr = deck.slice();
    var rnd = mulberry32(seed);
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }
  function sortHand(cards) {
    return cards.slice().sort(function (a, b) {
      var dv = rankValue(a.rank) - rankValue(b.rank);
      return dv !== 0 ? dv : a.suit.localeCompare(b.suit);
    });
  }
  function deal(seed) {
    var shuffled = shuffleDeck(createDeck(), seed);
    return {
      hands: [
        sortHand(shuffled.slice(0, HAND_SIZE)),
        sortHand(shuffled.slice(HAND_SIZE, HAND_SIZE * 2)),
        sortHand(shuffled.slice(HAND_SIZE * 2, HAND_SIZE * 3))
      ],
      bottom: sortHand(shuffled.slice(HAND_SIZE * 3, HAND_SIZE * 3 + BOTTOM_SIZE)),
      seed: seed
    };
  }
  function consecutiveNoTwo(values) {
    if (values.length < 2) return false;
    if (values.some(function (v) { return v >= 15; })) return false;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    for (var i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) return false;
    }
    return true;
  }
  function isStraightValues(values) {
    return values.length >= 5 && consecutiveNoTwo(values) && values.length === new Set(values).size;
  }
  function countByRank(cards) {
    var m = {};
    for (var i = 0; i < cards.length; i++) {
      var v = rankValue(cards[i].rank);
      if (!m[v]) m[v] = [];
      m[v].push(cards[i]);
    }
    return m;
  }
  function identifyCombo(cards) {
    if (!cards || !cards.length) return null;
    var n = cards.length;
    var byRank = countByRank(cards);
    var ranks = Object.keys(byRank).map(Number).sort(function (a, b) { return a - b; });
    var counts = ranks.map(function (r) { return byRank[r].length; });
    if (n === 2) {
      var ids = {};
      cards.forEach(function (c) { ids[c.rank] = true; });
      if (ids.SJ && ids.BJ) return { type: 'rocket', mainValue: 17, length: 1, cards: cards.slice() };
    }
    if (n === 4 && ranks.length === 1 && counts[0] === 4)
      return { type: 'bomb', mainValue: ranks[0], length: 1, cards: cards.slice() };
    if (n === 6) {
      var quad = ranks.find(function (r) { return byRank[r].length === 4; });
      if (quad !== undefined) {
        var kickRanks = ranks.filter(function (r) { return r !== quad; });
        if (kickRanks.length === 2 && byRank[kickRanks[0]].length === 1 && byRank[kickRanks[1]].length === 1)
          return { type: 'four_two_singles', mainValue: quad, length: 1, cards: cards.slice() };
      }
    }
    if (n === 8) {
      var quad2 = ranks.find(function (r) { return byRank[r].length === 4; });
      if (quad2 !== undefined) {
        var pairUnits2 = 0;
        for (var qi = 0; qi < ranks.length; qi++) {
          if (ranks[qi] === quad2) continue;
          if (byRank[ranks[qi]].length !== 2) { pairUnits2 = -999; break; }
          pairUnits2 += 1;
        }
        if (pairUnits2 === 2)
          return { type: 'four_two_pairs', mainValue: quad2, length: 1, cards: cards.slice() };
      }
    }
    if (n === 1)
      return { type: 'single', mainValue: rankValue(cards[0].rank), length: 1, cards: cards.slice() };
    if (n === 2 && ranks.length === 1 && counts[0] === 2)
      return { type: 'pair', mainValue: ranks[0], length: 1, cards: cards.slice() };
    if (n === 3 && ranks.length === 1 && counts[0] === 3)
      return { type: 'triple', mainValue: ranks[0], length: 1, cards: cards.slice() };
    if (n === 4 && ranks.length === 2) {
      var tr = ranks.find(function (r) { return byRank[r].length === 3; });
      var sr = ranks.find(function (r) { return byRank[r].length === 1; });
      if (tr !== undefined && sr !== undefined)
        return { type: 'triple_one', mainValue: tr, length: 1, cards: cards.slice() };
    }
    if (n === 5 && ranks.length === 2) {
      var tr2 = ranks.find(function (r) { return byRank[r].length === 3; });
      var pr = ranks.find(function (r) { return byRank[r].length === 2; });
      if (tr2 !== undefined && pr !== undefined)
        return { type: 'triple_two', mainValue: tr2, length: 1, cards: cards.slice() };
    }
    if (n >= 5 && ranks.length === n && counts.every(function (c) { return c === 1; }) && isStraightValues(ranks))
      return { type: 'straight', mainValue: Math.min.apply(null, ranks), length: n, cards: cards.slice() };
    if (n >= 6 && n % 2 === 0 && ranks.length === n / 2 && counts.every(function (c) { return c === 2; }) && ranks.length >= 3 && consecutiveNoTwo(ranks))
      return { type: 'pair_seq', mainValue: Math.min.apply(null, ranks), length: ranks.length, cards: cards.slice() };
    var tripleRanks = ranks.filter(function (r) { return byRank[r].length === 3; });
    if (tripleRanks.length >= 2 && consecutiveNoTwo(tripleRanks)) {
      var planeLen = tripleRanks.length;
      var mainValue = Math.min.apply(null, tripleRanks);
      var body = planeLen * 3;
      var rest = n - body;
      if (rest === 0 && ranks.length === planeLen)
        return { type: 'airplane', mainValue: mainValue, length: planeLen, cards: cards.slice() };
      if (rest === planeLen)
        return { type: 'airplane_singles', mainValue: mainValue, length: planeLen, cards: cards.slice() };
      if (rest === planeLen * 2) {
        var pairUnits = 0;
        for (var i = 0; i < ranks.length; i++) {
          if (tripleRanks.indexOf(ranks[i]) >= 0) continue;
          var c = byRank[ranks[i]].length;
          if (c % 2 !== 0) { pairUnits = -999; break; }
          pairUnits += c / 2;
        }
        if (pairUnits === planeLen)
          return { type: 'airplane_pairs', mainValue: mainValue, length: planeLen, cards: cards.slice() };
      }
    }
    return null;
  }
  function canBeat(incoming, table) {
    if (!table) return true;
    if (incoming.type === 'rocket') return true;
    if (table.type === 'rocket') return false;
    if (incoming.type === 'bomb' && table.type !== 'bomb') return true;
    if (incoming.type === 'bomb' && table.type === 'bomb') return incoming.mainValue > table.mainValue;
    if (table.type === 'bomb') return false;
    if (incoming.type !== table.type || incoming.length !== table.length) return false;
    return incoming.mainValue > table.mainValue;
  }
  function playKey(cards) {
    return cards.map(function (c) { return c.id; }).sort().join('|');
  }
  function takeN(cards, n) { return cards.slice(0, n); }
  function shouldAlarmCount(count) { return count === 1 || count === 2; }

  /** Enumerate legal plays from hand that beat table (or free lead). Product 提示 source. */
  function enumerateLegalPlays(hand, table) {
    if (!hand || !hand.length) return [];
    var byRank = countByRank(hand);
    var ranks = Object.keys(byRank).map(Number).sort(function (a, b) { return a - b; });
    var candidates = [];
    function push(cards) {
      if (!cards || !cards.length) return;
      var combo = identifyCombo(cards);
      if (!combo || !canBeat(combo, table)) return;
      candidates.push(cards);
    }
    for (var i = 0; i < hand.length; i++) push([hand[i]]);
    for (var ri = 0; ri < ranks.length; ri++) {
      var group = byRank[ranks[ri]];
      if (group.length >= 2) push(takeN(group, 2));
      if (group.length >= 3) push(takeN(group, 3));
      if (group.length >= 4) push(takeN(group, 4));
    }
    for (var qr = 0; qr < ranks.length; qr++) {
      var quadGroup = byRank[ranks[qr]];
      if (quadGroup.length < 4) continue;
      var quadBody = takeN(quadGroup, 4);
      var kickRanks4 = ranks.filter(function (r) { return r !== ranks[qr]; });
      var singlesPool4 = [];
      for (var sk = 0; sk < kickRanks4.length; sk++) {
        if (byRank[kickRanks4[sk]].length === 1) singlesPool4 = singlesPool4.concat(byRank[kickRanks4[sk]]);
      }
      if (singlesPool4.length >= 2) {
        singlesPool4.sort(function (x, y) {
          var dv = rankValue(x.rank) - rankValue(y.rank);
          return dv !== 0 ? dv : x.suit.localeCompare(y.suit);
        });
        push(quadBody.concat(singlesPool4.slice(0, 2)));
      }
      var pairs4 = [];
      for (var pk4 = 0; pk4 < kickRanks4.length; pk4++) {
        if (byRank[kickRanks4[pk4]].length >= 2) pairs4.push(takeN(byRank[kickRanks4[pk4]], 2));
      }
      if (pairs4.length >= 2) {
        pairs4.sort(function (x, y) { return rankValue(x[0].rank) - rankValue(y[0].rank); });
        push(quadBody.concat(pairs4[0]).concat(pairs4[1]));
      }
    }
    var sj = null, bj = null;
    for (var j = 0; j < hand.length; j++) {
      if (hand[j].rank === 'SJ') sj = hand[j];
      if (hand[j].rank === 'BJ') bj = hand[j];
    }
    if (sj && bj) push([sj, bj]);
    for (var tr = 0; tr < ranks.length; tr++) {
      var triple = byRank[ranks[tr]];
      if (triple.length < 3) continue;
      var body = takeN(triple, 3);
      for (var sr = 0; sr < ranks.length; sr++) {
        if (ranks[sr] === ranks[tr]) continue;
        var others = byRank[ranks[sr]];
        if (others.length >= 1) push(body.concat([others[0]]));
        if (others.length >= 2) push(body.concat(takeN(others, 2)));
      }
    }
    var singleRanks = ranks.filter(function (r) { return r < 15; });
    for (var len = 5; len <= Math.min(12, singleRanks.length); len++) {
      for (var s = 0; s + len <= singleRanks.length; s++) {
        var slice = singleRanks.slice(s, s + len);
        if (!consecutiveNoTwo(slice)) continue;
        var scards = [];
        for (var k = 0; k < slice.length; k++) scards.push(byRank[slice[k]][0]);
        push(scards);
      }
    }
    var pairRanks = ranks.filter(function (r) { return r < 15 && byRank[r].length >= 2; });
    for (var plen = 3; plen <= pairRanks.length; plen++) {
      for (var p = 0; p + plen <= pairRanks.length; p++) {
        var pslice = pairRanks.slice(p, p + plen);
        if (!consecutiveNoTwo(pslice)) continue;
        var pcards = [];
        for (var q = 0; q < pslice.length; q++) pcards = pcards.concat(takeN(byRank[pslice[q]], 2));
        push(pcards);
      }
    }
    var tripRanks = ranks.filter(function (r) { return r < 15 && byRank[r].length >= 3; });
    for (var alen = 2; alen <= tripRanks.length; alen++) {
      for (var a = 0; a + alen <= tripRanks.length; a++) {
        var aslice = tripRanks.slice(a, a + alen);
        if (!consecutiveNoTwo(aslice)) continue;
        var abody = [];
        for (var t = 0; t < aslice.length; t++) abody = abody.concat(takeN(byRank[aslice[t]], 3));
        push(abody.slice());
        var kickRanks = ranks.filter(function (r) { return aslice.indexOf(r) < 0; });
        var singlesPool = [];
        for (var kr = 0; kr < kickRanks.length; kr++) {
          singlesPool = singlesPool.concat(byRank[kickRanks[kr]]);
        }
        if (singlesPool.length >= alen) {
          singlesPool.sort(function (x, y) {
            var dv = rankValue(x.rank) - rankValue(y.rank);
            return dv !== 0 ? dv : x.suit.localeCompare(y.suit);
          });
          push(abody.concat(singlesPool.slice(0, alen)));
        }
        var pairKick = [];
        for (var pr = 0; pr < kickRanks.length; pr++) {
          if (byRank[kickRanks[pr]].length >= 2) pairKick.push(takeN(byRank[kickRanks[pr]], 2));
        }
        if (pairKick.length >= alen) {
          pairKick.sort(function (x, y) { return rankValue(x[0].rank) - rankValue(y[0].rank); });
          var attached = [];
          for (var pk = 0; pk < alen; pk++) attached = attached.concat(pairKick[pk]);
          push(abody.concat(attached));
        }
      }
    }
    var seen = {};
    var unique = [];
    for (var u = 0; u < candidates.length; u++) {
      var cards = candidates[u];
      var key = playKey(cards);
      if (seen[key]) continue;
      var combo = identifyCombo(cards);
      if (!combo || !canBeat(combo, table)) continue;
      seen[key] = true;
      unique.push({ cards: cards, combo: combo, key: key });
    }
    unique.sort(function (a, b) {
      var aBoom = (a.combo.type === 'bomb' || a.combo.type === 'rocket') ? 1 : 0;
      var bBoom = (b.combo.type === 'bomb' || b.combo.type === 'rocket') ? 1 : 0;
      if (aBoom !== bBoom) return aBoom - bBoom;
      if (a.cards.length !== b.cards.length) return a.cards.length - b.cards.length;
      if (a.combo.mainValue !== b.combo.mainValue) return a.combo.mainValue - b.combo.mainValue;
      return a.key.localeCompare(b.key);
    });
    return unique.map(function (x) { return x.cards; });
  }
  function nextHintPlay(hand, table, currentKey) {
    var plays = enumerateLegalPlays(hand, table);
    if (!plays.length) return null;
    var idx = 0;
    if (currentKey) {
      var found = -1;
      for (var i = 0; i < plays.length; i++) {
        if (playKey(plays[i]) === currentKey) { found = i; break; }
      }
      idx = found >= 0 ? (found + 1) % plays.length : 0;
    }
    return { cards: plays[idx], key: playKey(plays[idx]), index: idx, total: plays.length };
  }
  function removeFromHand(hand, cards) {
    var ids = {};
    for (var i = 0; i < cards.length; i++) {
      if (ids[cards[i].id]) return null;
      ids[cards[i].id] = true;
    }
    var remaining = [];
    var have = {};
    hand.forEach(function (c) { have[c.id] = true; });
    for (var k in ids) { if (!have[k]) return null; }
    hand.forEach(function (c) { if (!ids[c.id]) remaining.push(c); });
    return remaining;
  }
  function startDeal(seed, auctionStart) {
    var d = deal(seed);
    var start = ((auctionStart % N) + N) % N;
    return {
      phase: 'auction', seed: seed, hands: d.hands, bottom: d.bottom,
      landlord: null, bidScore: 0, bidWinner: null, turn: start,
      trickLeader: null, lastCombo: null, passCount: 0,
      auctionStart: start, auctionActions: 0, multiplier: 1, winner: null, winningSide: null
    };
  }
  function finishAuction(state, landlord) {
    var next = JSON.parse(JSON.stringify(state));
    next.landlord = landlord;
    next.hands[landlord] = sortHand(next.hands[landlord].concat(next.bottom));
    next.phase = 'playing';
    next.turn = landlord;
    next.trickLeader = null;
    next.lastCombo = null;
    next.passCount = 0;
    return next;
  }
  function applyBid(state, action) {
    if (state.phase !== 'auction') return { ok: false, error: 'Not in auction', state: state };
    if (action.seat !== state.turn) return { ok: false, error: 'Not your turn', state: state };
    var next = JSON.parse(JSON.stringify(state));
    if (action.kind === 'bid') {
      if (action.score < 1 || action.score > 3 || action.score <= next.bidScore)
        return { ok: false, error: 'Invalid bid', state: state };
      next.bidScore = action.score;
      next.bidWinner = action.seat;
      next.auctionActions += 1;
      next.passCount = 0;
      if (action.score === 3) return { ok: true, state: finishAuction(next, action.seat) };
      next.turn = (action.seat + 1) % N;
      return { ok: true, state: next };
    }
    next.auctionActions += 1;
    next.passCount += 1;
    next.turn = (action.seat + 1) % N;
    if (next.bidWinner === null && next.auctionActions >= N)
      return { ok: true, state: next, redeal: true };
    if (next.bidWinner !== null && next.passCount >= N - 1)
      return { ok: true, state: finishAuction(next, next.bidWinner) };
    return { ok: true, state: next };
  }
  function findTrickWinner(stateBeforePass) {
    var passer = stateBeforePass.turn;
    var newPassCount = stateBeforePass.passCount + 1;
    return (passer - newPassCount + N * 3) % N;
  }
  function applyPlay(state, action) {
    if (state.phase !== 'playing') return { ok: false, error: 'Not playing', state: state };
    if (action.seat !== state.turn) return { ok: false, error: 'Not your turn', state: state };
    var next = JSON.parse(JSON.stringify(state));
    if (action.kind === 'pass') {
      if (next.lastCombo === null || next.trickLeader === null)
        return { ok: false, error: 'Cannot pass when leading', state: state };
      next.passCount += 1;
      if (next.passCount >= N - 1) {
        var w = findTrickWinner(state);
        next.lastCombo = null;
        next.passCount = 0;
        next.trickLeader = null;
        next.turn = w;
        return { ok: true, state: next };
      }
      next.turn = (action.seat + 1) % N;
      return { ok: true, state: next };
    }
    var combo = identifyCombo(action.cards);
    if (!combo) return { ok: false, error: 'Illegal combination', state: state };
    if (!canBeat(combo, next.lastCombo)) return { ok: false, error: 'Cannot beat', state: state };
    var remaining = removeFromHand(next.hands[action.seat], action.cards);
    if (!remaining) return { ok: false, error: 'Cards not in hand', state: state };
    next.hands[action.seat] = sortHand(remaining);
    next.lastCombo = combo;
    next.passCount = 0;
    if (next.trickLeader === null) next.trickLeader = action.seat;
    if (next.hands[action.seat].length === 0) {
      next.phase = 'finished';
      next.winner = action.seat;
      next.winningSide = action.seat === next.landlord ? 'landlord' : 'farmers';
      return { ok: true, state: next };
    }
    next.turn = (action.seat + 1) % N;
    return { ok: true, state: next };
  }
  function assignSeats(actorIds) {
    var sorted = actorIds.slice().sort();
    var map = {};
    sorted.forEach(function (id, i) { map[id] = i; });
    return map;
  }
  function canStartMatch(seats, ready) {
    var actors = Object.keys(seats);
    if (actors.length !== 3) return false;
    return actors.every(function (a) { return ready[a] === true; });
  }

  // ─── Texture catalog (package assets/) ──────────────────────
  // Paths must match manifest.assets; loaded via Tapp.assets.getUrl when available.
  var TEXTURE_MAP = {
    felt: 'assets/felt/table_felt.png',
    feltDark: 'assets/felt/table_felt_dark.png',
    scene: 'assets/felt/scene_bg.png',
    feltTile: 'assets/felt/felt_tile.png',
    centerVelvet: 'assets/felt/center_velvet.png',
    // card_back.png remains in the package for legacy compatibility checks.
    cardBack: 'assets/cards/card_back.gif',
    cardBackSm: 'assets/cards/card_back.gif',
    cardFace: 'assets/cards/card_face.png',
    cardFaceSm: 'assets/cards/card_face_sm.png',
    paper: 'assets/cards/paper_texture.png',
    suitS: 'assets/cards/suit_S.png',
    suitH: 'assets/cards/suit_H.png',
    suitD: 'assets/cards/suit_D.png',
    suitC: 'assets/cards/suit_C.png',
    jokerSj: 'assets/cards/joker_sj.png',
    jokerBj: 'assets/cards/joker_bj.png',
    btnPlay: 'assets/ui/btn_play.png',
    btnPass: 'assets/ui/btn_pass.png',
    btnHint: 'assets/ui/btn_hint.png',
    btnBid: 'assets/ui/btn_bid.png',
    btnPrimary: 'assets/ui/btn_primary.png',
    btnGhost: 'assets/ui/btn_ghost.png',
    bubbleDark: 'assets/ui/bubble_dark.png',
    bubbleGold: 'assets/ui/bubble_gold.png',
    turnRing: 'assets/ui/turn_ring.png',
    badgeLandlord: 'assets/badges/badge_landlord.png',
    badgeFarmer: 'assets/badges/badge_farmer.png',
    badgeAlarm: 'assets/badges/badge_alarm.png',
    woodPanel: 'assets/chrome/wood_panel.png',
    seatFrame: 'assets/chrome/seat_frame.png',
    bottomTray: 'assets/chrome/bottom_tray.png',
    lastTray: 'assets/chrome/last_tray.png',
    avatarRing: 'assets/chrome/avatar_ring.png',
    logoPlate: 'assets/chrome/logo_plate.png',
    ornament: 'assets/chrome/ornament_strip.png',
    coin: 'assets/chrome/coin.png',
    endRibbon: 'assets/chrome/end_ribbon.png',
    crown: 'assets/chrome/crown.png',
    readyCheck: 'assets/chrome/ready_check.png'
  };
  var textureUrls = {};
  var texturesReady = false;
  var LEGACY_CARD_BACK_ASSET = 'assets/cards/card_back.png';

  var FLAME_CHASER_CARD_LOCALES = ['zh-CN', 'en-US', 'ja-JP'];
  var FLAME_CHASER_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var FLAME_CHASER_SUITS = ['S', 'H', 'D', 'C'];

  function normalizeCardLocale(locale) {
    var lang = String(locale || '').toLowerCase();
    if (lang.indexOf('ja') === 0) return 'ja-JP';
    if (lang.indexOf('en') === 0) return 'en-US';
    return 'zh-CN';
  }

  function currentCardLocale() {
    try {
      if (typeof Tapp !== 'undefined' && Tapp.i18n && typeof Tapp.i18n.getLocale === 'function') {
        return normalizeCardLocale(Tapp.i18n.getLocale());
      }
    } catch (e) {}
    if (typeof navigator !== 'undefined') return normalizeCardLocale(navigator.language);
    return 'zh-CN';
  }

  function flameChaserTextureKey(locale, rank, suit) {
    return 'flameChaserAtlas_' + locale;
  }

  function flameChaserAssetPath(locale) {
    return 'assets/cards/flame-chasers/' + locale + '-atlas.png';
  }

  for (var fcl = 0; fcl < FLAME_CHASER_CARD_LOCALES.length; fcl++) {
    var fcLocale = FLAME_CHASER_CARD_LOCALES[fcl];
    TEXTURE_MAP[flameChaserTextureKey(fcLocale)] = flameChaserAssetPath(fcLocale);
  }

  function cssUrl(pathOrUrl) {
    if (!pathOrUrl) return 'none';
    return 'url("' + String(pathOrUrl).replace(/"/g, '\\"') + '")';
  }

  /**
   * Map TEXTURE_MAP keys → CSS custom properties.
   * MUST include every key in TEXTURE_MAP so no asset is load-only dead weight.
   */
  var TEXTURE_CSS_VARS = {
    scene: '--ddz-tex-scene',
    felt: '--ddz-tex-felt',
    feltDark: '--ddz-tex-felt-dark',
    feltTile: '--ddz-tex-felt-tile',
    centerVelvet: '--ddz-tex-velvet',
    woodPanel: '--ddz-tex-wood',
    cardBack: '--ddz-tex-card-back',
    cardBackSm: '--ddz-tex-card-back-sm',
    cardFace: '--ddz-tex-card-face',
    cardFaceSm: '--ddz-tex-card-face-sm',
    paper: '--ddz-tex-paper',
    suitS: '--ddz-tex-suit-S',
    suitH: '--ddz-tex-suit-H',
    suitD: '--ddz-tex-suit-D',
    suitC: '--ddz-tex-suit-C',
    jokerSj: '--ddz-tex-joker-sj',
    jokerBj: '--ddz-tex-joker-bj',
    btnPlay: '--ddz-tex-btn-play',
    btnPass: '--ddz-tex-btn-pass',
    btnHint: '--ddz-tex-btn-hint',
    btnBid: '--ddz-tex-btn-bid',
    btnPrimary: '--ddz-tex-btn-primary',
    btnGhost: '--ddz-tex-btn-ghost',
    bubbleDark: '--ddz-tex-bubble',
    bubbleGold: '--ddz-tex-bubble-gold',
    turnRing: '--ddz-tex-turn-ring',
    badgeLandlord: '--ddz-tex-badge-landlord',
    badgeFarmer: '--ddz-tex-badge-farmer',
    badgeAlarm: '--ddz-tex-badge-alarm',
    seatFrame: '--ddz-tex-seat-frame',
    bottomTray: '--ddz-tex-bottom-tray',
    lastTray: '--ddz-tex-last-tray',
    avatarRing: '--ddz-tex-avatar-ring',
    logoPlate: '--ddz-tex-logo',
    ornament: '--ddz-tex-ornament',
    coin: '--ddz-tex-coin',
    endRibbon: '--ddz-tex-end-ribbon',
    crown: '--ddz-tex-crown',
    readyCheck: '--ddz-tex-ready',
    'flameChaserAtlas_zh-CN': '--ddz-tex-flame-chasers-zh',
    'flameChaserAtlas_en-US': '--ddz-tex-flame-chasers-en',
    'flameChaserAtlas_ja-JP': '--ddz-tex-flame-chasers-ja'
  };

  /**
   * Apply texture CSS vars to ancestors that cover BOTH #tapp-background (sibling)
   * and #tapp-content/.ddz-root. documentElement is required so .ddz-bg-felt paints.
   */
  function textureApplyTargets() {
    var list = [];
    if (typeof document !== 'undefined') {
      if (document.documentElement) list.push(document.documentElement);
      if (document.body) list.push(document.body);
      var bg = document.getElementById('tapp-background');
      if (bg) list.push(bg);
      var root = document.querySelector('.ddz-root');
      if (root) list.push(root);
    }
    return list;
  }

  function applyTextureCssVars(targets) {
    var nodes = targets;
    if (!nodes) nodes = textureApplyTargets();
    if (!nodes || !nodes.length) return;
    if (nodes.nodeType) nodes = [nodes]; // single element
    for (var n = 0; n < nodes.length; n++) {
      var el = nodes[n];
      if (!el || !el.style || !el.style.setProperty) continue;
      var keys = Object.keys(TEXTURE_CSS_VARS);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var u = textureUrls[key];
        if (u) el.style.setProperty(TEXTURE_CSS_VARS[key], cssUrl(u));
      }
      if (el.classList) el.classList.add('ddz-textures-ready');
    }
    texturesReady = true;
  }

  async function loadTextures() {
    var keys = Object.keys(TEXTURE_MAP);
    var hasApi = typeof Tapp !== 'undefined' && Tapp.assets && typeof Tapp.assets.getUrl === 'function';
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var path = TEXTURE_MAP[k];
      if (hasApi) {
        try {
          var info = await Tapp.assets.getUrl(path);
          textureUrls[k] = (info && info.url) ? info.url : path;
        } catch (e) {
          textureUrls[k] = path; // relative fallback
        }
      } else {
        textureUrls[k] = path;
      }
    }
    // documentElement first — #tapp-background is NOT inside .ddz-root
    applyTextureCssVars(textureApplyTargets());
    return textureUrls;
  }

  // ─── UI helpers ─────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function setText(el, t) { if (el) el.textContent = t == null ? '' : String(t); }
  function show(el, on) { if (el) el.classList.toggle('hidden', !on); }

  var RANK_LABEL = { '3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9','10':'10','J':'J','Q':'Q','K':'K','A':'A','2':'2','SJ':'小王','BJ':'大王' };
  var SUIT_LABEL = { S:'♠', H:'♥', D:'♦', C:'♣', J:'' };
  var COMBO_LABELS = {
    single: '单张', pair: '对子', triple: '三张', triple_one: '三带一', triple_two: '三带二',
    straight: '顺子', pair_seq: '连对', airplane: '飞机', airplane_singles: '飞机带单',
    airplane_pairs: '飞机带对', four_two_singles: '四带二',
    four_two_pairs: '四带两对', bomb: '炸弹', rocket: '王炸'
  };

  function comboTypeLabel(typeOrCombo) {
    if (!typeOrCombo) return '';
    var type = typeof typeOrCombo === 'string' ? typeOrCombo : typeOrCombo.type;
    return COMBO_LABELS[type] || type || '';
  }

  function cardLabel(card) {
    if (card.rank === 'SJ' || card.rank === 'BJ') return RANK_LABEL[card.rank];
    return SUIT_LABEL[card.suit] + RANK_LABEL[card.rank];
  }
  function flameChaserCardFaceUrl(card) {
    if (!card || isJoker(card)) return '';
    var locale = currentCardLocale();
    var key = flameChaserTextureKey(locale);
    return textureUrls[key] || TEXTURE_MAP[key] || '';
  }
  function applyFlameChaserCardFace(el, card, url) {
    var rankIndex = FLAME_CHASER_RANKS.indexOf(card.rank);
    var suitIndex = FLAME_CHASER_SUITS.indexOf(card.suit);
    if (rankIndex < 0 || suitIndex < 0) return false;
    el.style.backgroundImage = cssUrl(url);
    el.style.backgroundSize = '400% 1300%';
    el.style.backgroundPosition = (suitIndex * 100 / 3) + '% ' + (rankIndex * 100 / 12) + '%';
    return true;
  }
  function isRed(card) {
    return card.suit === 'H' || card.suit === 'D' || card.rank === 'BJ';
  }
  function isJoker(card) {
    return card.rank === 'SJ' || card.rank === 'BJ';
  }
  function initialOf(name) {
    var s = String(name || '?').trim();
    return s ? s.charAt(0).toUpperCase() : '?';
  }
  function setRoleBadge(el, seat) {
    if (!el) return;
    el.classList.remove('is-landlord', 'is-farmer');
    var label = roleLabel(seat);
    setText(el, label);
    if (label === '地主') el.classList.add('is-landlord');
    else if (label === '农民') el.classList.add('is-farmer');
  }
  function renderCards(container, cards, opts) {
    opts = opts || {};
    if (!container) return;
    container.textContent = '';
    (cards || []).forEach(function (card, idx) {
      var el = document.createElement(opts.selectable ? 'button' : 'div');
      if (opts.selectable) {
        el.type = 'button';
        el.setAttribute('role', 'option');
        el.setAttribute('aria-selected', opts.selectedIds && opts.selectedIds[card.id] ? 'true' : 'false');
      }
      var cls = 'ddz-card';
      if (opts.mini) cls += ' mini';
      if (opts.backs) {
        cls = 'ddz-card back' + (opts.mini ? ' mini' : '');
      } else if (isJoker(card)) {
        cls += ' joker';
      } else if (flameChaserCardFaceUrl(card)) {
        cls += ' flame-chaser';
      } else if (isRed(card)) {
        cls += ' red';
      } else {
        cls += ' black';
      }
      if (opts.selectable) cls += ' btnlike';
      if (opts.selectedIds && opts.selectedIds[card.id]) cls += ' selected';
      if (isJoker(card) && card.rank === 'SJ') cls += ' is-sj';
      el.className = cls;
      el.style.setProperty('--ddz-card-layer', String(idx + 1));
      el.title = opts.backs ? '牌背' : cardLabel(card);
      if (opts.backs) {
        el.setAttribute('aria-label', '牌背');
      } else {
        var cardFaceUrl = flameChaserCardFaceUrl(card);
        if (cardFaceUrl) {
          applyFlameChaserCardFace(el, card, cardFaceUrl);
          el.setAttribute('aria-label', cardLabel(card));
        } else {
          var rankEl = document.createElement('span');
          rankEl.className = 'ddz-card-rank';
          rankEl.textContent = RANK_LABEL[card.rank] || card.rank;
          el.appendChild(rankEl);
        }
        if (!isJoker(card) && !cardFaceUrl) {
          var suitEl = document.createElement('span');
          suitEl.className = 'ddz-card-suit is-' + (card.suit || 'S');
          suitEl.setAttribute('aria-hidden', 'true');
          // Fallback glyph if texture not yet applied
          suitEl.textContent = SUIT_LABEL[card.suit] || '';
          el.appendChild(suitEl);
        }
      }
      if (opts.selectable) {
        el.addEventListener('click', function () {
          if (opts.onToggle) opts.onToggle(card);
        });
      }
      el.style.zIndex = String(idx + 1);
      container.appendChild(el);
    });
  }

  // ─── App state ──────────────────────────────────────────────
  var mode = 'lobby'; // lobby | solo | multi
  var myActorId = '';
  var roomId = '';
  var hostActor = '';
  var seats = {};
  var readyMap = {};
  var seq = 0;
  var lastSeq = 0;
  var game = null;
  var selected = {};
  var lastPlaySeat = null;
  /** Per-seat latest action for situational feedback: { kind, label, cards? } */
  var seatActions = [null, null, null];
  var hintKey = null;
  var unsubMessage = null;
  var isHost = false;
  var botTimers = [];
  var turnTimer = null;
  var turnDeadlineAt = 0;
  var turnStamp = '';
  var isAutoActing = false;
  var aiOpponentEnabled = false;
  var sessionScores = [0, 0, 0];

  function clearBots() {
    botTimers.forEach(function (t) { clearTimeout(t); });
    botTimers = [];
  }

  function clearTurnTimer() {
    if (turnTimer) clearInterval(turnTimer);
    turnTimer = null;
    turnDeadlineAt = 0;
    turnStamp = '';
  }

  function status(msg) { setText($('ddz-status'), msg); }
  function lobbyMsg(msg) { setText($('ddz-lobby-msg'), msg); }
  function tableMsg(msg) {
    var el = $('ddz-table-msg');
    setText(el, msg);
    if (el) el.classList.toggle('is-error', !!(msg && msg.length));
  }

  function mySeat() {
    if (myActorId && seats[myActorId] !== undefined) return seats[myActorId];
    return 0;
  }

  function viewSeat(which) {
    // which: me | left | right relative to my seat
    var me = mySeat();
    if (which === 'me') return me;
    if (which === 'left') return (me + 1) % N;
    return (me + 2) % N;
  }

  function actorAtSeat(seat) {
    var keys = Object.keys(seats);
    for (var i = 0; i < keys.length; i++) {
      if (seats[keys[i]] === seat) return keys[i];
    }
    return '座位' + seat;
  }

  function shortName(actor) {
    if (!actor) return '?';
    var s = String(actor);
    if (s.indexOf('/') >= 0) s = s.split('/').pop();
    if (s.indexOf(':') >= 0) s = s.split(':').pop();
    return s.length > 16 ? s.slice(0, 14) + '…' : s;
  }

  function roleLabel(seat) {
    if (!game || game.landlord === null) return '';
    return seat === game.landlord ? '地主' : '农民';
  }

  function calculateSettlement(state) {
    var base = Math.max(1, Number(state.bidScore || 1));
    var multiplier = Math.max(1, Number(state.multiplier || 1));
    var stake = base * multiplier;
    var deltas = [0, 0, 0];
    var landlord = state.landlord == null ? state.winner : state.landlord;
    if (state.winningSide === 'landlord') {
      deltas[landlord] = stake * 2;
      for (var i = 0; i < N; i++) if (i !== landlord) deltas[i] = -stake;
    } else {
      deltas[landlord] = -stake * 2;
      for (var j = 0; j < N; j++) if (j !== landlord) deltas[j] = stake;
    }
    return {
      base: base,
      multiplier: multiplier,
      stake: stake,
      deltas: deltas
    };
  }

  function ensureSettlement() {
    if (!game || game.phase !== 'finished') return null;
    if (game.settlement) return game.settlement;
    game.settlement = calculateSettlement(game);
    for (var i = 0; i < N; i++) sessionScores[i] += game.settlement.deltas[i];
    return game.settlement;
  }

  function updateLobbyUI() {
    var box = $('ddz-seats');
    if (!box) return;
    box.textContent = '';
    for (var seat = 0; seat < N; seat++) {
      var actor = null;
      Object.keys(seats).forEach(function (a) { if (seats[a] === seat) actor = a; });
      var isReady = !!(actor && readyMap[actor]);
      var isSeatHost = !!(actor && actor === hostActor);
      var isMe = !!(actor && actor === myActorId);
      var div = document.createElement('div');
      div.className = 'ddz-seat-card'
        + (actor ? '' : ' empty')
        + (isReady ? ' ready' : '')
        + (isSeatHost ? ' host' : '')
        + (isMe ? ' me' : '');
      div.setAttribute('role', 'listitem');
      var title = actor ? shortName(actor) : '空位';

      var line1 = document.createElement('div');
      line1.className = 'ddz-seat-card-title';
      var strong = document.createElement('strong');
      strong.textContent = '座位 ' + (seat + 1);
      line1.appendChild(strong);
      if (isSeatHost) {
        var hostPill = document.createElement('span');
        hostPill.className = 'ddz-pill ddz-pill-host';
        hostPill.textContent = '房主';
        line1.appendChild(hostPill);
      }

      var line2 = document.createElement('div');
      line2.className = 'ddz-seat-card-name';
      line2.textContent = title + (isMe ? '（我）' : '');

      var line3 = document.createElement('div');
      line3.className = 'ddz-seat-card-sub';
      if (!actor) {
        line3.textContent = '等待加入';
      } else {
        var readyPill = document.createElement('span');
        readyPill.className = 'ddz-pill ' + (isReady ? 'ddz-pill-ready' : 'ddz-pill-wait');
        readyPill.textContent = isReady ? '已准备' : '未准备';
        line3.appendChild(readyPill);
      }

      div.appendChild(line1);
      div.appendChild(line2);
      div.appendChild(line3);
      box.appendChild(div);
    }
    var inRoom = !!roomId;
    var readyBtn = $('ddz-ready');
    if (readyBtn) {
      readyBtn.disabled = !inRoom || mode === 'solo';
      setText(readyBtn, readyMap[myActorId] ? '取消准备' : '准备');
    }
    $('ddz-start').disabled = !inRoom || !isHost || !canStartMatch(seats, readyMap);
    $('ddz-leave').disabled = !inRoom && mode !== 'solo';
    $('ddz-invite').disabled = !inRoom || !isHost;
    setText($('ddz-room-label'), roomId ? ('房间 ' + roomId) : '');
    setText($('ddz-phase'), mode === 'solo' ? '单机' : (game ? phaseLabel(game.phase) : '大厅'));
    show($('ddz-bid-chip'), false);
    var root = document.querySelector('.ddz-root');
    if (root) root.setAttribute('data-phase', game ? game.phase : 'lobby');
  }

  function phaseLabel(p) {
    return ({ lobby: '大厅', auction: '叫分', playing: '出牌', finished: '结束' })[p] || p;
  }

  function renderSeatAction(view, seat) {
    var wrap = $('ddz-action-' + view);
    var labelEl = $('ddz-action-label-' + view);
    var cardsEl = view === 'me' ? $('ddz-local-me') : $('ddz-local-' + view);
    var action = seatActions[seat];
    if (wrap) {
      wrap.classList.remove('is-bid', 'is-bid-pass', 'is-play', 'is-pass');
      if (action && action.kind) wrap.classList.add('is-' + action.kind);
    }
    if (!labelEl) return;
    if (!action) {
      setText(labelEl, '');
      if (cardsEl) cardsEl.textContent = '';
      return;
    }
    setText(labelEl, action.label || '');
    if (cardsEl) {
      if ((view === 'left' || view === 'right') && action.kind === 'play') {
        cardsEl.textContent = '';
      } else if (action.cards && action.cards.length) {
        renderCards(cardsEl, action.cards, { mini: true });
      } else {
        cardsEl.textContent = '';
      }
    }
  }

  function setAlarm(view, count) {
    var el = $('ddz-alarm-' + view);
    if (!el) return;
    var on = shouldAlarmCount(count) && game && (game.phase === 'playing' || game.phase === 'finished');
    show(el, on);
    if (on) {
      setText(el, count === 1 ? '报牌 · 1' : '报牌 · 2');
      el.classList.toggle('is-critical', count === 1);
    }
  }

  function updateTableUI() {
    if (!game) return;
    sanitizePrivateHands();
    show($('ddz-lobby'), false);
    show($('ddz-table'), true);
    setText($('ddz-phase'), phaseLabel(game.phase));

    var me = mySeat();
    var left = viewSeat('left');
    var right = viewSeat('right');
    var myTurn = game.turn === me;

    var root = document.querySelector('.ddz-root');
    if (root) root.setAttribute('data-phase', game.phase);

    setText($('ddz-name-me'), shortName(actorAtSeat(me)) + '（我）');
    setText($('ddz-name-left'), shortName(actorAtSeat(left)));
    setText($('ddz-name-right'), shortName(actorAtSeat(right)));
    setText($('ddz-count-me'), game.hands[me].length);
    setText($('ddz-count-left'), game.hands[left].length);
    setText($('ddz-count-right'), game.hands[right].length);
    setRoleBadge($('ddz-role-me'), me);
    setRoleBadge($('ddz-role-left'), left);
    setRoleBadge($('ddz-role-right'), right);

    setText($('ddz-avatar-me'), initialOf(shortName(actorAtSeat(me))));
    setText($('ddz-avatar-left'), initialOf(shortName(actorAtSeat(left))));
    setText($('ddz-avatar-right'), initialOf(shortName(actorAtSeat(right))));

    // 报牌 at 1–2 residual cards
    setAlarm('me', game.hands[me].length);
    setAlarm('left', game.hands[left].length);
    setAlarm('right', game.hands[right].length);

    var seatMe = document.querySelector('.ddz-me');
    var seatLeft = document.querySelector('.ddz-seat-left');
    var seatRight = document.querySelector('.ddz-seat-right');
    if (seatMe) seatMe.classList.toggle('is-turn', game.phase !== 'finished' && game.turn === me);
    if (seatLeft) seatLeft.classList.toggle('is-turn', game.phase !== 'finished' && game.turn === left);
    if (seatRight) seatRight.classList.toggle('is-turn', game.phase !== 'finished' && game.turn === right);
    if (seatMe) seatMe.classList.toggle('is-alarm', shouldAlarmCount(game.hands[me].length) && game.phase === 'playing');
    if (seatLeft) seatLeft.classList.toggle('is-alarm', shouldAlarmCount(game.hands[left].length) && game.phase === 'playing');
    if (seatRight) seatRight.classList.toggle('is-alarm', shouldAlarmCount(game.hands[right].length) && game.phase === 'playing');

    // Bid score: always visible after any bid; roles stay after landlord set
    var inAuction = game.phase === 'auction';
    show($('ddz-auction-score'), inAuction || game.bidScore > 0);
    show($('ddz-bid-chip'), inAuction || game.bidScore > 0);
    setText($('ddz-bid-score'), game.bidScore);
    setText($('ddz-bid-chip'), '叫分 ' + (game.bidScore || 0));
    setText($('ddz-stat-turn'), game.phase === 'finished' ? '已结束' : shortName(actorAtSeat(game.turn)));
    setText($('ddz-stat-landlord'), game.landlord === null ? '未确定' : shortName(actorAtSeat(game.landlord)));
    setText($('ddz-stat-hand'), game.hands[me].length);

    // Bottom cards: hidden (backs) during auction until landlord is set
    var showBottomFaces = game.landlord !== null || game.phase === 'playing' || game.phase === 'finished';
    setText($('ddz-stat-bottom'), showBottomFaces ? '已公开' : '未公开');
    var bottomCards = showBottomFaces
      ? game.bottom
      : game.bottom.map(function (_, i) { return { id: 'bottom-back-' + i, suit: 'S', rank: '3' }; });
    renderCards($('ddz-bottom'), bottomCards, {
      backs: !showBottomFaces,
      mini: true
    });

    // Center last play + meta
    var lastMeta = $('ddz-last-meta');
    if (game.lastCombo && game.lastCombo.cards && game.lastCombo.cards.length) {
      renderCards($('ddz-last'), game.lastCombo.cards, { mini: true });
      var who = lastPlaySeat != null ? shortName(actorAtSeat(lastPlaySeat)) : '';
      var comboName = comboTypeLabel(game.lastCombo);
      setText(lastMeta, (comboName ? comboName : '') + (who ? ' · ' + who : ''));
    } else {
      if ($('ddz-last')) $('ddz-last').textContent = '';
      setText(lastMeta, game.phase === 'playing' ? '自由出牌' : (game.phase === 'auction' ? '叫分中' : ''));
    }

    // Per-seat last auction / play / pass for current situational memory
    renderSeatAction('me', me);
    renderSeatAction('left', left);
    renderSeatAction('right', right);

    // Opponent residual count visual (card backs, capped)
    var leftBacks = Math.min(10, game.hands[left].length);
    var rightBacks = Math.min(10, game.hands[right].length);
    var leftBackCards = [];
    var rightBackCards = [];
    for (var bi = 0; bi < leftBacks; bi++) leftBackCards.push({ id: 'bl' + bi, suit: 'S', rank: '3' });
    for (var bj = 0; bj < rightBacks; bj++) rightBackCards.push({ id: 'br' + bj, suit: 'S', rank: '3' });
    renderCards($('ddz-played-left'), leftBackCards, { backs: true });
    renderCards($('ddz-played-right'), rightBackCards, { backs: true });

    var canSelect = game.phase === 'playing' && myTurn;
    renderCards($('ddz-hand'), game.hands[me], {
      selectable: canSelect,
      selectedIds: selected,
      onToggle: function (card) {
        if (selected[card.id]) delete selected[card.id];
        else selected[card.id] = true;
        hintKey = null; // manual pick resets hint cycle anchor
        updateTableUI();
      }
    });

    // Phase / turn gated controls
    show($('ddz-auction-btns'), game.phase === 'auction' && myTurn);
    show($('ddz-play-btns'), game.phase === 'playing' && myTurn);
    show($('ddz-end-btns'), game.phase === 'finished');

    Array.prototype.forEach.call(document.querySelectorAll('[data-bid]'), function (btn) {
      var score = Number(btn.getAttribute('data-bid'));
      btn.disabled = !(game.phase === 'auction' && myTurn && score > game.bidScore);
    });
    var passBtn = $('ddz-pass');
    var canPass = game.phase === 'playing' && myTurn && !!game.lastCombo;
    if (passBtn) passBtn.disabled = !canPass;

    var playBtn = $('ddz-play');
    if (playBtn) playBtn.disabled = !(game.phase === 'playing' && myTurn);

    var hintBtn = $('ddz-hint');
    if (hintBtn) {
      hintBtn.disabled = !(game.phase === 'playing' && myTurn);
      var legalN = (game.phase === 'playing' && myTurn)
        ? enumerateLegalPlays(game.hands[me], game.lastCombo).length
        : 0;
      hintBtn.classList.toggle('is-empty', game.phase === 'playing' && myTurn && legalN === 0);
      setText(hintBtn, legalN === 0 && myTurn && game.phase === 'playing'
        ? (canPass ? '提示（可过）' : '提示')
        : '提示');
    }

    var turnText = '';
    if (game.phase === 'auction') {
      turnText = myTurn
        ? ('轮到你叫分 · 当前 ' + game.bidScore + ' 分')
        : ('等待 ' + shortName(actorAtSeat(game.turn)) + ' 叫分 · 当前 ' + game.bidScore + ' 分');
    } else if (game.phase === 'playing') {
      turnText = myTurn
        ? (game.lastCombo ? ('请压牌或过牌 · ' + comboTypeLabel(game.lastCombo)) : '请出牌（首家）')
        : ('等待 ' + shortName(actorAtSeat(game.turn)) + ' 出牌');
    } else if (game.phase === 'finished') {
      var settlement = ensureSettlement();
      var wname = shortName(actorAtSeat(game.winner));
      var side = game.winningSide === 'landlord' ? '地主胜' : '农民胜';
      turnText = side + ' · ' + wname + ' 出完';
      var summary = $('ddz-end-summary');
      if (summary) {
        summary.textContent = '';
        var main = document.createElement('div');
        main.textContent = '本局结束 · ' + wname + ' 获胜';
        var sub = document.createElement('span');
        sub.className = 'ddz-end-side';
        sub.textContent = side + ' · 座位 ' + ((game.winner != null ? game.winner : 0) + 1)
          + (game.bidScore ? ' · 叫分 ' + game.bidScore : '')
          + (settlement ? (' · 倍数 x' + settlement.multiplier) : '');
        var score = document.createElement('span');
        score.className = 'ddz-end-side';
        score.textContent = settlement
          ? ('本局 ' + settlement.deltas.map(function (delta, seat) {
              return shortName(actorAtSeat(seat)) + ' ' + (delta >= 0 ? '+' : '') + delta;
            }).join(' / '))
          : '';
        var total = document.createElement('span');
        total.className = 'ddz-end-side';
        total.textContent = '累计 ' + sessionScores.map(function (scoreValue, seat) {
          return shortName(actorAtSeat(seat)) + ' ' + (scoreValue >= 0 ? '+' : '') + scoreValue;
        }).join(' / ');
        summary.appendChild(main);
        summary.appendChild(sub);
        if (score.textContent) summary.appendChild(score);
        summary.appendChild(total);
      }
    }
    setText($('ddz-turn-hint'), turnText);
    setText($('ddz-room-label'), roomId ? (mode === 'solo' ? '单机' : ('房间 ' + roomId)) : '');
    syncTurnTimer();
  }

  function showLobby() {
    show($('ddz-lobby'), true);
    show($('ddz-table'), false);
    updateLobbyUI();
  }

  // ─── Protocol: host-owned seq + peer intents ────────────────
  // Only the host assigns global seq on canonical messages and rebroadcasts.
  // Peers send { type:'intent', actorId, clientNonce, action } — never own lastSeq.
  var seenNonces = {};

  function makeNonce() {
    return 'n-' + myActorId + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  function seatActorLocal(actorId) {
    if (seats[actorId] !== undefined) return true;
    var used = {};
    Object.keys(seats).forEach(function (a) { used[seats[a]] = true; });
    for (var i = 0; i < N; i++) {
      if (!used[i]) {
        seats[actorId] = i;
        return true;
      }
    }
    return false;
  }

  async function sendWire(payload) {
    if (mode === 'solo') return;
    if (!roomId || !Tapp.federation) return;
    try {
      await Tapp.federation.sendRoomMessage(roomId, {
        message_type: MSG_TYPE,
        payload: payload
      });
    } catch (e) {
      tableMsg('发送失败: ' + (e && e.message ? e.message : e));
    }
  }

  /**
   * Host (or solo) assigns the next global seq, applies locally, then broadcasts.
   * Callers must NOT pre-assign seq — assignment is atomic with apply so consecutive
   * hostEmit calls get contiguous numbers.
   */
  async function hostEmit(partial) {
    var msg = {};
    for (var k in partial) {
      if (k !== 'seq') msg[k] = partial[k];
    }
    msg.seq = (lastSeq || 0) + 1;
    applyCanonical(msg);
    if (mode === 'solo') return;
    await sendWire(msg);
  }

  /** Peer (or host acting as player) submits an intent; host turns it into canonical msgs. */
  async function submitIntent(action) {
    var intent = {
      type: 'intent',
      actorId: myActorId,
      clientNonce: makeNonce(),
      action: action
    };
    if (mode === 'solo' || isHost) {
      await hostHandleIntent(intent);
      return;
    }
    // Peer: do not apply optimistically with a private seq — wait for host rebroadcast
    await sendWire(intent);
  }

  async function hostHandleIntent(intent) {
    if (!isHost && mode !== 'solo') return;
    if (!intent || intent.type !== 'intent') return;
    if (seenNonces[intent.clientNonce]) return;
    seenNonces[intent.clientNonce] = true;

    var action = intent.action;
    if (action.kind === 'join' || action.kind === 'ready') {
      if (!seatActorLocal(intent.actorId)) {
        lobbyMsg('座位已满');
        return;
      }
      if (action.kind === 'ready') {
        readyMap[intent.actorId] = !!action.ready;
      } else if (readyMap[intent.actorId] === undefined) {
        readyMap[intent.actorId] = false;
      }
      await hostEmit({
        type: 'ready',
        actorId: intent.actorId,
        ready: readyMap[intent.actorId] === true
      });
      await hostEmit({
        type: 'lobby_sync',
        seats: seats,
        ready: readyMap,
        hostActor: hostActor || myActorId
      });
      return;
    }

    var seat = seats[intent.actorId];
    if (seat === undefined) {
      tableMsg('未入座');
      return;
    }
    var msg = null;
    if (action.kind === 'bid') {
      msg = { type: 'bid', seat: seat, score: action.score };
    } else if (action.kind === 'bid_pass') {
      msg = { type: 'bid_pass', seat: seat };
    } else if (action.kind === 'play') {
      msg = { type: 'play', seat: seat, cards: action.cards };
    } else if (action.kind === 'pass') {
      msg = { type: 'pass', seat: seat };
    }
    if (msg) await hostEmit(msg);
  }

  function applyCanonical(msg) {
    // Host-sequenced only: drop exact redeliveries, never drop because of peer-local counters
    if (msg.seq > 0 && msg.seq <= lastSeq) {
      return;
    }
    // Contiguous for game actions; allow host reset types to jump
    if (lastSeq > 0 && msg.seq !== lastSeq + 1) {
      if (msg.type !== 'lobby_sync' && msg.type !== 'deal_start' && msg.type !== 'redeal' && msg.type !== 'state_sync') {
        console.warn('[斗地主] seq gap expected', lastSeq + 1, 'got', msg.seq, msg.type);
        return;
      }
    }
    lastSeq = msg.seq;

    if (msg.type === 'lobby_sync') {
      seats = msg.seats || {};
      readyMap = msg.ready || {};
      hostActor = msg.hostActor || hostActor;
      if (!game || game.phase === 'lobby' || game.phase === 'finished') {
        game = null;
      }
      updateLobbyUI();
      return;
    }
    if (msg.type === 'ready') {
      if (seats[msg.actorId] === undefined) {
        seatActorLocal(msg.actorId);
      }
      readyMap[msg.actorId] = msg.ready;
      updateLobbyUI();
      return;
    }
    if (msg.type === 'deal_start' || msg.type === 'redeal') {
      seats = msg.seats || seats;
      if (msg.hostActor) hostActor = msg.hostActor;
      game = {
        phase: 'auction',
        seed: msg.seed,
        hands: msg.hands,
        bottom: msg.bottom,
        landlord: null,
        bidScore: 0,
        bidWinner: null,
        turn: msg.auctionStart || 0,
        trickLeader: null,
        lastCombo: null,
        passCount: 0,
        auctionStart: msg.auctionStart || 0,
        auctionActions: 0,
        multiplier: 1,
        winner: null,
        winningSide: null
      };
      selected = {};
      lastPlaySeat = null;
      seatActions = [null, null, null];
      hintKey = null;
      mode = mode === 'solo' ? 'solo' : 'multi';
      tableMsg('');
      updateLobbyUI();
      updateTableUI();
      scheduleBots();
      return;
    }
    if (!game) return;
    if (msg.type === 'bid') {
      var br = applyBid(game, { kind: 'bid', seat: msg.seat, score: msg.score });
      if (br.ok) {
        game = br.state;
        seatActions[msg.seat] = { kind: 'bid', label: '叫 ' + msg.score + ' 分', cards: null };
        tableMsg('');
        if (br.redeal) hostRedeal();
        if (game.phase === 'playing') seatActions = [null, null, null];
      } else tableMsg(br.error || '叫分失败');
    } else if (msg.type === 'bid_pass') {
      var pr = applyBid(game, { kind: 'pass', seat: msg.seat });
      if (pr.ok) {
        game = pr.state;
        seatActions[msg.seat] = { kind: 'bid_pass', label: '不叫', cards: null };
        if (pr.redeal) hostRedeal();
        if (game.phase === 'playing') seatActions = [null, null, null];
      } else tableMsg(pr.error || '操作失败');
    } else if (msg.type === 'play') {
      var pl = applyTrustedRemotePlay(game, { kind: 'play', seat: msg.seat, cards: msg.cards }, mySeat());
      if (pl.ok) {
        game = pl.state;
        lastPlaySeat = msg.seat;
        var playedCombo = identifyCombo(msg.cards);
        seatActions[msg.seat] = {
          kind: 'play',
          label: comboTypeLabel(playedCombo) || '出牌',
          cards: msg.cards
        };
        tableMsg('');
        hintKey = null;
      } else tableMsg(pl.error || '出牌失败');
      selected = {};
    } else if (msg.type === 'pass') {
      var prevLast = game.lastCombo;
      var pa = applyPlay(game, { kind: 'pass', seat: msg.seat });
      if (pa.ok) {
        game = pa.state;
        seatActions[msg.seat] = { kind: 'pass', label: '不要', cards: null };
        if (prevLast && !game.lastCombo) {
          lastPlaySeat = null;
          seatActions = [null, null, null];
        }
        tableMsg('');
        hintKey = null;
      } else tableMsg(pa.error || '过牌失败');
    }
    updateTableUI();
    scheduleBots();
  }

  function hostRedeal() {
    if (!isHost && mode !== 'solo') return;
    tableMsg('无人叫分，重新发牌…');
    var seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    var d = deal(seed);
    var msg = {
      type: 'redeal',
      seed: seed,
      auctionStart: (game && game.auctionStart != null ? (game.auctionStart + 1) % N : 0),
      hands: d.hands,
      bottom: d.bottom,
      seats: seats,
      hostActor: hostActor
    };
    setTimeout(function () { hostEmit(msg); }, 400);
  }

  // ─── Solo bot strategy ──────────────────────────────────────
  function isBot(seat) {
    if (mode !== 'solo') return false;
    return seat !== mySeat();
  }

  function botComboOf(cards) {
    return identifyCombo(cards) || { type: 'invalid', mainValue: 0, length: 0, cards: cards || [] };
  }

  function botIsPowerCombo(combo) {
    return combo && (combo.type === 'bomb' || combo.type === 'rocket');
  }

  function botCountHandRanks(hand) {
    var by = countByRank(hand);
    var ranks = Object.keys(by).map(Number).sort(function (a, b) { return a - b; });
    var stats = {
      ranks: ranks,
      bombs: 0,
      triples: 0,
      pairs: 0,
      singles: 0,
      highSingles: 0,
      hasSmallJoker: false,
      hasBigJoker: false,
      rocket: false
    };
    for (var i = 0; i < ranks.length; i++) {
      var group = by[ranks[i]];
      if (group.length === 4) stats.bombs += 1;
      if (group.length >= 3) stats.triples += 1;
      if (group.length >= 2) stats.pairs += 1;
      if (group.length === 1) stats.singles += 1;
      if (ranks[i] >= 14 && group.length === 1) stats.highSingles += 1;
    }
    for (var j = 0; j < hand.length; j++) {
      if (hand[j].rank === 'SJ') stats.hasSmallJoker = true;
      if (hand[j].rank === 'BJ') stats.hasBigJoker = true;
    }
    stats.rocket = stats.hasSmallJoker && stats.hasBigJoker;
    return stats;
  }

  function botHandStrength(hand) {
    var stats = botCountHandRanks(hand);
    var score = 0;
    score += stats.bombs * 18;
    score += stats.rocket ? 26 : 0;
    score += stats.triples * 5;
    score += stats.pairs * 2.2;
    score -= Math.max(0, stats.singles - 4) * 2.5;
    for (var i = 0; i < hand.length; i++) {
      var v = rankValue(hand[i].rank);
      if (v >= 17) score += 10;
      else if (v === 16) score += 8;
      else if (v === 15) score += 5;
      else if (v === 14) score += 3;
      else if (v >= 12) score += 1;
    }
    return score;
  }

  function botPickBid(state, seat) {
    var score = botHandStrength(state.hands[seat]);
    var wanted = 0;
    if (score >= 68) wanted = 3;
    else if (score >= 52) wanted = 2;
    else if (score >= 38) wanted = 1;
    if (wanted === 0 && state.bidWinner === null && state.auctionActions >= N - 1) wanted = 1;
    if (wanted > state.bidScore) return { kind: 'bid', score: wanted };
    return { kind: 'pass' };
  }

  function botIsTeammate(seat, other, landlord) {
    return landlord !== null && seat !== landlord && other !== landlord;
  }

  function farmerPartnerSeat(seat, landlord) {
    if (landlord === null || seat === landlord) return null;
    for (var i = 0; i < N; i++) {
      if (i !== seat && i !== landlord) return i;
    }
    return null;
  }

  function botLowestOpponentCount(state, seat) {
    var min = 99;
    for (var i = 0; i < N; i++) {
      if (i === seat) continue;
      if (botIsTeammate(seat, i, state.landlord)) continue;
      min = Math.min(min, state.hands[i].length);
    }
    return min === 99 ? 0 : min;
  }

  function botMoveScore(state, seat, play, isLead) {
    var combo = botComboOf(play.cards);
    var remaining = state.hands[seat].length - play.cards.length;
    var score = 0;
    if (remaining === 0) score += 10000;
    if (isLead) {
      var leadWeights = {
        airplane_pairs: 180,
        airplane_singles: 165,
        airplane: 155,
        straight: 135,
        pair_seq: 128,
        triple_two: 110,
        triple_one: 95,
        triple: 80,
        four_two_pairs: 75,
        four_two_singles: 68,
        pair: 42,
        single: 20,
        bomb: 5,
        rocket: 0
      };
      score += leadWeights[combo.type] || 0;
      score += play.cards.length * 11;
      score -= combo.mainValue * 0.55;
      if (botIsPowerCombo(combo) && remaining > 0) score -= 220;
      if (combo.type === 'single' && combo.mainValue >= 15 && remaining > 0) score -= 90;
      if (combo.type === 'pair' && combo.mainValue >= 15 && remaining > 0) score -= 60;
    } else {
      score += 220 - combo.mainValue * 4;
      score -= play.cards.length * 2;
      if (botIsPowerCombo(combo)) score -= 260;
      if (botLowestOpponentCount(state, seat) <= 2) score += 130;
      if (remaining <= 2) score += 70;
    }
    return score;
  }

  function botCanFinish(hand, table) {
    var whole = identifyCombo(hand);
    if (whole && canBeat(whole, table)) return hand.slice();
    var plays = enumerateLegalPlays(hand, table);
    for (var i = 0; i < plays.length; i++) {
      if (plays[i].length === hand.length) return plays[i];
    }
    return null;
  }

  function botPickBestLead(state, seat) {
    var hand = state.hands[seat];
    var finish = botCanFinish(hand, null);
    if (finish) return finish;
    var plays = enumerateLegalPlays(hand, null).map(function (cards) {
      return { cards: cards, combo: botComboOf(cards) };
    });
    var filtered = plays.filter(function (p) {
      return !botIsPowerCombo(p.combo) || p.cards.length === hand.length;
    });
    if (!filtered.length) filtered = plays;
    filtered.sort(function (a, b) {
      var sa = botMoveScore(state, seat, a, true);
      var sb = botMoveScore(state, seat, b, true);
      if (sa !== sb) return sb - sa;
      return playKey(a.cards).localeCompare(playKey(b.cards));
    });
    return filtered.length ? filtered[0].cards : null;
  }

  function botPickBestResponse(state, seat) {
    var hand = state.hands[seat];
    var finish = botCanFinish(hand, state.lastCombo);
    if (finish) return finish;
    var plays = enumerateLegalPlays(hand, state.lastCombo).map(function (cards) {
      return { cards: cards, combo: botComboOf(cards) };
    });
    if (!plays.length) return null;
    var lastSeat = lastPlaySeat;
    if (lastSeat !== null && botIsTeammate(seat, lastSeat, state.landlord) && botLowestOpponentCount(state, seat) > 2) {
      return null;
    }
    var pressure = botLowestOpponentCount(state, seat) <= 2;
    var nonPower = plays.filter(function (p) { return !botIsPowerCombo(p.combo); });
    var pool = (nonPower.length && !pressure) ? nonPower : plays;
    pool.sort(function (a, b) {
      var sa = botMoveScore(state, seat, a, false);
      var sb = botMoveScore(state, seat, b, false);
      if (sa !== sb) return sb - sa;
      return playKey(a.cards).localeCompare(playKey(b.cards));
    });
    return pool[0].cards;
  }

  function botPickPlay(state, seat) {
    var cards = state.lastCombo ? botPickBestResponse(state, seat) : botPickBestLead(state, seat);
    return cards && cards.length ? { kind: 'play', cards: cards } : { kind: 'pass' };
  }

  function isTruthySetting(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  async function loadAiSettings() {
    aiOpponentEnabled = false;
    try {
      if (typeof Tapp === 'undefined' || !Tapp.settings || typeof Tapp.settings.get !== 'function') return;
      aiOpponentEnabled = isTruthySetting(await Tapp.settings.get('aiOpponentEnabled'));
    } catch (e) {
      aiOpponentEnabled = false;
    }
  }

  function tappAiAvailable() {
    return typeof Tapp !== 'undefined'
      && Tapp.ai
      && Tapp.ai.tasks
      && typeof Tapp.ai.tasks.create === 'function';
  }

  function setAiOpponentStatus(text) {
    if (mode !== 'solo' || !aiOpponentEnabled) return;
    status(text || '单机练习 · AI 对手');
  }

  function cardSummary(card) {
    return {
      id: card.id,
      rank: card.rank,
      suit: card.suit,
      value: rankValue(card.rank),
      label: cardLabel(card)
    };
  }

  function comboSummary(cards) {
    var combo = identifyCombo(cards);
    if (!combo) return { type: 'invalid', label: '非法', count: cards ? cards.length : 0, mainValue: 0 };
    return {
      type: combo.type,
      label: comboTypeLabel(combo),
      count: cards.length,
      mainValue: combo.mainValue,
      length: combo.length
    };
  }

  function aiDecisionStamp(state, seat) {
    var last = state.lastCombo && state.lastCombo.cards ? playKey(state.lastCombo.cards) : 'lead';
    return [
      state.seed || 'seed',
      state.phase,
      seat,
      state.turn,
      state.auctionActions,
      state.bidScore,
      state.passCount,
      state.hands[seat].map(function (c) { return c.id; }).join(',')
    ].join('-') + '-' + last;
  }

  function candidateActionLabel(candidate) {
    if (candidate.action.kind === 'pass') return '过牌';
    if (candidate.action.kind === 'bid') return '叫 ' + candidate.action.score + ' 分';
    if (candidate.action.kind === 'bid_pass') return '不叫';
    var summary = comboSummary(candidate.action.cards || []);
    return summary.label + ' · ' + (candidate.action.cards || []).map(cardLabel).join(' ');
  }

  function buildBidCandidates(state) {
    var actions = [{ kind: 'bid_pass' }];
    for (var score = state.bidScore + 1; score <= 3; score++) {
      actions.push({ kind: 'bid', score: score });
    }
    return actions.map(function (action, index) {
      return { index: index, action: action, label: action.kind === 'bid' ? ('叫 ' + action.score + ' 分') : '不叫' };
    });
  }

  function buildPlayCandidates(state, seat) {
    var isLead = !state.lastCombo;
    var actions = [];
    var plays = enumerateLegalPlays(state.hands[seat], state.lastCombo).map(function (cards) {
      return { action: { kind: 'play', cards: cards }, score: botMoveScore(state, seat, { cards: cards }, isLead) };
    });
    plays.sort(function (a, b) {
      if (a.score !== b.score) return b.score - a.score;
      return playKey(a.action.cards).localeCompare(playKey(b.action.cards));
    });
    if (!isLead) actions.push({ action: { kind: 'pass' }, score: 0 });
    actions = actions.concat(plays.slice(0, 36));
    return actions.map(function (item, index) {
      return {
        index: index,
        action: item.action,
        label: item.action.kind === 'pass' ? '过牌' : candidateActionLabel(item),
        combo: item.action.kind === 'play' ? comboSummary(item.action.cards) : null,
        score: item.score
      };
    });
  }

  function buildAiPrompt(state, seat, candidates) {
    var landlord = state.landlord;
    var isLandlord = landlord === seat;
    var partner = farmerPartnerSeat(seat, landlord);
    var bottomKnown = state.phase !== 'auction' && landlord !== null;
    var payload = {
      task: '你是斗地主机器人。只从 candidates 里选择一个 index，返回 JSON，不要 Markdown。',
      rules: [
        '只能选择候选动作，不能创造新牌。',
        '如果能直接出完牌，优先出完。',
        '农民要合作；通常不要压队友的牌，除非能马上获胜或阻止地主。',
        '炸弹和王炸是强资源，不到关键压力不要浪费。',
        '返回格式必须是 {"index":数字,"reason":"一句话理由"}。'
      ],
      phase: state.phase,
      seat: seat,
      role: isLandlord ? 'landlord' : 'farmer',
      landlord: landlord,
      farmerPartner: partner,
      bidScore: state.bidScore,
      bidWinner: state.bidWinner,
      auctionActions: state.auctionActions,
      passCount: state.passCount,
      hand: state.hands[seat].map(cardSummary),
      handCounts: state.hands.map(function (h) { return h.length; }),
      bottomKnown: bottomKnown,
      bottom: bottomKnown ? state.bottom.map(cardSummary) : [],
      bottomCount: state.bottom.length,
      multiplier: state.multiplier || 1,
      lastPlaySeat: lastPlaySeat,
      lastCombo: state.lastCombo ? {
        type: state.lastCombo.type,
        label: comboTypeLabel(state.lastCombo),
        mainValue: state.lastCombo.mainValue,
        length: state.lastCombo.length,
        cards: (state.lastCombo.cards || []).map(cardSummary)
      } : null,
      candidates: candidates.map(function (c) {
        return {
          index: c.index,
          label: c.label,
          action: c.action.kind,
          score: c.action.score,
          combo: c.combo,
          cards: c.action.cards ? c.action.cards.map(cardSummary) : []
        };
      })
    };
    return JSON.stringify(payload);
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error('AI decision timeout'));
      }, ms);
      promise.then(function (value) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      }, function (err) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function extractAiPayload(value) {
    if (!value) return null;
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch (e) {
        var m = value.match(/\{[\s\S]*\}/);
        if (!m) return null;
        try { return JSON.parse(m[0]); } catch (e2) { return null; }
      }
    }
    if (typeof value === 'object') {
      if (typeof value.index === 'number') return value;
      if (value.value !== undefined) return extractAiPayload(value.value);
      if (value.result !== undefined) return extractAiPayload(value.result);
      if (value.output !== undefined) return extractAiPayload(value.output);
      if (value.text !== undefined) return extractAiPayload(value.text);
      if (value.message !== undefined) return extractAiPayload(value.message);
    }
    return null;
  }

  async function waitAiTask(task, timeoutMs) {
    if (!task) return null;
    var direct = extractAiPayload(task);
    if (direct) return direct;
    if (!task.taskId || typeof Tapp.ai.tasks.get !== 'function') return null;
    var started = Date.now();
    while (Date.now() - started < timeoutMs) {
      await sleep(350);
      var latest = await Tapp.ai.tasks.get(task.taskId);
      var payload = extractAiPayload(latest);
      if (payload) return payload;
      if (latest && (latest.status === 'failed' || latest.status === 'cancelled' || latest.status === 'canceled')) return null;
    }
    return null;
  }

  async function cancelAiTask(task) {
    if (!task || !task.taskId || !tappAiAvailable() || typeof Tapp.ai.tasks.cancel !== 'function') return;
    try { await Tapp.ai.tasks.cancel(task.taskId); } catch (e) { /* terminal or unavailable */ }
  }

  async function requestAiDecision(state, seat, candidates) {
    if (!aiOpponentEnabled || !tappAiAvailable() || !candidates.length) return null;
    var task = null;
    try {
      setAiOpponentStatus('单机练习 · AI 思考中');
      task = await withTimeout(Tapp.ai.tasks.create({
        version: 2,
        operation: 'chat',
        input: { message: buildAiPrompt(state, seat, candidates) },
        output: {
          format: 'json',
          schema: {
            type: 'object',
            properties: {
              index: { type: 'number' },
              reason: { type: 'string' }
            },
            required: ['index'],
            additionalProperties: false
          }
        },
        delivery: 'result',
        idempotencyKey: 'doudizhu-ai-' + aiDecisionStamp(state, seat)
      }), 6500);
      var result = await withTimeout(waitAiTask(task, 6500), 7000);
      if (!result || typeof result.index !== 'number') {
        await cancelAiTask(task);
        setAiOpponentStatus('单机练习 · AI 回退本地策略');
        return null;
      }
      var index = Math.floor(result.index);
      for (var i = 0; i < candidates.length; i++) {
        if (candidates[i].index === index) {
          setAiOpponentStatus('单机练习 · AI 对手');
          return candidates[i].action;
        }
      }
      setAiOpponentStatus('单机练习 · AI 回退本地策略');
    } catch (e) {
      await cancelAiTask(task);
      setAiOpponentStatus('单机练习 · AI 回退本地策略');
      console.warn('[斗地主] AI opponent fallback', e);
    }
    return null;
  }

  async function botPickBidWithAi(state, seat) {
    var fallback = botPickBid(state, seat);
    var ai = await requestAiDecision(state, seat, buildBidCandidates(state));
    return ai || fallback;
  }

  async function botPickPlayWithAi(state, seat) {
    var fallback = botPickPlay(state, seat);
    var ai = await requestAiDecision(state, seat, buildPlayCandidates(state, seat));
    return ai || fallback;
  }

  function scheduleBots() {
    clearBots();
    if (!game) return;
    if (game.phase === 'finished') return;
    var seat = game.turn;
    if (!isBot(seat)) return;
    var botActor = actorAtSeat(seat);
    var t = setTimeout(async function () {
      if (!game || game.turn !== seat) return;
      if (game.phase === 'auction') {
        var b = await botPickBidWithAi(game, seat);
        if (!game || game.turn !== seat || game.phase !== 'auction') return;
        if (b.kind === 'bid') {
          hostHandleIntent({
            type: 'intent', actorId: botActor, clientNonce: makeNonce(),
            action: { kind: 'bid', score: b.score }
          });
        } else {
          hostHandleIntent({
            type: 'intent', actorId: botActor, clientNonce: makeNonce(),
            action: { kind: 'bid_pass' }
          });
        }
      } else if (game.phase === 'playing') {
        var p = await botPickPlayWithAi(game, seat);
        if (!game || game.turn !== seat || game.phase !== 'playing') return;
        if (p.kind === 'play') {
          hostHandleIntent({
            type: 'intent', actorId: botActor, clientNonce: makeNonce(),
            action: { kind: 'play', cards: p.cards }
          });
        } else {
          hostHandleIntent({
            type: 'intent', actorId: botActor, clientNonce: makeNonce(),
            action: { kind: 'pass' }
          });
        }
      }
    }, 450 + Math.random() * 400);
    botTimers.push(t);
  }

  // ─── Federation lobby ───────────────────────────────────────
  function decodeIncoming(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var messageType = raw.message_type;
    var payload = raw.payload;
    if (raw.data && typeof raw.data === 'object') {
      if (raw.data.message_type !== undefined) {
        messageType = raw.data.message_type;
        payload = raw.data.payload;
      }
    }
    // federation:message event: { scope, roomId, data }
    if (raw.scope === 'room' && raw.data) {
      var d = raw.data;
      messageType = d.message_type || messageType;
      payload = d.payload !== undefined ? d.payload : d;
    }
    if (messageType && messageType !== MSG_TYPE) return null;
    if (!payload || typeof payload !== 'object') return null;
    if (payload.type === 'intent') {
      if (typeof payload.actorId !== 'string' || !payload.action) return null;
      return payload;
    }
    if (!payload.type || typeof payload.seq !== 'number') return null;
    return payload;
  }

  async function ensureIdentity() {
    if (myActorId) return myActorId;
    try {
      if (Tapp.federation && Tapp.federation.getIdentity) {
        var id = await Tapp.federation.getIdentity();
        myActorId = (id && (id.actor_id || id.id || id.actor || id.username)) || ('local-' + Math.random().toString(36).slice(2, 8));
      } else {
        myActorId = 'local-' + Math.random().toString(36).slice(2, 8);
      }
    } catch (e) {
      myActorId = 'local-' + Math.random().toString(36).slice(2, 8);
    }
    return myActorId;
  }

  async function subscribeRoom(id) {
    if (!Tapp.federation || !Tapp.federation.subscribeRoom) return;
    try {
      await Tapp.federation.subscribeRoom(id);
      status('已订阅房间实时事件');
    } catch (e) {
      status('订阅房间失败: ' + (e && e.message ? e.message : e));
    }
  }

  function wireMessageHandler() {
    if (unsubMessage || !Tapp.federation || !Tapp.federation.onMessage) return;
    unsubMessage = Tapp.federation.onMessage(function (evt) {
      try {
        if (evt && evt.scope && evt.scope !== 'room') return;
        if (evt && evt.roomId && roomId && evt.roomId !== roomId) return;
        var msg = decodeIncoming(evt);
        if (!msg) msg = decodeIncoming(evt && evt.data);
        if (!msg) return;
        if (msg.type === 'intent') {
          // Only host turns intents into sequenced canonical messages
          if (isHost || mode === 'solo') {
            hostHandleIntent(msg);
          }
          return;
        }
        // Canonical host-sequenced message — applyCanonical handles redelivery
        applyCanonical(msg);
      } catch (err) {
        console.warn('[斗地主] onMessage', err);
      }
    });
  }

  async function createRoom() {
    await ensureIdentity();
    if (!Tapp.federation || !Tapp.federation.createRoom) {
      lobbyMsg('当前环境无联邦能力（Playground 不可用）。请安装后运行，或使用单机练习。');
      return;
    }
    try {
      var res = await Tapp.federation.createRoom({
        name: '斗地主 ' + shortName(myActorId),
        description: 'Myriad 斗地主联机房',
        max_members: 3,
        invite_policy: 'member-invite',
        governance_type: 'owner'
      });
      roomId = (res && (res.room_id || res.id)) || '';
      if (!roomId) {
        lobbyMsg('创建房间失败：无 room_id');
        return;
      }
      hostActor = myActorId;
      isHost = true;
      seats = {};
      seats[myActorId] = 0;
      readyMap = {};
      readyMap[myActorId] = false;
      mode = 'multi';
      seq = 0;
      lastSeq = 0;
      seenNonces = {};
      await subscribeRoom(roomId);
      wireMessageHandler();
      lobbyMsg('房间已创建。邀请两位好友后准备开始。');
      status('房主 · ' + roomId);
      updateLobbyUI();
      await hostEmit({
        type: 'lobby_sync',
        seats: seats,
        ready: readyMap,
        hostActor: hostActor
      });
    } catch (e) {
      lobbyMsg('创建失败: ' + (e && e.message ? e.message : e));
    }
  }

  async function joinRoom() {
    await ensureIdentity();
    var id = ($('ddz-join-id').value || '').trim();
    if (!id) { lobbyMsg('请输入房间 ID'); return; }
    if (!Tapp.federation) {
      lobbyMsg('无联邦 API');
      return;
    }
    try {
      if (Tapp.federation.acceptRoomInvite) {
        try { await Tapp.federation.acceptRoomInvite(id); } catch (e1) { /* may already be member */ }
      }
      if (Tapp.federation.joinRoom) {
        try { await Tapp.federation.joinRoom(id); } catch (e2) { /* optional */ }
      }
      roomId = id;
      isHost = false;
      mode = 'multi';
      seq = 0;
      lastSeq = 0;
      seenNonces = {};
      await subscribeRoom(roomId);
      wireMessageHandler();
      lobbyMsg('已加入房间，向房主登记入座…');
      status('成员 · ' + roomId);
      updateLobbyUI();
      // Peer announces join via intent — host seats + lobby_sync (no private seq)
      await submitIntent({ kind: 'join' });
    } catch (e) {
      lobbyMsg('加入失败: ' + (e && e.message ? e.message : e));
    }
  }

  async function inviteFriend() {
    var actor = ($('ddz-invite-actor').value || '').trim();
    if (!actor || !roomId) { lobbyMsg('请填写好友并先创建房间'); return; }
    try {
      await Tapp.federation.inviteMember(roomId, { actor: actor, role: 'member' });
      lobbyMsg('已邀请 ' + actor + '（对方加入后会自动入座）');
      // Host may pre-reserve a seat; final seat also happens on join/ready intent
      if (isHost && seats[actor] === undefined) {
        if (seatActorLocal(actor)) {
          readyMap[actor] = false;
          await hostEmit({
            type: 'lobby_sync',
            seats: seats,
            ready: readyMap,
            hostActor: hostActor
          });
        }
      }
      updateLobbyUI();
    } catch (e) {
      lobbyMsg('邀请失败: ' + (e && e.message ? e.message : e));
    }
  }

  async function toggleReady() {
    await ensureIdentity();
    if (!roomId && mode !== 'solo') return;
    var nextReady = !readyMap[myActorId];
    await submitIntent({ kind: 'ready', ready: nextReady });
  }

  async function startMatch() {
    if (!isHost && mode !== 'solo') {
      lobbyMsg('仅房主可开始');
      return;
    }
    var actors = Object.keys(seats);
    if (mode === 'multi') {
      if (actors.length < 3) {
        lobbyMsg('需要 3 名玩家入座');
        return;
      }
      if (!canStartMatch(seats, readyMap)) {
        lobbyMsg('需三人都准备');
        return;
      }
      seats = assignSeats(actors.slice(0, 3));
    }
    var seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    var d = deal(seed);
    await hostEmit({
      type: 'deal_start',
      seed: seed,
      auctionStart: 0,
      seats: seats,
      hostActor: hostActor || myActorId,
      hands: d.hands,
      bottom: d.bottom
    });
  }

  async function startSolo() {
    clearBots();
    await ensureIdentity();
    await loadAiSettings();
    mode = 'solo';
    isHost = true;
    hostActor = myActorId;
    roomId = 'solo-local';
    seats = {};
    seats[myActorId] = 0;
    seats['bot:west'] = 1;
    seats['bot:east'] = 2;
    readyMap = {};
    readyMap[myActorId] = true;
    readyMap['bot:west'] = true;
    readyMap['bot:east'] = true;
    seq = 0;
    lastSeq = 0;
    seenNonces = {};
    lobbyMsg(aiOpponentEnabled ? '单机练习：你 vs 两位 Myriad AI 对手' : '单机练习：你 vs 两位本地对手');
    status(aiOpponentEnabled ? '单机练习 · AI 对手' : '单机练习');
    updateLobbyUI();
    startMatch();
  }

  async function leaveRoom() {
    clearBots();
    clearTurnTimer();
    if (roomId && mode === 'multi' && Tapp.federation && Tapp.federation.leaveRoom) {
      try { await Tapp.federation.leaveRoom(roomId); } catch (e) {}
      try {
        if (Tapp.federation.unsubscribeRoom) await Tapp.federation.unsubscribeRoom(roomId);
      } catch (e2) {}
    }
    roomId = '';
    game = null;
    seats = {};
    readyMap = {};
    isHost = false;
    mode = 'lobby';
    showLobby();
    status('已离开');
    lobbyMsg('');
  }

  function handCountStamp() {
    if (!game || !game.hands) return '';
    return game.hands.map(function (h) { return h.length; }).join(',');
  }

  function makeHiddenCards(count, seat) {
    var cards = [];
    for (var i = 0; i < count; i++) {
      cards.push({ id: 'hidden-' + seat + '-' + i, suit: 'J', rank: 'SJ', hidden: true });
    }
    return cards;
  }

  function hasHiddenCards(hand) {
    return !!(hand && hand.some(function (c) { return c && c.hidden === true; }));
  }

  function sanitizePrivateHands() {
    if (!game || mode !== 'multi' || isHost) return;
    var mine = mySeat();
    for (var seat = 0; seat < N; seat++) {
      if (seat === mine) continue;
      game.hands[seat] = makeHiddenCards(game.hands[seat].length, seat);
    }
  }

  function applyTrustedRemotePlay(state, action, viewerSeat) {
    if (action.seat === viewerSeat || !hasHiddenCards(state.hands[action.seat])) {
      return applyPlay(state, action);
    }
    if (state.phase !== 'playing') return { ok: false, error: 'Not playing', state: state };
    if (action.seat !== state.turn) return { ok: false, error: 'Not your turn', state: state };
    var combo = identifyCombo(action.cards);
    if (!combo) return { ok: false, error: 'Illegal combination', state: state };
    if (!canBeat(combo, state.lastCombo)) return { ok: false, error: 'Cannot beat', state: state };
    var next = JSON.parse(JSON.stringify(state));
    next.hands[action.seat] = next.hands[action.seat].slice(action.cards.length);
    next.lastCombo = combo;
    next.passCount = 0;
    if (combo.type === 'bomb' || combo.type === 'rocket') next.multiplier = (next.multiplier || 1) * 2;
    if (next.trickLeader === null) next.trickLeader = action.seat;
    if (next.hands[action.seat].length === 0) {
      next.phase = 'finished';
      next.winner = action.seat;
      next.winningSide = action.seat === next.landlord ? 'landlord' : 'farmers';
      return { ok: true, state: next };
    }
    next.turn = (action.seat + 1) % N;
    return { ok: true, state: next };
  }

  function currentTurnStamp() {
    if (!game || game.phase === 'finished') return '';
    var comboKey = game.lastCombo && game.lastCombo.cards ? playKey(game.lastCombo.cards) : 'lead';
    return [
      game.phase,
      game.turn,
      game.bidScore,
      comboKey,
      game.passCount,
      game.landlord,
      handCountStamp()
    ].join('|');
  }

  function updateTurnTimerUI() {
    var el = $('ddz-turn-timer');
    if (!el) return;
    if (!game || game.phase === 'finished' || game.phase === 'lobby') {
      show(el, false);
      return;
    }
    show(el, true);
    var remaining = Math.max(0, Math.ceil((turnDeadlineAt - Date.now()) / 1000));
    setText(el, remaining + 's');
    el.classList.toggle('is-warning', remaining <= 10);
    el.classList.toggle('is-critical', remaining <= 5);
  }

  async function autoActCurrentTurn(stamp) {
    if (isAutoActing || !game || currentTurnStamp() !== stamp) return;
    if (!(mode === 'solo' || isHost)) return;
    if (game.phase !== 'auction' && game.phase !== 'playing') return;
    isAutoActing = true;
    try {
      var seat = game.turn;
      var actor = actorAtSeat(seat);
      var action = null;
      if (game.phase === 'auction') {
        action = { kind: 'bid_pass' };
      } else if (game.phase === 'playing') {
        if (game.lastCombo) {
          action = { kind: 'pass' };
        } else {
          var pick = nextHintPlay(game.hands[seat], null, null);
          action = pick ? { kind: 'play', cards: pick.cards } : null;
        }
      }
      if (!action) return;
      await hostHandleIntent({
        type: 'intent',
        actorId: actor,
        clientNonce: 'timeout-' + stamp + '-' + Date.now(),
        action: action
      });
    } finally {
      isAutoActing = false;
    }
  }

  function syncTurnTimer() {
    if (!game || game.phase === 'finished' || game.phase === 'lobby') {
      clearTurnTimer();
      updateTurnTimerUI();
      return;
    }
    var stamp = currentTurnStamp();
    if (stamp && stamp !== turnStamp) {
      turnStamp = stamp;
      turnDeadlineAt = Date.now() + TURN_SECONDS * 1000;
    }
    if (!turnTimer) {
      turnTimer = setInterval(function () {
        updateTurnTimerUI();
        if (turnDeadlineAt > 0 && Date.now() >= turnDeadlineAt) {
          turnDeadlineAt = 0;
          autoActCurrentTurn(turnStamp);
        }
      }, 250);
    }
    updateTurnTimerUI();
  }

  function installStableHandHover() {
    var hovered = null;

    function setHovered(card) {
      if (hovered === card) return;
      if (hovered) hovered.classList.remove('is-hovered');
      hovered = card;
      if (hovered) hovered.classList.add('is-hovered');
    }

    function isInsideStickyCard(card, x, y) {
      if (!card) return false;
      var rect = card.getBoundingClientRect();
      return (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom + 92
      );
    }

    function updateFromPointer(ev) {
      var hand = $('ddz-hand');
      if (!hand) {
        setHovered(null);
        return;
      }
      var handRect = hand.getBoundingClientRect();
      var x = ev.clientX;
      var y = ev.clientY;
      if (
        x < handRect.left ||
        x > handRect.right ||
        y < handRect.top - 84 ||
        y > handRect.bottom + 8
      ) {
        setHovered(null);
        return;
      }

      if (isInsideStickyCard(hovered, x, y)) return;

      var stack = document.elementsFromPoint(x, y);
      var match = null;
      for (var i = 0; i < stack.length; i++) {
        var card = stack[i].closest && stack[i].closest('.ddz-card');
        if (card && hand.contains(card)) {
          match = card;
          break;
        }
      }
      setHovered(match);
    }

    document.addEventListener('pointermove', updateFromPointer, { passive: true });
    document.addEventListener('pointerleave', function () { setHovered(null); });
  }

  // ─── Controls ───────────────────────────────────────────────
  function selectedCards() {
    if (!game) return [];
    var me = mySeat();
    return game.hands[me].filter(function (c) { return selected[c.id]; });
  }

  async function doBid(score) {
    if (!game || game.phase !== 'auction') return;
    var seat = mySeat();
    if (game.turn !== seat) return;
    await submitIntent({ kind: 'bid', score: score });
  }
  async function doBidPass() {
    if (!game || game.phase !== 'auction') return;
    var seat = mySeat();
    if (game.turn !== seat) return;
    await submitIntent({ kind: 'bid_pass' });
  }
  async function doPlay() {
    if (!game || game.phase !== 'playing') return;
    var seat = mySeat();
    if (game.turn !== seat) {
      tableMsg('还没轮到你');
      return;
    }
    var cards = selectedCards();
    if (!cards.length) {
      tableMsg('请先点选手牌，或点「提示」');
      return;
    }
    var combo = identifyCombo(cards);
    if (!combo) {
      tableMsg('不是合法牌型，请重选或点「提示」');
      return;
    }
    if (!canBeat(combo, game.lastCombo)) {
      tableMsg(game.lastCombo
        ? ('压不过 · 当前 ' + comboTypeLabel(game.lastCombo))
        : '出牌不合法');
      return;
    }
    tableMsg('');
    await submitIntent({ kind: 'play', cards: cards });
  }
  async function doPass() {
    if (!game || game.phase !== 'playing') return;
    var seat = mySeat();
    if (game.turn !== seat) {
      tableMsg('还没轮到你');
      return;
    }
    if (!game.lastCombo) {
      tableMsg('首家必须出牌，不能过');
      return;
    }
    tableMsg('');
    await submitIntent({ kind: 'pass' });
  }

  function doHint() {
    if (!game || game.phase !== 'playing') return;
    var seat = mySeat();
    if (game.turn !== seat) {
      tableMsg('还没轮到你');
      return;
    }
    var hand = game.hands[seat];
    var result = nextHintPlay(hand, game.lastCombo, hintKey);
    if (!result) {
      selected = {};
      hintKey = null;
      if (game.lastCombo) {
        tableMsg('没有能压的牌，请点「过牌」');
        var passBtn = $('ddz-pass');
        if (passBtn) {
          passBtn.classList.add('ddz-btn-pulse');
          setTimeout(function () { passBtn.classList.remove('ddz-btn-pulse'); }, 900);
        }
      } else {
        tableMsg('没有可提示的出牌');
      }
      updateTableUI();
      return;
    }
    selected = {};
    for (var i = 0; i < result.cards.length; i++) {
      selected[result.cards[i].id] = true;
    }
    hintKey = result.key;
    tableMsg(
      result.total > 1
        ? ('提示 ' + (result.index + 1) + '/' + result.total + ' · ' + comboTypeLabel(identifyCombo(result.cards)))
        : ('提示 · ' + comboTypeLabel(identifyCombo(result.cards)))
    );
    var msgEl = $('ddz-table-msg');
    if (msgEl) msgEl.classList.remove('is-error');
    updateTableUI();
  }

  // ─── Wire DOM ───────────────────────────────────────────────
  $('ddz-create').addEventListener('click', createRoom);
  $('ddz-join').addEventListener('click', joinRoom);
  $('ddz-invite').addEventListener('click', inviteFriend);
  $('ddz-ready').addEventListener('click', toggleReady);
  $('ddz-start').addEventListener('click', startMatch);
  $('ddz-leave').addEventListener('click', leaveRoom);
  $('ddz-solo').addEventListener('click', startSolo);
  $('ddz-play').addEventListener('click', doPlay);
  $('ddz-pass').addEventListener('click', doPass);
  $('ddz-hint').addEventListener('click', doHint);
  $('ddz-clear').addEventListener('click', function () {
    selected = {};
    hintKey = null;
    tableMsg('');
    updateTableUI();
  });
  $('ddz-bid-pass').addEventListener('click', doBidPass);
  Array.prototype.forEach.call(document.querySelectorAll('[data-bid]'), function (btn) {
    btn.addEventListener('click', function () {
      doBid(Number(btn.getAttribute('data-bid')));
    });
  });
  $('ddz-again').addEventListener('click', function () {
    if (mode === 'solo' || isHost) startMatch();
    else tableMsg('等待房主开下一局');
  });
  $('ddz-to-lobby').addEventListener('click', function () {
    game = null;
    if (mode === 'solo') {
      mode = 'lobby';
      roomId = '';
      seats = {};
      readyMap = {};
    }
    showLobby();
  });
  installStableHandHover();

  Tapp.lifecycle.onDestroy(function () {
    clearBots();
    clearTurnTimer();
    if (roomId && mode === 'multi' && Tapp.federation && Tapp.federation.unsubscribeRoom) {
      try { Tapp.federation.unsubscribeRoom(roomId); } catch (e) {}
    }
  });

  function applyThemeClass(theme) {
    try {
      var dark = theme === 'dark' || theme === 'Dark' || theme === true;
      var roots = [document.documentElement, document.body, document.querySelector('.ddz-root')];
      for (var i = 0; i < roots.length; i++) {
        if (!roots[i]) continue;
        roots[i].classList.toggle('dark', !!dark);
      }
    } catch (e) { /* theme optional */ }
  }

  Tapp.lifecycle.onReady(async function () {
    await ensureIdentity();
    await loadAiSettings();
    // Load commercial texture pack before first paint of table chrome
    try {
      await loadTextures();
    } catch (texErr) {
      console.warn('[斗地主] texture load', texErr);
      // still apply relative-path fallbacks
      try {
        var keys = Object.keys(TEXTURE_MAP);
        for (var ti = 0; ti < keys.length; ti++) textureUrls[keys[ti]] = TEXTURE_MAP[keys[ti]];
        applyTextureCssVars(textureApplyTargets());
      } catch (e2) { /* ignore */ }
    }
    wireMessageHandler();
    showLobby();
    status('身份: ' + shortName(myActorId));
    var hasFed = Tapp.federation && typeof Tapp.federation.createRoom === 'function';
    if (!hasFed) {
      lobbyMsg('联邦 API 不可用时仍可「单机练习」。安装运行并授予 federation 权限后可联机。');
    }
    // Product theme: follow host light/dark when available
    try {
      if (Tapp.ui && typeof Tapp.ui.onThemeChange === 'function') {
        Tapp.ui.onThemeChange(function (theme) { applyThemeClass(theme); });
      } else if (Tapp.ui && typeof Tapp.ui.getTheme === 'function') {
        var t = Tapp.ui.getTheme();
        if (t && typeof t.then === 'function') t.then(applyThemeClass);
        else applyThemeClass(t);
      } else if (window.matchMedia) {
        var mq = window.matchMedia('(prefers-color-scheme: dark)');
        applyThemeClass(mq.matches ? 'dark' : 'light');
        if (mq.addEventListener) mq.addEventListener('change', function (ev) {
          applyThemeClass(ev.matches ? 'dark' : 'light');
        });
      }
    } catch (themeErr) { /* ignore */ }
  });
})();
