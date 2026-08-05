/**
 * Pure 斗地主 (Fight the Landlord) rule engine.
 *
 * No DOM / federation I/O — safe for unit tests and host-authoritative multiplayer.
 *
 * Deck: 54 cards (52 + 2 jokers). Deal: 17 / 17 / 17 + 3 bottom.
 * Auction: bid 1–3 or pass; all-pass redeals. Landlord takes bottom and leads.
 * Play: beat-or-pass with core combinations; first empty hand wins.
 */

/** Suit codes: S H D C; jokers use suit 'J'. */
export type Suit = 'S' | 'H' | 'D' | 'C' | 'J'

/**
 * Rank codes. Numeric order for comparison is via {@link rankValue}.
 * 3..2, then SJ (small joker), BJ (big joker).
 */
export type Rank =
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A'
  | '2'
  | 'SJ'
  | 'BJ'

export interface Card {
  /** Stable id, e.g. "S-3", "J-SJ" */
  id: string
  suit: Suit
  rank: Rank
}

export type ComboType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'triple_one'
  | 'triple_two'
  | 'straight'
  | 'pair_seq'
  | 'airplane'
  | 'airplane_singles'
  | 'airplane_pairs'
  | 'four_two_singles'
  | 'four_two_pairs'
  | 'bomb'
  | 'rocket'

export interface Combo {
  type: ComboType
  /** Primary rank value used for comparison (lowest triple rank for airplane, etc.) */
  mainValue: number
  /** Number of primary units (straight length, pair-seq length, airplane length) */
  length: number
  cards: Card[]
}

export type Phase = 'lobby' | 'auction' | 'playing' | 'finished'

export interface GameState {
  phase: Phase
  /** Seed used for the last deal (reproducible tests / host share). */
  seed: number
  /** Three seats 0..2 */
  hands: [Card[], Card[], Card[]]
  bottom: Card[]
  /** Seat of current landlord, or null before auction resolves. */
  landlord: number | null
  /** Highest bid so far (0 = none). */
  bidScore: number
  /** Seat that currently holds the high bid. */
  bidWinner: number | null
  /** Seat whose turn it is to bid or play. */
  turn: number
  /** Seat that led the current trick (null = must lead, not pass). */
  trickLeader: number | null
  /** Last non-pass combo on the table. */
  lastCombo: Combo | null
  /** Consecutive passes since last play (0..2). */
  passCount: number
  /** Auction starting seat. */
  auctionStart: number
  /** Number of auction actions taken this round. */
  auctionActions: number
  /** Bomb / rocket multiplier, starts at 1 and doubles for each bomb/rocket play. */
  multiplier: number
  /** Winner seat when finished. */
  winner: number | null
  /** 'landlord' | 'farmers' when finished. */
  winningSide: 'landlord' | 'farmers' | null
}

export const DECK_SIZE = 54
export const HAND_SIZE = 17
export const BOTTOM_SIZE = 3
export const PLAYER_COUNT = 3

const RANK_ORDER: Rank[] = [
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
  '2',
  'SJ',
  'BJ',
]

const SUITS: Suit[] = ['S', 'H', 'D', 'C']
const STANDARD_RANKS: Rank[] = [
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
  '2',
]

/** Rank comparison value: 3=3 … A=14, 2=15, SJ=16, BJ=17 */
export function rankValue(rank: Rank): number {
  const idx = RANK_ORDER.indexOf(rank)
  if (idx < 0)
    throw new Error(`Unknown rank: ${rank}`)
  // 3..2 map to 3..15; jokers 16/17
  if (rank === 'SJ')
    return 16
  if (rank === 'BJ')
    return 17
  return idx + 3
}

export function cardId(suit: Suit, rank: Rank): string {
  return `${suit}-${rank}`
}

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of STANDARD_RANKS) {
      deck.push({ id: cardId(suit, rank), suit, rank })
    }
  }
  deck.push({ id: cardId('J', 'SJ'), suit: 'J', rank: 'SJ' })
  deck.push({ id: cardId('J', 'BJ'), suit: 'J', rank: 'BJ' })
  return deck
}

/** Mulberry32 — deterministic PRNG from a 32-bit seed. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffleDeck(deck: Card[], seed: number): Card[] {
  const arr = deck.slice()
  const rnd = mulberry32(seed)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
  return arr
}

export function sortHand(cards: Card[]): Card[] {
  return cards.slice().sort((a, b) => {
    const dv = rankValue(a.rank) - rankValue(b.rank)
    if (dv !== 0)
      return dv
    return a.suit.localeCompare(b.suit)
  })
}

export interface DealResult {
  hands: [Card[], Card[], Card[]]
  bottom: Card[]
  seed: number
}

/** Deal 17/17/17 + 3 bottom from a 54-card deck. */
export function deal(seed: number): DealResult {
  const shuffled = shuffleDeck(createDeck(), seed)
  if (shuffled.length !== DECK_SIZE) {
    throw new Error(`Expected deck size ${DECK_SIZE}, got ${shuffled.length}`)
  }
  const hands: [Card[], Card[], Card[]] = [
    sortHand(shuffled.slice(0, HAND_SIZE)),
    sortHand(shuffled.slice(HAND_SIZE, HAND_SIZE * 2)),
    sortHand(shuffled.slice(HAND_SIZE * 2, HAND_SIZE * 3)),
  ]
  const bottom = sortHand(shuffled.slice(HAND_SIZE * 3, HAND_SIZE * 3 + BOTTOM_SIZE))
  return { hands, bottom, seed }
}

export function createLobbyState(): GameState {
  return {
    phase: 'lobby',
    seed: 0,
    hands: [[], [], []],
    bottom: [],
    landlord: null,
    bidScore: 0,
    bidWinner: null,
    turn: 0,
    trickLeader: null,
    lastCombo: null,
    passCount: 0,
    auctionStart: 0,
    auctionActions: 0,
    multiplier: 1,
    winner: null,
    winningSide: null,
  }
}

/** Start a new deal and enter auction. auctionStart is seat that bids first. */
export function startDeal(seed: number, auctionStart = 0): GameState {
  const { hands, bottom } = deal(seed)
  const start = ((auctionStart % PLAYER_COUNT) + PLAYER_COUNT) % PLAYER_COUNT
  return {
    phase: 'auction',
    seed,
    hands,
    bottom,
    landlord: null,
    bidScore: 0,
    bidWinner: null,
    turn: start,
    trickLeader: null,
    lastCombo: null,
    passCount: 0,
    auctionStart: start,
    auctionActions: 0,
    multiplier: 1,
    winner: null,
    winningSide: null,
  }
}

export type BidAction = { kind: 'bid', seat: number, score: 1 | 2 | 3 } | { kind: 'pass', seat: number }

export interface ApplyResult {
  ok: boolean
  error?: string
  state: GameState
  /** True when all passed auction — caller should redeal. */
  redeal?: boolean
}

function cloneState(s: GameState): GameState {
  return {
    ...s,
    hands: [
      s.hands[0].map(c => ({ ...c })),
      s.hands[1].map(c => ({ ...c })),
      s.hands[2].map(c => ({ ...c })),
    ],
    bottom: s.bottom.map(c => ({ ...c })),
    lastCombo: s.lastCombo
      ? { ...s.lastCombo, cards: s.lastCombo.cards.map(c => ({ ...c })) }
      : null,
  }
}

/**
 * Apply auction bid/pass. Bid must be strictly higher than current high.
 *
 * Ends when: bid 3; all three pass with no bid (redeal); or after a bid, the
 * other two seats both pass (passCount reaches 2) — high bidder becomes landlord.
 * `passCount` reuses the same field during auction for consecutive passes.
 */
export function applyBid(state: GameState, action: BidAction): ApplyResult {
  if (state.phase !== 'auction') {
    return { ok: false, error: 'Not in auction phase', state }
  }
  if (action.seat !== state.turn) {
    return { ok: false, error: 'Not your turn to bid', state }
  }

  const next = cloneState(state)

  if (action.kind === 'bid') {
    if (action.score < 1 || action.score > 3) {
      return { ok: false, error: 'Bid must be 1, 2, or 3', state }
    }
    if (action.score <= next.bidScore) {
      return { ok: false, error: 'Bid must be higher than current', state }
    }
    next.bidScore = action.score
    next.bidWinner = action.seat
    next.auctionActions += 1
    next.passCount = 0

    if (action.score === 3) {
      return finishAuction(next, action.seat)
    }

    next.turn = (action.seat + 1) % PLAYER_COUNT
    return { ok: true, state: next }
  }

  // pass
  next.auctionActions += 1
  next.passCount += 1
  next.turn = (action.seat + 1) % PLAYER_COUNT

  // All three passed with no bid → redeal
  if (next.bidWinner === null && next.auctionActions >= PLAYER_COUNT) {
    return { ok: true, state: next, redeal: true }
  }

  // After a bid, two consecutive passes → high bidder is landlord
  if (next.bidWinner !== null && next.passCount >= PLAYER_COUNT - 1) {
    return finishAuction(next, next.bidWinner)
  }

  return { ok: true, state: next }
}

function finishAuction(state: GameState, landlord: number): ApplyResult {
  const next = cloneState(state)
  next.landlord = landlord
  next.hands[landlord as 0 | 1 | 2] = sortHand([
    ...next.hands[landlord as 0 | 1 | 2],
    ...next.bottom,
  ])
  // Bottom stays visible after auction for UI
  next.phase = 'playing'
  next.turn = landlord
  next.trickLeader = null
  next.lastCombo = null
  next.passCount = 0
  return { ok: true, state: next }
}

// ─── Combination detection ───────────────────────────────────────────────────

function countByRank(cards: Card[]): Map<number, Card[]> {
  const m = new Map<number, Card[]>()
  for (const c of cards) {
    const v = rankValue(c.rank)
    const arr = m.get(v) || []
    arr.push(c)
    m.set(v, arr)
  }
  return m
}

function isStraightValues(values: number[]): boolean {
  if (values.length < 5)
    return false
  // No 2 (15) or jokers (16/17)
  if (values.some(v => v >= 15))
    return false
  const sorted = values.slice().sort((a, b) => a - b)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]! !== sorted[i - 1]! + 1)
      return false
  }
  return true
}

/**
 * Identify a legal combination from cards.
 * Returns null if not a recognised legal combo.
 */
export function identifyCombo(cards: Card[]): Combo | null {
  if (!cards.length)
    return null
  const n = cards.length
  const byRank = countByRank(cards)
  const ranks = [...byRank.keys()].sort((a, b) => a - b)
  const counts = ranks.map(r => byRank.get(r)!.length)

  // Rocket
  if (n === 2) {
    const ids = new Set(cards.map(c => c.rank))
    if (ids.has('SJ') && ids.has('BJ')) {
      return { type: 'rocket', mainValue: 17, length: 1, cards: cards.slice() }
    }
  }

  // Bomb
  if (n === 4 && ranks.length === 1 && counts[0] === 4) {
    return { type: 'bomb', mainValue: ranks[0]!, length: 1, cards: cards.slice() }
  }

  // Four + two singles (四带二)
  if (n === 6) {
    const quadRank = ranks.find(r => byRank.get(r)!.length === 4)
    if (quadRank !== undefined) {
      return {
        type: 'four_two_singles',
        mainValue: quadRank,
        length: 1,
        cards: cards.slice(),
      }
    }
  }

  // Four + two pairs (四带两对)
  if (n === 8) {
    const quadRank = ranks.find(r => byRank.get(r)!.length === 4)
    if (quadRank !== undefined) {
      let pairUnits = 0
      for (const r of ranks) {
        if (r === quadRank)
          continue
        const count = byRank.get(r)!.length
        if (count !== 2) {
          pairUnits = -999
          break
        }
        pairUnits += 1
      }
      if (pairUnits === 2) {
        return {
          type: 'four_two_pairs',
          mainValue: quadRank,
          length: 1,
          cards: cards.slice(),
        }
      }
    }
  }

  // Single
  if (n === 1) {
    return {
      type: 'single',
      mainValue: rankValue(cards[0]!.rank),
      length: 1,
      cards: cards.slice(),
    }
  }

  // Pair
  if (n === 2 && ranks.length === 1 && counts[0] === 2) {
    return { type: 'pair', mainValue: ranks[0]!, length: 1, cards: cards.slice() }
  }

  // Triple
  if (n === 3 && ranks.length === 1 && counts[0] === 3) {
    return { type: 'triple', mainValue: ranks[0]!, length: 1, cards: cards.slice() }
  }

  // Triple + single
  if (n === 4 && ranks.length === 2) {
    const tripleRank = ranks.find(r => byRank.get(r)!.length === 3)
    const singleRank = ranks.find(r => byRank.get(r)!.length === 1)
    if (tripleRank !== undefined && singleRank !== undefined) {
      return {
        type: 'triple_one',
        mainValue: tripleRank,
        length: 1,
        cards: cards.slice(),
      }
    }
  }

  // Triple + pair
  if (n === 5 && ranks.length === 2) {
    const tripleRank = ranks.find(r => byRank.get(r)!.length === 3)
    const pairRank = ranks.find(r => byRank.get(r)!.length === 2)
    if (tripleRank !== undefined && pairRank !== undefined) {
      return {
        type: 'triple_two',
        mainValue: tripleRank,
        length: 1,
        cards: cards.slice(),
      }
    }
  }

  // Straight (all singles, ≥5 consecutive, no 2/jokers)
  if (n >= 5 && ranks.length === n && counts.every(c => c === 1)) {
    if (isStraightValues(ranks)) {
      return {
        type: 'straight',
        mainValue: Math.min(...ranks),
        length: n,
        cards: cards.slice(),
      }
    }
  }

  // Consecutive pairs (连对) ≥3 pairs
  if (
    n >= 6
    && n % 2 === 0
    && ranks.length === n / 2
    && counts.every(c => c === 2)
    && ranks.length >= 3
    && consecutiveNoTwo(ranks)
  ) {
    return {
      type: 'pair_seq',
      mainValue: Math.min(...ranks),
      length: ranks.length,
      cards: cards.slice(),
    }
  }

  // Airplane: ≥2 consecutive triples, optionally with singles or pairs
  const tripleRanks = ranks.filter(r => byRank.get(r)!.length === 3)

  if (tripleRanks.length >= 2 && consecutiveNoTwo(tripleRanks)) {
    const planeLen = tripleRanks.length
    const mainValue = Math.min(...tripleRanks)
    const body = planeLen * 3
    const rest = n - body

    // Pure airplane
    if (rest === 0 && ranks.length === planeLen) {
      return {
        type: 'airplane',
        mainValue,
        length: planeLen,
        cards: cards.slice(),
      }
    }

    // Airplane + singles (one single per triple)
    if (rest === planeLen) {
      return {
        type: 'airplane_singles',
        mainValue,
        length: planeLen,
        cards: cards.slice(),
      }
    }

    // Airplane + pairs (one pair per triple)
    if (rest === planeLen * 2) {
      let pairUnits = 0
      for (const r of ranks) {
        if (tripleRanks.includes(r))
          continue
        const c = byRank.get(r)!.length
        if (c % 2 !== 0) {
          pairUnits = -999
          break
        }
        pairUnits += c / 2
      }
      if (pairUnits === planeLen) {
        return {
          type: 'airplane_pairs',
          mainValue,
          length: planeLen,
          cards: cards.slice(),
        }
      }
    }
  }

  return null
}

function consecutiveNoTwo(values: number[]): boolean {
  if (values.length < 2)
    return false
  if (values.some(v => v >= 15))
    return false
  const sorted = values.slice().sort((a, b) => a - b)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]! !== sorted[i - 1]! + 1)
      return false
  }
  return true
}

/**
 * Can `incoming` beat `table`?
 * - Leading (table null): any legal combo
 * - Same type + length, higher mainValue
 * - Bomb beats non-bomb / lower bomb
 * - Rocket beats everything
 */
export function canBeat(incoming: Combo, table: Combo | null): boolean {
  if (!table)
    return true
  if (incoming.type === 'rocket')
    return true
  if (table.type === 'rocket')
    return false
  if (incoming.type === 'bomb' && table.type !== 'bomb')
    return true
  if (incoming.type === 'bomb' && table.type === 'bomb') {
    return incoming.mainValue > table.mainValue
  }
  if (table.type === 'bomb')
    return false
  if (incoming.type !== table.type)
    return false
  if (incoming.length !== table.length)
    return false
  return incoming.mainValue > table.mainValue
}

export function cardsEqualId(a: Card, b: Card): boolean {
  return a.id === b.id
}

/** Remove cards from hand by id. Returns null if hand missing any. */
export function removeFromHand(hand: Card[], cards: Card[]): Card[] | null {
  const ids = new Set(cards.map(c => c.id))
  if (ids.size !== cards.length)
    return null
  const remaining: Card[] = []
  const handIds = new Map(hand.map(c => [c.id, c]))
  for (const id of ids) {
    if (!handIds.has(id))
      return null
  }
  for (const c of hand) {
    if (!ids.has(c.id))
      remaining.push(c)
  }
  return remaining
}

export type PlayAction =
  | { kind: 'play', seat: number, cards: Card[] }
  | { kind: 'pass', seat: number }

/**
 * Apply a play or pass during the playing phase.
 * Win detection: first seat to empty hand wins.
 */
export function applyPlay(state: GameState, action: PlayAction): ApplyResult {
  if (state.phase !== 'playing') {
    return { ok: false, error: 'Not in playing phase', state }
  }
  if (action.seat !== state.turn) {
    return { ok: false, error: 'Not your turn', state }
  }

  const next = cloneState(state)
  const seat = action.seat as 0 | 1 | 2

  if (action.kind === 'pass') {
    // Cannot pass when leading a new trick
    if (next.lastCombo === null || next.trickLeader === null) {
      return { ok: false, error: 'Cannot pass when leading', state }
    }
    next.passCount += 1
    if (next.passCount >= PLAYER_COUNT - 1) {
      // Trick complete — leader of last play (who was not passed out) starts free
      // The player who played lastCombo is the one before the first passer chain.
      // After 2 consecutive passes, the seat after the last passer leads freely.
      // lastCombo was played by someone; free lead goes to the player who won the trick.
      // Winner of trick = the seat that played lastCombo = turn before first pass in chain.
      // We track: after passCount hits 2, next turn is the seat that played lastCombo.
      const winnerOfTrick = findTrickWinner(state)
      next.lastCombo = null
      next.passCount = 0
      next.trickLeader = null
      next.turn = winnerOfTrick
      return { ok: true, state: next }
    }
    next.turn = (action.seat + 1) % PLAYER_COUNT
    return { ok: true, state: next }
  }

  // play
  const combo = identifyCombo(action.cards)
  if (!combo) {
    return { ok: false, error: 'Illegal combination', state }
  }
  if (!canBeat(combo, next.lastCombo)) {
    return { ok: false, error: 'Cannot beat current combo', state }
  }

  const remaining = removeFromHand(next.hands[seat], action.cards)
  if (!remaining) {
    return { ok: false, error: 'Cards not in hand', state }
  }
  next.hands[seat] = sortHand(remaining)
  next.lastCombo = combo
  next.passCount = 0
  if (combo.type === 'bomb' || combo.type === 'rocket') {
    next.multiplier = (next.multiplier || 1) * 2
  }
  if (next.trickLeader === null) {
    next.trickLeader = action.seat
  }

  // Win?
  if (next.hands[seat].length === 0) {
    next.phase = 'finished'
    next.winner = action.seat
    next.winningSide = action.seat === next.landlord ? 'landlord' : 'farmers'
    return { ok: true, state: next }
  }

  next.turn = (action.seat + 1) % PLAYER_COUNT
  return { ok: true, state: next }
}

/**
 * Seat that won the current trick (played lastCombo).
 * Walk backward from current turn: the player who just played is
 * (turn) if we haven't applied the pass yet… stored state before pass:
 * last player who played is not stored explicitly; derive from passCount.
 *
 * Before applying a pass that completes the trick, passCount is PLAYER_COUNT-2
 * (about to become 2). The last play seat = current turn was the player who
 * should respond; after they pass and complete, trick winner is
 * (currentSeat - passCount - 1) mod 3? 
 *
 * Simpler: store lastPlaySeat on state. For now without that field, when
 * passCount becomes 2 at seat S (who just passed), the trick winner is
 * (S - passCount + 3) % 3? 
 * Sequence: A plays, B passes (passCount=1), C passes (passCount=2) → A wins.
 * When C passes, seat=C, passCount becomes 2, winner = A = (C - 2 + 3) % 3? 
 * C=2, (2-2+3)%3=0=A. Good.
 * A plays, B plays higher, C passes, A passes → B wins.
 * When A passes completing: seat=A=0, passCount=2, winner=(0-2+3)%3=1=B. Good.
 */
function findTrickWinner(stateBeforePass: GameState): number {
  // stateBeforePass.turn is the seat currently passing; after this pass, passCount+1 >= 2
  const passer = stateBeforePass.turn
  const newPassCount = stateBeforePass.passCount + 1
  return (passer - newPassCount + PLAYER_COUNT * 3) % PLAYER_COUNT
}

/** Public view of a seat's hand size (no card leak). */
export function handCounts(state: GameState): [number, number, number] {
  return [
    state.hands[0].length,
    state.hands[1].length,
    state.hands[2].length,
  ]
}

/** Cards still in play (for tests): 3 hands + bottom during auction, or 3 hands after. */
export function totalCardsInState(state: GameState): number {
  const hands = state.hands[0].length + state.hands[1].length + state.hands[2].length
  if (state.phase === 'auction') {
    return hands + state.bottom.length
  }
  // After auction bottom is absorbed into landlord hand
  return hands
}

/** Human-readable Chinese labels for combo types (product table feedback). */
export const COMBO_TYPE_LABELS: Record<ComboType, string> = {
  single: '单张',
  pair: '对子',
  triple: '三张',
  triple_one: '三带一',
  triple_two: '三带二',
  straight: '顺子',
  pair_seq: '连对',
  airplane: '飞机',
  airplane_singles: '飞机带单',
  airplane_pairs: '飞机带对',
  four_two_singles: '四带二',
  four_two_pairs: '四带两对',
  bomb: '炸弹',
  rocket: '王炸',
}

/** Map a combo type (or raw combo) to a display label. */
export function comboTypeLabel(typeOrCombo: ComboType | Combo | null | undefined): string {
  if (!typeOrCombo) return ''
  const type = typeof typeOrCombo === 'string' ? typeOrCombo : typeOrCombo.type
  return COMBO_TYPE_LABELS[type] || type
}

/** Stable key for a card multiset (sorted ids). */
export function playKey(cards: Card[]): string {
  return cards.map(c => c.id).sort().join('|')
}

function takeN(cards: Card[], n: number): Card[] {
  return cards.slice(0, n)
}

/**
 * Enumerate legal plays from `hand` that beat `table` (or any legal lead if table is null).
 * Returns distinct card subsets ordered roughly low→high / simple→complex for 提示 cycling.
 * Bombs/rocket are included when they beat the table.
 */
export function enumerateLegalPlays(hand: Card[], table: Combo | null): Card[][] {
  if (!hand.length) return []

  const byRank = countByRank(hand)
  const ranks = [...byRank.keys()].sort((a, b) => a - b)
  const candidates: Card[][] = []

  const push = (cards: Card[]) => {
    if (!cards.length) return
    const combo = identifyCombo(cards)
    if (!combo) return
    if (!canBeat(combo, table)) return
    candidates.push(cards)
  }

  // Singles
  for (const c of hand) push([c])

  // Pairs / triples / bombs from same rank
  for (const r of ranks) {
    const group = byRank.get(r)!
    if (group.length >= 2) push(takeN(group, 2))
    if (group.length >= 3) push(takeN(group, 3))
    if (group.length >= 4) push(takeN(group, 4))
  }

  // Four + two singles / two pairs. These are normal combinations, not bombs.
  for (const r of ranks) {
    const quad = byRank.get(r)!
    if (quad.length < 4) continue
    const body = takeN(quad, 4)
    const kickRanks = ranks.filter(x => x !== r)
    const singlesPool: Card[] = []
    for (const kr of kickRanks) singlesPool.push(...byRank.get(kr)!)
    if (singlesPool.length >= 2) {
      singlesPool.sort((a, b) => rankValue(a.rank) - rankValue(b.rank) || a.suit.localeCompare(b.suit))
      push([...body, ...singlesPool.slice(0, 2)])
    }
    const pairs: Card[][] = []
    for (const kr of kickRanks) {
      const group = byRank.get(kr)!
      if (group.length >= 2) pairs.push(takeN(group, 2))
    }
    if (pairs.length >= 2) {
      pairs.sort((a, b) => rankValue(a[0]!.rank) - rankValue(b[0]!.rank))
      push([...body, ...pairs.slice(0, 2).flat()])
    }
  }

  // Rocket
  const sj = hand.find(c => c.rank === 'SJ')
  const bj = hand.find(c => c.rank === 'BJ')
  if (sj && bj) push([sj, bj])

  // Triple + one / + pair
  for (const tr of ranks) {
    const triple = byRank.get(tr)!
    if (triple.length < 3) continue
    const body = takeN(triple, 3)
    for (const sr of ranks) {
      if (sr === tr) continue
      const others = byRank.get(sr)!
      if (others.length >= 1) push([...body, others[0]!])
      if (others.length >= 2) push([...body, ...takeN(others, 2)])
    }
  }

  // Straights of singles (length 5..12) using one card per rank
  const singleRanks = ranks.filter(r => r < 15) // no 2/jokers in straight body
  for (let len = 5; len <= Math.min(12, singleRanks.length); len++) {
    for (let i = 0; i + len <= singleRanks.length; i++) {
      const slice = singleRanks.slice(i, i + len)
      if (!consecutiveNoTwo(slice)) continue
      const cards: Card[] = []
      for (const r of slice) cards.push(byRank.get(r)![0]!)
      push(cards)
    }
  }

  // Consecutive pairs (连对) length ≥3 pairs
  const pairRanks = ranks.filter(r => r < 15 && byRank.get(r)!.length >= 2)
  for (let len = 3; len <= pairRanks.length; len++) {
    for (let i = 0; i + len <= pairRanks.length; i++) {
      const slice = pairRanks.slice(i, i + len)
      if (!consecutiveNoTwo(slice)) continue
      const cards: Card[] = []
      for (const r of slice) cards.push(...takeN(byRank.get(r)!, 2))
      push(cards)
    }
  }

  // Airplane pure (≥2 consecutive triples)
  const tripRanks = ranks.filter(r => r < 15 && byRank.get(r)!.length >= 3)
  for (let len = 2; len <= tripRanks.length; len++) {
    for (let i = 0; i + len <= tripRanks.length; i++) {
      const slice = tripRanks.slice(i, i + len)
      if (!consecutiveNoTwo(slice)) continue
      const body: Card[] = []
      for (const r of slice) body.push(...takeN(byRank.get(r)!, 3))

      // pure airplane
      push(body.slice())

      // airplane + singles
      const kickRanks = ranks.filter(r => !slice.includes(r))
      const singlesPool: Card[] = []
      for (const r of kickRanks) {
        for (const c of byRank.get(r)!) singlesPool.push(c)
      }
      if (singlesPool.length >= len) {
        // take lowest `len` singles by rank value
        singlesPool.sort((a, b) => rankValue(a.rank) - rankValue(b.rank) || a.suit.localeCompare(b.suit))
        push([...body, ...singlesPool.slice(0, len)])
      }

      // airplane + pairs
      const pairKick: Card[][] = []
      for (const r of kickRanks) {
        const g = byRank.get(r)!
        if (g.length >= 2) pairKick.push(takeN(g, 2))
      }
      if (pairKick.length >= len) {
        pairKick.sort((a, b) => rankValue(a[0]!.rank) - rankValue(b[0]!.rank))
        const attached = pairKick.slice(0, len).flat()
        push([...body, ...attached])
      }
    }
  }

  // Deduplicate + stable order: smaller length first, then lower mainValue, then key
  const seen = new Set<string>()
  const unique: { cards: Card[], combo: Combo, key: string }[] = []
  for (const cards of candidates) {
    const key = playKey(cards)
    if (seen.has(key)) continue
    const combo = identifyCombo(cards)
    if (!combo || !canBeat(combo, table)) continue
    seen.add(key)
    unique.push({ cards, combo, key })
  }

  unique.sort((a, b) => {
    // Prefer non-bomb/rocket first when free or when same-type beats exist
    const aBoom = a.combo.type === 'bomb' || a.combo.type === 'rocket' ? 1 : 0
    const bBoom = b.combo.type === 'bomb' || b.combo.type === 'rocket' ? 1 : 0
    if (aBoom !== bBoom) return aBoom - bBoom
    if (a.cards.length !== b.cards.length) return a.cards.length - b.cards.length
    if (a.combo.mainValue !== b.combo.mainValue) return a.combo.mainValue - b.combo.mainValue
    return a.key.localeCompare(b.key)
  })

  return unique.map(u => u.cards)
}

/**
 * Cycle helper for 提示: return the next legal play after `currentKey` (sorted id key),
 * wrapping to the first option. Empty list → null.
 */
export function nextHintPlay(
  hand: Card[],
  table: Combo | null,
  currentKey: string | null = null,
): { cards: Card[], key: string, index: number, total: number } | null {
  const plays = enumerateLegalPlays(hand, table)
  if (!plays.length) return null
  let idx = 0
  if (currentKey) {
    const found = plays.findIndex(p => playKey(p) === currentKey)
    idx = found >= 0 ? (found + 1) % plays.length : 0
  }
  const cards = plays[idx]!
  return { cards, key: playKey(cards), index: idx, total: plays.length }
}

/** True when residual hand size should show 报牌 alarm (1 or 2 cards left). */
export function shouldAlarmCount(count: number): boolean {
  return count === 1 || count === 2
}
