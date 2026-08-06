(function (root) {
  'use strict';
  const DDZ = root.DDZ = root.DDZ || {};
  const playerMeta = [
    { id: 'human', human: true },
    { id: 'left-ai', human: false },
    { id: 'top-ai', human: false }
  ];

  function makePlayers(hands, sortMode) {
    return playerMeta.map(function (meta, index) {
      return {
        id: meta.id, human: meta.human, role: 'unknown',
        hand: DDZ.cards.sortCards(hands[index] || [], sortMode), bid: 'waiting', lastAction: '', successfulPlays: 0
      };
    });
  }

  function menuState() {
    return {
      schemaVersion: 2, phase: 'menu', players: makePlayers([[], [], []], 'rank'), bottom: [], currentPlayer: 0,
      firstBidder: 0, bidCount: 0, landlordCandidate: null, landlordIndex: null,
      baseScore: 1, bidMultiplier: 1, multiplier: 1, bombCount: 0, leadPlay: null, passes: 0,
      table: {}, history: [], selectedIds: [], hintIndex: -1, message: '', paused: false, busy: false,
      round: 0, settlement: null, actionSerial: 0
    };
  }

  function startGame(options) {
    const settings = options || {};
    const random = settings.random || Math.random;
    const dealt = DDZ.cards.deal(random);
    const starter = Number.isInteger(settings.firstBidder) ? settings.firstBidder : Math.floor(random() * 3);
    return Object.assign(menuState(), {
      phase: 'dealing', players: makePlayers(dealt.hands, settings.sortMode || 'rank'), bottom: dealt.bottom,
      currentPlayer: starter, firstBidder: starter, round: settings.round || 1, message: { key: 'message.dealing' }, actionSerial: 1
    });
  }

  function beginBidding(state) {
    if (state.phase !== 'dealing') return state;
    return Object.assign({}, state, { phase: 'bidding', message: { key: 'message.startsBidding', params: { name: state.players[state.currentPlayer].id } }, actionSerial: state.actionSerial + 1 });
  }

  function assignLandlord(state, players, candidate, bidMultiplier, sortMode) {
    const assigned = players.map(function (player, index) {
      return Object.assign({}, player, {
        role: index === candidate ? 'landlord' : 'farmer',
        hand: index === candidate ? DDZ.cards.sortCards(player.hand.concat(state.bottom), sortMode || 'rank') : player.hand
      });
    });
    return Object.assign({}, state, {
      phase: 'playing', players: assigned, landlordIndex: candidate, landlordCandidate: candidate,
      currentPlayer: candidate, bidCount: 3, bidMultiplier: bidMultiplier, multiplier: bidMultiplier,
      selectedIds: [], table: {}, message: { key: 'message.becomesLandlord', params: { name: assigned[candidate].id } }, busy: false,
      actionSerial: state.actionSerial + 1
    });
  }

  function bid(state, playerIndex, wantsLandlord, options) {
    if (state.phase !== 'bidding' || state.currentPlayer !== playerIndex || state.paused || state.busy) return state;
    const hasCandidate = state.landlordCandidate !== null;
    const action = wantsLandlord ? (hasCandidate ? 'rob' : 'call') : (hasCandidate ? 'no-rob' : 'pass');
    const actionKey = 'action.' + ({ call: 'call', rob: 'rob', 'no-rob': 'noRob', pass: 'noCall' })[action];
    const players = state.players.map(function (player, index) {
      return index === playerIndex ? Object.assign({}, player, { bid: action, lastAction: { key: actionKey } }) : player;
    });
    const candidate = wantsLandlord ? playerIndex : state.landlordCandidate;
    const bidMultiplier = wantsLandlord && hasCandidate ? state.bidMultiplier * 2 : state.bidMultiplier;
    const bidCount = state.bidCount + 1;
    if (bidCount >= 3) {
      if (candidate === null) {
        return startGame({
          random: options && options.random,
          sortMode: options && options.sortMode,
          firstBidder: (state.firstBidder + 1) % 3,
          round: state.round + 1
        });
      }
      return assignLandlord(state, players, candidate, bidMultiplier, options && options.sortMode);
    }
    return Object.assign({}, state, {
      players: players, landlordCandidate: candidate, bidMultiplier: bidMultiplier, bidCount: bidCount,
      currentPlayer: (playerIndex + 1) % 3,
      message: { key: 'message.playerAction', params: { name: players[playerIndex].id, action: actionKey } },
      actionSerial: state.actionSerial + 1
    });
  }

  function settlementFor(state, winnerIndex, players, multiplier) {
    const landlordWon = winnerIndex === state.landlordIndex;
    const landlord = players[state.landlordIndex];
    const farmers = players.filter(function (_, index) { return index !== state.landlordIndex; });
    const spring = landlordWon && farmers.every(function (player) { return player.successfulPlays === 0; });
    const antiSpring = !landlordWon && landlord.successfulPlays === 1;
    const finalMultiplier = multiplier * (spring || antiSpring ? 2 : 1);
    const humanLandlord = state.landlordIndex === 0;
    const humanWon = humanLandlord === landlordWon;
    return {
      winner: landlordWon ? 'landlord' : 'farmers', humanWon: humanWon, spring: spring, antiSpring: antiSpring,
      baseScore: state.baseScore, bidMultiplier: state.bidMultiplier, bombCount: state.bombCount,
      finalMultiplier: finalMultiplier,
      scoreDelta: state.baseScore * finalMultiplier * (humanLandlord ? 2 : 1) * (humanWon ? 1 : -1)
    };
  }

  function play(state, playerIndex, cards) {
    if (state.phase !== 'playing' || state.currentPlayer !== playerIndex || state.paused || state.busy || !cards || !cards.length) return state;
    const player = state.players[playerIndex];
    const held = new Set(player.hand.map(function (card) { return card.id; }));
    if (cards.some(function (card) { return !held.has(card.id); })) return Object.assign({}, state, { message: { key: 'message.cardsMissing' } });
    const currentPattern = DDZ.rules.detect(cards);
    if (!currentPattern) return Object.assign({}, state, { message: { key: 'message.invalidPattern' } });
    if (!DDZ.rules.canBeat(state.leadPlay && state.leadPlay.pattern, currentPattern)) return Object.assign({}, state, { message: { key: 'message.cannotBeat' } });

    const ids = new Set(cards.map(function (card) { return card.id; }));
    const nextHand = player.hand.filter(function (card) { return !ids.has(card.id); });
    const players = state.players.map(function (item, index) {
      return index === playerIndex ? Object.assign({}, item, { hand: nextHand, lastAction: { key: 'message.playedPattern', params: { pattern: currentPattern.type } }, successfulPlays: item.successfulPlays + 1 }) : item;
    });
    const isBomb = currentPattern.type === 'bomb' || currentPattern.type === 'rocket';
    const multiplier = isBomb ? state.multiplier * 2 : state.multiplier;
    const record = { playerIndex: playerIndex, playerId: player.id, cards: cards.slice(), pattern: currentPattern, timestamp: Date.now() };
    const history = state.history.concat(record);
    const bombCount = state.bombCount + (isBomb ? 1 : 0);

    if (nextHand.length === 0) {
      const interim = Object.assign({}, state, { bombCount: bombCount });
      const settled = settlementFor(interim, playerIndex, players, multiplier);
      return Object.assign({}, state, {
        phase: 'finished', players: players, leadPlay: record, table: { [player.id]: record }, history: history,
        multiplier: settled.finalMultiplier, bombCount: bombCount, selectedIds: [], settlement: settled,
        message: { key: settled.humanWon ? 'message.youWon' : 'message.youLost' }, busy: false,
        actionSerial: state.actionSerial + 1
      });
    }
    return Object.assign({}, state, {
      players: players, leadPlay: record, passes: 0, table: { [player.id]: record }, history: history,
      currentPlayer: (playerIndex + 1) % 3, selectedIds: [], hintIndex: -1,
      multiplier: multiplier, bombCount: bombCount, message: { key: 'message.pattern', params: { pattern: currentPattern.type } },
      actionSerial: state.actionSerial + 1
    });
  }

  function pass(state, playerIndex) {
    if (state.phase !== 'playing' || state.currentPlayer !== playerIndex || state.paused || state.busy) return state;
    if (!state.leadPlay) return Object.assign({}, state, { message: { key: 'message.mustLead' } });
    const passes = state.passes + 1;
    const reset = passes >= 2;
    const player = state.players[playerIndex];
    const players = state.players.map(function (item, index) {
      return index === playerIndex ? Object.assign({}, item, { lastAction: { key: 'action.pass' } }) : item;
    });
    const record = { playerIndex: playerIndex, playerId: player.id, cards: [], pattern: null, pass: true, timestamp: Date.now() };
    return Object.assign({}, state, {
      players: players, leadPlay: reset ? null : state.leadPlay, passes: reset ? 0 : passes,
      table: reset ? {} : { [player.id]: record }, history: state.history.concat(record),
      currentPlayer: (playerIndex + 1) % 3, selectedIds: [], hintIndex: -1,
      message: { key: reset ? 'message.leadsAgain' : 'message.playerPass', params: { name: (reset ? state.players[(playerIndex + 1) % 3] : player).id } },
      actionSerial: state.actionSerial + 1
    });
  }

  function toggleCard(state, cardId) {
    if (state.phase !== 'playing' || state.currentPlayer !== 0 || state.paused || state.busy) return state;
    const selected = state.selectedIds.includes(cardId)
      ? state.selectedIds.filter(function (id) { return id !== cardId; })
      : state.selectedIds.concat(cardId);
    return Object.assign({}, state, { selectedIds: selected, hintIndex: -1, message: '' });
  }

  function setCardSelected(state, cardId, selected) {
    if (state.phase !== 'playing' || state.currentPlayer !== 0 || state.paused || state.busy) return state;
    const playerHasCard = state.players[0].hand.some(function (card) { return card.id === cardId; });
    if (!playerHasCard) return state;
    const alreadySelected = state.selectedIds.includes(cardId);
    if (alreadySelected === selected) return state;
    const selectedIds = selected ? state.selectedIds.concat(cardId) : state.selectedIds.filter(function (id) { return id !== cardId; });
    return Object.assign({}, state, { selectedIds: selectedIds, hintIndex: -1, message: '' });
  }

  function selectedCards(state) {
    const ids = new Set(state.selectedIds);
    return state.players[0].hand.filter(function (card) { return ids.has(card.id); });
  }

  function hint(state) {
    if (state.phase !== 'playing' || state.currentPlayer !== 0 || state.paused) return state;
    const plays = DDZ.rules.allValidPlays(state.players[0].hand, state.leadPlay && state.leadPlay.pattern);
    if (!plays.length) return Object.assign({}, state, { selectedIds: [], hintIndex: -1, message: { key: 'message.noPlay' } });
    const index = (state.hintIndex + 1) % plays.length;
    return Object.assign({}, state, {
      hintIndex: index, selectedIds: plays[index].map(function (card) { return card.id; }),
      message: { key: 'message.hint', params: { current: index + 1, total: plays.length, pattern: DDZ.rules.detect(plays[index]).type } }
    });
  }

  function timeout(state, options) {
    if (state.phase === 'bidding') return bid(state, state.currentPlayer, false, options || {});
    if (state.phase !== 'playing') return state;
    if (state.leadPlay) return pass(state, state.currentPlayer);
    const plays = DDZ.rules.allValidPlays(state.players[state.currentPlayer].hand, null);
    return plays.length ? play(state, state.currentPlayer, plays[0]) : state;
  }

  function sortHuman(state, mode) {
    const players = state.players.map(function (player, index) {
      return index === 0 ? Object.assign({}, player, { hand: DDZ.cards.sortCards(player.hand, mode) }) : player;
    });
    return Object.assign({}, state, { players: players });
  }

  function validHumanPlay(state) {
    if (state.phase !== 'playing' || state.currentPlayer !== 0 || !state.selectedIds.length) return false;
    const selected = selectedCards(state);
    return DDZ.rules.canBeat(state.leadPlay && state.leadPlay.pattern, DDZ.rules.detect(selected));
  }

  function normalizeSavedState(value) {
    if (!value || value.schemaVersion !== 2 || !Array.isArray(value.players) || value.players.length !== 3) return null;
    if (!['dealing', 'bidding', 'playing'].includes(value.phase)) return null;
    const players = value.players.map(function (player) { return Object.assign({ lastAction: '' }, player); });
    return Object.assign(menuState(), value, { players: players, paused: true, busy: false, selectedIds: [], hintIndex: -1 });
  }

  DDZ.engine = {
    menuState: menuState, startGame: startGame, beginBidding: beginBidding, bid: bid, play: play, pass: pass,
    toggleCard: toggleCard, setCardSelected: setCardSelected, selectedCards: selectedCards, hint: hint, timeout: timeout, sortHuman: sortHuman,
    validHumanPlay: validHumanPlay, normalizeSavedState: normalizeSavedState
  };
})(globalThis);
