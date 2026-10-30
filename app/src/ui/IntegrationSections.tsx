import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { CATS_IN, CATS_OUT } from '../lib/format'
import { useApp } from '../lib/store'
import type { CategoryRule, MpAccount, MutationResult, PluggyItem, SyncResult } from '../lib/types'
import { Icon } from './Icon'

const when = (iso: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca'

/** Configurações › Pluggy (8.2, 16.5): itens, contas incluídas, "Sincronizar agora", "Remover". */
export function PluggySection() {
  const { toast, refresh, version } = useApp()
  const [items, setItems] = useState<PluggyItem[] | null>(null)
  const [itemId, setItemId] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => { api<PluggyItem[]>('/api/pluggy/items').then(setItems).catch(() => setItems([])) }, [])
  useEffect(load, [load, version])

  const run = async (f: () => Promise<unknown>) => {
    setBusy(true)
    try { await f(); load() } catch (e) { toast(e instanceof ApiError ? e.message : 'Sem conexão') } finally { setBusy(false) }
  }
  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemId.trim()) return
    run(async () => { await api('/api/pluggy/items', { method: 'POST', json: { itemId: itemId.trim() } }); setItemId('') })
  }
  const toggle = (it: PluggyItem, accId: string) => {
    const cur = it.includeAccountIds.length ? it.includeAccountIds : it.accounts.map(a => a.id)
    const next = cur.includes(accId) ? cur.filter(x => x !== accId) : [...cur, accId]
    run(() => api(`/api/pluggy/items/${it.id}`, { method: 'PUT', json: { accountIds: next.length === it.accounts.length ? [] : next } }))
  }
  const sync = () => run(async () => {
    const r = await api<SyncResult>('/api/pluggy/sync-now', { method: 'POST' })
    toast(`${r.inserted} ${r.inserted === 1 ? 'lançamento sincronizado' : 'lançamentos sincronizados'}`)
    refresh()
  })

  return (
    <section className="set-sec">
      <h3>Pluggy (Open Finance)</h3>
      <p className="hint">Contas conectadas no meu.pluggy.ai. A sincronização roda todo dia às 08:00; transações do Mercado Pago entram sozinhas, sem duplicar.</p>
      {items?.map(it => (
        <div key={it.id} className="int-item">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{it.connectorName ?? it.itemId}</b>
            <span className={'pill' + (it.status === 'error' ? ' late' : '')}>{it.status === 'error' ? 'erro' : it.status}</span>
          </div>
          <small>{it.owner ? `de ${it.owner} · ` : ''}última sincronização: {when(it.lastSyncAt)}</small>
          {it.lastError && <small className="int-error">{it.lastError}</small>}
          {it.accounts.map(a => (
            <label key={a.id} className="check">
              <input type="checkbox" disabled={busy} checked={!it.includeAccountIds.length || it.includeAccountIds.includes(a.id)} onChange={() => toggle(it, a.id)} />
              {a.name} {a.number && <small>· {a.number}</small>} <small>· {a.type === 'CREDIT' ? 'cartão' : 'conta'}</small>
            </label>
          ))}
          <div><button className="btn ghost sm" type="button" disabled={busy}
            onClick={() => run(() => api(`/api/pluggy/items/${it.id}`, { method: 'DELETE' }))}><Icon name="trash" />Remover</button></div>
        </div>
      ))}
      <form className="row" onSubmit={add}>
        <input className="input" placeholder="itemId do meu.pluggy.ai" value={itemId} onChange={e => setItemId(e.target.value)} aria-label="itemId da Pluggy" />
        <button className="btn" type="submit" disabled={busy || !itemId.trim()}>Adicionar</button>
      </form>
      {!!items?.length && <div><button className="btn" type="button" disabled={busy} onClick={sync}>Sincronizar agora</button></div>}
    </section>
  )
}

/** Configurações › Mercado Pago (8.9). Sem contas configuradas, a seção fica oculta. */
export function MercadoPagoSection() {
  const { toast, refresh } = useApp()
  const [accs, setAccs] = useState<MpAccount[]>([])
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => { api<MpAccount[]>('/api/mp/accounts').then(setAccs).catch(() => setAccs([])) }, [])
  useEffect(load, [load])
  if (!accs.length) return null

  const run = async (action: 'start' | 'import') => {
    setBusy(true)
    try {
      const r = await api<SyncResult>('/api/mp/import', { method: 'POST', json: { action } })
      toast(action === 'start'
        ? 'O Mercado Pago está preparando os relatórios. Toque em Buscar relatórios prontos daqui a alguns minutos.'
        : `${r.inserted} lançamentos importados`)
      if (r.errors?.length) toast(r.errors.join(' · '))
      refresh()
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Sem conexão') }
    finally { setBusy(false); load() }
  }

  return (
    <section className="set-sec">
      <h3>Mercado Pago</h3>
      {accs.map(a => (
        <div key={a.id} className="int-item">
          <div className="row" style={{ justifyContent: 'space-between' }}><b>{a.label}</b><span className={'pill' + (a.status === 'error' ? ' late' : '')}>{a.status}</span></div>
          <small>última importação: {when(a.lastImportAt)}</small>
          {a.lastError && <small className="int-error">{a.lastError}</small>}
        </div>
      ))}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn" type="button" disabled={busy} onClick={() => run('start')}>Importar histórico</button>
        <button className="btn" type="button" disabled={busy} onClick={() => run('import')}>Buscar relatórios prontos</button>
      </div>
    </section>
  )
}

/** Configurações › Regras de categoria (8.5): "texto contém → categoria", prioridade (menor vence). */
export function CategoryRulesSection() {
  const { mutate, version } = useApp()
  const [rules, setRules] = useState<CategoryRule[]>([])
  const [editing, setEditing] = useState<Partial<CategoryRule> | null>(null)
  useEffect(() => { api<CategoryRule[]>('/api/category-rules').then(setRules).catch(() => setRules([])) }, [version])
  const cats = [...new Set([...CATS_OUT, ...CATS_IN])]

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing?.matchValue?.trim() || !editing.category) return
    const body = { matchType: editing.matchType ?? 'description_contains', matchValue: editing.matchValue.trim(), category: editing.category, priority: editing.priority ?? 100 }
    const r = await mutate(() => api<MutationResult>(editing.id ? `/api/category-rules/${editing.id}` : '/api/category-rules',
      { method: editing.id ? 'PUT' : 'POST', json: body }))
    if (r) setEditing(null)
  }

  return (
    <section className="set-sec">
      <h3>Regras de categoria</h3>
      <p className="hint">Aplicadas aos lançamentos importados (Pluggy, notificações, CSV). A de menor prioridade vence.</p>
      {rules.map(r => (
        <div key={r.id} className="li hov rule-row">
          <div className="d">
            <span>{r.matchType === 'pluggy_category' ? `categoria Pluggy ${r.matchValue}` : `“${r.matchValue}”`} → {r.category}</span>
            <small>prioridade {r.priority}</small>
          </div>
          <div className="r acts">
            <button type="button" className="icon-btn sm" aria-label={`Editar regra ${r.matchValue}`} onClick={() => setEditing(r)}><Icon name="pencil" /></button>
            <button type="button" className="icon-btn sm" aria-label={`Excluir regra ${r.matchValue}`}
              onClick={() => mutate(() => api<MutationResult>(`/api/category-rules/${r.id}`, { method: 'DELETE' }))}><Icon name="trash" /></button>
          </div>
        </div>
      ))}
      {editing ? (
        <form className="stack-sm" onSubmit={save}>
          <label className="fld"><span>Texto contém (sem acentos e minúsculas)</span>
            <input className="input" value={editing.matchValue ?? ''} onChange={e => setEditing({ ...editing, matchValue: e.target.value })} autoFocus />
          </label>
          <div className="grid2">
            <label className="fld"><span>Categoria</span>
              <select className="select" value={editing.category ?? ''} onChange={e => setEditing({ ...editing, category: e.target.value })}>
                <option value="" disabled>Escolha…</option>
                {cats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="fld"><span>Prioridade</span>
              <input className="input num" type="number" min={1} value={editing.priority ?? 100} onChange={e => setEditing({ ...editing, priority: Number(e.target.value) || 100 })} />
            </label>
          </div>
          <div className="row">
            <button className="btn primary" type="submit">Salvar regra</button>
            <button className="btn" type="button" onClick={() => setEditing(null)}>Cancelar</button>
          </div>
        </form>
      ) : <div><button className="btn" type="button" onClick={() => setEditing({ matchType: 'description_contains', priority: 100 })}><Icon name="plus" />Nova regra</button></div>}
    </section>
  )
}
