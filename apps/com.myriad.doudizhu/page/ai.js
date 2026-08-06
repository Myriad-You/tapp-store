(function (root) {
  'use strict';
  const DDZ = root.DDZ = root.DDZ || {};

  function counts(hand) {
    const result = new Map();
    hand.forEach(function (card) { result.set(card.value, (result.get(card.value) || 0) + 1); });
    return result;
  }

  function breaksStructure(hand, play) {
    const before = counts(hand);
    const chosen = new Set(play.map(function (card) { return card.id; }));
    const after = counts(hand.filter(function (card) { return !chosen.has(card.id); }));
    let penalty = 0;
    new Set(play.map(function (card) { return card.value; })).forEach(function (value) {
      const original = before.get(value) || 0;
      const remaining = after.get(value) || 0;
      if (original === 4 && remaining > 0) penalty += 42;
      else if (original === 3 && remaining > 0) penalty += 12;
      else if (original === 2 && remaining > 0) penalty += 7;
    });
    return penalty;
  }

  function approximateTurns(hand) {
    if (!hand.length) return 0;
    const candidates = DDZ.rules.allValidPlays(hand, null).slice(0, 180);
    let best = hand.length;
    candidates.forEach(function (first) {
      const ids = new Set(first.map(function (card) { return card.id; }));
      const rest = hand.filter(function (card) { return !ids.has(card.id); });
      if (!rest.length) best = 1;
      else {
        const second = DDZ.rules.allValidPlays(rest, null).slice(0, 80).reduce(function (max, play) { return Math.max(max, play.length); }, 1);
        best = Math.min(best, 2 + Math.ceil(Math.max(0, rest.length - second) / 3));
      }
    });
    return best;
  }

  function scorePlay(state, playerIndex, play, difficulty) {
    const player = state.players[playerIndex];
    const selected = new Set(play.map(function (card) { return card.id; }));
    const remaining = player.hand.filter(function (card) { return !selected.has(card.id); });
    const pattern = DDZ.rules.detect(play);
    const bomb = pattern.type === 'bomb' || pattern.type === 'rocket';
    const next = state.players[(playerIndex + 1) % 3];
    const opponents = state.players.filter(function (_, index) { return index !== playerIndex && state.players[index].role !== player.role; });
    let score = play.length * 8 - pattern.mainValue - breaksStructure(player.hand, play) - (bomb ? 95 : 0);
    if (!remaining.length) score += 10000;
    if (remaining.length <= 2) score += 120;
    if (difficulty === 'hard') {
      score -= approximateTurns(remaining) * 16;
      if (next.role !== player.role && next.hand.length === 1 && pattern.type === 'single') score += pattern.mainValue * 7;
      if (next.role !== player.role && next.hand.length === 2 && pattern.type === 'pair') score += pattern.mainValue * 6;
      if (player.role === 'farmer' && state.leadPlay) {
        const leader = state.players[state.leadPlay.playerIndex];
        if (leader.role === 'farmer' && leader.id !== player.id && leader.hand.length <= player.hand.length) score -= 180;
      }
      if (bomb && opponents.some(function (opponent) { return opponent.hand.length <= 2; })) score += 80;
      if (pattern.type === 'single' && opponents.some(function (opponent) { return opponent.hand.length === 1; })) score += pattern.mainValue * 3;
    }
    return score;
  }

  function choosePlay(state, playerIndex, difficulty, random) {
    const rng = random || Math.random;
    const player = state.players[playerIndex];
    const plays = DDZ.rules.allValidPlays(player.hand, state.leadPlay && state.leadPlay.pattern);
    if (!plays.length) return null;
    if (difficulty === 'easy') {
      if (state.leadPlay && rng() < 0.14) return null;
      return plays[Math.floor(rng() * plays.length)];
    }
    if (difficulty === 'hard' && state.leadPlay) {
      const leader = state.players[state.leadPlay.playerIndex];
      if (player.role === 'farmer' && leader.role === 'farmer' && leader.hand.length <= 4 && player.hand.length > 2) return null;
    }
    return plays.map(function (play) { return { play: play, score: scorePlay(state, playerIndex, play, difficulty) }; })
      .sort(function (a, b) { return b.score - a.score; })[0].play;
  }

  function chooseBid(state, playerIndex, difficulty, random) {
    const rng = random || Math.random;
    const hand = state.players[playerIndex].hand;
    const grouped = counts(hand);
    const bombs = Array.from(grouped.values()).filter(function (count) { return count === 4; }).length;
    const high = hand.filter(function (card) { return card.value >= 15; }).length;
    const jokers = hand.filter(function (card) { return card.value >= 16; }).length;
    const structure = DDZ.rules.allValidPlays(hand, null).some(function (play) { return play.length >= 6; }) ? 1.2 : 0;
    const strength = bombs * 4.2 + high * 1.35 + jokers * 1.8 + structure + rng() * 2.5;
    const threshold = difficulty === 'easy' ? 7.2 : difficulty === 'normal' ? 8.2 : 9;
    return strength >= threshold + (state.landlordCandidate !== null ? 1.5 : 0);
  }

  function delay(speed, random) {
    const rng = random || Math.random;
    const range = speed === 'fast' ? [420, 760] : speed === 'slow' ? [1000, 1500] : [650, 1050];
    return Math.round(range[0] + rng() * (range[1] - range[0]));
  }

  DDZ.ai = { choosePlay: choosePlay, chooseBid: chooseBid, delay: delay, approximateTurns: approximateTurns };
})(globalThis);
