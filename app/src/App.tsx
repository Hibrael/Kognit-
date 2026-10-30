import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError } from './lib/api'
import { todaySP, monthOf } from './lib/format'
import { AppCtx, usePref, type AppState, type Tab, type TxPreset } from './lib/store'
import type { Recurring, TxType, UndoToken } from './lib/types'
import { Overview } from './pages/Overview'
import { Projection } from './pages/Projection'
import { Statement } from './pages/Statement'
import { Icon } from './ui/Icon'
import { RecDialog } from './ui/RecDialog'
import { SettingsSheet } from './ui/SettingsSheet'
import { TxDialog } from './ui/TxDialog'
import { HouseSection } from './ui/HouseSection'
import { CategoryRulesSection, MercadoPagoSection, PluggySection } from './ui/IntegrationSections'
import { SimilarDialog } from './ui/SimilarDialog'
import { subscribeEvents } from './lib/session'

export interface Me { email: string; name: string | null; household: { id: string; name: string; role: 'owner' | 'member' } }

const TODAY = todaySP()
const CUR = monthOf(TODAY)
const THEME_KEY = 'minhascontas:theme'

function effectiveTheme() {
  return document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}

interface ToastState { msg: string; undo: UndoToken | null; retry?: () => void; id: number }

export default function App({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  const [version, setVersion] = useState(0)
  const [tab, setTab] = usePref<Tab>('tab', 'geral')
  const [extMonth, setExtMonth] = useState(CUR)
  const [extDay, setExtDay] = useState<string | null>(null)
  const [projOpen, setProjOpen] = useState<string | null>(null)
  const [txPreset, setTxPreset] = useState<TxPreset | null>(null)
  const [rec, setRec] = useState<{ open: boolean; rec: Recurring | null }>({ open: false, rec: null })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [similar, setSimilar] = useState<{ matchValue: string; category: string } | null>(null)
  const [toastState, setToastState] = useState<ToastState | null>(null)
  const [theme, setTheme] = useState(effectiveTheme)
  const [online, setOnline] = useState(navigator.onLine)
  const [categories, setCategories] = useState<Record<TxType, string[]>>({ in: [], out: [] })
  const undoStack = useRef<UndoToken[]>([])
  const toastTimer = useRef<number>(0)

  const refresh = useCallback(() => setVersion(v => v + 1), [])

  const toast = useCallback((msg: string, undo: UndoToken | null = null, retry?: () => void) => {
    setToastState({ msg, undo, retry, id: Date.now() })
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastState(null), 5000)
  }, [])

  // desfazer (16.2): pilha local de até 20 ações; recusado se outra pessoa alterou a linha depois
  const runUndo = useCallback(async (token?: UndoToken) => {
    const t = token ?? undoStack.current.pop()
    if (!t) return
    undoStack.current = undoStack.current.filter(x => x !== t)
    setToastState(null)
    try {
      await api('/api/undo', { method: 'POST', json: t })
      refresh()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível desfazer')
    }
  }, [refresh, toast])

  const mutate = useCallback<AppState['mutate']>(async (run, opts) => {
    // sem conexão: somente leitura (16.1)
    if (!navigator.onLine) { toast('Sem conexão — somente leitura'); return null }
    try {
      const res = await run()
      undoStack.current.push(res.undo)
      if (undoStack.current.length > 20) undoStack.current.shift()
      if (!opts?.silent) toast(res.message, res.undo)
      refresh()
      return res
    } catch (e) {
      const msg = e instanceof ApiError && e.status !== 0 && e.status < 500 ? e.message : 'Não foi salvo'
      toast(msg, null, () => { void mutate(run, opts) })
      refresh()
      return null
    }
  }, [refresh, toast])

  const go = useCallback((t: Tab) => { setTab(t); window.scrollTo({ top: 0 }) }, [setTab])

  // tempo real: outra pessoa (ou a sincronização) gravou → recarrega; avisos com "Desfazer" (8.7)
  useEffect(() => subscribeEvents({
    changed: refresh,
    notice: d => {
      if (d.undo) { undoStack.current.push(d.undo); if (undoStack.current.length > 20) undoStack.current.shift() }
      toast(d.message, d.undo ?? null)
      refresh()
    },
  }), [refresh, toast])

  useEffect(() => {
    api<Record<TxType, string[]>>('/api/categories').then(setCategories).catch(() => {})
  }, [version])

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // atalhos: N = novo lançamento (sempre hoje); Ctrl/⌘+Z = desfazer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const typing = (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) || document.querySelector('dialog[open]')
      if (typing) return
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setTxPreset({ kind: 'new', date: TODAY }) }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && undoStack.current.length) { e.preventDefault(); void runUndo() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [runUndo])

  const toggleTheme = () => {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem(THEME_KEY, next) } catch { /* sem armazenamento */ }
    setTheme(next)
  }

  const state = useMemo<AppState>(() => ({
    version, refresh, tab, go, mutate, undoLast: () => void runUndo(), toast,
    openTx: setTxPreset, openRec: r => setRec({ open: true, rec: r ?? null }), openSettings: () => setSettingsOpen(true),
    extMonth, setExtMonth, extDay, setExtDay, projOpen, setProjOpen, online,
  }), [version, refresh, tab, go, mutate, runUndo, toast, extMonth, extDay, projOpen, online])

  const tabs: [Tab, string, string][] = [['geral', 'Visão geral', 'Início'], ['extrato', 'Extrato', 'Extrato'], ['projecao', 'Fixos e projeção', 'Projeção']]

  return (
    <AppCtx.Provider value={state}>
      <header className="top">
        <div className="wrap">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true"><i /></div>
            <h1>Minhas contas</h1>
          </div>
          <nav className="seg nav" aria-label="Seções">
            {tabs.map(([t, long, shortName]) => (
              <button key={t} type="button" aria-current={tab === t ? 'page' : undefined} onClick={() => go(t)}>
                <span className="nl">{long}</span><span className="ns">{shortName}</span>
              </button>
            ))}
          </nav>
          <div className="top-actions">
            <button className="btn primary" type="button" title="Novo lançamento (N)" disabled={!online}
              onClick={() => setTxPreset({ kind: 'new', date: tab === 'extrato' && extDay ? extDay : TODAY })}>
              <Icon name="plus" /><span className="add-label">Lançamento</span>
            </button>
            <button className="icon-btn" type="button" aria-label="Alternar tema claro/escuro" title="Alternar tema" onClick={toggleTheme}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
            <button className="icon-btn" type="button" aria-label="Configurações" title="Configurações" onClick={() => setSettingsOpen(true)}>
              <Icon name="sliders" />
            </button>
          </div>
        </div>
      </header>
      {!online && <div className="offline" role="status">Sem conexão — somente leitura</div>}

      <main className="wrap">
        {tab === 'geral' && <Overview />}
        {tab === 'extrato' && <Statement />}
        {tab === 'projecao' && <Projection />}
      </main>

      <TxDialog preset={txPreset} today={TODAY} categories={categories} onClose={() => setTxPreset(null)}
        onCategoryChanged={(matchValue, category) => setSimilar({ matchValue, category })} />
      <SimilarDialog value={similar} onClose={() => setSimilar(null)} />
      <RecDialog open={rec.open} rec={rec.rec} cur={CUR} onClose={() => setRec({ open: false, rec: null })} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        {settingsOpen && <>
          <HouseSection role={me.household.role} onSignOut={onSignOut} />
          <PluggySection />
          <MercadoPagoSection />
          <CategoryRulesSection />
        </>}
      </SettingsSheet>

      <div className={'toast' + (toastState ? ' on' : '')} role="status" aria-live="polite">
        <span>{toastState?.msg}</span>
        {toastState?.undo && <button type="button" onClick={() => void runUndo(toastState.undo!)}>Desfazer</button>}
        {toastState?.retry && <button type="button" onClick={() => { setToastState(null); toastState.retry!() }}>Tentar de novo</button>}
      </div>
    </AppCtx.Provider>
  )
}

