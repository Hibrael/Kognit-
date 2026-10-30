import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { googleStartUrl, isNative, setToken, type AuthOptions } from '../lib/session'

/** Login (RF-16, 10.3): Google ou link mágico; só os e-mails do casal entram. */
export function Login({ message, openExternal }: { message: string | null; openExternal: (url: string) => void }) {
  const [opts, setOpts] = useState<AuthOptions | null>(null)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(message)

  useEffect(() => {
    api<AuthOptions>('/api/auth/options').then(setOpts).catch(() => setError('Sem conexão'))
  }, [])

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) { setError('Informe seu e-mail'); return }
    setState('sending'); setError(null)
    try {
      await api('/api/auth/magic-link', { method: 'POST', json: { email: email.trim(), client: isNative() ? 'app' : 'web' } })
      setState('sent')
    } catch (err) {
      setState('idle')
      setError(err instanceof ApiError ? err.message : 'Sem conexão')
    }
  }

  const devLogin = async () => {
    setError(null)
    try { setToken((await api<{ token: string }>('/api/auth/dev', { method: 'POST', json: { email: email.trim() } })).token) }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Sem conexão') }
  }

  return (
    <main className="auth">
      <div className="card auth-card">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><i /></div>
          <h1>Minhas contas</h1>
        </div>
        <p className="sec-sub">Entre com o e-mail cadastrado para a casa.</p>
        {opts?.google && (
          <button type="button" className="btn full" onClick={() => openExternal(googleStartUrl())}>Entrar com Google</button>
        )}
        {state === 'sent' ? (
          <p className="auth-note">Link enviado para <b>{email.trim()}</b>. Abra o e-mail neste aparelho para entrar.</p>
        ) : (
          <form className="stack-sm" onSubmit={sendLink} noValidate>
            <label className="fld"><span>E-mail</span>
              <input className="input" type="email" autoComplete="email" inputMode="email" value={email}
                onChange={e => { setEmail(e.target.value); setError(null) }} />
            </label>
            {(opts?.magicLink ?? true) && (
              <button type="submit" className="btn primary full" disabled={state === 'sending'}>
                {state === 'sending' ? 'Enviando…' : 'Receber link de acesso'}
              </button>
            )}
            {opts?.dev && <button type="button" className="btn ghost full" onClick={devLogin}>Entrar sem link (desenvolvimento)</button>}
          </form>
        )}
        {error && <p className="auth-error" role="alert">{error}</p>}
      </div>
    </main>
  )
}
