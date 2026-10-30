import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { dShort, plain } from '../lib/format'
import { readSpreadsheet, type Table } from '../lib/sheet'
import { useApp } from '../lib/store'
import type { CsvMapping, CsvPreview, MutationResult } from '../lib/types'
import { Dialog } from './Dialog'

const EMPTY: CsvMapping = { date: '', description: '', amount: null, credit: null, debit: null, id: null }

/** Importar extrato CSV/XLSX (RF-18, 8.4): leitura no aparelho, mapeamento, prévia e deduplicação no back. */
export function CsvImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate, toast } = useApp()
  const [table, setTable] = useState<Table | null>(null)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<CsvPreview | null>(null)
  const [mapping, setMapping] = useState<CsvMapping>(EMPTY)
  const [valueMode, setValueMode] = useState<'amount' | 'split'>('amount')
  const [owner, setOwner] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) { setTable(null); setPreview(null); setMapping(EMPTY); setOwner(null); setSelected(new Set()) }
  }, [open])

  const requestPreview = async (t: Table, m: CsvMapping | null, o: string | null) => {
    setBusy(true)
    try {
      const p = await api<CsvPreview>('/api/import/csv/preview', { method: 'POST', json: { fileName, headers: t.headers, rows: t.rows, mapping: m, owner: o } })
      setPreview(p)
      if (p.mapping) { setMapping(p.mapping); setValueMode(p.mapping.amount ? 'amount' : 'split') }
      // novos marcados; possíveis duplicatas vêm desmarcadas; já existentes não entram
      setSelected(new Set(p.lines.filter(l => l.status === 'new' && !l.error).map(l => l.n)))
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Não foi possível ler o arquivo') }
    finally { setBusy(false) }
  }

  const pick = async (f: File) => {
    try {
      const t = await readSpreadsheet(f)
      if (!t.headers.length || !t.rows.length) { toast('Arquivo vazio'); return }
      setFileName(f.name); setTable(t); setPreview(null)
      await requestPreview(t, null, null)
    } catch { toast('Arquivo não reconhecido') }
  }

  const applyMapping = () => {
    if (!table) return
    const m = valueMode === 'amount' ? { ...mapping, credit: null, debit: null } : { ...mapping, amount: null }
    if (!m.date || !m.description || (valueMode === 'amount' ? !m.amount : !m.credit || !m.debit)) { toast('Escolha as colunas de data, descrição e valor'); return }
    void requestPreview(table, m, owner)
  }

  const commit = async () => {
    if (!table || !preview) return
    const m = preview.kind === 'release' ? null : mapping
    const r = await mutate(() => api<MutationResult>('/api/import/csv/commit', {
      method: 'POST', json: { fileName, headers: table.headers, rows: table.rows, mapping: m, owner, selected: [...selected] },
    }))
    if (r) onClose()
  }

  const col = (label: string, key: keyof CsvMapping, optional = false) => (
    <label className="fld"><span>{label}</span>
      <select className="select" value={mapping[key] ?? ''} onChange={e => setMapping({ ...mapping, [key]: e.target.value || null })}>
        <option value="">{optional ? '(nenhuma)' : 'Escolha…'}</option>
        {table!.headers.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
    </label>
  )

  return (
    <Dialog open={open} onClose={onClose} title="Importar extrato" sub="CSV ou XLSX exportado do banco ou do Mercado Pago." labelledBy="csvTitle">
      <div className="dlg-body">
        <div className="row">
          <button className="btn" type="button" onClick={() => file.current?.click()} disabled={busy}>{table ? 'Trocar arquivo' : 'Escolher arquivo'}</button>
          {fileName && <small className="small">{fileName}</small>}
          <input ref={file} type="file" hidden accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pick(f) }} />
        </div>

        {preview?.needsOwner && (
          <label className="fld"><span>De quem é esta conta do Mercado Pago?</span>
            <select className="select" value={owner ?? ''} onChange={e => { setOwner(e.target.value); if (table) void requestPreview(table, null, e.target.value) }}>
              <option value="" disabled>Escolha…</option>
              {preview.owners.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        )}

        {table && preview?.needsMapping && (
          <div className="stack-sm">
            <p className="hint">Indique as colunas. O mapeamento fica salvo para os próximos arquivos com os mesmos cabeçalhos.</p>
            <div className="grid2">{col('Data', 'date')}{col('Descrição', 'description')}</div>
            <div className="seg full" role="group" aria-label="Como vem o valor">
              <button type="button" aria-pressed={valueMode === 'amount'} onClick={() => setValueMode('amount')}>Valor com sinal</button>
              <button type="button" aria-pressed={valueMode === 'split'} onClick={() => setValueMode('split')}>Crédito e débito</button>
            </div>
            {valueMode === 'amount' ? col('Valor', 'amount') : <div className="grid2">{col('Crédito', 'credit')}{col('Débito', 'debit')}</div>}
            {col('Id da operação', 'id', true)}
            <div><button className="btn" type="button" onClick={applyMapping} disabled={busy}>Ver prévia</button></div>
          </div>
        )}

        {preview && !preview.needsMapping && !preview.needsOwner && (
          <>
            <p className="hint">{preview.counts.new} novos · {preview.counts.existing} já existentes · {preview.counts.duplicate} possíveis duplicatas</p>
            <div className="csv-list">
              {preview.lines.map(l => (
                <label key={l.n} className={'check csv-line' + (l.status === 'existing' || l.error ? ' done' : '')}>
                  <input type="checkbox" disabled={l.status === 'existing' || !!l.error} checked={selected.has(l.n)}
                    onChange={() => { const s = new Set(selected); if (s.has(l.n)) s.delete(l.n); else s.add(l.n); setSelected(s) }} />
                  <span className="csv-d">
                    <span>{l.error ? `Linha ${l.n}: ${l.error}` : l.description || '(sem descrição)'}</span>
                    {!l.error && <small>{dShort(l.date)} · {l.category}{l.status === 'existing' ? ' · já existe' : ''}{l.similarTo ? ` · Parece com lançamento de ${dShort(l.similarTo)}` : ''}</small>}
                  </span>
                  {!l.error && <span className={'amt' + (l.type === 'in' ? ' in' : '')}>{(l.type === 'in' ? '+' : '−') + plain(l.amount)}</span>}
                </label>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="dlg-foot">
        <span className="spacer" />
        <button className="btn" type="button" onClick={onClose}>Cancelar</button>
        <button className="btn primary" type="button" disabled={busy || !selected.size} onClick={commit}>
          Importar {selected.size ? selected.size : ''}
        </button>
      </div>
    </Dialog>
  )
}
