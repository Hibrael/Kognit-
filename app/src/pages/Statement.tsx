import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import {
  addM, brl, brlS, cap, dateFor, dayLabel, daysIn, mLabelY, mLong, mName, monthOf, norm, plain, round2, SEMANA, short, sum, toDate, todaySP,
} from '../lib/format'
import { useApp, useView } from '../lib/store'
import { entra, type Extrato, type Lancamento } from '../lib/types'
import { Icon } from '../ui/Icon'
import { TxRow, ViewGate } from '../ui/common'

type TypeFilter = 'all' | 'in' | 'out' | 'mim'
type Opt = { kind: 'text' } | { kind: 'all' } | { kind: 'cat'; cat: string; n: number; inn: number; out: number; share: number }

const TYPE_LABEL: Record<TypeFilter, string> = { all: 'Tudo', in: 'Entrou', out: 'Saiu', mim: 'Pra mim' }

const ofType = (t: Lancamento, type: TypeFilter) =>
  type === 'all' || (type === 'in' ? entra(t.tipo) : type === 'out' ? t.tipo === 'saida' : t.tipo === 'retirada')

/** Todas as movimentações do mês (a API pagina de 200 em 200). */
async function loadMonth(k: string): Promise<Extrato> {
  const page = (p: number) => api<Extrato>(`/api/extrato?filtro=tudo&de=${k}-01&ate=${dateFor(k, 31)}&tamanho=200&pagina=${p}`)
  const first = await page(1)
  const itens = [...first.movimentacoes.itens]
  for (let p = 2; itens.length < first.movimentacoes.total; p++) {
    const r = await page(p)
    if (!r.movimentacoes.itens.length) break
    itens.push(...r.movimentacoes.itens)
  }
  return { ...first, movimentacoes: { ...first.movimentacoes, itens } }
}

/** Extrato (4.4, RF-05 a RF-07) com as movimentações da API KOGNIT. Filtros e busca são locais. */
export function Statement() {
  const { extMonth: k, setExtMonth, extDay, setExtDay, openTx } = useApp()
  const v = useView<Extrato>(`extrato:${k}`, () => loadMonth(k))
  const [type, setType] = useState<TypeFilter>('all')
  const [cat, setCat] = useState('')
  const [query, setQuery] = useState('')
  const d = v.data   // ao trocar de mês, mantém a tela anterior até chegar a nova (16.1)
  const today = todaySP()
  const cur = monthOf(today)

  const all = d?.movimentacoes.itens ?? []
  const passes = (t: Lancamento) => {
    if (!ofType(t, type)) return false
    if (cat && t.categoria !== cat) return false
    const q = norm(query.trim())
    return !q || norm(t.descricao).includes(q) || norm(t.categoria).includes(q)
  }
  const shown = all.filter(passes)

  const go = (n: number) => { setExtMonth(addM(k, n)); setExtDay(null) }
  const toToday = () => { setExtMonth(cur); setExtDay(today) }

  return (
    <section aria-label="Extrato">
      <div className="ext-bar">
        <div className="month-nav">
          <button className="icon-btn sm" type="button" aria-label="Mês anterior" onClick={() => go(-1)}><Icon name="chevL" /></button>
          <strong>{cap(mLong(k))}</strong>
          <button className="icon-btn sm" type="button" aria-label="Próximo mês" disabled={k >= cur} onClick={() => go(1)}><Icon name="chevR" /></button>
        </div>
        <button className="btn sm ghost" type="button" onClick={toToday}>Hoje</button>
        <div className="seg" role="group" aria-label="Filtrar por tipo">
          {(['all', 'in', 'out', 'mim'] as const).map(t => (
            <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}>{TYPE_LABEL[t]}</button>
          ))}
        </div>
        <SearchBox month={k} items={all} type={type} cat={cat} setCat={setCat} query={query} setQuery={setQuery} />
      </div>

      <ViewGate loading={v.loading} error={v.error} hasData={!!d} reload={v.reload}>
        {d && (
          <div className="ext-grid">
            <div className="card cal-wrap">
              <Calendar k={k} shown={shown} today={today} sel={extDay} onPick={ds => setExtDay(extDay === ds ? null : ds)} />
              <div className="cal-note"><span>Toque num dia para filtrar</span><span>verde = entrou · cinza = saiu</span></div>
            </div>
            <div className="card">
              <Summary shown={shown} />
              {extDay && monthOf(extDay) === k && (
                <div className="filter-note">
                  <span>Mostrando só {dayLabel(extDay).toLowerCase()}</span>
                  <button type="button" className="link-btn" onClick={() => setExtDay(null)}>Ver o mês todo</button>
                </div>
              )}
              <Days k={k} today={today} all={all} shown={extDay && monthOf(extDay) === k ? shown.filter(t => t.data === extDay) : shown}
                onAdd={() => openTx({ date: k === cur ? today : `${k}-01` })} />
            </div>
          </div>
        )}
      </ViewGate>
    </section>
  )
}

/** Totais do que está na tela. Lucro = entradas − saídas (retiradas e dinheiro do dono ficam fora, como na API). */
function Summary({ shown }: { shown: Lancamento[] }) {
  const total = (tipo: Lancamento['tipo']) => sum(shown.filter(t => t.tipo === tipo), t => t.valor)
  const inn = sum(shown.filter(t => entra(t.tipo)), t => t.valor)
  return (
    <div className="sum-line">
      <span>Entrou <b className="num in">{brl(inn)}</b></span>
      <span>Saiu <b className="num">{brl(total('saida'))}</b></span>
      <span>Pra mim <b className="num">{brl(total('retirada'))}</b></span>
      <span>Lucro <b className="num">{brlS(total('entrada') - total('saida'))}</b></span>
    </div>
  )
}

function Days({ k, today, all, shown, onAdd }: { k: string; today: string; all: Lancamento[]; shown: Lancamento[]; onAdd: () => void }) {
  if (!shown.length) {
    return (
      <div className="empty">
        {all.length ? 'Nada encontrado com estes filtros' : `Nenhuma movimentação em ${mName(k)}`}
        {!all.length && <div style={{ marginTop: 10 }}><button type="button" className="btn sm" onClick={onAdd}>Adicionar lançamento</button></div>}
      </div>
    )
  }
  // a API já entrega do mais recente para o mais antigo; aqui só agrupa por dia
  const groups: [string, Lancamento[]][] = []
  for (const t of shown) {
    const last = groups[groups.length - 1]
    if (last && last[0] === t.data) last[1].push(t)
    else groups.push([t.data, [t]])
  }
  return (
    <div>
      {groups.map(([day, items]) => {
        const di = sum(items.filter(t => entra(t.tipo)), t => t.valor)
        const dout = sum(items.filter(t => !entra(t.tipo)), t => t.valor)
        return (
          <div key={day}>
            <div className="day-h">
              <span><b>{dayLabel(day)}</b>{day === today ? ' · hoje' : ''}</span>
              <span className="tot">
                {di ? <span style={{ color: 'var(--accent-text)' }}>{brlS(di)}</span> : null}
                {dout ? <span>{brlS(-dout)}</span> : null}
              </span>
            </div>
            {items.map(t => <TxRow key={t.id} t={t} />)}
          </div>
        )
      })}
    </div>
  )
}

function Calendar({ k, shown, today, sel, onPick }: { k: string; shown: Lancamento[]; today: string; sel: string | null; onPick: (d: string) => void }) {
  const first = toDate(`${k}-01`).getDay()
  const N = daysIn(k)
  return (
    <div className="cal">
      {SEMANA.map((s, i) => <div key={i} className="cal-h" aria-hidden="true">{s}</div>)}
      {Array.from({ length: first }, (_, i) => <div key={'o' + i} className="cal-d other" aria-hidden="true" />)}
      {Array.from({ length: N }, (_, i) => {
        const day = i + 1
        const ds = dateFor(k, day)
        const its = shown.filter(x => x.data === ds)
        const rIn = sum(its.filter(x => entra(x.tipo)), x => x.valor)
        const rOut = sum(its.filter(x => !entra(x.tipo)), x => x.valor)
        const label = [`${day} de ${mName(k)}`, rIn ? `entrou ${brl(rIn)}` : '', rOut ? `saiu ${brl(rOut)}` : ''].filter(Boolean).join(', ')
        return (
          <button key={ds} type="button" className={'cal-d' + (ds === today ? ' today' : '') + (sel === ds ? ' sel' : '')}
            aria-label={label} aria-pressed={sel === ds} onClick={() => onPick(ds)}>
            <span className="n">{day}</span>
            {rIn ? <span className="ci">+{short(rIn)}</span> : null}
            {rOut ? <span className="co">−{short(rOut)}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

/** Caixa de pesquisa com categorias (RF-07). */
function SearchBox({ month, items, type, cat, setCat, query, setQuery }: {
  month: string; items: Lancamento[]; type: TypeFilter
  cat: string; setCat: (c: string) => void; query: string; setQuery: (q: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const input = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  const opts = useMemo<Opt[]>(() => {
    const q = norm(query.trim())
    const by = new Map<string, { cat: string; n: number; inn: number; out: number }>()
    for (const t of items) {
      if (!ofType(t, type)) continue
      const c = by.get(t.categoria) ?? { cat: t.categoria, n: 0, inn: 0, out: 0 }
      c.n++
      if (entra(t.tipo)) c.inn += t.valor; else c.out += t.valor
      by.set(t.categoria, c)
    }
    let cats = [...by.values()]
    if (q) cats = cats.filter(c => norm(c.cat).includes(q))
    cats.sort((a, b) => (b.inn + b.out) - (a.inn + a.out) || a.cat.localeCompare(b.cat, 'pt-BR'))
    const max = Math.max(1, ...cats.map(c => c.inn + c.out))
    const out: Opt[] = []
    if (q) out.push({ kind: 'text' })
    if (cat) out.push({ kind: 'all' })
    for (const c of cats) out.push({ kind: 'cat', ...c, share: (c.inn + c.out) / max })
    return out
  }, [items, type, query, cat])

  useEffect(() => { if (active >= opts.length) setActive(opts.length - 1) }, [opts, active])
  useEffect(() => { panel.current?.querySelector(`#sp${active}`)?.scrollIntoView({ block: 'nearest' }) }, [active])

  const pick = (o: Opt) => {
    if (o.kind === 'cat') { setCat(o.cat); setQuery('') }
    else if (o.kind === 'all') setCat('')
    setActive(-1)
    input.current?.blur()
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!opts.length) return
      setActive(e.key === 'ArrowDown' ? (active + 1) % opts.length : active <= 0 ? opts.length - 1 : active - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (active >= 0 && opts[active]) pick(opts[active]); else input.current?.blur()
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); input.current?.blur() }
    } else if (e.key === 'Backspace' && !query && cat) setCat('')
  }

  let headerShown = false
  return (
    <div className="sbox" onClick={e => { if (!(e.target as HTMLElement).closest('button')) input.current?.focus() }}>
      <Icon name="search" />
      {cat && (
        <span className="cat-chip">
          <span>{cat}</span>
          <button type="button" aria-label={`Remover filtro ${cat}`} title="Remover filtro" onClick={() => setCat('')}><Icon name="x" /></button>
        </span>
      )}
      <input ref={input} type="search" placeholder="Buscar ou filtrar por categoria" aria-label="Buscar movimentações ou filtrar por categoria"
        role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls="sboxPanel" autoComplete="off"
        aria-activedescendant={open && active >= 0 ? `sp${active}` : undefined}
        value={query} onChange={e => { setQuery(e.target.value); setActive(-1) }}
        onFocus={() => { setActive(-1); setOpen(true) }} onBlur={() => setOpen(false)} onKeyDown={onKey} />
      {open && (
        <div className="sbox-panel" id="sboxPanel" role="listbox" aria-label="Categorias" ref={panel}>
          {opts.map((o, idx) => {
            const head = o.kind === 'cat' && !headerShown
            if (head) headerShown = true
            const net = o.kind === 'cat' ? round2(o.inn - o.out) : 0
            return (
              <div key={o.kind === 'cat' ? o.cat : o.kind}>
                {head && <div className="sp-h">Categorias · {mLabelY(month)}</div>}
                <button type="button" className="sp-opt" role="option" id={`sp${idx}`} aria-selected={idx === active} tabIndex={-1}
                  onMouseDown={e => e.preventDefault()} onClick={() => pick(o)}>
                  {o.kind === 'text' ? <><span>Buscar “{query.trim()}” nas descrições</span><span /><small>Enter</small></>
                    : o.kind === 'all' ? <><span>Todas as categorias</span><span /><small>limpar filtro</small></>
                    : <>
                      <span>{o.cat}<div className="sp-bar" aria-hidden="true"><i style={{ width: `${o.share * 100}%` }} /></div></span>
                      <small>{`${o.n} ${o.n === 1 ? 'movimentação' : 'movimentações'}`}</small>
                      <span className={'amt num' + (net > 0 ? ' in' : '')}>{(net > 0 ? '+' : net < 0 ? '−' : '') + plain(Math.abs(net))}</span>
                    </>}
                </button>
              </div>
            )
          })}
          {!opts.length && <div className="sp-h">Nenhuma categoria encontrada</div>}
        </div>
      )}
    </div>
  )
}
