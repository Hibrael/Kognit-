import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from './lib/api'
import { todaySP, monthOf } from './lib/format'
import { AppCtx, usePref, type AppState, type Tab, type TxPreset } from './lib/store'
import type { Usuario } from './lib/types'
import { Overview } from './pages/Overview'
import { Projection } from './pages/Projection'
import { Statement } from './pages/Statement'
import { ContaDialog } from './ui/ContaDialog'
import { Icon } from './ui/Icon'
import { SettingsSheet } from './ui/SettingsSheet'
import { TxDialog } from './ui/TxDialog'

const TODAY = todaySP()
const CUR = monthOf(TODAY)
const THEME_KEY = 'minhascontas:theme'

function effectiveTheme() {
  return document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}

interface ToastState { msg: string; retry?: () => void; id: number }

export default function App({ me, onMeChanged, onSignOut }: { me: Usuario; onMeChanged: (u: Usuario) => void; onSignOut: () => void }) {
  const [version, setVersion] = useState(0)
  const [tab, setTab] = usePref<Tab>('tab', 'geral')
  const [extMonth, setExtMonth] = useState(CUR)
  const [extDay, setExtDay] = useState<string | null>(null)
  const [txPreset, setTxPreset] = useState<TxPreset | null>(null)
  const [contaOpen, setContaOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toastState, setToastState] = useState<ToastState | null>(null)
  const [theme, setTheme] = useState(effectiveTheme)
  const [online, setOnline] = useState(navigator.onLine)
  const toastTimer = useRef<number>(0)

  const refresh = useCallback(() => setVersion(v => v + 1), [])

  const toast = useCallback((msg: string, retry?: () => void) => {
    setToastState({ msg, retry, id: Date.now() })
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastState(null), 5000)
  }, [])

  const write = useCallback(async function run(fn: () => Promise<unknown>, message: string): Promise<boolean> {
    // sem conexão: somente leitura (16.1)
    if (!navigator.onLine) { toast('Sem conexão — somente leitura'); return false }
    try {
      await fn()
      toast(message)
      refresh()
      return true
    } catch (e) {
      const msg = e instanceof ApiError && e.status !== 0 && e.status < 500 ? e.message : 'Não foi salvo'
      toast(msg, () => { void run(fn, message) })
      refresh()
      return false
    }
  }, [refresh, toast])

  const go = useCallback((t: Tab) => { setTab(t); window.scrollTo({ top: 0 }) }, [setTab])

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // atalho: N = novo lançamento (sempre hoje)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const typing = (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) || document.querySelector('dialog[open]')
      if (typing) return
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setTxPreset({ date: TODAY }) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const toggleTheme = () => {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem(THEME_KEY, next) } catch { /* sem armazenamento */ }
    setTheme(next)
  }

  const state = useMemo<AppState>(() => ({
    version, refresh, tab, go, write, toast,
    openTx: setTxPreset, openConta: () => setContaOpen(true), openSettings: () => setSettingsOpen(true),
    extMonth, setExtMonth, extDay, setExtDay, online,
  }), [version, refresh, tab, go, write, toast, extMonth, extDay, online])

  const tabs: [Tab, string, string][] = [['geral', 'Visão geral', 'Início'], ['extrato', 'Extrato', 'Extrato'], ['projecao', 'Contas e previsão', 'Previsão']]

  return (
    <AppCtx.Provider value={state}>
      <header className="top">
        <div className="wrap">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true"><i /></div>
            <h1>Kognit</h1>
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
              onClick={() => setTxPreset({ date: tab === 'extrato' && extDay ? extDay : TODAY })}>
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

      <TxDialog preset={txPreset} today={TODAY} onClose={() => setTxPreset(null)} />
      <ContaDialog open={contaOpen} today={TODAY} onClose={() => setContaOpen(false)} />
      <SettingsSheet open={settingsOpen} me={me} onMeChanged={onMeChanged} onSignOut={onSignOut} onClose={() => setSettingsOpen(false)} />

      <div className={'toast' + (toastState ? ' on' : '')} role="status" aria-live="polite">
        <span>{toastState?.msg}</span>
        {toastState?.retry && <button type="button" onClick={() => { setToastState(null); toastState.retry!() }}>Tentar de novo</button>}
      </div>
    </AppCtx.Provider>
  )
}
