import { api, apiUrl, configureAuth, DEMO } from './api'

// Sessão (10.3): o token é opaco para o front; vai em Authorization: Bearer.

const KEY = 'minhascontas:token'
let token: string | null = null
try { token = localStorage.getItem(KEY) } catch { /* sem armazenamento */ }
if (DEMO && !token) token = 'demo'   // modo demonstração entra direto

const listeners = new Set<() => void>()
export const onSessionChange = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f) } }
const emit = () => listeners.forEach(f => f())

export const getToken = () => token

export function setToken(t: string | null) {
  const changed = t !== token
  token = t
  try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY) } catch { /* sem armazenamento */ }
  // renovar com o mesmo token não é troca de sessão: não recarrega o usuário
  if (changed) emit()
}

// 401 em qualquer rota → volta para o login sem perder a aba (a aba fica nas preferências do aparelho)
configureAuth(() => token, () => setToken(null))

/** O app roda dentro do Capacitor (APK)? */
export const isNative = () =>
  !!(globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()

export interface AuthOptions { google: boolean; magicLink: boolean; dev: boolean }

/**
 * Volta do link mágico (?token=) ou do Google (?code=, ?error=). Troca pelo token de sessão e limpa a URL,
 * mantendo ?hoje= se houver. Devolve a mensagem de erro, se houver.
 */
export async function handleAuthReturn(url: string = location.href): Promise<string | null> {
  const u = new URL(url)
  const t = u.searchParams.get('token'), code = u.searchParams.get('code'), error = u.searchParams.get('error')
  if (!t && !code && !error) return null
  if (u.protocol.startsWith('http')) {
    for (const k of ['token', 'code', 'error']) u.searchParams.delete(k)
    history.replaceState(null, '', u.pathname + (u.search ? u.search : '') + u.hash)
  }
  if (error) return error
  try {
    const r = await api<{ token: string }>(t ? '/api/auth/verify' : '/api/auth/exchange', { method: 'POST', json: { token: t ?? code } })
    setToken(r.token)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : 'Não foi possível entrar'
  }
}

/** Renova o token ao abrir o app (mantém a sessão viva enquanto o app é usado). */
export async function refreshSession() {
  if (!token) return
  try { setToken((await api<{ token: string }>('/api/auth/refresh', { method: 'POST' })).token) } catch { /* 401 já desloga */ }
}

export const googleStartUrl = () => apiUrl(`/api/auth/google/start?client=${isNative() ? 'app' : 'web'}`)

/** Tempo real (Server-Sent Events, contrato /api/events). Reconecta sozinho. */
export function subscribeEvents(on: { changed: () => void; notice: (d: { message: string; undo?: Record<string, unknown> }) => void }) {
  if (DEMO) return () => {}   // sem servidor, sem eventos
  let es: EventSource | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  const open = () => {
    if (stopped || !token) return
    const u = new URL(apiUrl('/api/events'), location.href)
    u.searchParams.set('access_token', token)
    es = new EventSource(u)
    es.addEventListener('changed', () => on.changed())
    es.addEventListener('notice', e => { try { on.notice(JSON.parse((e as MessageEvent).data)) } catch { /* evento malformado */ } })
    // o EventSource reconecta sozinho; se o servidor recusar (ex.: 401), tenta de novo em 5 s
    es.onerror = () => {
      if (es?.readyState === EventSource.CLOSED) { es = null; timer = setTimeout(open, 5000) }
    }
  }
  open()
  return () => { stopped = true; clearTimeout(timer); es?.close() }
}
