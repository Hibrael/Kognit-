import { useCallback, useEffect, useState } from 'react'
import App, { type Me } from './App'
import { api, ApiError } from './lib/api'
import { getToken, handleAuthReturn, onSessionChange, refreshSession, setToken } from './lib/session'
import { Login } from './pages/Login'
import { Welcome } from './pages/Welcome'
import { listenAuthDeepLinks, openExternal as openPlatform } from './native/platform'

type MeState = Omit<Me, 'household'> & { household: Me['household'] | null }

/** Portão de entrada (10.3): login → "Bem-vindo" (sem casa) → app. */
export function Root({ openExternal = openPlatform }: { openExternal?: (url: string) => void }) {
  const [token, setTok] = useState(getToken())
  const [me, setMe] = useState<MeState | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => onSessionChange(() => { setTok(getToken()); setMe(null) }), [])

  // volta do link mágico ou do Google, e renovação do token ao abrir
  useEffect(() => {
    handleAuthReturn().then(msg => { if (msg) setMessage(msg) })
    listenAuthDeepLinks(msg => { if (msg) setMessage(msg) })
    void refreshSession()
  }, [])

  const loadMe = useCallback(() => {
    if (!getToken()) return
    setFailed(false)
    api<MeState>('/api/me').then(setMe).catch(e => { if (!(e instanceof ApiError && e.status === 401)) setFailed(true) })
  }, [])
  useEffect(() => { if (token) loadMe() }, [token, loadMe])

  const signOut = () => { setToken(null); setMessage(null) }

  if (!token) return <Login message={message} openExternal={openExternal} />
  if (failed) {
    return (
      <main className="auth"><div className="card empty">Não foi possível carregar · <button type="button" className="link-btn" onClick={loadMe}>Tentar de novo</button></div></main>
    )
  }
  if (!me) return <div className="state-loading" role="status" aria-label="Carregando"><span className="spinner" /></div>
  if (!me.household) return <Welcome email={me.email} onDone={loadMe} onSignOut={signOut} />
  return <App me={me as Me} onSignOut={signOut} />
}
