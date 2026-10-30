import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api, ApiError } from './api'
import type { MutationResult, Recurring, Tx, TxType, UndoToken } from './types'

export type Tab = 'geral' | 'extrato' | 'projecao'

/** Como o diálogo de lançamento abre: edição, confirmação de conta fixa ou novo (com data). */
export type TxPreset =
  | { kind: 'edit'; tx: Tx }
  | { kind: 'confirm'; recurringId: string; k: string; name: string; type: TxType; category: string; amount: number }
  | { kind: 'new'; date?: string; type?: TxType; description?: string; amount?: number; inboxId?: string }

export interface AppState {
  version: number
  refresh: () => void
  tab: Tab
  go: (t: Tab) => void
  /** Executa uma escrita: mostra o aviso com "Desfazer" (RF-15) ou "Não foi salvo · Tentar de novo" (16.1). */
  mutate: (run: () => Promise<MutationResult>, opts?: { silent?: boolean }) => Promise<MutationResult | null>
  undoLast: () => void
  toast: (msg: string, undo?: UndoToken | null, retry?: () => void) => void
  openTx: (p: TxPreset) => void
  openRec: (r?: Recurring) => void
  openSettings: () => void
  extMonth: string
  setExtMonth: (k: string) => void
  extDay: string | null
  setExtDay: (d: string | null) => void
  projOpen: string | null
  setProjOpen: (k: string | null) => void
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

export interface ViewState<T> { data: T | null; error: string | null; loading: boolean; reload: () => void }

/**
 * Carrega uma tela da API (16.1): primeira carga com indicador por até 10 s, depois erro com "Tentar de novo";
 * recargas mantêm a tela anterior.
 */
export function useView<T>(path: string | null): ViewState<T> {
  const { version } = useApp()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)
  const seq = useRef(0)

  useEffect(() => {
    if (!path) return
    const my = ++seq.current
    setLoading(true)
    const timer = setTimeout(() => {
      if (seq.current === my) { setError('Não foi possível carregar'); setLoading(false) }
    }, 10_000)
    api<T>(path)
      .then(d => { if (seq.current === my) { setData(d); setError(null) } })
      .catch((e: unknown) => {
        if (seq.current === my && !(e instanceof ApiError && e.status === 401)) setError('Não foi possível carregar')
      })
      .finally(() => { clearTimeout(timer); if (seq.current === my) setLoading(false) })
    return () => clearTimeout(timer)
  }, [path, version, nonce])

  return { data, error, loading, reload: () => setNonce(n => n + 1) }
}
