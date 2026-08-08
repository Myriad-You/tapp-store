import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

// Run with:
// node --test apps/com.myriad.doudizhu/tests/game-rules.test.mjs

const context = { console, Date, Math };
context.globalThis = context;
vm.createContext(context);
for (const file of ['cards.js', 'rules.js', 'engine.js']) {
  vm.runInContext(
    fs.readFileSync(new URL('../page/' + file, import.meta.url), 'utf8'),
    context,
    { filename: file }
  );
}
const { cards: cardApi, rules, engine } = context.DDZ;

let nextCardId = 0;
function card(value) {
  nextCardId += 1;
  return { id: 'test-' + nextCardId, suit: 'spade', rank: String(value), value };
}

function hand(...values) {
  return values.map(card);
}

function player(id, cards, successfulPlays = 0) {
  return {
    id,
    human: id === 'human',
    role: id === 'human' ? 'landlord' : 'farmer',
    hand: cards,
    bid: 'waiting',
    lastAction: '',
    successfulPlays
  };
}

describe('airplane single wings', () => {
  it('accepts a fourth body-rank card as a single wing', () => {
    const mixedWing = hand(3, 3, 3, 3, 4, 4, 4, 5);
    const bothBodyWings = hand(3, 3, 3, 3, 4, 4, 4, 4);
    assert.equal(rules.detect(mixedWing)?.type, 'airplaneSingles');
    assert.equal(rules.detect(bothBodyWings)?.type, 'airplaneSingles');
  });

  it('generates airplane singles by splitting fourth cards from bombs', () => {
    for (const source of [
      hand(3, 3, 3, 3, 4, 4, 4, 5),
      hand(3, 3, 3, 3, 4, 4, 4, 4)
    ]) {
      const plays = rules.allValidPlays(source, null);
      assert.ok(plays.some((play) => play.length === 8 && rules.detect(play)?.type === 'airplaneSingles'));
    }
  });

  it('does not relax pair wings to reuse body ranks', () => {
    assert.equal(rules.detect(hand(3, 3, 3, 3, 4, 4, 4, 4, 5, 5)), null);
  });
});

describe('sequence boundaries', () => {
  it('allows straights through ace and rejects short straights or any straight containing 2', () => {
    assert.equal(rules.detect(hand(10, 11, 12, 13, 14))?.type, 'straight');
    assert.equal(rules.detect(hand(3, 4, 5, 6)), null);
    assert.equal(rules.detect(hand(11, 12, 13, 14, 15)), null);
  });

  it('requires at least three consecutive pairs and excludes 2', () => {
    assert.equal(rules.detect(hand(3, 3, 4, 4, 5, 5))?.type, 'pairStraight');
    assert.equal(rules.detect(hand(12, 12, 13, 13, 14, 14))?.type, 'pairStraight');
    assert.equal(rules.detect(hand(3, 3, 4, 4)), null);
    assert.equal(rules.detect(hand(13, 13, 14, 14, 15, 15)), null);
  });
});

describe('bomb and rocket comparison', () => {
  it('orders ordinary plays, bombs, and the rocket correctly', () => {
    const single = rules.detect(hand(14));
    const lowBomb = rules.detect(hand(3, 3, 3, 3));
    const highBomb = rules.detect(hand(9, 9, 9, 9));
    const rocket = rules.detect(hand(16, 17));
    assert.equal(rules.canBeat(single, lowBomb), true);
    assert.equal(rules.canBeat(lowBomb, highBomb), true);
    assert.equal(rules.canBeat(highBomb, lowBomb), false);
    assert.equal(rules.canBeat(highBomb, rocket), true);
    assert.equal(rules.canBeat(rocket, highBomb), false);
    assert.equal(rules.canBeat(rocket, rocket), false);
  });
});

describe('bidding state machine', () => {
  it('assigns the bottom cards to the caller after three actions', () => {
    const random = () => 0;
    let state = engine.beginBidding(engine.startGame({ random, firstBidder: 0 }));
    state = engine.bid(state, 0, true, { random });
    state = engine.bid(state, 1, false, { random });
    state = engine.bid(state, 2, false, { random });
    assert.equal(state.phase, 'playing');
    assert.equal(state.landlordIndex, 0);
    assert.equal(state.players[0].hand.length, 20);
  });

  it('redeals after everyone declines and rotates the first bidder', () => {
    const random = () => 0;
    let state = engine.beginBidding(engine.startGame({ random, firstBidder: 0, round: 1 }));
    state = engine.bid(state, 0, false, { random });
    state = engine.bid(state, 1, false, { random });
    state = engine.bid(state, 2, false, { random });
    assert.equal(state.phase, 'dealing');
    assert.equal(state.landlordIndex, null);
    assert.equal(state.firstBidder, 1);
    assert.equal(state.round, 2);
    assert.deepEqual(Array.from(state.players, (item) => item.hand.length), [17, 17, 17]);
    assert.equal(state.bottom.length, 3);
  });
});

describe('spring settlement', () => {
  it('doubles a landlord win when neither farmer has played', () => {
    const winningCard = card(3);
    const state = Object.assign(engine.menuState(), {
      phase: 'playing',
      landlordIndex: 0,
      landlordCandidate: 0,
      currentPlayer: 0,
      players: [player('human', [winningCard]), player('left-ai', hand(4)), player('top-ai', hand(5))]
    });
    const result = engine.play(state, 0, [winningCard]);
    assert.equal(result.phase, 'finished');
    assert.equal(result.settlement.spring, true);
    assert.equal(result.settlement.antiSpring, false);
    assert.equal(result.settlement.finalMultiplier, 2);
  });

  it('doubles a farmer win when the landlord has played exactly once', () => {
    const winningCard = card(6);
    const state = Object.assign(engine.menuState(), {
      phase: 'playing',
      landlordIndex: 0,
      landlordCandidate: 0,
      currentPlayer: 1,
      players: [player('human', hand(3, 4), 1), player('left-ai', [winningCard]), player('top-ai', hand(5))]
    });
    const result = engine.play(state, 1, [winningCard]);
    assert.equal(result.phase, 'finished');
    assert.equal(result.settlement.spring, false);
    assert.equal(result.settlement.antiSpring, true);
    assert.equal(result.settlement.finalMultiplier, 2);
  });
});

describe('deck invariants', () => {
  it('keeps 54 unique cards and deals 17/17/17 plus 3 bottom cards', () => {
    const deck = cardApi.createDeck();
    assert.equal(deck.length, 54);
    assert.equal(new Set(deck.map((item) => item.id)).size, 54);
    const dealt = cardApi.deal(() => 0.5);
    assert.deepEqual(Array.from(dealt.hands, (cards) => cards.length), [17, 17, 17]);
    assert.equal(dealt.bottom.length, 3);
  });
});

describe('generated-play invariants', () => {
  it('only emits held, unique, detectable plays across deterministic deals', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      let state = seed >>> 0;
      const random = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
      };
      const dealt = cardApi.deal(random);
      for (const source of dealt.hands) {
        const held = new Set(source.map((item) => item.id));
        for (const play of rules.allValidPlays(source, null)) {
          assert.ok(rules.detect(play), 'generated play must be detectable');
          assert.equal(new Set(play.map((item) => item.id)).size, play.length, 'generated play must not duplicate cards');
          assert.ok(play.every((item) => held.has(item.id)), 'generated play must come from the hand');
        }
      }
    }
  });
});
