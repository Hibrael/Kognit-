import { api } from '../lib/api'
import { brl, dShort, mName, monthOf, plain, todaySP } from '../lib/format'
import { useApp, useView } from '../lib/store'
import type { Alerta, Conta, Painel, Semaforo } from '../lib/types'
import { Icon } from '../ui/Icon'
import { TxRow, ViewGate } from '../ui/common'

/** Situação da conta a pagar, no estilo das pílulas do protótipo. */
export function ContaPill({ c }: { c: Conta }) {
  if (c.paga) return <span className="pill ok">Paga{c.pagaEm ? ` ${dShort(c.pagaEm)}` : ''}</span>
  if (c.situacao === 'atrasada') return <span className="pill late">Atrasada · {dShort(c.vencimento)}</span>
  if (c.situacao === 'venceHoje') return <span className="pill late">Vence hoje</span>
  return <span className="pill">{dShort(c.vencimento)}</span>
}

/** Semáforo da previsão de 30 dias (verde / amarelo / vermelho). */
export function SemaforoCard({ s, action }: { s: Semaforo; action?: React.ReactNode }) {
  return (
    <div className="card sem" role="status">
      <span className={'sem-dot ' + s.cor} aria-hidden="true" />
      <div className="sem-txt"><b>{s.titulo}</b><p>{s.texto}</p></div>
      {action}
    </div>
  )
}

function AlertaRow({ a }: { a: Alerta }) {
  return (
    <div className="li wrap">
      <div className="d">
        <span>{a.titulo}</span>
        <small>{a.texto}</small>
        {a.sugestao && <small className="sug">{a.sugestao}</small>}
      </div>
      <div className="r">{a.nivel === 'alto' ? <span className="pill late">importante</span> : a.nivel === 'medio' ? <span className="pill">atenção</span> : null}</div>
    </div>
  )
}

/** Visão geral: semáforo, quatro números, "Precisa de atenção", contas a pagar e últimas movimentações (GET /api/painel). */
export function Overview() {
  const v = useView<Painel>('/api/painel')
  const { go, write, openSettings, openConta } = useApp()
  const d = v.data

  return (
    <ViewGate loading={v.loading} error={v.error} hasData={!!d} reload={v.reload}>
      {d && (() => {
        const mes = mName(monthOf(todaySP()))
        const semDados = !d.conexoes.length && !d.ultimasMovimentacoes.length
        const pagar = (c: Conta) => write(() => api(`/api/contas/${c.id}/pagar`, { method: 'POST' }), `${c.descricao} marcada como paga`)
        const aPagar = d.proximasContas.filter(c => !c.paga)
        return (
          <section className="stack" aria-label="Visão geral">
            {semDados && (
              <div className="card reminder">
                <span>Conecte o banco do negócio para as movimentações entrarem sozinhas, já organizadas.</span>
                <span className="row">
                  <button type="button" className="btn sm"
                    onClick={() => write(() => api('/api/conexoes/demo', { method: 'POST' }), 'Banco de demonstração conectado')}>Usar banco de demonstração</button>
                  <button type="button" className="btn sm ghost" onClick={openSettings}>Conectar banco</button>
                </span>
              </div>
            )}
            {!semDados && (
              <SemaforoCard s={d.semaforo}
                action={<button type="button" className="link-btn" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }} onClick={() => go('projecao')}>ver previsão</button>} />
            )}
            <div className="kpis">
              <article className="card kpi">
                <div className="kpi-label">Saldo atual</div>
                <div className="kpi-value hero num">{brl(d.saldo)}</div>
                <div className="kpi-sub">menor saldo em 30 dias: <b className="num">{brl(d.semaforo.menorSaldo)}</b> em {dShort(d.semaforo.diaMenorSaldo)}</div>
              </article>
              <article className="card kpi">
                <div className="kpi-label">Entrou em {mes}</div>
                <div className="kpi-value num">{brl(d.mes.entrou)}</div>
                <div className="kpi-sub">hoje: <b className="num">{brl(d.hoje.entrou)}</b></div>
              </article>
              <article className="card kpi">
                <div className="kpi-label">Saiu em {mes}</div>
                <div className="kpi-value num">{brl(d.mes.saiu)}</div>
                <div className="kpi-sub">hoje: <b className="num">{brl(d.hoje.saiu)}</b></div>
              </article>
              <article className="card kpi">
                <div className="kpi-label">Lucro em {mes}</div>
                <div className={'kpi-value num ' + (d.mes.lucro >= 0 ? 'pos' : '')}>{brl(d.mes.lucro)}</div>
                <div className="kpi-sub">você retirou <b className="num">{brl(d.mes.praMim)}</b> para você</div>
              </article>
            </div>

            {!!d.alertas.length && (
              <div className="card">
                <div className="sec-head"><div><h2 className="sec-title">Precisa de atenção</h2></div></div>
                <div className="list">{d.alertas.map(a => <AlertaRow key={a.id} a={a} />)}</div>
              </div>
            )}

            <div className="cols">
              <div className="card">
                <div className="sec-head">
                  <div>
                    <h2 className="sec-title">Contas a pagar</h2>
                    <p className="sec-sub">
                      {d.hoje.venceAmanha.length ? `Amanhã vence: ${d.hoje.venceAmanha.map(c => `${c.descricao} ${brl(c.valor)}`).join(' · ')}`
                        : aPagar.length ? `${aPagar.length} ${aPagar.length === 1 ? 'conta' : 'contas'} nos próximos dias` : 'Nada a pagar nos próximos dias'}
                    </p>
                  </div>
                  <button className="btn sm" type="button" onClick={openConta}><Icon name="plus" />Conta</button>
                </div>
                <div className="list">
                  {d.proximasContas.map(c => (
                    <div key={c.id} className={'li' + (c.paga ? ' done' : '')}>
                      <div className="d"><span>{c.descricao}</span><small>{c.categoria}{c.recorrente ? ' · todo mês' : ''}</small></div>
                      <div className="r">
                        <ContaPill c={c} />
                        <span className={'amt ' + (c.paga ? 'muted' : '')}>−{plain(c.valor)}</span>
                        {c.paga ? <span style={{ width: 28 }} /> : (
                          <button type="button" className="icon-btn sm" title="Marcar como paga" aria-label={`Marcar ${c.descricao} como paga`} onClick={() => pagar(c)}>
                            <Icon name="check" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!d.proximasContas.length && <div className="empty">Nenhuma conta cadastrada. As contas fixas aparecem sozinhas quando o banco está conectado.</div>}
                </div>
                <div className="card-foot">
                  <span>Falta pagar <b className="num">{brl(aPagar.reduce((s, c) => s + c.valor, 0))}</b></span>
                  <button type="button" className="link-btn" onClick={() => go('projecao')}>Ver todas</button>
                </div>
              </div>

              <div className="card">
                <div className="sec-head">
                  <div>
                    <h2 className="sec-title">Últimas movimentações</h2>
                    {d.paraConferir > 0 && <p className="sec-sub">{d.paraConferir} {d.paraConferir === 1 ? 'movimentação' : 'movimentações'} para conferir</p>}
                  </div>
                  <button className="btn sm" type="button" onClick={() => go('extrato')}>Ver extrato</button>
                </div>
                <div className="list">
                  {d.ultimasMovimentacoes.length ? d.ultimasMovimentacoes.map(t => <TxRow key={t.id} t={t} showDate />)
                    : <div className="empty">Nenhuma movimentação ainda. Use o botão "Lançamento" para anotar dinheiro vivo.</div>}
                </div>
              </div>
            </div>
          </section>
        )
      })()}
    </ViewGate>
  )
}
