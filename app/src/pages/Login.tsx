import { useEffect, useState } from 'react'
import { ApiError } from '../lib/api'
import { entrar, registrar } from '../lib/session'
import { SLOW_MS } from '../lib/store'

/** Login da API KOGNIT: e-mail e senha, ou criar a conta do negócio. */
export function Login() {
  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar')
  const [nome, setNome] = useState('')
  const [nomeNegocio, setNomeNegocio] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [busy, setBusy] = useState(false)
  const [slow, setSlow] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // o servidor grátis dorme sem uso: se o login demorar, explica em vez de parecer travado
  useEffect(() => {
    if (!busy) { setSlow(false); return }
    const t = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(t)
  }, [busy])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) { setError('Informe seu e-mail'); return }
    if (mode === 'criar' && nome.trim().length < 2) { setError('Informe seu nome'); return }
    if (mode === 'criar' && senha.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres'); return }
    if (!senha) { setError('Informe a senha'); return }
    setBusy(true); setError(null)
    try {
      if (mode === 'entrar') await entrar(email.trim(), senha)
      else await registrar({ nome: nome.trim(), email: email.trim(), senha, nomeNegocio: nomeNegocio.trim() })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sem conexão')
      setBusy(false)
    }
  }

  const swap = () => { setMode(mode === 'entrar' ? 'criar' : 'entrar'); setError(null) }

  return (
    <main className="auth">
      <div className="card auth-card">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><i /></div>
          <h1>Kognit</h1>
        </div>
        <p className="sec-sub">{mode === 'entrar' ? 'Entre para ver o caixa do seu negócio.' : 'Crie a conta do seu negócio.'}</p>
        <form className="stack-sm" onSubmit={submit} noValidate>
          {mode === 'criar' && <>
            <label className="fld"><span>Seu nome</span>
              <input className="input" autoComplete="name" maxLength={100} value={nome} onChange={e => { setNome(e.target.value); setError(null) }} />
            </label>
            <label className="fld"><span>Nome do negócio</span>
              <input className="input" maxLength={100} placeholder="Ex.: Pet Shop Amigo Fiel" value={nomeNegocio} onChange={e => setNomeNegocio(e.target.value)} />
            </label>
          </>}
          <label className="fld"><span>E-mail</span>
            <input className="input" type="email" autoComplete="email" inputMode="email" value={email}
              onChange={e => { setEmail(e.target.value); setError(null) }} />
          </label>
          <label className="fld"><span>Senha</span>
            <input className="input" type="password" autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'} value={senha}
              onChange={e => { setSenha(e.target.value); setError(null) }} />
          </label>
          <button type="submit" className="btn primary full" disabled={busy}>
            {busy ? (mode === 'entrar' ? 'Entrando…' : 'Criando…') : mode === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
        {slow && <p className="auth-note">Ligando o servidor. Na primeira vez do dia isso pode levar até 1 minuto.</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="button" className="link-btn auth-out" onClick={swap}>
          {mode === 'entrar' ? 'Ainda não tem conta? Criar conta' : 'Já tenho conta. Entrar'}
        </button>
      </div>
    </main>
  )
}
