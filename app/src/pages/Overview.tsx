import { useState } from 'react'
import { api } from '../lib/api'
import { brl, brlS, dShort, dateFor, dayOf, mLabel, mLabelY, mName, plain } from '../lib/format'
import { useApp, useView } from '../lib/store'
import type { Bill, MutationResult, Overview as OverviewData } from '../lib/types'
import { Icon } from '../ui/Icon'
import { TxRow, ViewGate } from '../ui/common'

/** Lembrete mensal de backup (16.4): sem exportação nos últimos 30 dias. */
function needsBackup() {
  try {
    const last = Number(localStorage.getItem('minhascontas:lastBackup') || 0)
    return Date.now() - last > 30 * 864e5
  } catch { return false }
}

/** Visão geral (4.3, 6.6): quatro números, "A pagar e a receber" e "Últimos lançamentos". */
export function Overview() {
  const v = useView<OverviewData>('/api/overview')
  const { go, openTx, mutate, setProjOpen, openSettings } = useApp()
  const [showDone, setShowDone] = useState(false)
  const d = v.data

  return (
    <ViewGate loading={v.loading} error={v.error} hasData={!!d} reload={v.reload}>
      {d && (() => {
        const mes = mName(d.cur)
        const done = d.bills.filter(b => b.txId).length
        const pend = d.bills.length - done
        const skip = (b: Bill) => mutate(() => api<MutationResult>(`/api/recurring/${b.recurringId}/skip`, { method: 'POST', json: { month: b.k } }))
        const confirm = (b: Bill) => openTx({ kind: 'confirm', recurringId: b.recurringId, k: b.k, name: b.name, type: b.type, category: b.category, amount: b.amount })
        const plural = (n: number) => `${n} ${n === 1 ? 'lançamento' : 'lançamentos'}`
        return (
          <section className="stack" aria-label="Visão geral">
            {!d.hasRecurring && (
              <div className="card empty state">
                Comece cadastrando seu salário e suas contas fixas ·{' '}
                <button type="button" className="link-btn" onClick={() => go('projecao')}>Ir para Fixos</button>
              </div>
            )}
            {needsBackup() && (
              <div className="card reminder">
                <span>Faça um backup (Exportar JSON): o servidor não guarda cópias automáticas.</span>
                <button type="button" className="btn sm" onClick={openSettings}>Exportar</button>
              </div>
            )}
            <div className="kpis">
              <article className="card kpi">
                <div className="kpi-label">Saldo atual</div>
                <div className="kpi-value hero num">{brl(d.balance)}</div>
                <div className="kpi-sub">previsto para {dShort(dateFor(d.cur, 31))}: <b className="num">{brl(d.endOfMonth)}</b></div>
              </article>
              <article className="card kpi">
                <div className="kpi-label">Entrou em {mes}</div>
                <div className="kpi-value num">{brl(d.monthIn)}</div>
                <div className="kpi-sub">{plural(d.nIn)}{d.toReceive > 0 && <> · <b className="num">{brl(d.toReceive)}</b> a receber</>}</div>
              </article>
              <article className="card kpi">
                <div className="kpi-label">Saiu em {mes}</div>
                <div className="kpi-value num">{brl(d.monthOut)}</div>
                <div className="kpi-sub">{plural(d.nOut)}{d.toPay > 0 && <> · <b className="num">{brl(d.toPay)}</b> a pagar</>}</div>
              </article>
              <article className="card kpi">
                <div className="kpi-label">Sobra em {mName(d.nextMonth)}</div>
                <div className={'kpi-value num ' + (d.nextNet >= 0 ? 'pos' : '')}>{brlS(d.nextNet)}</div>
                <div className="kpi-sub">
                  {d.nextNet >= 0 ? 'prevista com salário e fixos · ' : 'falta prevista · '}
                  <button type="button" className="link-btn" onClick={() => { setProjOpen(null); go('projecao') }}>ver projeção</button>
                </div>
              </article>
            </div>

            <div className="cols">
              <div className="card">
                <div className="sec-head">
                  <div>
                    <h2 className="sec-title">A pagar e a receber</h2>
                    <p className="sec-sub">
                      {!d.bills.length ? (d.hasRecurring ? 'Nada pendente neste mês.' : 'Nenhuma conta fixa cadastrada.')
                        : pend ? `${pend} ${pend === 1 ? 'conta pendente' : 'contas pendentes'} em ${mes}` : `Tudo em dia em ${mes}`}
                    </p>
                  </div>
                </div>
                <div className="list">
                  {d.bills.filter(b => !b.txId || showDone).map(b => {
                    const isIn = b.type === 'in'
                    const status = b.txId ? <span className="pill ok">{isIn ? 'Recebido' : 'Pago'} {dShort(b.txDate!)}</span>
                      : b.overdue ? <span className="pill late">{b.k < d.cur ? `Atrasada · ${mLabel(b.k).toLowerCase()}` : `Atrasada · dia ${dayOf(b.due)}`}</span>
                      : b.dueToday ? <span className="pill late">Vence hoje</span>
                      : <span className="pill">Dia {dayOf(b.due)}</span>
                    return (
                      <div key={b.recurringId + b.k} className={'li' + (b.txId ? ' done' : '')}>
                        <div className="d"><span>{b.name}</span><small>{isIn ? 'Entrada fixa' : b.category}</small></div>
                        <div className="r">
                          {status}
                          <span className={'amt ' + (b.txId ? 'muted' : isIn ? 'in' : '')}>{(isIn ? '+' : '−') + plain(b.amount)}</span>
                          {b.txId ? <span style={{ width: 58 }} /> : (
                            <span className="row" style={{ gap: 2 }}>
                              <button type="button" className="icon-btn sm" title={`Ignorar em ${mLabelY(b.k)} (não vai acontecer ou já está no saldo)`}
                                aria-label={`Ignorar ${b.name} em ${mLabelY(b.k)}`} onClick={() => skip(b)}><Icon name="x" /></button>
                              <button type="button" className="icon-btn sm" title={isIn ? 'Confirmar recebimento' : 'Confirmar pagamento'}
                                aria-label={`Confirmar ${b.name}`} onClick={() => confirm(b)}><Icon name="check" /></button>
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {!d.bills.length && <div className="empty">{d.hasRecurring ? 'As contas fixas deste mês vencem antes do saldo inicial ou foram ignoradas.' : 'Cadastre salário e contas fixas em "Fixos e projeção".'}</div>}
                  {!!d.bills.length && !pend && !showDone && <div className="empty">Tudo em dia em {mes}</div>}
                </div>
                <div className="card-foot">
                  <span>Falta pagar <b className="num">{brl(d.pOut)}</b> · receber <b className="num">{brl(d.pIn)}</b></span>
                  {done > 0 && <button type="button" className="link-btn" onClick={() => setShowDone(!showDone)}>{showDone ? 'Ocultar confirmadas' : `Ver ${done} confirmadas`}</button>}
                </div>
              </div>

              <div className="card">
                <div className="sec-head">
                  <div><h2 className="sec-title">Últimos lançamentos</h2></div>
                  <button className="btn sm" type="button" onClick={() => go('extrato')}>Ver extrato</button>
                </div>
                <div className="list">
                  {d.recent.length ? d.recent.map(t => <TxRow key={t.id} t={t} showDate today={d.today} />)
                    : <div className="empty">Nenhum lançamento ainda. Use o botão "Lançamento".</div>}
                </div>
              </div>
            </div>
          </section>
        )
      })()}
    </ViewGate>
  )
}
