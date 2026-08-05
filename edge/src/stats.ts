/** GET /v1/stats handler — batch / single / top (10k-safe, no full dump). */

import { getCounters, getCountersBatch, readTopIndex } from './kv.ts'
import type { Env, ErrorBody, StatsAppEntry, StatsResponse } from './types.ts'
import { parseAppIdList, parsePositiveInt } from './validate.ts'

export async function handleStats(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonError(405, 'method not allowed', 'method_not_allowed')
  }

  const url = new URL(request.url)
  const maxBatch = parsePositiveInt(env.STATS_MAX_BATCH, 100, 200)
  const topMax = parsePositiveInt(env.STATS_TOP_MAX, 100, 200)

  // Leaderboard: never scans all KV keys — uses maintained top index.
  const topParam = url.searchParams.get('top')
  if (topParam !== null) {
    const n = Math.min(
      topMax,
      Math.max(1, Number.parseInt(topParam, 10) || 20),
    )
    const top = await readTopIndex(env, n)
    const apps: Record<string, StatsAppEntry> = {}
    // Re-read live counters so top list stays accurate after concurrent hits.
    const ids = top.map((e) => e.id)
    const live = await getCountersBatch(env, ids)
    for (const id of ids) {
      const c = live[id] ?? { installs: 0, updates: 0 }
      apps[id] = toEntry(c.installs, c.updates)
    }
    return jsonStats(apps)
  }

  // Explicit app list (UI overlay path).
  const single = url.searchParams.get('app')
  const appsParam = url.searchParams.get('apps')
  if (single || appsParam || url.searchParams.getAll('app').length > 0) {
    const parsed = parseAppIdList(url.searchParams, maxBatch)
    if (!parsed.ok) {
      return jsonError(400, parsed.error, parsed.code)
    }
    const live = await getCountersBatch(env, parsed.ids)
    const apps: Record<string, StatsAppEntry> = {}
    for (const id of parsed.ids) {
      const c = live[id] ?? { installs: 0, updates: 0 }
      // Only include apps that have ever been counted — keeps payload small
      // and UI can treat missing as "no data" (do not show 0).
      if (c.installs > 0 || c.updates > 0) {
        apps[id] = toEntry(c.installs, c.updates)
      } else {
        // Still return zeros when explicitly asked so clients can merge easily;
        // FE decides not to display 0.
        apps[id] = toEntry(0, 0)
      }
    }
    return jsonStats(apps)
  }

  // Unbounded full dump is rejected at 10k scale — force clients to batch.
  return jsonError(
    400,
    'provide apps=id1,id2, app=id, or top=N (full dump disabled for scale)',
    'query_required',
  )
}

function toEntry(installs: number, updates: number): StatsAppEntry {
  return { installs, updates, downloads: installs }
}

function jsonStats(apps: Record<string, StatsAppEntry>): Response {
  const body: StatsResponse = {
    updated_at: new Date().toISOString(),
    apps,
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Short CDN/browser cache — counters are near-real-time, not live tick.
      'Cache-Control': 'public, max-age=60',
    },
  })
}

function jsonError(status: number, error: string, code: string): Response {
  const body: ErrorBody = { ok: false, error, code }
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

// re-export for tests that want single-app read without HTTP
export { getCounters }
