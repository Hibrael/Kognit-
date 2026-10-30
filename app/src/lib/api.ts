import { isDate } from './format'

/** Endereço da API: VITE_API_URL no build (APK/web); vazio = mesma origem (proxy do Vite em desenvolvimento). */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export class ApiError extends Error {
  readonly status: number
  readonly field?: string
  constructor(status: number, message: string, field?: string) {
    super(message)
    this.status = status
    this.field = field
  }
}

/** Repassa ?hoje= (simulação de data, só aceita pela API em desenvolvimento). */
function withToday(path: string) {
  const q = new URLSearchParams(location.search).get('hoje')
  if (!isDate(q)) return path
  return path + (path.includes('?') ? '&' : '?') + 'hoje=' + q
}

let tokenGetter: () => string | null = () => null
let onUnauthorized: () => void = () => {}
export function configureAuth(getToken: () => string | null, unauthorized: () => void) {
  tokenGetter = getToken
  onUnauthorized = unauthorized
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
    res = await fetch(BASE + withToday(path), { ...init, headers, body })
  } catch {
    throw new ApiError(0, 'Sem conexão')
  }
  if (res.status === 401) {
    onUnauthorized()
    throw new ApiError(401, 'Sessão expirada')
  }
  if (!res.ok) {
    let msg = 'Não foi salvo · Tentar de novo', field: string | undefined
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
      field = j?.field
    } catch { /* corpo vazio */ }
    throw new ApiError(res.status, msg, field)
  }
  const type = res.headers.get('content-type') ?? ''
  return (type.includes('application/json') ? res.json() : res.text()) as Promise<T>
}

export const apiUrl = (path: string) => BASE + withToday(path)
