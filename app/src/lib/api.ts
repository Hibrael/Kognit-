/** Endereço da API KOGNIT: VITE_API_URL no build (APK/web); vazio = mesma origem (proxy do Vite em desenvolvimento). */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let tokenGetter: () => string | null = () => null
let onUnauthorized: () => void = () => {}
export function configureAuth(getToken: () => string | null, unauthorized: () => void) {
  tokenGetter = getToken
  onUnauthorized = unauthorized
}

/** Mensagem de erro da API (ProblemDetails): o primeiro erro de validação ou o título. */
function problemMessage(j: { title?: string; errors?: Record<string, string[]> } | null): string | null {
  const first = j?.errors && Object.values(j.errors).flat()[0]
  return first || j?.title || null
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = tokenGetter()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let body = init.body
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(init.json)
  }
  let res: Response
  try {
    res = await fetch(BASE + path, { ...init, headers, body })
  } catch {
    throw new ApiError(0, 'Sem conexão')
  }
  // 401 sem token é login recusado (a mensagem vem da API); com token, a sessão expirou
  if (res.status === 401 && token) {
    onUnauthorized()
    throw new ApiError(401, 'Sessão expirada')
  }
  if (!res.ok) {
    let msg: string | null = null
    try { msg = problemMessage(await res.json()) } catch { /* corpo vazio */ }
    throw new ApiError(res.status, msg ?? 'Não foi salvo · Tentar de novo')
  }
  if (res.status === 202 || res.status === 204) return null as T
  const type = res.headers.get('content-type') ?? ''
  return (type.includes('json') ? res.json() : res.text()) as Promise<T>
}
