import { useCallback, useEffect, useState } from 'react'
import App from './App'
import { api, ApiError } from './lib/api'
import { getToken, onSessionChange, setToken } from './lib/session'
import type { Usuario } from './lib/types'
import { SlowNote } from './ui/common'
import { Login } from './pages/Login'

/** Portão de entrada: login → app. */
export function Root() {
  const [token, setTok] = useState(getToken())
  const [me, setMe] = useState<Usuario | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => onSessionChange(() => { setTok(getToken()); setMe(null) }), [])

  const loadMe = useCallback(() => {
    if (!getToken()) return
    setFailed(false)
    api<Usuario>('/api/usuario').then(setMe).catch(e => { if (!(e instanceof ApiError && e.status === 401)) setFailed(true) })
  }, [])
  useEffect(() => { if (token) loadMe() }, [token, loadMe])

  if (!token) return <Login />
  if (failed) {
    return (
      <main className="auth"><div className="card empty">Não foi possível carregar · <button type="button" className="link-btn" onClick={loadMe}>Tentar de novo</button></div></main>
    )
  }
  if (!me) return <div className="state-loading" role="status" aria-label="Carregando"><div className="stack-sm"><span className="spinner" /><SlowNote /></div></div>
  return <App me={me} onMeChanged={setMe} onSignOut={() => setToken(null)} />
}
