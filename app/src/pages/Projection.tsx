import { Fragment, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { brl, brlS, cap, mLabel, mLabelY, mLong, parseKey, plain, round2, short } from '../lib/format'
import { useApp, usePref, useView } from '../lib/store'
import type { MutationResult, Projection as ProjectionData, ProjectionRow, Recurring } from '../lib/types'
import { Icon } from '../ui/Icon'
import { Switch, ViewGate } from '../ui/common'

/** Fixos e projeção (4.5, RF-12, RF-13). Aprovada como está no protótipo (D3). */
export function Projection() {
  const [variable, setVariable] = usePref('projVar', false)
  const v = useView<ProjectionData>(`/api/projection?variable=${variable}`)
  const { projOpen, setProjOpen, openRec } = useApp()
  const d = v.data

  return (
    <ViewGate loading={v.loading} error={v.error} hasData={!!d} reload={v.reload}>
      {d && (() => {
        const last = d.rows[d.rows.length - 1]
        const toggle = (k: string) => setProjOpen(projOpen === k ? null : k)
        return (
          <section className="stack" aria-label="Fixos e projeção">
            <div className="card">
              <div className="sec-head">
                <div>
                  <h2 className="sec-title">Projeção dos próximos meses</h2>
                  <p className="sec-sub">Parte do saldo atual ({brl(d.balance)}) e soma salário e contas fixas. Em {mLabelY(last.k)}: {brl(last.end)}.</p>
                </div>
                <label className="switch-inline">
                  <Switch checked={variable && d.varAvg > 0} onChange={setVariable} label="Incluir gastos variáveis" disabled={!(d.varAvg > 0)} />
                  <span>{d.varAvg > 0 ? `Incluir gastos variáveis (~${brl(d.varAvg)}/mês)` : 'Incluir gastos variáveis (sem histórico)'}</span>
                </label>
              </div>
              {!d.base.salary && <div className="filter-note"><span>Cadastre o salário para ver a sobra</span></div>}
              <div className="legend">
                <span><i className="key box" style={{ background: 'var(--accent)' }} />Sobra</span>
                <span><i className="key box" style={{ background: 'var(--neg-bar)' }} />Falta</span>
              </div>
              <Bars rows={d.rows} open={projOpen} onToggle={toggle} />
              <div className="table-scroll">
                <table className="proj-table">
                  <thead><tr><th>Mês</th><th className="opt">Entradas</th><th className="opt">Saídas</th><th>Sobra / falta</th><th>Saldo no fim</th></tr></thead>
                  <tbody>
                    {d.rows.map((r, i) => {
                      const open = projOpen === r.k
                      return (
                        <Fragment key={r.k}>
                          <tr className={'m' + (open ? ' open' : '')} tabIndex={0} aria-expanded={open} onClick={() => toggle(r.k)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(r.k) } }}>
                            <td>
                              <span className="chev" aria-hidden="true">›</span>{' '}
                              <span className="lg">{cap(mLong(r.k))}{i === 0 && <span className="small"> · atual</span>}</span>
                              <span className="sm">{mLabelY(r.k) + (i === 0 ? '*' : '')}</span>
                            </td>
                            <td className="opt">{brl(r.in)}</td>
                            <td className="opt">{brl(r.out)}</td>
                            <td className={'res' + (r.net >= 0 ? ' pos' : '')}>{brlS(r.net)}<span className="lg">{r.net >= 0 ? ' sobra' : ' falta'}</span></td>
                            <td>{brl(r.end)}</td>
                          </tr>
                          {open && <tr className="det"><td colSpan={5}><MonthDetail r={r} /></td></tr>}
                        </Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr><td colSpan={5} className="small" style={{ textAlign: 'left', padding: '10px 20px', borderBottom: 0, whiteSpace: 'normal' }}>
                      * {mLabel(d.cur)}: inclui o que já entrou e saiu no mês mais as contas fixas ainda não confirmadas. Toque num mês para ver o detalhe.
                    </td></tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="sec-head">
                <div>
                  <h2 className="sec-title">Salário e contas fixas</h2>
                  <p className="sec-sub">A base da projeção. Cada conta vira um "previsto" no extrato até ser confirmada.</p>
                </div>
                <button className="btn sm" type="button" onClick={() => openRec()}><Icon name="plus" />Conta fixa</button>
              </div>
              <div className="base-line">
                <div><span>Salário base (líquido)</span><b>{brl(d.base.salary)}</b></div>
                <div><span>Contas fixas ({mLabelY(d.base.k)})</span><b>{brl(d.base.fixed)}</b></div>
                <div><span>Sobra base por mês</span><b className={d.base.net >= 0 ? 'pos' : ''}>{brlS(d.base.net)}</b></div>
              </div>
              <RecList recs={d.recurring} titheBase={d.titheBase} />
            </div>
          </section>
        )
      })()}
    </ViewGate>
  )
}

function MonthDetail({ r }: { r: ProjectionRow }) {
  const col = (title: string, type: 'in' | 'out', total: number) => {
    const lines = r.lines.filter(l => l.type === type)
    return (
      <div>
        <h4>{title} · {brl(total)}</h4>
        {lines.length ? lines.map((l, i) => (
          <div key={i} className="det-row"><span>{l.name} <small>{l.note}</small></span><span className="num">{plain(l.amount)}</span></div>
        )) : <div className="det-row"><small>Nada previsto</small></div>}
      </div>
    )
  }
  return <div className="det-box">{col('Entradas', 'in', r.in)}{col('Saídas', 'out', r.out)}</div>
}

function RecList({ recs, titheBase }: { recs: Recurring[]; titheBase: string }) {
  const { openRec, mutate } = useApp()
  const group = (title: string, arr: Recurring[]) => !arr.length ? null : (
    <>
      <div className="grp">{title}</div>
      {[...arr].sort((a, b) => a.day - b.day).map(r => (
        <div key={r.id} className={'li hov' + (r.ended ? ' done' : '')}>
          <div className="d">
            <span>{r.name}{r.isSalary && <span className="pill" style={{ marginLeft: 8 }}>salário</span>}</span>
            <small>{[`dia ${r.day}`, r.vigencia, r.category, r.formula === 'tithe' ? `10% sobre o ${titheBase === 'bruto' ? 'bruto' : 'líquido'}` : '',
              r.formula === 'decimo' ? '50% do bruto' : ''].filter(Boolean).join(' · ')}</small>
          </div>
          <div className="r">
            <span className={'amt ' + (r.type === 'in' ? 'in' : '')}>{(r.type === 'in' ? '+' : '−') + plain(r.displayAmount)}</span>
            <div className="acts">
              <button type="button" className="icon-btn sm" title="Editar" aria-label={`Editar ${r.name}`} onClick={() => openRec(r)}><Icon name="pencil" /></button>
              <button type="button" className="icon-btn sm" title="Excluir" aria-label={`Excluir ${r.name}`}
                onClick={() => mutate(() => api<MutationResult>(`/api/recurring/${r.id}`, { method: 'DELETE' }))}><Icon name="trash" /></button>
            </div>
          </div>
        </div>
      ))}
    </>
  )
  return (
    <div>
      {group('Entradas fixas', recs.filter(r => r.type === 'in'))}
      {group('Saídas fixas', recs.filter(r => r.type === 'out'))}
      {!recs.length && <div className="empty">Cadastre seu salário e suas contas fixas para ver a projeção.</div>}
      <div style={{ height: 8 }} />
    </div>
  )
}

/** "Redondas" para o eixo (16.8: 3–4 marcas). */
function niceTicks(lo: number, hi: number, count: number) {
  const raw = (hi - lo) / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / mag
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag
  const out: number[] = []
  for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + step / 2; v += step) out.push(round2(v))
  return out
}
const tickLabel = (t: number) => (t === 0 ? '0' : (t < 0 ? '−' : '') + short(t))

/** Barras divergentes a partir do zero, largura máx. 24px, ponta arredondada 4px (4.5). */
function Bars({ rows, open, onToggle }: { rows: ProjectionRow[]; open: string | null; onToggle: (k: string) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(600)
  const [tip, setTip] = useState<number>(-1)
  useEffect(() => {
    const el = host.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(240, Math.round(el.clientWidth))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const Hh = W < 560 ? 220 : 260
  const pad = { l: 46, r: 12, t: 12, b: 28 }
  const nets = rows.map(r => r.net)
  let lo = Math.min(0, ...nets), hi = Math.max(0, ...nets)
  if (hi - lo < 1) hi = lo + 1000
  const ticks = niceTicks(lo, hi, 4)
  lo = ticks[0]; hi = ticks[ticks.length - 1]
  const iw = W - pad.l - pad.r, ih = Hh - pad.t - pad.b, n = rows.length, band = iw / n
  const bw = Math.min(24, band * 0.5)
  const y = (v: number) => pad.t + ih * (1 - (v - lo) / (hi - lo))
  const xc = (i: number) => pad.l + band * (i + 0.5)
  const y0 = y(0)
  const nearest = (clientX: number) => {
    const px = clientX - host.current!.getBoundingClientRect().left
    let best = 0, bd = Infinity
    rows.forEach((_, i) => { const dd = Math.abs(xc(i) - px); if (dd < bd) { bd = dd; best = i } })
    return best
  }
  const r = tip >= 0 ? rows[tip] : null
  const tipLeft = r ? (xc(tip) + 14 + 200 > W ? xc(tip) - 214 : xc(tip) + 14) : 0
  const tipTop = r ? Math.max(4, Math.min(y(Math.max(0, r.net)) - 60, Hh - 130)) : 0

  return (
    <div className="chart">
      <div className="chart-host" ref={host} tabIndex={0}
        onPointerMove={e => setTip(nearest(e.clientX))} onPointerLeave={() => setTip(-1)}
        onClick={e => onToggle(rows[nearest(e.clientX)].k)}
        onFocus={() => setTip(t => (t < 0 ? 0 : t))} onBlur={() => setTip(-1)}
        onKeyDown={e => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setTip(t => Math.max(0, Math.min(n - 1, (t < 0 ? 0 : t) + (e.key === 'ArrowRight' ? 1 : -1)))) }
          else if (e.key === 'Enter' && tip >= 0) { e.preventDefault(); onToggle(rows[tip].k) }
        }}>
        <svg width={W} height={Hh} viewBox={`0 0 ${W} ${Hh}`} role="img"
          aria-label={'Sobra ou falta por mês: ' + rows.map(x => `${mLong(x.k)} ${brlS(x.net)}`).join('; ')}>
          {ticks.map(t => (
            <g key={t}>
              <line className={t === 0 ? 'c-zero' : 'c-grid'} x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
              <text className="c-tick" x={pad.l - 10} y={y(t) + 4} textAnchor="end">{tickLabel(t)}</text>
            </g>
          ))}
          {rows.map((row, i) => {
            const cx = xc(i), x0 = cx - bw / 2
            const isOpen = open === row.k
            const hgt = Math.abs(y(row.net) - y0)
            const up = row.net >= 0, R = Math.min(4, hgt, bw / 2)
            const d = up
              ? `M${x0},${y0} V${y0 - hgt + R} Q${x0},${y0 - hgt} ${x0 + R},${y0 - hgt} H${x0 + bw - R} Q${x0 + bw},${y0 - hgt} ${x0 + bw},${y0 - hgt + R} V${y0} Z`
              : `M${x0},${y0} V${y0 + hgt - R} Q${x0},${y0 + hgt} ${x0 + R},${y0 + hgt} H${x0 + bw - R} Q${x0 + bw},${y0 + hgt} ${x0 + bw},${y0 + hgt - R} V${y0} Z`
            const lbl = i === 0 ? `${mLabel(row.k)}*` : parseKey(row.k).m === 1 ? mLabelY(row.k) : mLabel(row.k)
            return (
              <g key={row.k}>
                <rect className={'c-bar-band' + (isOpen ? ' on' : '')} x={pad.l + band * i + 2} y={pad.t} width={band - 4} height={ih} rx={6} />
                {hgt >= 0.5 && <path className={up ? 'c-bar-pos' : 'c-bar-neg'} d={d} />}
                <text className={'c-x' + (isOpen ? ' sel' : '')} x={cx} y={Hh - 8} textAnchor="middle">{lbl}</text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className={'tt' + (r ? ' on' : '')} aria-hidden="true" style={{ left: tipLeft, top: tipTop }}>
        {r && <>
          <div className="tt-title">{cap(mLong(r.k)) + (tip === 0 ? ' (mês atual)' : '')}</div>
          <div className="tt-row"><i className="tt-key" style={{ background: r.net >= 0 ? 'var(--accent)' : 'var(--neg-bar)' }} /><b className="num">{brlS(r.net)}</b><span>{r.net >= 0 ? 'sobra do mês' : 'falta no mês'}</span></div>
          <div className="tt-row"><b className="num">{brl(r.in)}</b><span>entradas</span></div>
          <div className="tt-row"><b className="num">{brl(r.out)}</b><span>saídas</span></div>
          <div className="tt-row"><b className="num">{brl(r.end)}</b><span>saldo no fim do mês</span></div>
        </>}
      </div>
    </div>
  )
}
