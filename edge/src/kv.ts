/** KV counter / dedupe / rate helpers. */

import {
  COUNTER_KEY_PREFIX,
  DEDUPE_KEY_PREFIX,
  DEDUPE_TTL_SEC,
  META_TOP_INDEX,
  RATE_KEY_PREFIX,
  RATE_TTL_SEC,
  type AppCounters,
  type Env,
} from './types.ts'

export function counterKey(appId: string): string {
  return `${COUNTER_KEY_PREFIX}${appId}`
}

export function dedupeKey(idempotencyKey: string): string {
  return `${DEDUPE_KEY_PREFIX}${idempotencyKey}`
}

export function rateKey(ipHash: string, minuteBucket: number): string {
  return `${RATE_KEY_PREFIX}${ipHash}:${minuteBucket}`
}

export function emptyCounters(): AppCounters {
  return { installs: 0, updates: 0 }
}

export function parseCounters(raw: string | null): AppCounters {
  if (!raw) return emptyCounters()
  try {
    const o = JSON.parse(raw) as Partial<AppCounters>
    return {
      installs: Math.max(0, Math.floor(Number(o.installs) || 0)),
      updates: Math.max(0, Math.floor(Number(o.updates) || 0)),
    }
  } catch {
    return emptyCounters()
  }
}

export async function getCounters(
  env: Env,
  appId: string,
): Promise<AppCounters> {
  const raw = await env.STATS.get(counterKey(appId))
  return parseCounters(raw)
}

export async function getCountersBatch(
  env: Env,
  appIds: string[],
): Promise<Record<string, AppCounters>> {
  const out: Record<string, AppCounters> = {}
  // KV has no multi-get in all runtimes; parallel gets scale fine for ≤100.
  await Promise.all(
    appIds.map(async (id) => {
      out[id] = await getCounters(env, id)
    }),
  )
  return out
}

/**
 * Increment counters if idempotency key is new.
 * Returns whether this call counted, and the resulting counters.
 */
export async function incrementIfNew(
  env: Env,
  appId: string,
  event: 'install' | 'update',
  idempotencyKey: string,
): Promise<{ counted: boolean; counters: AppCounters }> {
  const dKey = dedupeKey(idempotencyKey)
  const existing = await env.STATS.get(dKey)
  if (existing !== null) {
    const counters = await getCounters(env, appId)
    return { counted: false, counters }
  }

  // Mark dedupe first to reduce double-count under race (second writer sees key).
  await env.STATS.put(dKey, '1', { expirationTtl: DEDUPE_TTL_SEC })

  const counters = await getCounters(env, appId)
  if (event === 'install') counters.installs += 1
  else counters.updates += 1

  await env.STATS.put(counterKey(appId), JSON.stringify(counters))
  // Best-effort maintain a compact top-installs index for /v1/stats?top=
  void touchTopIndex(env, appId, counters.installs)

  return { counted: true, counters }
}

/** Soft IP rate limit. Returns false when over limit. */
export async function checkRateLimit(
  env: Env,
  ip: string,
  limitPerMin: number,
): Promise<boolean> {
  if (limitPerMin <= 0) return true
  const minuteBucket = Math.floor(Date.now() / 60_000)
  const ipHash = await sha256Hex(ip).then((h) => h.slice(0, 16))
  const key = rateKey(ipHash, minuteBucket)
  const raw = await env.STATS.get(key)
  const count = raw ? Number.parseInt(raw, 10) || 0 : 0
  if (count >= limitPerMin) return false
  await env.STATS.put(key, String(count + 1), { expirationTtl: RATE_TTL_SEC })
  return true
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

interface TopEntry {
  id: string
  installs: number
}

/**
 * Maintain a small top-N list in one KV value so we never need a full scan
 * of 10k counter keys for leaderboard reads.
 */
async function touchTopIndex(
  env: Env,
  appId: string,
  installs: number,
): Promise<void> {
  try {
    const raw = await env.STATS.get(META_TOP_INDEX)
    let list: TopEntry[] = []
    if (raw) {
      try {
        list = JSON.parse(raw) as TopEntry[]
        if (!Array.isArray(list)) list = []
      } catch {
        list = []
      }
    }
    const filtered = list.filter((e) => e && e.id !== appId)
    filtered.push({ id: appId, installs })
    filtered.sort((a, b) => b.installs - a.installs || a.id.localeCompare(b.id))
    // Keep headroom above STATS_TOP_MAX for concurrent churn
    const trimmed = filtered.slice(0, 200)
    await env.STATS.put(META_TOP_INDEX, JSON.stringify(trimmed))
  } catch {
    // non-fatal
  }
}

export async function readTopIndex(
  env: Env,
  limit: number,
): Promise<TopEntry[]> {
  const raw = await env.STATS.get(META_TOP_INDEX)
  if (!raw) return []
  try {
    const list = JSON.parse(raw) as TopEntry[]
    if (!Array.isArray(list)) return []
    return list
      .filter(
        (e) =>
          e &&
          typeof e.id === 'string' &&
          typeof e.installs === 'number' &&
          e.installs > 0,
      )
      .slice(0, limit)
  } catch {
    return []
  }
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    '0.0.0.0'
  )
}
