import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { CATS_IN, CATS_OUT, isDate, mLabelY, norm, parseMoney, plain } from '../lib/format'
import { useApp, type TxPreset } from '../lib/store'
import type { LinkOption, MutationResult, TxType } from '../lib/types'
import { Dialog } from './Dialog'
import { Icon } from './Icon'

const NEW_CAT = '__nova__'

/** Diálogo de lançamento (4.6, RF-01, RF-02, RF-09). */
export function TxDialog({ preset, today, categories, onClose, onSaved, onCategoryChanged }: {
  preset: TxPreset | null; today: string; categories: Record<TxType, string[]>; onClose: () => void; onSaved?: (id: string) => void
  /** categoria de um lançamento importado foi trocada: oferecer "Aplicar a lançamentos parecidos" (8.5) */
  onCategoryChanged?: (description: string, category: string) => void
}) {
  const { mutate, toast } = useApp()
  const [type, setType] = useState<TxType>('out')
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState(today)
  const [cat, setCat] = useState('')
  const [newCat, setNewCat] = useState('')
  const [link, setLink] = useState('')
  const [links, setLinks] = useState<LinkOption[]>([])
  const [bad, setBad] = useState<'amount' | 'date' | null>(null)
  const [saving, setSaving] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)
  const editing = preset?.kind === 'edit' ? preset.tx : null

  useEffect(() => {
    if (!preset) return
    setBad(null); setNewCat('')
    if (preset.kind === 'edit') {
      const t = preset.tx
      setType(t.type); setAmount(plain(t.amount)); setDesc(t.description); setDate(t.date); setCat(t.category)
      setLink(t.recurringId ? `${t.recurringId}|${t.recurringMonth}` : '')
    } else if (preset.kind === 'confirm') {
      setType(preset.type); setAmount(plain(preset.amount)); setDesc(preset.name); setDate(today); setCat(preset.category)
      setLink(`${preset.recurringId}|${preset.k}`)
    } else {
      const t = preset.type ?? 'out'
      setType(t); setAmount(preset.amount ? plain(preset.amount) : ''); setDesc(preset.description ?? ''); setDate(preset.date ?? today)
      setCat(t === 'in' ? 'Renda extra' : 'Outros'); setLink('')
    }
    setTimeout(() => { amountRef.current?.focus(); amountRef.current?.select() }, 20)
  }, [preset, today])

  // opções de vínculo: refeitas ao mudar tipo ou data (4.6)
  useEffect(() => {
    if (!preset || !isDate(date)) return
    let alive = true
    api<LinkOption[]>(`/api/link-options?type=${type}&date=${date}${editing ? `&txId=${editing.id}` : ''}`)
      .then(o => { if (alive) setLinks(o) })
      .catch(() => { if (alive) setLinks([]) })
    return () => { alive = false }
  }, [preset, type, date, editing])

  if (!preset) return <Dialog open={false} onClose={onClose} title="" labelledBy="txTitle">{null}</Dialog>

  const base = type === 'in' ? CATS_IN : CATS_OUT
  const catOpts = [...new Set([...base, ...categories[type], ...(cat && cat !== NEW_CAT ? [cat] : [])])]
  const linkOpts = [...links]
  if (link && !linkOpts.some(o => o.value === link)) {
    const [rid, k] = link.split('|')
    const label = preset.kind === 'confirm' ? preset.name : preset.kind === 'edit' ? preset.tx.recurringName ?? 'Conta fixa' : 'Conta fixa'
    linkOpts.push({ value: link, recurringId: rid, k, label: `${label} · ${mLabelY(k)}`, name: label, category: cat, expected: 0 })
  }

  const changeType = (t: TxType) => {
    if (t === type) return
    setType(t); setCat(t === 'in' ? 'Renda extra' : 'Outros'); setLink('')
  }
  const pickLink = (v: string) => {
    setLink(v)
    const o = linkOpts.find(x => x.value === v)
    if (!o) return
    if (!desc.trim()) setDesc(o.name)
    if (!(parseMoney(amount) > 0) && o.expected > 0) setAmount(plain(o.expected))
    setCat(o.category)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const v = parseMoney(amount)
    if (!(v > 0)) { setBad('amount'); amountRef.current?.focus(); return }
    if (!isDate(date)) { setBad('date'); return }
    const category = cat === NEW_CAT ? newCat.trim() || (type === 'in' ? 'Renda extra' : 'Outros') : cat
    const [recurringId, recurringMonth] = link ? link.split('|') : [null, null]
    const inboxId = preset.kind === 'new' ? preset.inboxId ?? null : null
    const body = { type, amount: v, date, description: desc.trim(), category, recurringId, recurringMonth, inboxId }
    setSaving(true)
    try {
      const res = await api<MutationResult>(editing ? `/api/transactions/${editing.id}` : '/api/transactions',
        { method: editing ? 'PUT' : 'POST', json: body })
      await mutate(async () => res)
      onSaved?.(res.id ?? '')
      onClose()
      if (editing && editing.source !== 'manual' && editing.category !== category && desc.trim())
        onCategoryChanged?.(norm(desc.trim()), category)
    } catch (err) {
      if (err instanceof ApiError && err.field === 'link') { setLink(''); toast(err.message) }
      else if (err instanceof ApiError && err.field === 'amount') { setBad('amount'); toast(err.message) }
      else toast(err instanceof ApiError ? err.message : 'Não foi salvo · Tentar de novo')
    } finally { setSaving(false) }
  }

  const del = async () => {
    if (!editing) return
    onClose()
    await mutate(() => api<MutationResult>(`/api/transactions/${editing.id}`, { method: 'DELETE' }))
  }

  const title = editing ? 'Editar lançamento' : preset.kind === 'confirm' ? `Confirmar ${preset.name}` : 'Novo lançamento'
  const sub = preset.kind === 'confirm' ? 'Ajuste o valor se foi diferente do previsto.' : editing ? 'Altere e salve.' : 'Registre o que entrou ou saiu.'

  return (
    <Dialog open onClose={onClose} title={title} sub={sub} labelledBy="txTitle">
      <form onSubmit={submit} noValidate>
        <div className="dlg-body">
          <div className="seg full" role="group" aria-label="Tipo">
            <button type="button" aria-pressed={type === 'out'} onClick={() => changeType('out')}>Saída</button>
            <button type="button" aria-pressed={type === 'in'} onClick={() => changeType('in')}>Entrada</button>
          </div>
          <div className={'money' + (bad === 'amount' ? ' invalid' : '')}>
            <span>R$</span>
            <input ref={amountRef} className="num" inputMode="decimal" autoComplete="off" placeholder="0,00" aria-label="Valor"
              value={amount} onChange={e => { setAmount(e.target.value); setBad(null) }} />
          </div>
          <label className="fld"><span>Descrição</span>
            <input className="input" maxLength={60} placeholder="Ex.: Mercado, Pix recebido…" value={desc} onChange={e => setDesc(e.target.value)} />
          </label>
          <div className="grid2">
            <label className="fld"><span>Data</span>
              <input className={'input' + (bad === 'date' ? ' invalid' : '')} type="date" value={date} onChange={e => { setDate(e.target.value); setBad(null) }} />
            </label>
            <label className="fld"><span>Categoria</span>
              <select className="select" value={cat} onChange={e => setCat(e.target.value)}>
                {catOpts.map(c => <option key={c} value={c}>{c}</option>)}
                <option value={NEW_CAT}>Nova categoria…</option>
              </select>
            </label>
          </div>
          {cat === NEW_CAT && (
            <label className="fld"><span>Nome da nova categoria</span>
              <input className="input" maxLength={40} value={newCat} onChange={e => setNewCat(e.target.value)} autoFocus />
            </label>
          )}
          <label className="fld"><span>Referente a conta fixa</span>
            <select className="select" value={link} onChange={e => pickLink(e.target.value)}>
              <option value="">Nenhuma (gasto ou entrada avulsa)</option>
              {linkOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <div className="dlg-foot">
          {editing && <button className="btn ghost" type="button" onClick={del}><Icon name="trash" />Excluir</button>}
          <span className="spacer" />
          <button className="btn" type="button" onClick={onClose}>Cancelar</button>
          <button className="btn primary" type="submit" disabled={saving}>Salvar</button>
        </div>
      </form>
    </Dialog>
  )
}
