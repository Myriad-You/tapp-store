/** CORS helpers — public anonymous stats API. */

const ALLOW_HEADERS = 'content-type'
const ALLOW_METHODS = 'GET, POST, OPTIONS'

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin')
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': ALLOW_METHODS,
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function withCors(request: Request, response: Response): Response {
  const headers = new Headers(response.headers)
  const extra = corsHeaders(request)
  for (const [k, v] of Object.entries(extra)) {
    headers.set(k, v)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export function preflight(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  })
}
