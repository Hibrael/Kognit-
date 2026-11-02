import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { brl, brlS, cap, dShort, mLabelY, mLong, plain, round2, short } from '../lib/format'
import { useApp, useView } from '../lib/store'
import type { Conta, Contas, Previsao } from '../lib/types'
import { Icon } from '../ui/Icon'
import { ViewGate } from '../ui/common'
import { ContaPill, SemaforoCard } from './Overview'

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Contas e previsão: saldo dos próximos 30 dias com "E se…?", contas a pagar e evolução mensal (GET /api/previsao, /api/contas). */
export function Projection() {
  const [menos, setMenos] = useState(0)
  const [mais, setMais] = useState(0)
  const [ajuste, setAjuste] = useState({ menos: 0, mais: 0 })
  // o controle desliza livre; a API só é chamada quando ele para
  useEffect(() => { const t = setTimeout(() => setAjuste({ menos, mais }), 350); return () => clearTimeout(t) }, [menos, mais])

  const base = useView<Previsao>('/api/previsao')
  const simulando = ajuste.menos > 0 || ajuste.mais > 0
  const sim = useView<Previsao>(simulando ? `/api/previsao?menosRetiradaMes=${ajuste.menos}&maisEntradaMes=${ajuste.mais}` : null)
  const d = base.data
  const p = simulando && sim.data ? sim.data : d

  return (
    <ViewGate loading={base.loading} error={base.error} hasData={!!d} reload={base.reload}>
      {d && p && (
        <section className="stack" aria-label="Contas e previsão">
          <SemaforoCard s={p.semaforo} />
          <div className="card">
            <div className="sec-head">
              <div>
                <h2 className="sec-title">Saldo previsto nos próximos 30 dias</h2>
                <p className="sec-sub">Saldo de hoje + média do que entra − média dos gastos e retiradas − contas que vencem em cada dia.</p>
              </div>
            </div>
            <div className="base-line">
              <div><span>Dinheiro em caixa hoje</span><b>{brl(d.saldoAtual)}</b></div>
              <div><span>Entra por dia (média)</span><b className="pos">{brlS(p.medias.entradaPorDia)}</b></div>
              <div><span>Gastos por dia</span><b>{brlS(-p.medias.gastoPorDia)}</b></div>
              <div><span>Suas retiradas por dia</span><b>{brlS(-p.medias.retiradaPorDia)}</b></div>
              <div><span>Contas no período</span><b>{brlS(-p.contasNoPeriodo)}</b></div>
            </div>
            <div className="legend">
              <span><i className="key box" style={{ background: 'var(--accent)' }} />Saldo positivo</span>
              <span><i className="key box" style={{ background: 'var(--neg-bar)' }} />Falta dinheiro</span>
            </div>
            <Bars rows={p.pontos.map(pt => ({
              key: pt.data, label: dShort(pt.data), value: pt.saldo, title: dShort(pt.data),
              lines: pt.contas.map(c => `${c.descricao}: ${brl(c.valor)}`),
            }))} />
            <div className="set-sec" style={{ padding: '4px 20px 16px' }}>
              <h3>E se…?</h3>
              <p className="hint">Teste uma decisão antes de agir: o gráfico e o semáforo mudam na hora.</p>
              <label className="fld"><span>Retirar a menos por mês: <b className="num">{brl(menos)}</b></span>
                <input type="range" min={0} max={3000} step={50} value={menos} style={{ accentColor: 'var(--accent)' }}
                  onChange={e => setMenos(Number(e.target.value))} />
              </label>
              <label className="fld"><span>Vender a mais por mês: <b className="num">{brl(mais)}</b></span>
                <input type="range" min={0} max={5000} step={50} value={mais} style={{ accentColor: 'var(--accent)' }}
                  onChange={e => setMais(Number(e.target.value))} />
              </label>
              {simulando && sim.data && (
                <p className="hint">
                  Menor saldo em 30 dias: <b className="num">{brl(d.semaforo.menorSaldo)}</b> no ritmo atual → <b className="num">{brl(sim.data.semaforo.menorSaldo)}</b> com o ajuste.{' '}
                  <button type="button" className="link-btn" onClick={() => { setMenos(0); setMais(0) }}>Voltar ao ritmo atual</button>
                </p>
              )}
            </div>
          </div>

          <ContasCard />

          <div className="cols">
            <div className="card">
              <div className="sec-head"><div><h2 className="sec-title">Mês a mês</h2><p className="sec-sub">Lucro = entrou − saiu. As suas retiradas aparecem à parte.</p></div></div>
              <div className="table-scroll">
                <table className="proj-table">
                  <thead><tr><th>Mês</th><th className="opt">Entrou</th><th className="opt">Saiu</th><th>Lucro</th><th>Pra mim</th></tr></thead>
                  <tbody>
                    {[...d.evolucao].reverse().map((m, i) => {
                      const k = `${m.ano}-${pad2(m.mes)}`
                      return (
                        <tr key={k}>
                          <td><span className="lg">{cap(mLong(k))}{i === 0 && <span className="small"> · até hoje</span>}</span><span className="sm">{mLabelY(k)}</span></td>
                          <td className="opt">{brl(m.totais.entrou)}</td>
                          <td className="opt">{brl(m.totais.saiu)}</td>
                          <td className={'res' + (m.totais.lucro >= 0 ? ' pos' : '')}>{brlS(m.totais.lucro)}</td>
                          <td>{brl(m.totais.praMim)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="sec-head"><div><h2 className="sec-title">Maiores gastos do mês</h2></div></div>
              <div className="list">
                {d.gastosDoMes.map(g => (
                  <div key={g.categoria} className="li">
                    <div className="d"><span>{g.categoria}</span><div className="sp-bar" aria-hidden="true"><i style={{ width: `${g.percentual}%` }} /></div></div>
                    <div className="r"><small className="hint">{g.percentual.toLocaleString('pt-BR')}%</small><span className="amt">{plain(g.valor)}</span></div>
                  </div>
                ))}
                {!d.gastosDoMes.length && <div className="empty">Nenhum gasto neste mês ainda.</div>}
              </div>
            </div>
          </div>
        </section>
      )}
    </ViewGate>
  )
}

/** Contas a pagar com o total em 30/60/90 dias (as recorrentes se repetem sozinhas). */
function ContasCard() {
  const [status, setStatus] = useState<'abertas' | 'pagas'>('abertas')
  const v = useView<Contas>(`/api/contas?status=${status}`)
  const { write, openConta } = useApp()
  const d = v.data
  const pagar = (c: Conta) => write(() => api(`/api/contas/${c.id}/pagar`, { method: 'POST' }), `${c.descricao} marcada como paga`)
  const apagar = (c: Conta) => write(() => api(`/api/contas/${c.id}`, { method: 'DELETE' }), `${c.descricao} apagada`)
  return (
    <div className="card">
      <div className="sec-head">
        <div>
          <h2 className="sec-title">Contas a pagar</h2>
          <p className="sec-sub">Boletos e contas fixas. As fixas são descobertas no extrato e se repetem todo mês.</p>
        </div>
        <div className="row">
          <div className="seg" role="group" aria-label="Mostrar contas">
            <button type="button" aria-pressed={status === 'abertas'} onClick={() => setStatus('abertas')}>Abertas</button>
            <button type="button" aria-pressed={status === 'pagas'} onClick={() => setStatus('pagas')}>Pagas</button>
          </div>
          <button className="btn sm" type="button" onClick={openConta}><Icon name="plus" />Conta</button>
        </div>
      </div>
      <ViewGate loading={v.loading} error={v.error} hasData={!!d} reload={v.reload}>
        {d && <>
          <div className="base-line">
            <div><span>Até 30 dias</span><b>{brl(d.totalAPagar.ate30Dias)}</b></div>
            <div><span>De 31 a 60 dias</span><b>{brl(d.totalAPagar.de31a60Dias)}</b></div>
            <div><span>De 61 a 90 dias</span><b>{brl(d.totalAPagar.de61a90Dias)}</b></div>
          </div>
          <div className="list">
            {d.contas.map(c => (
              <div key={c.id} className={'li hov' + (c.paga ? ' done' : '')}>
                <div className="d">
                  <span>{c.descricao}</span>
                  <small>{[c.categoria, c.recorrente ? 'todo mês' : '', c.origem === 'detectada' ? 'descoberta no extrato' : c.origem === 'faturaCartao' ? 'fatura do cartão' : '',
                    c.pagaPeloBanco ? 'paga pelo banco' : ''].filter(Boolean).join(' · ')}</small>
                </div>
                <div className="r">
                  <ContaPill c={c} />
                  <span className={'amt ' + (c.paga ? 'muted' : '')}>−{plain(c.valor)}</span>
                  <div className="acts">
                    {!c.paga && <button type="button" className="icon-btn sm" title="Marcar como paga" aria-label={`Marcar ${c.descricao} como paga`} onClick={() => pagar(c)}><Icon name="check" /></button>}
                    <button type="button" className="icon-btn sm" title="Apagar" aria-label={`Apagar ${c.descricao}`} onClick={() => apagar(c)}><Icon name="trash" /></button>
                  </div>
                </div>
              </div>
            ))}
            {!d.contas.length && <div className="empty">{status === 'abertas' ? 'Nenhuma conta em aberto.' : 'Nenhuma conta paga ainda.'}</div>}
          </div>
        </>}
      </ViewGate>
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

interface BarRow { key: string; label: string; value: number; title: string; lines: string[] }

/** Barras divergentes a partir do zero, largura máx. 24px, ponta arredondada 4px (4.5). */
function Bars({ rows }: { rows: BarRow[] }) {
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
  if (!rows.length) return null

  const Hh = W < 560 ? 220 : 260
  const pad = { l: 46, r: 12, t: 12, b: 28 }
  const vals = rows.map(r => r.value)
  let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals)
  if (hi - lo < 1) hi = lo + 1000
  const ticks = niceTicks(lo, hi, 4)
  lo = ticks[0]; hi = ticks[ticks.length - 1]
  const iw = W - pad.l - pad.r, ih = Hh - pad.t - pad.b, n = rows.length, band = iw / n
  const bw = Math.min(24, band * 0.6)
  // com muitos dias, só alguns rótulos cabem no eixo
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / 48))))
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
  const tipTop = r ? Math.max(4, Math.min(y(Math.max(0, r.value)) - 60, Hh - 130)) : 0

  return (
    <div className="chart">
      <div className="chart-host" ref={host} tabIndex={0}
        onPointerMove={e => setTip(nearest(e.clientX))} onPointerLeave={() => setTip(-1)}
        onFocus={() => setTip(t => (t < 0 ? 0 : t))} onBlur={() => setTip(-1)}
        onKeyDown={e => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setTip(t => Math.max(0, Math.min(n - 1, (t < 0 ? 0 : t) + (e.key === 'ArrowRight' ? 1 : -1)))) }
        }}>
        <svg width={W} height={Hh} viewBox={`0 0 ${W} ${Hh}`} role="img"
          aria-label={'Saldo previsto por dia: ' + rows.map(x => `${x.title} ${brl(x.value)}`).join('; ')}>
          {ticks.map(t => (
            <g key={t}>
              <line className={t === 0 ? 'c-zero' : 'c-grid'} x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
              <text className="c-tick" x={pad.l - 10} y={y(t) + 4} textAnchor="end">{tickLabel(t)}</text>
            </g>
          ))}
          {rows.map((row, i) => {
            const cx = xc(i), x0 = cx - bw / 2
            const hgt = Math.abs(y(row.value) - y0)
            const up = row.value >= 0, R = Math.min(4, hgt, bw / 2)
            const d = up
              ? `M${x0},${y0} V${y0 - hgt + R} Q${x0},${y0 - hgt} ${x0 + R},${y0 - hgt} H${x0 + bw - R} Q${x0 + bw},${y0 - hgt} ${x0 + bw},${y0 - hgt + R} V${y0} Z`
              : `M${x0},${y0} V${y0 + hgt - R} Q${x0},${y0 + hgt} ${x0 + R},${y0 + hgt} H${x0 + bw - R} Q${x0 + bw},${y0 + hgt} ${x0 + bw},${y0 + hgt - R} V${y0} Z`
            return (
              <g key={row.key}>
                <rect className={'c-bar-band' + (tip === i ? ' on' : '')} x={pad.l + band * i + 1} y={pad.t} width={Math.max(0, band - 2)} height={ih} rx={4} />
                {hgt >= 0.5 && <path className={up ? 'c-bar-pos' : 'c-bar-neg'} d={d} />}
                {(i % every === 0 || tip === i) && <text className={'c-x' + (tip === i ? ' sel' : '')} x={cx} y={Hh - 8} textAnchor="middle">{i === 0 ? 'hoje' : row.label}</text>}
              </g>
            )
          })}
        </svg>
      </div>
      <div className={'tt' + (r ? ' on' : '')} aria-hidden="true" style={{ left: tipLeft, top: tipTop }}>
        {r && <>
          <div className="tt-title">{tip === 0 ? 'Hoje' : r.title}</div>
          <div className="tt-row"><i className="tt-key" style={{ background: r.value >= 0 ? 'var(--accent)' : 'var(--neg-bar)' }} /><b className="num">{brl(r.value)}</b><span>saldo previsto</span></div>
          {r.lines.map(l => <div key={l} className="tt-row"><span>vence: {l}</span></div>)}
        </>}
      </div>
    </div>
  )
}
