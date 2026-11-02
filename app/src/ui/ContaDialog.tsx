import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { CATS_OUT, isDate, parseMoney } from '../lib/format'
import { useApp } from '../lib/store'
import { Dialog } from './Dialog'

/** Nova conta a pagar: pela linha digitável do boleto (valor e vencimento lidos sozinhos) ou à mão (POST /api/contas). */
export function ContaDialog({ open, today, onClose }: { open: boolean; today: string; onClose: () => void }) {
  const { write } = useApp()
  const [desc, setDesc] = useState('')
  const [linha, setLinha] = useState('')
  const [amount, setAmount] = useState('')
  const [venc, setVenc] = useState(today)
  const [cat, setCat] = useState('Fornecedor')
  const [recorrente, setRecorrente] = useState(false)
  const [bad, setBad] = useState<'amount' | 'date' | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDesc(''); setLinha(''); setAmount(''); setVenc(today); setCat('Fornecedor'); setRecorrente(false); setBad(null)
  }, [open, today])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const digits = linha.replace(/\D/g, '')
    const v = parseMoney(amount)
    // com a linha digitável, valor e vencimento são opcionais (a API lê do boleto)
    if (!digits && !(v > 0)) { setBad('amount'); return }
    if (!digits && !isDate(venc)) { setBad('date'); return }
    setSaving(true)
    const ok = await write(() => api('/api/contas', {
      method: 'POST',
      json: {
        descricao: desc.trim() || null, linhaDigitavel: digits || null, categoria: cat, recorrente,
        valor: v > 0 ? v : null, vencimento: isDate(venc) && (!digits || amount) ? venc : null,
      },
    }), 'Conta cadastrada')
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nova conta a pagar" sub="Boleto, fornecedor ou conta fixa." labelledBy="contaTitle">
      <form onSubmit={submit} noValidate>
        <div className="dlg-body">
          <label className="fld"><span>Descrição</span>
            <input className="input" maxLength={120} placeholder="Ex.: Boleto ração (distribuidora)" value={desc} onChange={e => setDesc(e.target.value)} />
          </label>
          <label className="fld"><span>Linha digitável do boleto (opcional)</span>
            <input className="input num" inputMode="numeric" maxLength={60} placeholder="Cole os números do boleto" value={linha} onChange={e => setLinha(e.target.value)} />
          </label>
          <div className="grid2">
            <label className="fld"><span>Valor (R$)</span>
              <input className={'input num' + (bad === 'amount' ? ' invalid' : '')} inputMode="decimal" placeholder={linha ? 'lido do boleto' : '0,00'}
                value={amount} onChange={e => { setAmount(e.target.value); setBad(null) }} />
            </label>
            <label className="fld"><span>Vencimento</span>
              <input className={'input' + (bad === 'date' ? ' invalid' : '')} type="date" value={venc} onChange={e => { setVenc(e.target.value); setBad(null) }} />
            </label>
          </div>
          <div className="grid2">
            <label className="fld"><span>Categoria</span>
              <select className="select" value={cat} onChange={e => setCat(e.target.value)}>
                {CATS_OUT.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="check" style={{ alignSelf: 'end', paddingBottom: 8 }}>
              <input type="checkbox" checked={recorrente} onChange={e => setRecorrente(e.target.checked)} />Repete todo mês
            </label>
          </div>
          {linha && <p className="hint">Com a linha digitável, deixe valor e vencimento em branco para a API ler do boleto.</p>}
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
