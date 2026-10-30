import type { ReactNode } from 'react'
import { dayLabel, plain } from '../lib/format'
import { useApp } from '../lib/store'
import type { Tx } from '../lib/types'
import { api } from '../lib/api'
import type { MutationResult } from '../lib/types'
import { Icon } from './Icon'

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
  if (!hasData && loading) return <div className="state-loading" role="status" aria-label="Carregando"><span className="spinner" /></div>
  return <>{children}</>
}

/** Linha de lançamento (Visão geral e Extrato). */
export function TxRow({ t, showDate, today }: { t: Tx; showDate?: boolean; today: string }) {
  const { openTx, mutate } = useApp()
  const isIn = t.type === 'in'
  const meta = [
    showDate ? dayLabel(t.date) + ' · ' : '', t.category, t.recurringId ? ' · conta fixa' : '', t.date > today ? ' · agendado' : '',
    t.beforeOpening ? ' · antes do saldo inicial' : '',
  ].join('')
  const del = () => mutate(() => api<MutationResult>(`/api/transactions/${t.id}`, { method: 'DELETE' }))
  return (
    <div className={'li hov' + (t.isTransfer ? ' done' : '')}>
      <div className="d">
        <span>{t.description || '(sem descrição)'}</span>
        <small>{meta}</small>
      </div>
      <div className="r">
        {t.isTransfer && <span className="pill">transferência</span>}
        <span className={'amt ' + (t.isTransfer ? 'muted' : isIn ? 'in' : '')}>{(isIn ? '+' : '−') + plain(t.amount)}</span>
        <div className="acts">
          <button type="button" className="icon-btn sm" title="Editar" aria-label={`Editar ${t.description}`} onClick={() => openTx({ kind: 'edit', tx: t })}><Icon name="pencil" /></button>
          <button type="button" className="icon-btn sm" title="Excluir" aria-label={`Excluir ${t.description}`} onClick={del}><Icon name="trash" /></button>
        </div>
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
