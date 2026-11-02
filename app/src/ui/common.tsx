import { useEffect, useState, type ReactNode } from 'react'
import { dayLabel, plain } from '../lib/format'
import { SLOW_MS, useApp } from '../lib/store'
import { entra, type Lancamento } from '../lib/types'
import { api } from '../lib/api'
import { Icon } from './Icon'

/** Aparece se a resposta demorar: o servidor grátis (Render) dorme sem uso e leva até 1 min para ligar. */
export function SlowNote() {
  const [on, setOn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setOn(true), SLOW_MS); return () => clearTimeout(t) }, [])
  return on ? <p className="hint" style={{ textAlign: 'center' }}>Ligando o servidor. Na primeira vez do dia isso pode levar até 1 minuto.</p> : null
}

/** Estados de carga e erro da 16.1. */
export function ViewGate({ loading, error, hasData, reload, children }: {
  loading: boolean; error: string | null; hasData: boolean; reload: () => void; children: ReactNode
}) {
  if (!hasData && error) {
    return (
      <div className="card empty state">
        {error} · <button type="button" className="link-btn" onClick={reload}>Tentar de novo</button>
      </div>
    )
  }
  if (!hasData && loading) {
    return <div className="state-loading" role="status" aria-label="Carregando"><div className="stack-sm"><span className="spinner" style={{ justifySelf: 'center' }} /><SlowNote /></div></div>
  }
  return <>{children}</>
}

/** Linha de movimentação (Visão geral e Extrato). Só o que foi anotado à mão (ou simulado) pode ser apagado. */
export function TxRow({ t, showDate }: { t: Lancamento; showDate?: boolean }) {
  const { write } = useApp()
  const isIn = entra(t.tipo)
  const meta = [showDate ? dayLabel(t.data) : '', t.categoria, t.meio ?? '', t.contaPaga ? 'conta paga' : '', t.simulado ? 'simulado' : '']
    .filter(Boolean).join(' · ')
  const del = () => write(() => api(`/api/lancamentos/${t.id}`, { method: 'DELETE' }), 'Lançamento apagado')
  return (
    <div className="li hov">
      <div className="d">
        <span>{t.descricao || '(sem descrição)'}</span>
        <small title={t.motivo ?? undefined}>{meta}</small>
      </div>
      <div className="r">
        {t.tipo === 'retirada' && <span className="pill">pra mim</span>}
        {t.revisar && <span className="pill late" title={t.motivo ?? undefined}>conferir</span>}
        <span className={'amt ' + (isIn ? 'in' : '')}>{(isIn ? '+' : '−') + plain(t.valor)}</span>
        {(t.origem === 'manual' || t.simulado) && (
          <div className="acts">
            <button type="button" className="icon-btn sm" title="Apagar" aria-label={`Apagar ${t.descricao}`} onClick={del}><Icon name="trash" /></button>
          </div>
        )}
      </div>
    </div>
  )
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button className="switch" type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)} />
  )
}
