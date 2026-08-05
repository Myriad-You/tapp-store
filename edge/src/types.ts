/** Shared types for tapp-store-stats edge worker. */

export type HitEvent = 'install' | 'update'

export type HitClient = 'myriad-backend' | 'myriad-browser' | 'other'

export interface Env {
  STATS: KVNamespace
  CATALOG_URL: string
  ALLOW_UNKNOWN_APPS: string
  HIT_RATE_LIMIT_PER_MIN: string
  STATS_MAX_BATCH: string
  STATS_TOP_MAX: string
  CATALOG_IDS_TTL_SEC: string
}

export interface AppCounters {
  installs: number
  updates: number
}

export interface HitRequestBody {
  app_id: string
  version?: string
  event: HitEvent
  source?: string
  idempotency_key: string
  client?: HitClient | string
  myriad_version?: string
  instance_hash?: string
}

export interface HitResponse {
  ok: true
  counted: boolean
  downloads: number
  installs: number
  updates: number
}

export interface StatsAppEntry {
  installs: number
  updates: number
  /** Alias of installs — matches index.json field name. */
  downloads: number
}

export interface StatsResponse {
  updated_at: string
  apps: Record<string, StatsAppEntry>
}

export interface ErrorBody {
  ok: false
  error: string
  code?: string
}

export const SERVICE_VERSION = '1'
export const COUNTER_KEY_PREFIX = 'c:v1:'
export const DEDUPE_KEY_PREFIX = 'd:v1:'
export const RATE_KEY_PREFIX = 'rl:v1:'
export const META_CATALOG_IDS = 'meta:v1:catalog_ids'
export const META_CATALOG_TS = 'meta:v1:catalog_ids_ts'
export const META_TOP_INDEX = 'meta:v1:top_installs'
export const DEDUPE_TTL_SEC = 48 * 60 * 60
export const RATE_TTL_SEC = 70
