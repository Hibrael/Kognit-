import { useState } from 'react'
import { api, ApiError } from '../lib/api'
import { todaySP } from '../lib/format'

/** "Bem-vindo" (10.3): sem casa ainda → criar a casa ou entrar com o código de convite. */
export function Welcome({ email, onDone, onSignOut }: { email: string; onDone: () => void; onSignOut: () => void }) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [name, setName] = useState('Casa')
  const [date, setDate] = useState(todaySP())
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (f: () => Promise<unknown>) => {
    setBusy(true); setError(null)
    try { await f(); onDone() }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Sem conexão') }
    finally { setBusy(false) }
  }

  return (
    <main className="auth">
      <div className="card auth-card">
        <h2 className="sec-title">Bem-vindo</h2>
        <p className="sec-sub">Você entrou como {email}.</p>
        {mode === 'choose' && (
          <div className="stack-sm">
            <button type="button" className="btn primary full" onClick={() => setMode('create')}>Criar minha casa</button>
            <button type="button" className="btn full" onClick={() => setMode('join')}>Tenho um código</button>
          </div>
        )}
        {mode === 'create' && (
          <form className="stack-sm" noValidate onSubmit={e => { e.preventDefault(); run(() => api('/api/households', { method: 'POST', json: { name, openingDate: date } })) }}>
            <label className="fld"><span>Nome da casa</span><input className="input" maxLength={60} value={name} onChange={e => setName(e.target.value)} /></label>
            <label className="fld"><span>Data do saldo inicial</span><input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
            <p className="hint">O saldo inicial é informado depois, em Configurações.</p>
            <button type="submit" className="btn primary full" disabled={busy}>Criar</button>
            <button type="button" className="btn ghost full" onClick={() => setMode('choose')}>Voltar</button>
          </form>
        )}
        {mode === 'join' && (
          <form className="stack-sm" noValidate onSubmit={e => { e.preventDefault(); run(() => api('/api/households/join', { method: 'POST', json: { code } })) }}>
            <label className="fld"><span>Código de convite</span>
              <input className="input code-input" maxLength={8} autoCapitalize="characters" autoComplete="off" value={code}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
            </label>
            <button type="submit" className="btn primary full" disabled={busy || code.length !== 8}>Entrar na casa</button>
            <button type="button" className="btn ghost full" onClick={() => setMode('choose')}>Voltar</button>
          </form>
        )}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="button" className="link-btn auth-out" onClick={onSignOut}>Sair</button>
      </div>
    </main>
  )
}
