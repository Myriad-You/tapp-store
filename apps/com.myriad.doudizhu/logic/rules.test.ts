/**
 * Unit tests for shipped 斗地主 pure rules.
 *
 *   pnpm exec tsx --test src/tapp/examples/doudizhu/rules.test.ts
 */
/* eslint-disable test/no-import-node-test -- node:test; project has no vitest dep */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Card, Rank, Suit } from './rules.ts'
import {
  applyBid,
  applyPlay,
  BOTTOM_SIZE,
  canBeat,
  comboTypeLabel,
  createDeck,
  deal,
  DECK_SIZE,
  enumerateLegalPlays,
  HAND_SIZE,
  identifyCombo,
  nextHintPlay,
  PLAYER_COUNT,
  playKey,
  rankValue,
  shouldAlarmCount,
  startDeal,
  totalCardsInState,
} from './rules.ts'

function c(suit: Suit, rank: Rank): Card {
  return { id: `${suit}-${rank}`, suit, rank }
}

function cards(...specs: [Suit, Rank][]): Card[] {
  return specs.map(([s, r]) => c(s, r))
}

describe('deck and deal', () => {
  it('createDeck has 54 unique cards incl. jokers', () => {
    const deck = createDeck()
    assert.equal(deck.length, DECK_SIZE)
    const ids = new Set(deck.map(x => x.id))
    assert.equal(ids.size, DECK_SIZE)
    assert.ok(deck.some(x => x.rank === 'SJ'))
    assert.ok(deck.some(x => x.rank === 'BJ'))
  })

  it('deal yields 17/17/17 + 3 bottom and preserves 54 cards', () => {
    const d = deal(42)
    assert.equal(d.hands[0].length, HAND_SIZE)
    assert.equal(d.hands[1].length, HAND_SIZE)
    assert.equal(d.hands[2].length, HAND_SIZE)
    assert.equal(d.bottom.length, BOTTOM_SIZE)
    const all = [...d.hands[0], ...d.hands[1], ...d.hands[2], ...d.bottom]
    assert.equal(all.length, DECK_SIZE)
    assert.equal(new Set(all.map(x => x.id)).size, DECK_SIZE)
  })

  it('deal is deterministic for the same seed', () => {
    const a = deal(99)
    const b = deal(99)
    assert.deepEqual(
      a.hands[0].map(x => x.id),
      b.hands[0].map(x => x.id),
    )
    assert.deepEqual(
      a.bottom.map(x => x.id),
      b.bottom.map(x => x.id),
    )
  })

  it('startDeal enters auction with all cards accounted for', () => {
    const s = startDeal(7, 1)
    assert.equal(s.phase, 'auction')
    assert.equal(s.turn, 1)
    assert.equal(totalCardsInState(s), DECK_SIZE)
    assert.equal(s.landlord, null)
  })
})

describe('auction', () => {
  it('produces a landlord when someone bids and others pass', () => {
    let s = startDeal(1, 0)
    let r = applyBid(s, { kind: 'bid', seat: 0, score: 1 })
    assert.equal(r.ok, true)
    s = r.state
    r = applyBid(s, { kind: 'pass', seat: 1 })
    assert.equal(r.ok, true)
    s = r.state
    r = applyBid(s, { kind: 'pass', seat: 2 })
    assert.equal(r.ok, true)
    s = r.state
    assert.equal(s.phase, 'playing')
    assert.equal(s.landlord, 0)
    assert.equal(s.hands[0].length, HAND_SIZE + BOTTOM_SIZE)
    assert.equal(s.turn, 0)
  })

  it('bid of 3 ends auction immediately', () => {
    let s = startDeal(2, 0)
    const r = applyBid(s, { kind: 'bid', seat: 0, score: 3 })
    assert.equal(r.ok, true)
    s = r.state
    assert.equal(s.phase, 'playing')
    assert.equal(s.landlord, 0)
    assert.equal(s.bidScore, 3)
  })

  it('all-pass signals redeal', () => {
    let s = startDeal(3, 0)
    let r = applyBid(s, { kind: 'pass', seat: 0 })
    s = r.state
    r = applyBid(s, { kind: 'pass', seat: 1 })
    s = r.state
    r = applyBid(s, { kind: 'pass', seat: 2 })
    assert.equal(r.ok, true)
    assert.equal(r.redeal, true)
    assert.equal(r.state.landlord, null)
  })

  it('rejects bid not higher than current', () => {
    let s = startDeal(4, 0)
    let r = applyBid(s, { kind: 'bid', seat: 0, score: 2 })
    s = r.state
    r = applyBid(s, { kind: 'bid', seat: 1, score: 1 })
    assert.equal(r.ok, false)
  })
})

describe('combinations', () => {
  it('identifies single, pair, triple, bomb, rocket', () => {
    assert.equal(identifyCombo(cards(['S', '3']))!.type, 'single')
    assert.equal(identifyCombo(cards(['S', '5'], ['H', '5']))!.type, 'pair')
    assert.equal(
      identifyCombo(cards(['S', '7'], ['H', '7'], ['D', '7']))!.type,
      'triple',
    )
    assert.equal(
      identifyCombo(cards(['S', '9'], ['H', '9'], ['D', '9'], ['C', '9']))!.type,
      'bomb',
    )
    assert.equal(
      identifyCombo(cards(['J', 'SJ'], ['J', 'BJ']))!.type,
      'rocket',
    )
  })

  it('identifies triple_one, triple_two, straight, pair_seq, airplane', () => {
    assert.equal(
      identifyCombo(cards(['S', '4'], ['H', '4'], ['D', '4'], ['C', '8']))!.type,
      'triple_one',
    )
    assert.equal(
      identifyCombo(
        cards(['S', '6'], ['H', '6'], ['D', '6'], ['C', '9'], ['S', '9']),
      )!.type,
      'triple_two',
    )
    assert.equal(
      identifyCombo(
        cards(['S', '3'], ['H', '4'], ['D', '5'], ['C', '6'], ['S', '7']),
      )!.type,
      'straight',
    )
    assert.equal(
      identifyCombo(
        cards(
          ['S', '3'],
          ['H', '3'],
          ['D', '4'],
          ['C', '4'],
          ['S', '5'],
          ['H', '5'],
        ),
      )!.type,
      'pair_seq',
    )
    assert.equal(
      identifyCombo(
        cards(
          ['S', '3'],
          ['H', '3'],
          ['D', '3'],
          ['C', '4'],
          ['S', '4'],
          ['H', '4'],
        ),
      )!.type,
      'airplane',
    )
  })

  it('identifies four-with-two singles and four-with-two pairs', () => {
    assert.equal(
      identifyCombo(
        cards(
          ['S', '6'],
          ['H', '6'],
          ['D', '6'],
          ['C', '6'],
          ['S', '8'],
          ['H', '10'],
        ),
      )!.type,
      'four_two_singles',
    )
    assert.equal(
      identifyCombo(
        cards(
          ['S', '7'],
          ['H', '7'],
          ['D', '7'],
          ['C', '7'],
          ['S', '9'],
          ['H', '9'],
          ['D', 'J'],
          ['C', 'J'],
        ),
      )!.type,
      'four_two_pairs',
    )
  })

  it('rejects four-with-one-pair as four-with-two singles', () => {
    assert.equal(
      identifyCombo(
        cards(
          ['S', '6'],
          ['H', '6'],
          ['D', '6'],
          ['C', '6'],
          ['S', '8'],
          ['H', '8'],
        ),
      ),
      null,
    )
  })

  it('rejects illegal straight with 2', () => {
    assert.equal(
      identifyCombo(
        cards(['S', 'J'], ['H', 'Q'], ['D', 'K'], ['C', 'A'], ['S', '2']),
      ),
      null,
    )
  })
})

describe('canBeat', () => {
  it('allows any legal lead', () => {
    const solo = identifyCombo(cards(['S', '3']))!
    assert.equal(canBeat(solo, null), true)
  })

  it('same type higher rank beats', () => {
    const low = identifyCombo(cards(['S', '3']))!
    const high = identifyCombo(cards(['H', 'K']))!
    assert.equal(canBeat(high, low), true)
    assert.equal(canBeat(low, high), false)
  })

  it('bomb beats non-bomb; rocket beats bomb', () => {
    const single = identifyCombo(cards(['S', 'A']))!
    const bomb = identifyCombo(
      cards(['S', '5'], ['H', '5'], ['D', '5'], ['C', '5']),
    )!
    const rocket = identifyCombo(cards(['J', 'SJ'], ['J', 'BJ']))!
    assert.equal(canBeat(bomb, single), true)
    assert.equal(canBeat(single, bomb), false)
    assert.equal(canBeat(rocket, bomb), true)
    assert.equal(canBeat(bomb, rocket), false)
  })

  it('higher bomb beats lower bomb', () => {
    const lowBomb = identifyCombo(
      cards(['S', '3'], ['H', '3'], ['D', '3'], ['C', '3']),
    )!
    const highBomb = identifyCombo(
      cards(['S', 'K'], ['H', 'K'], ['D', 'K'], ['C', 'K']),
    )!
    assert.equal(canBeat(highBomb, lowBomb), true)
  })
})

describe('play / pass / win', () => {
  it('legal beat and illegal play', () => {
    // Build a playing state with known hands
    let s = startDeal(10, 0)
    // Force landlord seat 0 with bid 3
    let r = applyBid(s, { kind: 'bid', seat: 0, score: 3 })
    s = r.state
    assert.equal(s.phase, 'playing')

    // Lead a single from landlord hand
    const leadCard = s.hands[0][0]!
    r = applyPlay(s, { kind: 'play', seat: 0, cards: [leadCard] })
    assert.equal(r.ok, true, r.error)
    s = r.state
    assert.equal(s.turn, 1)
    assert.ok(s.lastCombo)

    // Seat 1 tries illegal empty / wrong combo: play cards not in hand
    const fake = c('S', '3')
    // ensure fake might not be in hand — use a card definitely removed if it was lead
    r = applyPlay(s, {
      kind: 'play',
      seat: 1,
      cards: [leadCard], // already played, not in seat 1
    })
    assert.equal(r.ok, false)

    // Seat 1 passes is legal
    r = applyPlay(s, { kind: 'pass', seat: 1 })
    assert.equal(r.ok, true, r.error)
  })

  it('completed trick after consecutive passes returns free lead to trick winner', () => {
    let s = startDeal(11, 0)
    let r = applyBid(s, { kind: 'bid', seat: 0, score: 3 })
    s = r.state
    const lead = s.hands[0][0]!
    r = applyPlay(s, { kind: 'play', seat: 0, cards: [lead] })
    s = r.state
    r = applyPlay(s, { kind: 'pass', seat: 1 })
    s = r.state
    r = applyPlay(s, { kind: 'pass', seat: 2 })
    assert.equal(r.ok, true, r.error)
    s = r.state
    assert.equal(s.lastCombo, null)
    assert.equal(s.turn, 0) // seat 0 won the trick
    // Now leading: cannot pass
    r = applyPlay(s, { kind: 'pass', seat: 0 })
    assert.equal(r.ok, false)
  })

  it('win detection when one hand empties', () => {
    let s = startDeal(12, 0)
    let r = applyBid(s, { kind: 'bid', seat: 0, score: 3 })
    s = r.state
    // Force seat 0 to a single card for a quick win
    const last = s.hands[0][0]!
    s = {
      ...s,
      hands: [[last], s.hands[1], s.hands[2]],
    }
    r = applyPlay(s, { kind: 'play', seat: 0, cards: [last] })
    assert.equal(r.ok, true, r.error)
    assert.equal(r.state.phase, 'finished')
    assert.equal(r.state.winner, 0)
    assert.equal(r.state.winningSide, 'landlord')
    assert.equal(r.state.hands[0].length, 0)
  })

  it('doubles multiplier for bomb and rocket plays', () => {
    let s = startDeal(14, 0)
    let r = applyBid(s, { kind: 'bid', seat: 0, score: 3 })
    s = r.state

    const bomb = cards(['S', '3'], ['H', '3'], ['D', '3'], ['C', '3'])
    s = {
      ...s,
      hands: [bomb, s.hands[1], s.hands[2]],
      turn: 0,
      lastCombo: null,
      passCount: 0,
      multiplier: 1,
    }
    r = applyPlay(s, { kind: 'play', seat: 0, cards: bomb })
    assert.equal(r.ok, true, r.error)
    assert.equal(r.state.multiplier, 2)

    const rocket = cards(['J', 'SJ'], ['J', 'BJ'])
    s = {
      ...r.state,
      phase: 'playing',
      hands: [rocket, r.state.hands[1], r.state.hands[2]],
      turn: 0,
      lastCombo: null,
      passCount: 0,
    }
    r = applyPlay(s, { kind: 'play', seat: 0, cards: rocket })
    assert.equal(r.ok, true, r.error)
    assert.equal(r.state.multiplier, 4)
  })

  it('farmer win when non-landlord empties first', () => {
    let s = startDeal(13, 0)
    let r = applyBid(s, { kind: 'bid', seat: 0, score: 3 })
    s = r.state
    // Landlord leads a low card, farmer responds and we force farmer to 1 card then empty
    const lead = s.hands[0].find(x => rankValue(x.rank) <= 10) || s.hands[0][0]!
    r = applyPlay(s, { kind: 'play', seat: 0, cards: [lead] })
    s = r.state
    // Give seat 1 one card that can beat lead
    const beater: Card = {
      id: 'X-win',
      suit: 'S',
      rank: '2',
    }
    // rank 2 always beats non-bomb singles that aren't 2/joker — if lead is 2, use joker
    const winCard
      = rankValue(lead.rank) < 15
        ? beater
        : c('J', 'BJ')
    s = {
      ...s,
      hands: [s.hands[0], [winCard], s.hands[2]],
    }
    r = applyPlay(s, { kind: 'play', seat: 1, cards: [winCard] })
    assert.equal(r.ok, true, r.error)
    assert.equal(r.state.phase, 'finished')
    assert.equal(r.state.winner, 1)
    assert.equal(r.state.winningSide, 'farmers')
  })

  it('auto-play simulation finishes across deterministic deals', () => {
    function handStrength(hand: Card[]): number {
      const byRank = new Map<number, Card[]>()
      for (const card of hand) {
        const v = rankValue(card.rank)
        byRank.set(v, [...(byRank.get(v) || []), card])
      }
      let score = 0
      let smallJoker = false
      let bigJoker = false
      let singles = 0
      for (const [rank, group] of byRank) {
        if (group.length === 4)
          score += 18
        if (group.length >= 3)
          score += 5
        if (group.length >= 2)
          score += 2
        if (group.length === 1)
          singles += 1
        if (rank >= 15)
          score += 5
      }
      for (const card of hand) {
        smallJoker ||= card.rank === 'SJ'
        bigJoker ||= card.rank === 'BJ'
      }
      if (smallJoker && bigJoker)
        score += 26
      score -= Math.max(0, singles - 4) * 2
      return score
    }

    function bidScoreFor(hand: Card[], current: number): 1 | 2 | 3 | 0 {
      const strength = handStrength(hand)
      const wanted = strength >= 68 ? 3 : strength >= 52 ? 2 : strength >= 38 ? 1 : 0
      return wanted > current ? wanted as 1 | 2 | 3 : 0
    }

    function pickPlay(state: ReturnType<typeof startDeal>): Card[] | null {
      const hand = state.hands[state.turn as 0 | 1 | 2]
      const whole = identifyCombo(hand)
      if (whole && canBeat(whole, state.lastCombo))
        return hand
      const plays = enumerateLegalPlays(hand, state.lastCombo)
      if (!plays.length)
        return null
      const sorted = plays.slice().sort((a, b) => {
        const ca = identifyCombo(a)!
        const cb = identifyCombo(b)!
        const pa = ca.type === 'bomb' || ca.type === 'rocket' ? 1 : 0
        const pb = cb.type === 'bomb' || cb.type === 'rocket' ? 1 : 0
        if (pa !== pb)
          return pa - pb
        if (!state.lastCombo && a.length !== b.length)
          return b.length - a.length
        if (ca.mainValue !== cb.mainValue)
          return ca.mainValue - cb.mainValue
        return playKey(a).localeCompare(playKey(b))
      })
      return sorted[0]!
    }

    for (let seed = 100; seed < 120; seed++) {
      let state = startDeal(seed, seed % PLAYER_COUNT)
      for (let i = 0; i < 12 && state.phase === 'auction'; i++) {
        let score = bidScoreFor(state.hands[state.turn as 0 | 1 | 2], state.bidScore)
        if (score === 0 && state.bidWinner === null && state.auctionActions >= PLAYER_COUNT - 1)
          score = 1
        const result = score
          ? applyBid(state, { kind: 'bid', seat: state.turn, score })
          : applyBid(state, { kind: 'pass', seat: state.turn })
        assert.equal(result.ok, true, result.error)
        state = result.redeal
          ? startDeal(seed + 10_000, (state.auctionStart + 1) % PLAYER_COUNT)
          : result.state
      }
      assert.equal(state.phase, 'playing', `seed ${seed} should resolve auction`)

      let steps = 0
      while (state.phase === 'playing' && steps < 500) {
        const cardsToPlay = pickPlay(state)
        const result = cardsToPlay
          ? applyPlay(state, { kind: 'play', seat: state.turn, cards: cardsToPlay })
          : applyPlay(state, { kind: 'pass', seat: state.turn })
        assert.equal(result.ok, true, result.error)
        state = result.state
        steps += 1
      }
      assert.equal(state.phase, 'finished', `seed ${seed} did not finish in ${steps} steps`)
      assert.ok(state.winner !== null)
      assert.ok(state.winningSide === 'landlord' || state.winningSide === 'farmers')
    }
  })
})

describe('constants', () => {
  it('player count is 3', () => {
    assert.equal(PLAYER_COUNT, 3)
  })
})

describe('comboTypeLabel', () => {
  it('labels core combo types in Chinese', () => {
    assert.equal(comboTypeLabel('single'), '单张')
    assert.equal(comboTypeLabel('pair'), '对子')
    assert.equal(comboTypeLabel('bomb'), '炸弹')
    assert.equal(comboTypeLabel('rocket'), '王炸')
    assert.equal(comboTypeLabel('straight'), '顺子')
    assert.equal(comboTypeLabel('airplane'), '飞机')
    assert.equal(comboTypeLabel('four_two_singles'), '四带二')
    assert.equal(comboTypeLabel('four_two_pairs'), '四带两对')
  })

  it('accepts combo object and empty input', () => {
    const combo = identifyCombo([c('S', '3'), c('H', '3')])
    assert.ok(combo)
    assert.equal(comboTypeLabel(combo), '对子')
    assert.equal(comboTypeLabel(null), '')
    assert.equal(comboTypeLabel(undefined), '')
  })
})

describe('enumerateLegalPlays / nextHintPlay (提示)', () => {
  it('lists legal singles that beat a table single from a real hand', () => {
    const hand = [c('S', '3'), c('H', '5'), c('D', '7'), c('C', '9'), c('S', '2')]
    const table = identifyCombo([c('H', '4')])
    assert.ok(table)
    const plays = enumerateLegalPlays(hand, table)
    assert.ok(plays.length >= 3, `expected beats, got ${plays.length}`)
    // Every returned play must identify + beat via shipped rules
    for (const p of plays) {
      const combo = identifyCombo(p)
      assert.ok(combo, `not a combo: ${playKey(p)}`)
      assert.equal(canBeat(combo, table), true)
      // All cards must be from hand
      for (const card of p) {
        assert.ok(hand.some(h => h.id === card.id), `card not in hand ${card.id}`)
      }
    }
    // 3 cannot beat 4; 5/7/9/2 can as singles
    const singleMains = plays
      .map(p => identifyCombo(p)!)
      .filter(x => x.type === 'single')
      .map(x => x.mainValue)
    assert.ok(singleMains.every(v => v > rankValue('4')))
    assert.ok(!plays.some(p => p.length === 1 && p[0]!.rank === '3'))
  })

  it('returns empty when no legal beat exists (and pass is the only option)', () => {
    const hand = [c('S', '3'), c('H', '4'), c('D', '5')]
    const table = identifyCombo([c('S', '2')]) // single 2
    assert.ok(table)
    const plays = enumerateLegalPlays(hand, table)
    // No bomb/rocket in hand; nothing beats 2
    assert.equal(plays.length, 0)
    assert.equal(nextHintPlay(hand, table), null)
  })

  it('cycles hint options and wraps', () => {
    const hand = [c('S', '5'), c('H', '6'), c('D', '7'), c('C', '8')]
    const table = identifyCombo([c('S', '4')])
    assert.ok(table)
    const first = nextHintPlay(hand, table, null)
    assert.ok(first)
    assert.ok(first.total >= 2)
    const second = nextHintPlay(hand, table, first.key)
    assert.ok(second)
    assert.notEqual(second.key, first.key)
    // Walk full cycle back to first
    let cur = first
    const seen = new Set<string>([cur.key])
    for (let i = 0; i < cur.total + 2; i++) {
      const n = nextHintPlay(hand, table, cur.key)
      assert.ok(n)
      cur = n
      seen.add(cur.key)
    }
    assert.equal(seen.size, first.total)
  })

  it('free lead enumerates legal combos from hand', () => {
    const hand = [
      c('S', '3'), c('H', '3'),
      c('D', '4'),
      c('C', '5'), c('S', '5'), c('H', '5'), c('D', '5'), // bomb of 5s
    ]
    const plays = enumerateLegalPlays(hand, null)
    assert.ok(plays.length >= 4)
    const types = new Set(plays.map(p => identifyCombo(p)!.type))
    assert.ok(types.has('single'))
    assert.ok(types.has('pair'))
    assert.ok(types.has('bomb'))
  })

  it('shouldAlarmCount marks 1–2 residual cards only', () => {
    assert.equal(shouldAlarmCount(0), false)
    assert.equal(shouldAlarmCount(1), true)
    assert.equal(shouldAlarmCount(2), true)
    assert.equal(shouldAlarmCount(3), false)
    assert.equal(shouldAlarmCount(17), false)
  })
})
