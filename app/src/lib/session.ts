import { api, configureAuth } from './api'
import type { TokenResponse } from './types'

// Sessão: o token JWT da API KOGNIT vai em Authorization: Bearer.

const KEY = 'kognit:token'
let token: string | null = null
try { token = localStorage.getItem(KEY) } catch { /* sem armazenamento */ }

const listeners = new Set<() => void>()
export const onSessionChange = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f) } }

export const getToken = () => token

export function setToken(t: string | null) {
  if (t === token) return
  token = t
  try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY) } catch { /* sem armazenamento */ }
  listeners.forEach(f => f())
}

// 401 em qualquer rota → volta para o login
configureAuth(() => token, () => setToken(null))

export async function entrar(email: string, senha: string) {
  setToken((await api<TokenResponse>('/api/auth/entrar', { method: 'POST', json: { email, senha } })).token)
}

export async function registrar(dados: { nome: string; email: string; senha: string; nomeNegocio: string }) {
  setToken((await api<TokenResponse>('/api/auth/registrar', { method: 'POST', json: dados })).token)
}
