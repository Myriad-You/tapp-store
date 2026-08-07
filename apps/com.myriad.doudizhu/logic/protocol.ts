/**
 * Multiplayer 斗地主 protocol — encode/decode/apply over federation room messages.
 *
 * Transport: federation Room custom messages with `message_type: 'doudizhu'`.
 * Realtime path: `Tapp.federation.sendRoomMessage` + `subscribeRoom` / `onMessage`
 * (persisted room messages + WebSocket fan-out). No separate private/direct hand
 * channel exists in the current Tapp Federation API, so host-trusted multiplayer
 * must treat room payloads as visible transport and avoid retaining opponent
 * hands in honest clients.
 *
 * Sequencing model (critical for multiplayer):
 * - **Host owns the single global `seq` stream.** Only the host assigns `seq`
 *   on canonical {@link ProtocolMessage}s and rebroadcasts them.
 * - Peers send {@link IntentMessage}s (no competing seq). Host validates,
 *   seats joiners, assigns the next seq, and emits canonical messages.
 * - Peers apply only host-sequenced canonical messages via
 *   {@link applyProtocolMessage}. Never drop a peer's intent because of a
 *   foreign lastSeq — intents are not seq-gated that way.
 */

import type { Card, GameState } from './rules.ts'
import {
  applyBid,
  applyPlay,
  createLobbyState,
  handCounts,
  startDeal,
} from './rules.ts'

/** Room message_type for all game payloads. */
export const DOUDIZHU_MESSAGE_TYPE = 'doudizhu'

export type SeatIndex = 0 | 1 | 2

/** Deterministic seat map: sorted actor ids → seats 0..2. */
export function assignSeats(actorIds: string[]): Record<string, SeatIndex> {
  if (actorIds.length !== 3) {
    throw new Error(`assignSeats expects 3 actors, got ${actorIds.length}`)
  }
  const sorted = actorIds.slice().sort((a, b) => a.localeCompare(b))
  const map: Record<string, SeatIndex> = {}
  sorted.forEach((id, i) => {
    map[id] = i as SeatIndex
  })
  return map
}

export function seatForActor(
  seats: Record<string, SeatIndex>,
  actorId: string,
): SeatIndex | null {
  const s = seats[actorId]
  return s === undefined ? null : s
}

/**
 * Insert actor into the first free seat (0..2), or leave unchanged if already seated.
 * Returns null if table is full and actor is not already seated.
 */
export function seatActor(
  seats: Record<string, SeatIndex>,
  actorId: string,
): Record<string, SeatIndex> | null {
  if (seats[actorId] !== undefined)
    return { ...seats }
  const used = new Set(Object.values(seats))
  for (let i = 0; i < 3; i++) {
    if (!used.has(i as SeatIndex)) {
      return { ...seats, [actorId]: i as SeatIndex }
    }
  }
  return null
}

export type ProtocolMessage =
  | {
    type: 'lobby_sync'
    seq: number
    seats: Record<string, SeatIndex>
    ready: Record<string, boolean>
    hostActor: string
  }
  | {
    type: 'ready'
    seq: number
    actorId: string
    ready: boolean
  }
  | {
    /** Host starts a match. Current room transport is visible to members. */
    type: 'deal_start'
    seq: number
    seed: number
    auctionStart: number
    seats: Record<string, SeatIndex>
    hostActor: string
    /** Full hands for host-authoritative sync; runtime sanitizes opponent hands on non-host clients. */
    hands: [Card[], Card[], Card[]]
    bottom: Card[]
  }
  | {
    type: 'bid'
    seq: number
    seat: SeatIndex
    score: 1 | 2 | 3
  }
  | {
    type: 'bid_pass'
    seq: number
    seat: SeatIndex
  }
  | {
    type: 'play'
    seq: number
    seat: SeatIndex
    cards: Card[]
  }
  | {
    type: 'pass'
    seq: number
    seat: SeatIndex
  }
  | {
    /** Host forces redeal after all-pass auction. */
    type: 'redeal'
    seq: number
    seed: number
    auctionStart: number
    hands: [Card[], Card[], Card[]]
    bottom: Card[]
    seats?: Record<string, SeatIndex>
    hostActor?: string
  }
  | {
    type: 'state_sync'
    seq: number
    /** Public snapshot + optional own hand for late joiners. */
    public: PublicGameView
    ownHand?: Card[]
    ownSeat?: SeatIndex
  }

/**
 * Peer → host intent (no global seq). Host turns these into canonical ProtocolMessages.
 * `clientNonce` is for host-side dedup of redelivered intents.
 */
export type IntentMessage = {
  type: 'intent'
  actorId: string
  clientNonce: string
  action:
    | { kind: 'ready', ready: boolean }
    | { kind: 'bid', score: 1 | 2 | 3 }
    | { kind: 'bid_pass' }
    | { kind: 'play', cards: Card[] }
    | { kind: 'pass' }
    | { kind: 'join' }
}

export type WirePayload = ProtocolMessage | IntentMessage

export interface PublicGameView {
  phase: GameState['phase']
  seed: number
  handCounts: [number, number, number]
  bottom: Card[]
  landlord: number | null
  bidScore: number
  bidWinner: number | null
  turn: number
  trickLeader: number | null
  lastCombo: GameState['lastCombo']
  passCount: number
  auctionStart: number
  multiplier: number
  winner: number | null
  winningSide: GameState['winningSide']
  seats: Record<string, SeatIndex>
  hostActor: string
}

export interface SessionState {
  /** Host-assigned monotonic seq of last applied *canonical* message. */
  lastSeq: number
  seats: Record<string, SeatIndex>
  ready: Record<string, boolean>
  hostActor: string
  game: GameState
  myActorId: string
  /** Host-only: nonces already accepted (intent dedup). */
  seenNonces: Record<string, true>
}

export function createSession(myActorId: string): SessionState {
  return {
    lastSeq: 0,
    seats: {},
    ready: {},
    hostActor: '',
    game: createLobbyState(),
    myActorId,
    seenNonces: {},
  }
}

/** Next host-owned sequence number. */
export function hostNextSeq(session: SessionState): number {
  return session.lastSeq + 1
}

export function toPublicView(
  game: GameState,
  seats: Record<string, SeatIndex>,
  hostActor: string,
): PublicGameView {
  return {
    phase: game.phase,
    seed: game.seed,
    handCounts: handCounts(game),
    bottom: game.landlord !== null
      ? game.bottom
      : game.phase === 'auction'
        ? game.bottom.map(() => ({ id: '?', suit: 'J', rank: 'SJ' as const }))
        : [],
    landlord: game.landlord,
    bidScore: game.bidScore,
    bidWinner: game.bidWinner,
    turn: game.turn,
    trickLeader: game.trickLeader,
    lastCombo: game.lastCombo,
    passCount: game.passCount,
    auctionStart: game.auctionStart,
    multiplier: game.multiplier,
    winner: game.winner,
    winningSide: game.winningSide,
    seats: { ...seats },
    hostActor,
  }
}

/** Encode a wire payload as a room message. */
export function encodeRoomPayload(msg: WirePayload): {
  message_type: string
  payload: WirePayload
} {
  return {
    message_type: DOUDIZHU_MESSAGE_TYPE,
    payload: msg,
  }
}

function extractPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object')
    return null
  const obj = raw as Record<string, unknown>
  let messageType = obj.message_type
  let payload = obj.payload

  if (obj.data && typeof obj.data === 'object') {
    const data = obj.data as Record<string, unknown>
    if (data.message_type !== undefined) {
      messageType = data.message_type
      payload = data.payload
    }
  }

  // federation:message event shape: { scope, roomId, data }
  if (obj.scope === 'room' && obj.data && typeof obj.data === 'object') {
    const d = obj.data as Record<string, unknown>
    messageType = (d.message_type as string) || (messageType as string)
    payload = d.payload !== undefined ? d.payload : d
  }

  if (messageType !== undefined && messageType !== DOUDIZHU_MESSAGE_TYPE)
    return null
  return payload
}

/** Decode a room WS/REST message into a wire payload, or null if not ours. */
export function decodeRoomMessage(raw: unknown): WirePayload | null {
  const payload = extractPayload(raw)
  if (!payload || typeof payload !== 'object')
    return null
  const p = payload as Record<string, unknown>
  if (p.type === 'intent') {
    if (typeof p.actorId !== 'string' || typeof p.clientNonce !== 'string' || !p.action)
      return null
    return p as IntentMessage
  }
  if (!p.type || typeof p.seq !== 'number')
    return null
  return p as ProtocolMessage
}

export function isIntent(msg: WirePayload): msg is IntentMessage {
  return msg.type === 'intent'
}

export function isCanonical(msg: WirePayload): msg is ProtocolMessage {
  return msg.type !== 'intent'
}

export interface ApplyProtocolResult {
  ok: boolean
  error?: string
  session: SessionState
  /** Host should emit a redeal after all-pass. */
  needsRedeal?: boolean
}

/**
 * Apply a host-sequenced canonical message.
 * Idempotent for the same seq: applying twice is a no-op after first.
 * Only host-owned seq stream — never used for peer-local seq counters.
 */
export function applyProtocolMessage(
  session: SessionState,
  msg: ProtocolMessage,
): ApplyProtocolResult {
  // Duplicate / old seq: treat as success no-op (network redelivery)
  if (msg.seq > 0 && msg.seq <= session.lastSeq) {
    return { ok: true, session }
  }
  // Require contiguous seq for game actions (allow first message any positive seq)
  if (session.lastSeq > 0 && msg.seq !== session.lastSeq + 1) {
    // Allow lobby_sync / state_sync / deal_start / redeal to jump (host reset)
    if (
      msg.type !== 'lobby_sync'
      && msg.type !== 'state_sync'
      && msg.type !== 'deal_start'
      && msg.type !== 'redeal'
    ) {
      return {
        ok: false,
        error: `Seq gap: expected ${session.lastSeq + 1}, got ${msg.seq}`,
        session,
      }
    }
  }

  const next: SessionState = {
    ...session,
    seats: { ...session.seats },
    ready: { ...session.ready },
    seenNonces: { ...session.seenNonces },
    game: session.game,
  }

  switch (msg.type) {
    case 'lobby_sync': {
      next.seats = { ...msg.seats }
      next.ready = { ...msg.ready }
      next.hostActor = msg.hostActor
      // Only reset game when still in lobby / not mid-match
      if (next.game.phase === 'lobby' || next.game.phase === 'finished') {
        next.game = createLobbyState()
      }
      next.lastSeq = msg.seq
      return { ok: true, session: next }
    }
    case 'ready': {
      // Seat joiner if not yet seated
      if (next.seats[msg.actorId] === undefined) {
        const seated = seatActor(next.seats, msg.actorId)
        if (seated)
          next.seats = seated
      }
      next.ready[msg.actorId] = msg.ready
      next.lastSeq = msg.seq
      return { ok: true, session: next }
    }
    case 'deal_start': {
      next.seats = { ...msg.seats }
      next.hostActor = msg.hostActor
      const fromSeed = startDeal(msg.seed, msg.auctionStart)
      next.game = {
        ...fromSeed,
        hands: [
          msg.hands[0].map(c => ({ ...c })),
          msg.hands[1].map(c => ({ ...c })),
          msg.hands[2].map(c => ({ ...c })),
        ],
        bottom: msg.bottom.map(c => ({ ...c })),
      }
      next.lastSeq = msg.seq
      return { ok: true, session: next }
    }
    case 'redeal': {
      const fromSeed = startDeal(msg.seed, msg.auctionStart)
      next.game = {
        ...fromSeed,
        hands: [
          msg.hands[0].map(c => ({ ...c })),
          msg.hands[1].map(c => ({ ...c })),
          msg.hands[2].map(c => ({ ...c })),
        ],
        bottom: msg.bottom.map(c => ({ ...c })),
      }
      if (msg.seats)
        next.seats = { ...msg.seats }
      if (msg.hostActor)
        next.hostActor = msg.hostActor
      next.lastSeq = msg.seq
      return { ok: true, session: next }
    }
    case 'bid': {
      const r = applyBid(next.game, { kind: 'bid', seat: msg.seat, score: msg.score })
      if (!r.ok)
        return { ok: false, error: r.error, session }
      next.game = r.state
      next.lastSeq = msg.seq
      return { ok: true, session: next, needsRedeal: r.redeal }
    }
    case 'bid_pass': {
      const r = applyBid(next.game, { kind: 'pass', seat: msg.seat })
      if (!r.ok)
        return { ok: false, error: r.error, session }
      next.game = r.state
      next.lastSeq = msg.seq
      return { ok: true, session: next, needsRedeal: r.redeal }
    }
    case 'play': {
      const r = applyPlay(next.game, { kind: 'play', seat: msg.seat, cards: msg.cards })
      if (!r.ok)
        return { ok: false, error: r.error, session }
      next.game = r.state
      next.lastSeq = msg.seq
      return { ok: true, session: next }
    }
    case 'pass': {
      const r = applyPlay(next.game, { kind: 'pass', seat: msg.seat })
      if (!r.ok)
        return { ok: false, error: r.error, session }
      next.game = r.state
      next.lastSeq = msg.seq
      return { ok: true, session: next }
    }
    case 'state_sync': {
      next.seats = { ...msg.public.seats }
      next.hostActor = msg.public.hostActor
      next.game = {
        ...next.game,
        phase: msg.public.phase,
        seed: msg.public.seed,
        landlord: msg.public.landlord,
        bidScore: msg.public.bidScore,
        bidWinner: msg.public.bidWinner,
        turn: msg.public.turn,
        trickLeader: msg.public.trickLeader,
        lastCombo: msg.public.lastCombo,
        passCount: msg.public.passCount,
        auctionStart: msg.public.auctionStart,
        multiplier: msg.public.multiplier || 1,
        winner: msg.public.winner,
        winningSide: msg.public.winningSide,
        bottom: msg.public.bottom.map(c => ({ ...c })),
      }
      if (msg.ownHand && msg.ownSeat !== undefined) {
        next.game.hands[msg.ownSeat] = msg.ownHand.map(c => ({ ...c }))
      }
      next.lastSeq = msg.seq
      return { ok: true, session: next }
    }
    default:
      return { ok: false, error: 'Unknown message type', session }
  }
}

export interface HostIntentResult {
  ok: boolean
  error?: string
  session: SessionState
  /** Canonical messages the host must broadcast (in order). */
  emit: ProtocolMessage[]
  needsRedeal?: boolean
}

/**
 * Host-side: accept a peer (or self) intent, seat joiners, assign host seqs,
 * apply to host session, and return canonical messages to rebroadcast.
 *
 * Peers must NOT assign global seqs; they only send intents.
 */
export function hostProcessIntent(
  session: SessionState,
  intent: IntentMessage,
): HostIntentResult {
  if (intent.type !== 'intent') {
    return { ok: false, error: 'Not an intent', session, emit: [] }
  }
  if (session.seenNonces[intent.clientNonce]) {
    // Idempotent redelivery
    return { ok: true, session, emit: [] }
  }

  let next: SessionState = {
    ...session,
    seats: { ...session.seats },
    ready: { ...session.ready },
    seenNonces: { ...session.seenNonces, [intent.clientNonce]: true },
    game: session.game,
  }

  const emit: ProtocolMessage[] = []
  const action = intent.action

  if (action.kind === 'join' || action.kind === 'ready') {
    const seated = seatActor(next.seats, intent.actorId)
    if (!seated && next.seats[intent.actorId] === undefined) {
      return { ok: false, error: 'Table full', session, emit: [] }
    }
    if (seated)
      next.seats = seated

    const readyVal = action.kind === 'ready' ? action.ready : false
    if (action.kind === 'ready')
      next.ready[intent.actorId] = readyVal
    else if (next.ready[intent.actorId] === undefined)
      next.ready[intent.actorId] = false

    const readyMsg: ProtocolMessage = {
      type: 'ready',
      seq: hostNextSeq(next),
      actorId: intent.actorId,
      ready: next.ready[intent.actorId] === true,
    }
    const appliedReady = applyProtocolMessage(next, readyMsg)
    if (!appliedReady.ok)
      return { ok: false, error: appliedReady.error, session, emit: [] }
    next = appliedReady.session
    emit.push(readyMsg)

    // Always lobby_sync after seat changes so peers share seats map
    const sync: ProtocolMessage = {
      type: 'lobby_sync',
      seq: hostNextSeq(next),
      seats: next.seats,
      ready: next.ready,
      hostActor: next.hostActor || session.hostActor,
    }
    const appliedSync = applyProtocolMessage(next, sync)
    if (!appliedSync.ok)
      return { ok: false, error: appliedSync.error, session, emit: [] }
    next = appliedSync.session
    emit.push(sync)
    return { ok: true, session: next, emit }
  }

  // Game actions require a seat
  const seat = seatForActor(next.seats, intent.actorId)
  if (seat === null) {
    return { ok: false, error: 'Actor not seated', session, emit: [] }
  }

  let canonical: ProtocolMessage
  if (action.kind === 'bid') {
    canonical = { type: 'bid', seq: hostNextSeq(next), seat, score: action.score }
  }
  else if (action.kind === 'bid_pass') {
    canonical = { type: 'bid_pass', seq: hostNextSeq(next), seat }
  }
  else if (action.kind === 'play') {
    canonical = { type: 'play', seq: hostNextSeq(next), seat, cards: action.cards }
  }
  else if (action.kind === 'pass') {
    canonical = { type: 'pass', seq: hostNextSeq(next), seat }
  }
  else {
    return { ok: false, error: 'Unknown intent action', session, emit: [] }
  }

  const applied = applyProtocolMessage(next, canonical)
  if (!applied.ok)
    return { ok: false, error: applied.error, session, emit: [] }
  emit.push(canonical)
  return {
    ok: true,
    session: applied.session,
    emit,
    needsRedeal: applied.needsRedeal,
  }
}

/**
 * Host helper: build deal_start from a seed and three actor ids.
 * Uses hostNextSeq from session when provided via seq arg.
 */
export function buildDealStart(
  seq: number,
  seed: number,
  actorIds: string[],
  hostActor: string,
  auctionStart = 0,
): ProtocolMessage {
  const seats = assignSeats(actorIds)
  const dealt = startDeal(seed, auctionStart)
  return {
    type: 'deal_start',
    seq,
    seed,
    auctionStart,
    seats,
    hostActor,
    hands: dealt.hands,
    bottom: dealt.bottom,
  }
}

/** True when three distinct actors are seated and all ready. */
export function canStartMatch(
  seats: Record<string, SeatIndex>,
  ready: Record<string, boolean>,
): boolean {
  const actors = Object.keys(seats)
  if (actors.length !== 3)
    return false
  const seatVals = new Set(Object.values(seats))
  if (seatVals.size !== 3)
    return false
  return actors.every(a => ready[a] === true)
}

/**
 * Own hand for a seat (private). Peers should only call with their own seat.
 */
export function ownHand(game: GameState, seat: SeatIndex): Card[] {
  return game.hands[seat].map(c => ({ ...c }))
}

/** Create a peer intent with a unique nonce. */
export function makeIntent(
  actorId: string,
  action: IntentMessage['action'],
  nonce?: string,
): IntentMessage {
  return {
    type: 'intent',
    actorId,
    clientNonce: nonce || `n-${actorId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    action,
  }
}
