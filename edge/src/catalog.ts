/** Official catalog allowlist — cached in KV for ~10k app ids. */

import {
  META_CATALOG_IDS,
  META_CATALOG_TS,
  type Env,
} from './types.ts'
import { parsePositiveInt } from './validate.ts'

export async function isAppAllowed(
  env: Env,
  appId: string,
  allowUnknown: boolean,
): Promise<boolean> {
  if (allowUnknown) return true
  const ids = await getCatalogIds(env)
  // Empty allowlist (first boot / fetch failure): fail open only if we have never
  // successfully stored a list; otherwise fail closed.
  if (ids === null) return true
  return ids.has(appId)
}

/**
 * Returns Set of allowed app ids, or null if no cached list exists yet
 * (caller may fail-open). On stale cache, refreshes in background when possible.
 */
export async function getCatalogIds(env: Env): Promise<Set<string> | null> {
  const ttlSec = parsePositiveInt(env.CATALOG_IDS_TTL_SEC, 600)
  const tsRaw = await env.STATS.get(META_CATALOG_TS)
  const ts = tsRaw ? Number.parseInt(tsRaw, 10) : 0
  const ageMs = Date.now() - (Number.isFinite(ts) ? ts : 0)
  const cached = await env.STATS.get(META_CATALOG_IDS)

  if (cached && ageMs < ttlSec * 1000) {
    return parseIdSet(cached)
  }

  // Stale or missing: try refresh (await so first hit after deploy gets list).
  const fresh = await refreshCatalogIds(env)
  if (fresh) return fresh
  if (cached) return parseIdSet(cached)
  return null
}

export async function refreshCatalogIds(
  env: Env,
): Promise<Set<string> | null> {
  const url = env.CATALOG_URL?.trim()
  if (!url) return null
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'tapp-store-stats/1',
      },
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit)
    if (!res.ok) return null
    const data = (await res.json()) as { apps?: Array<{ id?: string }> }
    const ids = new Set<string>()
    if (Array.isArray(data.apps)) {
      for (const app of data.apps) {
        if (app && typeof app.id === 'string' && app.id.trim()) {
          ids.add(app.id.trim())
        }
      }
    }
    // Cap defensive size (10k apps is fine; 100k would be abuse of catalog)
    if (ids.size > 50_000) {
      return null
    }
    const arr = [...ids]
    await env.STATS.put(META_CATALOG_IDS, JSON.stringify(arr))
    await env.STATS.put(META_CATALOG_TS, String(Date.now()))
    return ids
  } catch {
    return null
  }
}

function parseIdSet(raw: string): Set<string> {
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(
      arr.filter((x): x is string => typeof x === 'string' && x.length > 0),
    )
  } catch {
    return new Set()
  }
}
