/**
 * tapp-store-stats — Cloudflare Worker
 *
 * Routes:
 *   GET  /health
 *   GET  /v1/stats?apps=a,b | ?app=id | ?top=N
 *   POST /v1/hit
 *   OPTIONS *  (CORS preflight)
 */

import { preflight, withCors } from './cors.ts'
import { handleHit } from './hit.ts'
import { handleStats } from './stats.ts'
import { SERVICE_VERSION, type Env, type ErrorBody } from './types.ts'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      assertEnv(env)
      const response = await route(request, env)
      return withCors(request, response)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'internal error'
      const body: ErrorBody = { ok: false, error: message, code: 'internal' }
      return withCors(
        request,
        new Response(JSON.stringify(body), {
          status: 500,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }),
      )
    }
  },
}

function assertEnv(env: Env): void {
  if (!env.STATS) {
    throw new Error('STATS KV binding missing — configure [[kv_namespaces]]')
  }
}

async function route(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return preflight(request)
  }

  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'

  if (path === '/health' || path === '/') {
    return new Response(
      JSON.stringify({
        ok: true,
        service: 'tapp-store-stats',
        version: SERVICE_VERSION,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      },
    )
  }

  if (path === '/v1/hit') {
    return handleHit(request, env)
  }

  if (path === '/v1/stats') {
    return handleStats(request, env)
  }

  return new Response(
    JSON.stringify({
      ok: false,
      error: 'not found',
      code: 'not_found',
    } satisfies ErrorBody),
    {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    },
  )
}
