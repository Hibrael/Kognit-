import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api, ApiError } from '../lib/api'
import { brl, isDate, parseMoney, plain } from '../lib/format'
import { useApp, useView } from '../lib/store'
import type { MutationResult, Settings } from '../lib/types'
import { Dialog } from './Dialog'
import { Icon } from './Icon'
import { Switch } from './common'
import { CsvImportDialog } from './CsvImportDialog'

/** Painel lateral de configurações (RF-14, 16.5). Seções extras (casa, integrações) entram por `children`. */
export function SettingsSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children?: ReactNode }) {
  return (
    <Dialog open={open} onClose={onClose} sheet title="Configurações" sub="Valem para toda a casa." labelledBy="setTitle">
      <div className="dlg-body">{open && <SettingsBody />}{children}</div>
    </Dialog>
  )
}

function SettingsBody() {
  const { mutate, toast, version } = useApp()
  const v = useView<Settings>('/api/settings')
  const s = v.data
  const [opening, setOpening] = useState('')
  const [date, setDate] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const [csvOpen, setCsvOpen] = useState(false)
  useEffect(() => { if (s) { setOpening(plain(s.openingBalance)); setDate(s.openingDate) } }, [s, version])
  if (!s) return <div className="state-loading"><span className="spinner" /></div>

  // mudanças aqui são desfeitas com Ctrl/⌘+Z, sem aviso (RF-15)
  const save = (json: object) => mutate(() => api<MutationResult>('/api/settings', { method: 'PUT', json }), { silent: true })
  const saveOpening = () => {
    const n = parseMoney(opening)
    if (Number.isFinite(n) && n !== s.openingBalance) save({ openingBalance: n })
    else setOpening(plain(s.openingBalance))
  }
  const saveDate = () => {
    const y = Number(date.slice(0, 4))
    if (isDate(date) && y >= 2000 && y <= 2100 && date !== s.openingDate) save({ openingDate: date })
    else setDate(s.openingDate)
  }

  const exportJson = async () => {
    try {
      const data = await api<unknown>('/api/export')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `minhas-contas-${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())}.json`
      document.body.append(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      try { localStorage.setItem('minhascontas:lastBackup', String(Date.now())) } catch { /* sem armazenamento */ }
      toast('Arquivo JSON exportado')
    } catch { toast('Não foi possível exportar') }
  }
  const importJson = async (f: File) => {
    const text = await f.text()
    try {
      const c = await api<{ transactions: number; recurring: number }>('/api/import?dryRun=true', { method: 'POST', body: text, headers: { 'Content-Type': 'application/json' } })
      if (!confirm(`Isto substitui ${c.transactions} lançamentos e ${c.recurring} contas fixas. Continuar?`)) return
      await mutate(() => api<MutationResult>('/api/import', { method: 'POST', body: text, headers: { 'Content-Type': 'application/json' } }))
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Arquivo não reconhecido') }
  }

  const mode = s.titheBase
  return (
    <>
      <section className="set-sec">
        <h3>Saldo inicial</h3>
        <p className="hint">Quanto havia na conta no início do controle. O saldo atual é este valor mais os lançamentos a partir desta data.</p>
        <div className="grid2">
          <label className="fld"><span>Valor (R$)</span>
            <input className="input num" inputMode="decimal" value={opening} onChange={e => setOpening(e.target.value)} onBlur={saveOpening}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
          </label>
          <label className="fld"><span>Em</span>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} onBlur={saveDate} />
          </label>
        </div>
      </section>
      <section className="set-sec">
        <h3>Devolução (10%)</h3>
        <div className="switch-row">
          <span className={mode === 'liquido' ? 'on' : ''}>Sobre o líquido</span>
          <Switch checked={mode === 'bruto'} label="Calcular a devolução sobre o salário bruto"
            onChange={b => save({ titheBase: b ? 'bruto' : 'liquido' })} />
          <span className={mode === 'bruto' ? 'on' : ''}>Sobre o bruto</span>
        </div>
        <div className="cmp">
          <div className={'cmp-row' + (mode === 'liquido' ? ' on' : '')}><span>Sobre o líquido<small>10% de {brl(s.netTotal)}</small></span><span className="num">{brl(s.netTotal * 0.1)}/mês</span></div>
          <div className={'cmp-row' + (mode === 'bruto' ? ' on' : '')}><span>Sobre o bruto<small>10% de {brl(s.grossTotal)}</small></span><span className="num">{brl(s.grossTotal * 0.1)}/mês</span></div>
        </div>
        <p className="hint">Vale para a conta fixa "Devolução 10%". A 1ª parcela do 13º não tem descontos e entra igual nos dois modos.</p>
      </section>
      <section className="set-sec">
        <h3>Dados</h3>
        <p className="hint">Exporte um backup de vez em quando: o servidor não guarda cópias automáticas.</p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn" type="button" onClick={exportJson}><Icon name="download" />Exportar JSON</button>
          <button className="btn" type="button" onClick={() => file.current?.click()}><Icon name="upload" />Importar JSON</button>
          <button className="btn" type="button" onClick={() => setCsvOpen(true)}><Icon name="upload" />Importar extrato CSV/XLSX</button>
          <input ref={file} type="file" accept="application/json,.json" hidden
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importJson(f) }} />
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn ghost" type="button" disabled={!s.hasSampleTx}
            onClick={() => mutate(() => api<MutationResult>('/api/sample/clear', { method: 'POST' }))}><Icon name="trash" />Apagar lançamentos de exemplo</button>
          {s.canRestoreSample && (
            <button className="btn ghost" type="button"
              onClick={() => mutate(() => api<MutationResult>('/api/sample/restore', { method: 'POST' }))}><Icon name="rotate" />Restaurar exemplo</button>
          )}
        </div>
      </section>
      <CsvImportDialog open={csvOpen} onClose={() => setCsvOpen(false)} />
    </>
  )
}
