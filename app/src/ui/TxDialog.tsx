import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { CATS_IN, CATS_OUT, isDate, parseMoney } from '../lib/format'
import { useApp, type TxPreset } from '../lib/store'
import type { TipoLancamento } from '../lib/types'
import { Dialog } from './Dialog'

/** Novo lançamento (dinheiro vivo): o que passa pelo banco entra sozinho (POST /api/lancamentos). */
export function TxDialog({ preset, today, onClose }: { preset: TxPreset | null; today: string; onClose: () => void }) {
  const { write } = useApp()
  const [tipo, setTipo] = useState<TipoLancamento>('saida')
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState(today)
  const [cat, setCat] = useState('Outros')
  const [bad, setBad] = useState<'amount' | 'date' | null>(null)
  const [saving, setSaving] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!preset) return
    const t = preset.tipo ?? 'saida'
    setBad(null); setTipo(t); setAmount(''); setDesc(''); setDate(preset.date ?? today); setCat(t === 'entrada' ? 'Vendas' : 'Outros')
    setTimeout(() => amountRef.current?.focus(), 20)
  }, [preset, today])

  if (!preset) return <Dialog open={false} onClose={onClose} title="" labelledBy="txTitle">{null}</Dialog>

  const changeTipo = (t: TipoLancamento) => {
    if (t === tipo) return
    setTipo(t); setCat(t === 'entrada' ? 'Vendas' : 'Outros')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const v = parseMoney(amount)
    if (!(v > 0)) { setBad('amount'); amountRef.current?.focus(); return }
    if (!isDate(date)) { setBad('date'); return }
    setSaving(true)
    const ok = await write(() => api('/api/lancamentos', {
      method: 'POST',
      json: { tipo, valor: v, data: date, descricao: desc.trim() || null, categoria: tipo === 'retirada' ? null : cat },
    }), tipo === 'retirada' ? 'Retirada anotada' : 'Lançamento anotado')
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Dialog open onClose={onClose} title="Novo lançamento" sub="Anote o dinheiro vivo. O que passa pelo banco entra sozinho." labelledBy="txTitle">
      <form onSubmit={submit} noValidate>
        <div className="dlg-body">
          <div className="seg full" role="group" aria-label="Tipo">
            <button type="button" aria-pressed={tipo === 'saida'} onClick={() => changeTipo('saida')}>Saiu</button>
            <button type="button" aria-pressed={tipo === 'entrada'} onClick={() => changeTipo('entrada')}>Entrou</button>
            <button type="button" aria-pressed={tipo === 'retirada'} onClick={() => changeTipo('retirada')}>Pra mim</button>
          </div>
          <div className={'money' + (bad === 'amount' ? ' invalid' : '')}>
            <span>R$</span>
            <input ref={amountRef} className="num" inputMode="decimal" autoComplete="off" placeholder="0,00" aria-label="Valor"
              value={amount} onChange={e => { setAmount(e.target.value); setBad(null) }} />
          </div>
          <label className="fld"><span>Descrição (opcional)</span>
            <input className="input" maxLength={120} placeholder={tipo === 'retirada' ? 'Ex.: tirei para o mercado de casa' : 'Ex.: venda no balcão'}
              value={desc} onChange={e => setDesc(e.target.value)} />
          </label>
          <div className="grid2">
            <label className="fld"><span>Data</span>
              <input className={'input' + (bad === 'date' ? ' invalid' : '')} type="date" value={date} onChange={e => { setDate(e.target.value); setBad(null) }} />
            </label>
            {tipo !== 'retirada' && (
              <label className="fld"><span>Categoria</span>
                <select className="select" value={cat} onChange={e => setCat(e.target.value)}>
                  {(tipo === 'entrada' ? CATS_IN : CATS_OUT).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            )}
          </div>
          {tipo === 'retirada' && <p className="hint">Dinheiro do caixa que você tirou para uso pessoal. Fica separado do lucro do negócio.</p>}
        </div>
        <div className="dlg-foot">
          <span className="spacer" />
          <button className="btn" type="button" onClick={onClose}>Cancelar</button>
          <button className="btn primary" type="submit" disabled={saving}>Salvar</button>
        </div>
      </form>
    </Dialog>
  )
}
