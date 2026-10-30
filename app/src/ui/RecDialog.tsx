import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { addM, cap, CATS_IN, CATS_OUT, mLabelY, mLong, parseMoney, plain } from '../lib/format'
import { useApp } from '../lib/store'
import type { MutationResult, Recurring, TxType } from '../lib/types'
import { Dialog } from './Dialog'
import { Icon } from './Icon'

type Freq = Recurring['freq']
type Formula = '' | 'decimo' | 'tithe'

/** Conta fixa (RF-08, 4.6, 16.3). */
export function RecDialog({ open, rec, cur, onClose }: { open: boolean; rec: Recurring | null; cur: string; onClose: () => void }) {
  const { mutate, toast } = useApp()
  const [type, setType] = useState<TxType>('out')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [gross, setGross] = useState('')
  const [day, setDay] = useState('5')
  const [freq, setFreq] = useState<Freq>('mensal')
  const [start, setStart] = useState(cur)
  const [parcels, setParcels] = useState('3')
  const [cat, setCat] = useState('Outros')
  const [salary, setSalary] = useState(false)
  const [tithe, setTithe] = useState(false)
  const [formula, setFormula] = useState<Formula>('')
  const [keywords, setKeywords] = useState('')
  const [from, setFrom] = useState('')
  const [bad, setBad] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const r = rec
    setType(r?.type ?? 'out'); setName(r?.name ?? '')
    setFormula(r?.formula ?? '')
    setAmount(r ? plain(r.formula ? r.displayAmount : r.amount) : '')
    setGross(r?.gross != null ? plain(r.gross) : '')
    setDay(String(r?.day ?? Math.min(28, Number(new Date().getDate()))))
    setFreq(r?.freq ?? 'mensal'); setStart(r?.startMonth ?? cur); setParcels(String(r?.parcels ?? 3))
    setCat(r?.category ?? 'Outros'); setSalary(!!r?.isSalary); setTithe(!!r?.tithe)
    setKeywords((r?.matchKeywords ?? []).join(', ')); setFrom(''); setBad(null)
  }, [open, rec, cur])

  const fx = formula || null
  const locked = !!rec?.formula
  const isIn = type === 'in'
  const sal = isIn && salary && !fx
  const months = Array.from({ length: 30 }, (_, i) => addM(cur, i - 6))
  if (!months.includes(start)) months.unshift(start)
  const catOpts = [...new Set([...(isIn ? CATS_IN : CATS_OUT), cat])]

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setBad('name'); return }
    const v = fx ? 0 : parseMoney(amount)
    if (!fx && !(v > 0)) { setBad('amount'); return }
    const g = parseMoney(gross)
    const values = {
      type, name: name.trim(), amount: v, gross: sal ? (g > 0 ? g : v) : null, isSalary: sal, tithe: isIn && !sal && tithe,
      formula: fx, day: Math.min(31, Math.max(1, Math.round(Number(day) || 1))), freq, startMonth: start,
      parcels: freq === 'parcelas' ? Math.max(1, Math.round(Number(parcels) || 1)) : null, category: cat,
      matchKeywords: keywords.split(',').map(s => s.trim()).filter(Boolean),
    }
    try {
      const res = rec && from
        ? await api<MutationResult>(`/api/recurring/${rec.id}/change-from`, { method: 'POST', json: { month: from, values } })
        : await api<MutationResult>(rec ? `/api/recurring/${rec.id}` : '/api/recurring', { method: rec ? 'PUT' : 'POST', json: values })
      await mutate(async () => res)
      onClose()
    } catch (err) {
      if (err instanceof ApiError) { setBad(err.field ?? null); toast(err.message) }
      else toast('Não foi salvo · Tentar de novo')
    }
  }

  const unskip = (k: string) => {
    if (!rec) return
    onClose()
    mutate(() => api<MutationResult>(`/api/recurring/${rec.id}/unskip`, { method: 'POST', json: { month: k } }))
  }
  const del = () => {
    if (!rec) return
    onClose()
    mutate(() => api<MutationResult>(`/api/recurring/${rec.id}`, { method: 'DELETE' }))
  }

  return (
    <Dialog open={open} onClose={onClose} title={rec ? 'Editar conta fixa' : 'Nova conta fixa'}
      sub="Salário, contas mensais, parcelas ou um evento previsto." labelledBy="recTitle">
      <form onSubmit={submit} noValidate>
        <div className="dlg-body">
          <div className="seg full" role="group" aria-label="Tipo">
            {(['out', 'in'] as const).map(t => (
              <button key={t} type="button" aria-pressed={type === t} disabled={locked}
                onClick={() => { if (t !== type) { setType(t); setCat('Outros'); setFormula('') } }}>{t === 'out' ? 'Saída' : 'Entrada'}</button>
            ))}
          </div>
          <label className="fld"><span>Nome</span>
            <input className={'input' + (bad === 'name' ? ' invalid' : '')} maxLength={60} value={name} onChange={e => setName(e.target.value)} autoFocus />
          </label>
          {!locked && (
            <label className="fld"><span>Cálculo do valor</span>
              <select className="select" value={formula} onChange={e => setFormula(e.target.value as Formula)}>
                <option value="">Valor fixo</option>
                {isIn ? <option value="decimo">13º salário (50% dos salários brutos)</option>
                  : <option value="tithe">Devolução (10% dos salários e entradas marcadas)</option>}
              </select>
            </label>
          )}
          <div className="grid2">
            <label className="fld"><span>{sal ? 'Líquido (R$)' : 'Valor (R$)'}</span>
              <input className={'input num' + (bad === 'amount' ? ' invalid' : '')} inputMode="decimal" disabled={!!fx}
                value={fx && !locked ? '' : amount} placeholder={fx ? 'calculado' : ''} onChange={e => setAmount(e.target.value)} />
            </label>
            {sal && (
              <label className="fld"><span>Bruto (R$)</span>
                <input className="input num" inputMode="decimal" value={gross} onChange={e => setGross(e.target.value)} />
              </label>
            )}
            <label className="fld"><span>Dia do mês</span>
              <input className="input num" type="number" min={1} max={31} step={1} value={day} onChange={e => setDay(e.target.value)} />
            </label>
          </div>
          {fx && <p className="hint">{fx === 'decimo' ? 'Calculado: 50% da soma dos salários brutos.' : 'Calculado: 10% dos salários (líquido ou bruto, nas configurações) e das entradas marcadas.'}</p>}
          <div className="grid2">
            <label className="fld"><span>Frequência</span>
              <select className="select" value={freq} onChange={e => setFreq(e.target.value as Freq)}>
                <option value="mensal">Todo mês</option>
                <option value="parcelas">Parcelado</option>
                <option value="unica">Só uma vez</option>
              </select>
            </label>
            <label className="fld"><span>{freq === 'unica' ? 'Mês' : freq === 'parcelas' ? '1ª parcela em' : 'A partir de'}</span>
              <select className="select" value={start} onChange={e => setStart(e.target.value)}>
                {months.map(k => <option key={k} value={k}>{cap(mLong(k))}</option>)}
              </select>
            </label>
          </div>
          {freq === 'parcelas' && (
            <label className="fld"><span>Número de parcelas (a partir do mês acima)</span>
              <input className="input num" type="number" min={1} max={120} step={1} value={parcels} onChange={e => setParcels(e.target.value)} />
            </label>
          )}
          <label className="fld"><span>Categoria</span>
            <select className="select" value={cat} onChange={e => setCat(e.target.value)}>
              {catOpts.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {isIn && !fx && <label className="check"><input type="checkbox" checked={salary} onChange={e => setSalary(e.target.checked)} /> É salário (entra na base da devolução e do 13º)</label>}
          {isIn && !sal && <label className="check"><input type="checkbox" checked={tithe} onChange={e => setTithe(e.target.checked)} /> Incide a devolução de 10%</label>}
          <label className="fld"><span>Palavras para reconhecer automaticamente</span>
            <input className="input" placeholder="Ex.: enel, energia" value={keywords} onChange={e => setKeywords(e.target.value)} />
          </label>
          {rec && (
            <label className="fld"><span>Valer a partir de</span>
              <select className="select" value={from} onChange={e => setFrom(e.target.value)}>
                <option value="">Todos os meses ainda não confirmados</option>
                {months.filter(k => k > rec.startMonth).map(k => <option key={k} value={k}>Mudar a partir de {mLabelY(k)}</option>)}
              </select>
            </label>
          )}
          {rec && rec.skipMonths.length > 0 && (
            <div className="fld">
              <span className="fld-label">Meses ignorados</span>
              {rec.skipMonths.map(k => (
                <div key={k} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{cap(mLong(k))}</span>
                  <button type="button" className="btn sm" onClick={() => unskip(k)}>Restaurar</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="dlg-foot">
          {rec && <button className="btn ghost" type="button" onClick={del}><Icon name="trash" />Excluir</button>}
          <span className="spacer" />
          <button className="btn" type="button" onClick={onClose}>Cancelar</button>
          <button className="btn primary" type="submit">Salvar</button>
        </div>
      </form>
    </Dialog>
  )
}
