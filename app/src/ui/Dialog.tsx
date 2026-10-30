import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'

/** &lt;dialog&gt; nativo do protótipo: abre com showModal, fecha no fundo, no X e no Esc. */
export function Dialog({ open, onClose, title, sub, sheet, children, labelledBy }: {
  open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; sheet?: boolean; children: ReactNode; labelledBy: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className={sheet ? 'sheet' : undefined} aria-labelledby={labelledBy}
      onClose={onClose} onClick={e => { if (e.target === ref.current) onClose() }}>
      {open && <>
        <div className="dlg-head">
          <div><h2 className="sec-title" id={labelledBy}>{title}</h2>{sub && <p className="sec-sub">{sub}</p>}</div>
          <button className="icon-btn" type="button" aria-label="Fechar" onClick={onClose}><Icon name="x" /></button>
        </div>
        {children}
      </>}
    </dialog>
  )
}
