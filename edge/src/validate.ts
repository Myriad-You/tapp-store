/** Pure validation helpers (unit-testable without KV). */

import type { HitEvent, HitRequestBody } from './types.ts'

// Reverse-domain app ids; segments may include hyphens (e.g. music-player).
const APP_ID_RE = /^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)+$/i
const IDEMPOTENCY_RE = /^[A-Za-z0-9._:-]{8,128}$/
const VERSION_RE = /^[A-Za-z0-9._+-]{1,64}$/

export function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return fallback
}

export function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  max?: number,
): number {
  const n = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  if (max !== undefined && n > max) return max
  return n
}

export function isValidAppId(appId: string): boolean {
  if (!appId || appId.length > 128) return false
  return APP_ID_RE.test(appId)
}

export function isValidHitEvent(event: unknown): event is HitEvent {
  return event === 'install' || event === 'update'
}

export type HitValidationOk = { ok: true; body: HitRequestBody }
export type HitValidationErr = { ok: false; error: string; code: string }

export function validateHitBody(raw: unknown): HitValidationOk | HitValidationErr {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'JSON body required', code: 'invalid_body' }
  }
  const o = raw as Record<string, unknown>

  const appId = typeof o.app_id === 'string' ? o.app_id.trim() : ''
  if (!isValidAppId(appId)) {
    return { ok: false, error: 'invalid app_id', code: 'invalid_app_id' }
  }

  if (!isValidHitEvent(o.event)) {
    return {
      ok: false,
      error: 'event must be install or update',
      code: 'invalid_event',
    }
  }

  const idem =
    typeof o.idempotency_key === 'string' ? o.idempotency_key.trim() : ''
  if (!IDEMPOTENCY_RE.test(idem)) {
    return {
      ok: false,
      error: 'idempotency_key must be 8–128 chars [A-Za-z0-9._:-]',
      code: 'invalid_idempotency_key',
    }
  }

  let version: string | undefined
  if (o.version !== undefined && o.version !== null) {
    if (typeof o.version !== 'string' || !VERSION_RE.test(o.version.trim())) {
      return { ok: false, error: 'invalid version', code: 'invalid_version' }
    }
    version = o.version.trim()
  }

  const body: HitRequestBody = {
    app_id: appId,
    event: o.event,
    idempotency_key: idem,
    version,
  }

  if (typeof o.source === 'string' && o.source.length <= 64) {
    body.source = o.source
  }
  if (typeof o.client === 'string' && o.client.length <= 64) {
    body.client = o.client
  }
  if (typeof o.myriad_version === 'string' && o.myriad_version.length <= 32) {
    body.myriad_version = o.myriad_version
  }
  if (
    typeof o.instance_hash === 'string' &&
    /^[a-f0-9]{8,64}$/i.test(o.instance_hash)
  ) {
    body.instance_hash = o.instance_hash.toLowerCase()
  }

  return { ok: true, body }
}

/** Parse apps query: apps=a,b,c or repeated app= / apps=. */
export function parseAppIdList(
  searchParams: URLSearchParams,
  maxBatch: number,
): { ok: true; ids: string[] } | { ok: false; error: string; code: string } {
  const collected: string[] = []
  const appsParam = searchParams.get('apps')
  if (appsParam) {
    for (const part of appsParam.split(',')) {
      const id = part.trim()
      if (id) collected.push(id)
    }
  }
  for (const id of searchParams.getAll('app')) {
    const t = id.trim()
    if (t) collected.push(t)
  }

  if (collected.length === 0) {
    return {
      ok: false,
      error: 'provide apps=id1,id2 or app=id (max batch size applies)',
      code: 'missing_apps',
    }
  }

  const unique: string[] = []
  const seen = new Set<string>()
  for (const id of collected) {
    if (!isValidAppId(id)) {
      return { ok: false, error: `invalid app_id: ${id}`, code: 'invalid_app_id' }
    }
    if (seen.has(id)) continue
    seen.add(id)
    unique.push(id)
    if (unique.length > maxBatch) {
      return {
        ok: false,
        error: `at most ${maxBatch} app ids per request`,
        code: 'batch_too_large',
      }
    }
  }

  return { ok: true, ids: unique }
}
