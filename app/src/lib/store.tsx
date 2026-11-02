import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api, ApiError } from './api'
import type { TipoLancamento } from './types'

export type Tab = 'geral' | 'extrato' | 'projecao'

/** Como o diálogo de lançamento abre (sempre um lançamento novo: o que vem do banco não se edita). */
export interface TxPreset { date?: string; tipo?: TipoLancamento }

export interface AppState {
  version: number
  refresh: () => void
  tab: Tab
  go: (t: Tab) => void
  /** Executa uma escrita: mostra a mensagem e recarrega a tela, ou o erro com "Tentar de novo" (16.1). */
  write: (run: () => Promise<unknown>, message: string) => Promise<boolean>
  toast: (msg: string, retry?: () => void) => void
  openTx: (p: TxPreset) => void
  openConta: () => void
  openSettings: () => void
  extMonth: string
  setExtMonth: (k: string) => void
  extDay: string | null
  setExtDay: (d: string | null) => void
  online: boolean
}

export const AppCtx = createContext<AppState>(null!)
export const useApp = () => useContext(AppCtx)

/** Preferências do aparelho (16.5): localStorage, sempre com try/catch. */
export function usePref<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem('minhascontas:' + key)
      return raw == null ? initial : (JSON.parse(raw) as T)
    } catch { return initial }
  })
  const set = useCallback((nv: T) => {
    setV(nv)
    try { localStorage.setItem('minhascontas:' + key, JSON.stringify(nv)) } catch { /* sem armazenamento */ }
  }, [key])
  return [v, set]
}

export interface ViewState<T> { data: T | null; error: string | null; loading: boolean; slow: boolean; reload: () => void }

/** Depois deste tempo sem resposta, avisa que o servidor pode estar ligando (Render grátis dorme sem uso). */
export const SLOW_MS = 4_000
/** O Render grátis leva até ~1 min para acordar: só desiste depois disso. */
const TIMEOUT_MS = 90_000

/**
 * Carrega uma tela da API (16.1): primeira carga com indicador (e aviso se demorar), depois erro com "Tentar de novo";
 * recargas mantêm a tela anterior. `key` muda quando os dados pedidos mudam; `load` é opcional (padrão: GET key).
 */
export function useView<T>(key: string | null, load?: () => Promise<T>): ViewState<T> {
  const { version } = useApp()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [slow, setSlow] = useState(false)
  const [nonce, setNonce] = useState(0)
  const seq = useRef(0)
  const loader = useRef(load)
  loader.current = load

  useEffect(() => {
    if (!key) return
    const my = ++seq.current
    setLoading(true)
    const slowTimer = setTimeout(() => { if (seq.current === my) setSlow(true) }, SLOW_MS)
    const timer = setTimeout(() => {
      if (seq.current === my) { setError('Não foi possível carregar'); setLoading(false) }
    }, TIMEOUT_MS)
    ;(loader.current ? loader.current() : api<T>(key))
      .then(d => { if (seq.current === my) { setData(d); setError(null) } })
      .catch((e: unknown) => {
        if (seq.current === my && !(e instanceof ApiError && e.status === 401)) setError('Não foi possível carregar')
      })
      .finally(() => { clearTimeout(timer); clearTimeout(slowTimer); if (seq.current === my) { setLoading(false); setSlow(false) } })
    return () => { clearTimeout(timer); clearTimeout(slowTimer) }
  }, [key, version, nonce])

  return { data, error, loading, slow, reload: () => setNonce(n => n + 1) }
}
