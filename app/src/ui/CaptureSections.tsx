import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { plain } from '../lib/format'
import { useApp } from '../lib/store'
import type { InboxItem, MutationResult, ParserRule, Settings } from '../lib/types'
import { exportCaptures } from '../native/captureSync'
import { MpCapture } from '../native/mpCapture'
import { native } from '../native/platform'
import { Icon } from './Icon'
import { Switch } from './common'

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Configurações › Para revisar (RF-19, 8.6): notificações não entendidas e avisos do servidor. */
export function InboxSection() {
  const { mutate, openTx, version } = useApp()
  const [data, setData] = useState<{ items: InboxItem[]; newCount: number } | null>(null)
  useEffect(() => { api<{ items: InboxItem[]; newCount: number }>('/api/inbox?status=new').then(setData).catch(() => setData(null)) }, [version])
  if (!data) return null

  return (
    <section className="set-sec">
      <h3>Para revisar {data.newCount > 0 && <span className="pill">{data.newCount}</span>}</h3>
      {!data.items.length && <p className="hint">Nada para revisar.</p>}
      {data.items.map(it => (
        <div key={it.id} className="int-item">
          <small>{when(it.postedAt)}{it.deviceLabel ? ` · ${it.deviceLabel}` : ''}</small>
          {it.title && <b>{it.title}</b>}
          {it.body && <span className="inbox-body">{it.body}</span>}
          {it.parsed?.amount != null && <small>entendido: {it.parsed.type === 'in' ? 'entrada' : 'saída'} de R$ {plain(it.parsed.amount)}</small>}
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {it.action === 'create' && (
              <button className="btn sm" type="button" onClick={() => openTx({
                kind: 'new', inboxId: it.id, type: it.parsed?.type, amount: it.parsed?.amount ?? undefined,
                description: it.parsed?.description ?? it.title ?? '', date: it.parsed?.date,
              })}>Criar lançamento</button>
            )}
            {it.action === 'review-delete' && <>
              <button className="btn sm" type="button" onClick={() => mutate(() => api<MutationResult>(`/api/inbox/${it.id}/resolve`, { method: 'POST', json: { action: 'delete' } }))}>Excluir lançamento</button>
              <button className="btn sm" type="button" onClick={() => mutate(() => api<MutationResult>(`/api/inbox/${it.id}/resolve`, { method: 'POST', json: { action: 'keep' } }))}>Manter</button>
            </>}
            {it.action !== 'review-delete' && (
              <button className="btn sm ghost" type="button" onClick={() => mutate(() => api<MutationResult>(`/api/inbox/${it.id}/ignore`, { method: 'POST' }))}>Ignorar</button>
            )}
          </div>
        </div>
      ))}
    </section>
  )
}

/** Configurações › Captura automática (8.3, 10.6). Só aparece no APK. */
export function CaptureSection() {
  const { mutate, toast, version } = useApp()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [battery, setBattery] = useState<boolean | null>(null)
  const [queue, setQueue] = useState(0)
  const [mode, setMode] = useState<Settings['captureMode']>('inbox')
  const [rules, setRules] = useState<ParserRule[]>([])
  const [rule, setRule] = useState<{ pattern: string; type: ParserRule['type'] } | null>(null)

  const status = useCallback(async () => {
    if (!native) return
    setEnabled((await MpCapture.isEnabled()).enabled)
    setBattery((await MpCapture.isIgnoringBattery()).ignoring)
    setQueue((await MpCapture.peek({ limit: 0 })).total)
  }, [])
  useEffect(() => {
    void status()
    api<Settings>('/api/settings').then(s => setMode(s.captureMode)).catch(() => {})
    api<ParserRule[]>('/api/parser-rules').then(setRules).catch(() => setRules([]))
  }, [status, version])
  if (!native) return null

  const call = async (f: () => Promise<void>) => { try { await f() } catch (e) { toast(e instanceof Error ? e.message : 'Não foi possível abrir') } }
  const addRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rule?.pattern.trim()) return
    const r = await mutate(() => api<MutationResult>('/api/parser-rules', { method: 'POST', json: { pattern: rule.pattern.trim(), type: rule.type, priority: 100 } }))
    if (r) setRule(null)
  }

  return (
    <section className="set-sec">
      <h3>Captura automática</h3>
      <p className="hint">Lê só as notificações do app Mercado Pago neste celular e envia quando o app é aberto.</p>
      <div className="cmp">
        <div className="cmp-row"><span>Acesso a notificações</span><span>{enabled == null ? '…' : enabled ? 'ligado' : 'desligado'}</span></div>
        <div className="cmp-row"><span>Sem economia de bateria</span><span>{battery == null ? '…' : battery ? 'sim' : 'não'}</span></div>
        <div className="cmp-row"><span>Na fila deste aparelho</span><span className="num">{queue}</span></div>
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {!enabled && <button className="btn sm" type="button" onClick={() => call(MpCapture.openNotificationAccess)}>Ligar acesso</button>}
        {!battery && <button className="btn sm" type="button" onClick={() => call(MpCapture.openBatterySettings)}>Liberar bateria</button>}
        <button className="btn sm ghost" type="button" onClick={() => call(MpCapture.openAppDetails)}>Detalhes do app</button>
        <button className="btn sm ghost" type="button" onClick={() => call(exportCaptures)}><Icon name="download" />Exportar capturas (JSON)</button>
      </div>
      <div className="switch-row">
        <span className={mode === 'inbox' ? 'on' : ''}>Tudo para revisar</span>
        <Switch checked={mode === 'parse'} label="Criar lançamentos automaticamente"
          onChange={b => { setMode(b ? 'parse' : 'inbox'); void mutate(() => api<MutationResult>('/api/settings', { method: 'PUT', json: { captureMode: b ? 'parse' : 'inbox' } })) }} />
        <span className={mode === 'parse' ? 'on' : ''}>Criar lançamentos</span>
      </div>
      <h3>Regras do leitor</h3>
      <p className="hint">Expressão regular testada no título e no texto da notificação; a primeira que casar define o tipo.</p>
      {rules.map(r => (
        <div key={r.id} className="li hov rule-row">
          <div className="d"><span className="mono">{r.pattern}</span><small>{r.type === 'in' ? 'entrada' : r.type === 'out' ? 'saída' : 'ignorar'} · prioridade {r.priority}</small></div>
          <div className="r acts">
            <button type="button" className="icon-btn sm" aria-label={`Excluir regra ${r.pattern}`}
              onClick={() => mutate(() => api<MutationResult>(`/api/parser-rules/${r.id}`, { method: 'DELETE' }))}><Icon name="trash" /></button>
          </div>
        </div>
      ))}
      {rule ? (
        <form className="stack-sm" onSubmit={addRule}>
          <input className="input mono" placeholder="ex.: cashback|promo" value={rule.pattern} onChange={e => setRule({ ...rule, pattern: e.target.value })} autoFocus aria-label="Expressão" />
          <select className="select" value={rule.type} onChange={e => setRule({ ...rule, type: e.target.value as ParserRule['type'] })} aria-label="Tipo">
            <option value="ignore">Ignorar</option><option value="in">Entrada</option><option value="out">Saída</option>
          </select>
          <div className="row"><button className="btn primary" type="submit">Salvar regra</button><button className="btn" type="button" onClick={() => setRule(null)}>Cancelar</button></div>
        </form>
      ) : <div><button className="btn" type="button" onClick={() => setRule({ pattern: '', type: 'ignore' })}><Icon name="plus" />Nova regra</button></div>}
    </section>
  )
}

