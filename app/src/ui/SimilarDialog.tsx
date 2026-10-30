import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useApp } from '../lib/store'
import type { MutationResult } from '../lib/types'
import { Dialog } from './Dialog'

/**
 * "Aplicar a lançamentos parecidos" (8.5): depois de trocar a categoria de um lançamento importado, cria uma
 * regra "descrição contém" (texto editável) e recategoriza os importados sem trava.
 */
export function SimilarDialog({ value, onClose }: { value: { matchValue: string; category: string } | null; onClose: () => void }) {
  const { mutate } = useApp()
  const [text, setText] = useState('')
  useEffect(() => { if (value) setText(value.matchValue) }, [value])
  const apply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value || !text.trim()) return
    onClose()
    await mutate(() => api<MutationResult>('/api/category-rules/apply-similar', { method: 'POST', json: { matchValue: text.trim(), category: value.category } }))
  }
  return (
    <Dialog open={!!value} onClose={onClose} title="Aplicar a lançamentos parecidos" labelledBy="simTitle"
      sub={value ? `Lançamentos importados cuja descrição contém o texto abaixo passam a ser “${value.category}”.` : undefined}>
      <form onSubmit={apply} noValidate>
        <div className="dlg-body">
          <label className="fld"><span>Descrição contém</span><input className="input" value={text} onChange={e => setText(e.target.value)} autoFocus /></label>
        </div>
        <div className="dlg-foot">
          <span className="spacer" />
          <button className="btn" type="button" onClick={onClose}>Agora não</button>
          <button className="btn primary" type="submit">Aplicar</button>
        </div>
      </form>
    </Dialog>
  )
}
