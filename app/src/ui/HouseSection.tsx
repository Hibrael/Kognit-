import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { useApp } from '../lib/store'

interface Member { email: string; role: 'owner' | 'member'; me: boolean }
interface Invite { code: string; expiresAt: string }

/** Configurações › Casa (10.3, 16.10): membros, convidar, sair e apagar conta. */
export function HouseSection({ role, onSignOut }: { role: 'owner' | 'member'; onSignOut: () => void }) {
  const { toast } = useApp()
  const [members, setMembers] = useState<Member[]>([])
  const [invite, setInvite] = useState<Invite | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [typed, setTyped] = useState('')

  useEffect(() => { api<Member[]>('/api/households/members').then(setMembers).catch(() => {}) }, [])

  const createInvite = async () => {
    try { setInvite(await api<Invite>('/api/households/invite', { method: 'POST' })) }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Sem conexão') }
  }
  const text = invite ? `Entre na nossa casa no Minhas contas com o código ${invite.code} (vale por 48 horas).` : ''
  const copy = async () => {
    try { await navigator.clipboard.writeText(invite!.code); toast('Código copiado') } catch { toast('Não foi possível copiar') }
  }
  const share = async () => {
    try { await navigator.share({ text }) } catch { /* cancelado */ }
  }
  const deleteAccount = async () => {
    try { await api('/api/account', { method: 'DELETE' }); onSignOut() }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Sem conexão') }
  }

  return (
    <section className="set-sec">
      <h3>Casa</h3>
      <div>
        {members.map(m => (
          <div key={m.email} className="cmp-row" style={{ padding: '6px 0' }}>
            <span>{m.email}{m.me ? ' (você)' : ''}</span><span>{m.role === 'owner' ? 'dono' : 'membro'}</span>
          </div>
        ))}
      </div>
      {role === 'owner' && !invite && <div><button className="btn" type="button" onClick={createInvite}>Convidar</button></div>}
      {invite && (
        <div className="invite">
          <div className="invite-code num">{invite.code}</div>
          <p className="hint">Vale por 48 horas, até {new Date(invite.expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.</p>
          <div className="row">
            <button className="btn sm" type="button" onClick={copy}>Copiar</button>
            {'share' in navigator && <button className="btn sm" type="button" onClick={share}>Compartilhar</button>}
          </div>
        </div>
      )}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn ghost" type="button" onClick={onSignOut}>Sair da conta</button>
        <button className="btn ghost" type="button" onClick={() => setConfirmDelete(!confirmDelete)}>Apagar minha conta e dados</button>
      </div>
      {confirmDelete && (
        <div className="stack-sm">
          <p className="hint">Se você for o único membro, a casa e todos os dados são apagados. Para confirmar, digite APAGAR.</p>
          <input className="input" value={typed} onChange={e => setTyped(e.target.value)} aria-label="Digite APAGAR para confirmar" />
          <button className="btn" type="button" disabled={typed !== 'APAGAR'} onClick={deleteAccount}>Apagar definitivamente</button>
        </div>
      )}
    </section>
  )
}
