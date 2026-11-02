import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { brl, parseMoney, plain } from '../lib/format'
import { useApp } from '../lib/store'
import type { Conexao, Provedores, Usuario } from '../lib/types'
import { Dialog } from './Dialog'
import { Icon } from './Icon'

const when = (iso: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca'
const STATUS: Record<Conexao['status'], string> = { conectando: 'conectando', conectado: 'conectado', atualizando: 'atualizando', erro: 'erro' }

/** Painel lateral de configurações: dados do negócio, banco conectado e conta. */
export function SettingsSheet({ open, me, onMeChanged, onSignOut, onClose }: {
  open: boolean; me: Usuario; onMeChanged: (u: Usuario) => void; onSignOut: () => void; onClose: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} sheet title="Configurações" sub={me.nomeNegocio || me.email} labelledBy="setTitle">
      <div className="dlg-body">
        {open && <>
          <NegocioSection me={me} onMeChanged={onMeChanged} />
          <BancoSection />
          <section className="set-sec">
            <h3>Conta</h3>
            <p className="hint">Você entrou como {me.nome} ({me.email}).</p>
            <div><button className="btn ghost" type="button" onClick={onSignOut}>Sair da conta</button></div>
          </section>
        </>}
      </div>
    </Dialog>
  )
}

/** Nome do negócio, CPF do dono (reconhece as retiradas) e dinheiro vivo em caixa (PUT /api/usuario). */
function NegocioSection({ me, onMeChanged }: { me: Usuario; onMeChanged: (u: Usuario) => void }) {
  const { toast, refresh } = useApp()
  const [nomeNegocio, setNomeNegocio] = useState(me.nomeNegocio)
  const [cpf, setCpf] = useState(me.cpf ?? '')
  const [caixa, setCaixa] = useState(plain(me.caixaDinheiro))
  useEffect(() => { setNomeNegocio(me.nomeNegocio); setCpf(me.cpf ?? ''); setCaixa(plain(me.caixaDinheiro)) }, [me])

  const save = async (json: object) => {
    try { onMeChanged(await api<Usuario>('/api/usuario', { method: 'PUT', json })); refresh(); toast('Salvo') }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Não foi salvo') }
  }
  const saveCaixa = () => {
    const n = parseMoney(caixa)
    if (Number.isFinite(n) && n !== me.caixaDinheiro) void save({ caixaDinheiro: n })
    else setCaixa(plain(me.caixaDinheiro))
  }
  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur() }

  return (
    <section className="set-sec">
      <h3>Seu negócio</h3>
      <label className="fld"><span>Nome do negócio</span>
        <input className="input" maxLength={100} value={nomeNegocio} onChange={e => setNomeNegocio(e.target.value)} onKeyDown={blurOnEnter}
          onBlur={() => { if (nomeNegocio.trim() !== me.nomeNegocio) void save({ nomeNegocio: nomeNegocio.trim() }) }} />
      </label>
      <div className="grid2">
        <label className="fld"><span>Seu CPF (opcional)</span>
          <input className="input num" inputMode="numeric" maxLength={14} value={cpf} onChange={e => setCpf(e.target.value)} onKeyDown={blurOnEnter}
            onBlur={() => { if (cpf.trim() !== (me.cpf ?? '')) void save({ cpf: cpf.trim() }) }} />
        </label>
        <label className="fld"><span>Dinheiro vivo em caixa (R$)</span>
          <input className="input num" inputMode="decimal" value={caixa} onChange={e => setCaixa(e.target.value)} onKeyDown={blurOnEnter} onBlur={saveCaixa} />
        </label>
      </div>
      <p className="hint">Com o CPF, um Pix da conta do negócio para você vira "retirada" sozinho.</p>
    </section>
  )
}

/** Bancos conectados: banco de demonstração, "Atualizar agora" e desconectar (/api/conexoes). */
function BancoSection() {
  const { toast, refresh, version } = useApp()
  const [items, setItems] = useState<Conexao[] | null>(null)
  const [prov, setProv] = useState<Provedores | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api<Conexao[]>('/api/conexoes').then(setItems).catch(() => setItems([]))
    api<Provedores>('/api/conexoes/provedores').then(setProv).catch(() => setProv(null))
  }, [])
  useEffect(load, [load, version])

  const run = async (f: () => Promise<unknown>, msg: string) => {
    setBusy(true)
    try { await f(); toast(msg); load(); refresh() }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Sem conexão') }
    finally { setBusy(false) }
  }

  return (
    <section className="set-sec">
      <h3>Banco conectado</h3>
      <p className="hint">Com o banco conectado (Open Finance), vendas, gastos, retiradas e contas fixas entram sozinhos, já organizados.</p>
      {items?.map(c => (
        <div key={c.id} className="int-item">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{c.nomeBanco}</b>
            <span className={'pill' + (c.status === 'erro' ? ' late' : c.status === 'conectado' ? ' ok' : '')}>{STATUS[c.status]}</span>
          </div>
          <small>saldo {brl(c.saldoContas)} · atualizado em {when(c.ultimaSincronizacao)}</small>
          {c.mensagem && <small className="int-error">{c.mensagem}</small>}
          <div className="row">
            <button className="btn sm" type="button" disabled={busy}
              onClick={() => run(() => api(`/api/conexoes/${c.id}/sincronizar`, { method: 'POST' }), 'Atualizando. Os dados novos aparecem em alguns segundos.')}>
              <Icon name="rotate" />Atualizar agora
            </button>
            <button className="btn ghost sm" type="button" disabled={busy}
              onClick={() => run(() => api(`/api/conexoes/${c.id}`, { method: 'DELETE' }), 'Banco desconectado')}><Icon name="trash" />Desconectar</button>
          </div>
        </div>
      ))}
      {items && !items.length && <p className="hint">Nenhum banco conectado.</p>}
      {prov?.demoHabilitado && !items?.some(c => c.provedor === 'demo') && (
        <div><button className="btn" type="button" disabled={busy}
          onClick={() => run(() => api('/api/conexoes/demo', { method: 'POST' }), 'Banco de demonstração conectado')}>Usar banco de demonstração</button></div>
      )}
      {prov && !prov.pluggyConfigurado && <p className="hint">A conexão com bancos reais (Pluggy) ainda não foi configurada no servidor.</p>}
    </section>
  )
}
