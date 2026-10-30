import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import {
  addM, brl, brlS, cap, dShort, dateFor, dayLabel, daysIn, mLabelY, mLong, mName, monthOf, norm, plain, round2, SEMANA, short, sum, toDate,
} from '../lib/format'
import { useApp, usePref, useView } from '../lib/store'
import type { MutationResult, Pending, Statement as StatementData, StatementItem } from '../lib/types'
import { Icon } from '../ui/Icon'
import { Switch, TxRow, ViewGate } from '../ui/common'

type TypeFilter = 'all' | 'in' | 'out'
type Opt = { kind: 'text' } | { kind: 'all' } | { kind: 'cat'; cat: string; n: number; inn: number; out: number; share: number }

const signed = (i: { type: string; amount: number }) => (i.type === 'in' ? i.amount : -i.amount)

/** Extrato (4.4, RF-04 a RF-07). Os saldos vêm da API e nunca são filtrados; o resto é filtro local. */
export function Statement() {
  const { extMonth: k, setExtMonth, extDay, setExtDay, openTx } = useApp()
  const v = useView<StatementData>(`/api/statement?month=${k}`)
  const [type, setType] = useState<TypeFilter>('all')
  const [cat, setCat] = useState('')
  const [query, setQuery] = useState('')
  const [showPrev, setShowPrev] = usePref('showPrev', true)
  const d = v.data   // ao trocar de mês, mantém a tela anterior até chegar a nova (16.1)

  const all = useMemo(() => (d?.items ?? []).filter(i => showPrev || i.kind !== 'prev'), [d, showPrev])
  const passes = (i: StatementItem) => {
    if (type !== 'all' && i.type !== type) return false
    if (cat && i.category !== cat) return false
    const q = norm(query.trim())
    return !q || norm(i.description).includes(q) || norm(i.category).includes(q)
  }
  const shown = all.filter(passes)
  const cur = d?.cur ?? k
  const today = d?.today ?? ''

  const go = (n: number) => { setExtMonth(addM(k, n)); setExtDay(null) }
  const toToday = () => { setExtMonth(cur); setExtDay(today) }

  return (
    <section aria-label="Extrato">
      <div className="ext-bar">
        <div className="month-nav">
          <button className="icon-btn sm" type="button" aria-label="Mês anterior" onClick={() => go(-1)}><Icon name="chevL" /></button>
          <strong>{cap(mLong(k))}</strong>
          <button className="icon-btn sm" type="button" aria-label="Próximo mês" onClick={() => go(1)}><Icon name="chevR" /></button>
        </div>
        <button className="btn sm ghost" type="button" onClick={toToday}>Hoje</button>
        <div className="seg" role="group" aria-label="Filtrar por tipo">
          {(['all', 'in', 'out'] as const).map(t => (
            <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}>{t === 'all' ? 'Tudo' : t === 'in' ? 'Entradas' : 'Saídas'}</button>
          ))}
        </div>
        <SearchBox month={k} items={all} type={type} known={d?.knownCategories ?? []} cat={cat} setCat={setCat} query={query} setQuery={setQuery} />
        <label className="switch-inline"><Switch checked={showPrev} onChange={setShowPrev} label="Mostrar previstos" />Previstos</label>
      </div>

      <ViewGate loading={v.loading} error={v.error} hasData={!!d} reload={v.reload}>
        {d && (
          <div className="ext-grid">
            <div className="card cal-wrap">
              <Calendar k={k} shown={shown} today={today} sel={extDay} onPick={ds => setExtDay(extDay === ds ? null : ds)} />
              <div className="cal-note"><span>Toque num dia para filtrar</span><span>verde = entrou · cinza = saiu · <i>itálico</i> = previsto</span></div>
            </div>
            <div className="card">
              <Summary k={k} cur={cur} today={today} shown={shown} end={d.endBalance} />
              {extDay && monthOf(extDay) === k && (
                <div className="filter-note">
                  <span>Mostrando só {dayLabel(extDay).toLowerCase()}</span>
                  <button type="button" className="link-btn" onClick={() => setExtDay(null)}>Ver o mês todo</button>
                </div>
              )}
              <Days d={d} k={k} all={all} shown={extDay && monthOf(extDay) === k ? shown.filter(i => i.date === extDay) : shown}
                onAdd={() => openTx({ kind: 'new', date: k === cur ? today : `${k}-01` })} />
            </div>
          </div>
        )}
      </ViewGate>
    </section>
  )
}

function Summary({ k, cur, today, shown, end }: { k: string; cur: string; today: string; shown: StatementItem[]; end: number }) {
  const real = shown.filter(i => i.kind === 'tx' && i.date <= today && !i.tx?.isTransfer)
  const inn = sum(real.filter(i => i.type === 'in'), i => i.amount)
  const out = sum(real.filter(i => i.type === 'out'), i => i.amount)
  const pv = shown.filter(i => (i.kind === 'prev' || i.date > today) && !i.tx?.isTransfer)
  return (
    <div className="sum-line">
      <span>Entradas <b className="num in">{brl(inn)}</b></span>
      <span>Saídas <b className="num">{brl(out)}</b></span>
      <span>Resultado <b className="num">{brlS(inn - out)}</b></span>
      {pv.length > 0 && <span>Previstos e agendados <b className="num">{brlS(sum(pv, signed))}</b></span>}
      <span>{k >= cur ? 'Saldo previsto no fim ' : 'Saldo no fim '}<b className="num">{brl(end)}</b></span>
    </div>
  )
}

function Days({ d, k, all, shown, onAdd }: { d: StatementData; k: string; all: StatementItem[]; shown: StatementItem[]; onAdd: () => void }) {
  if (!shown.length) {
    return (
      <div className="empty">
        {all.length ? 'Nada encontrado com estes filtros' : `Nenhum lançamento em ${mName(k)}`}
        {!all.length && <div style={{ marginTop: 10 }}><button type="button" className="btn sm" onClick={onAdd}>Adicionar lançamento</button></div>}
      </div>
    )
  }
  // a API já entrega na ordem da RF-04; aqui só agrupa
  const groups: [string, StatementItem[]][] = []
  for (const it of shown) {
    const last = groups[groups.length - 1]
    if (last && last[0] === it.date) last[1].push(it)
    else groups.push([it.date, [it]])
  }
  return (
    <div>
      {groups.map(([day, items]) => {
        const real = items.filter(i => !i.tx?.isTransfer)
        const di = sum(real.filter(i => i.type === 'in'), i => i.amount)
        const dout = sum(real.filter(i => i.type === 'out'), i => i.amount)
        const fut = day > d.today || items.some(i => i.kind === 'prev')
        const before = day < d.openingDate
        return (
          <div key={day}>
            <div className="day-h">
              <span><b>{dayLabel(day)}</b>{day === d.today ? ' · hoje' : ''}</span>
              <span className="tot">
                {di ? <span style={{ color: 'var(--accent-text)' }}>{brlS(di)}</span> : null}
                {dout ? <span>{brlS(-dout)}</span> : null}
                {!before && <span>{fut ? 'saldo previsto' : 'saldo'} {brl(d.dayBalances[day] ?? 0)}</span>}
              </span>
            </div>
            {items.map(it => it.kind === 'tx' ? <TxRow key={it.tx!.id} t={it.tx!} today={d.today} /> : <PrevRow key={it.prev!.recurringId + it.prev!.k} p={it.prev!} />)}
          </div>
        )
      })}
    </div>
  )
}

function PrevRow({ p }: { p: Pending }) {
  const { openTx, mutate } = useApp()
  const isIn = p.type === 'in'
  return (
    <div className="li hov done">
      <div className="d"><span>{p.name}</span><small>{p.category} · {p.overdue ? `venceu ${dShort(p.due)}` : 'previsto'}</small></div>
      <div className="r">
        {p.overdue ? <span className="pill late">Atrasada</span> : <span className="pill">Previsto</span>}
        <span className="amt muted">{(isIn ? '+' : '−') + plain(p.amount)}</span>
        <button type="button" className="icon-btn sm" title={`Ignorar em ${mLabelY(p.k)}`} aria-label={`Ignorar ${p.name} em ${mLabelY(p.k)}`}
          onClick={() => mutate(() => api<MutationResult>(`/api/recurring/${p.recurringId}/skip`, { method: 'POST', json: { month: p.k } }))}><Icon name="x" /></button>
        <button type="button" className="btn sm" onClick={() => openTx({ kind: 'confirm', recurringId: p.recurringId, k: p.k, name: p.name, type: p.type, category: p.category, amount: p.amount })}>Confirmar</button>
      </div>
    </div>
  )
}

function Calendar({ k, shown, today, sel, onPick }: { k: string; shown: StatementItem[]; today: string; sel: string | null; onPick: (d: string) => void }) {
  const first = toDate(`${k}-01`).getDay()
  const N = daysIn(k)
  // só o que já aconteceu conta como "entrou/saiu"; agendados e previstos aparecem em itálico
  const done = (i: StatementItem) => i.kind === 'tx' && i.date <= today
  return (
    <div className="cal">
      {SEMANA.map((s, i) => <div key={i} className="cal-h" aria-hidden="true">{s}</div>)}
      {Array.from({ length: first }, (_, i) => <div key={'o' + i} className="cal-d other" aria-hidden="true" />)}
      {Array.from({ length: N }, (_, i) => {
        const day = i + 1
        const ds = dateFor(k, day)
        const its = shown.filter(x => x.date === ds && !x.tx?.isTransfer)
        const rIn = sum(its.filter(x => done(x) && x.type === 'in'), x => x.amount)
        const rOut = sum(its.filter(x => done(x) && x.type === 'out'), x => x.amount)
        const pIn = sum(its.filter(x => !done(x) && x.type === 'in'), x => x.amount)
        const pOut = sum(its.filter(x => !done(x) && x.type === 'out'), x => x.amount)
        const label = [`${day} de ${mName(k)}`, rIn ? `entrou ${brl(rIn)}` : '', rOut ? `saiu ${brl(rOut)}` : '', pIn || pOut ? `previsto ${brlS(pIn - pOut)}` : ''].filter(Boolean).join(', ')
        return (
          <button key={ds} type="button" className={'cal-d' + (ds === today ? ' today' : '') + (sel === ds ? ' sel' : '')}
            aria-label={label} aria-pressed={sel === ds} onClick={() => onPick(ds)}>
            <span className="n">{day}</span>
            {rIn ? <span className="ci">+{short(rIn)}</span> : null}
            {rOut ? <span className="co">−{short(rOut)}</span> : null}
            {pIn ? <span className="ci pv">+{short(pIn)}</span> : null}
            {pOut ? <span className="co pv">−{short(pOut)}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

/** Caixa de pesquisa com categorias (RF-07). */
function SearchBox({ month, items, type, known, cat, setCat, query, setQuery }: {
  month: string; items: StatementItem[]; type: TypeFilter; known: string[]
  cat: string; setCat: (c: string) => void; query: string; setQuery: (q: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const input = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  const opts = useMemo<Opt[]>(() => {
    const q = norm(query.trim())
    const by = new Map<string, { cat: string; n: number; inn: number; out: number }>()
    for (const i of items) {
      if (type !== 'all' && i.type !== type) continue
      const c = by.get(i.category) ?? { cat: i.category, n: 0, inn: 0, out: 0 }
      c.n++
      if (i.type === 'in') c.inn += i.amount; else c.out += i.amount
      by.set(i.category, c)
    }
    let cats = [...by.values()]
    if (q) {
      for (const c of known) if (!by.has(c)) cats.push({ cat: c, n: 0, inn: 0, out: 0 })
      cats = cats.filter(c => norm(c.cat).includes(q))
    }
    cats.sort((a, b) => (b.inn + b.out) - (a.inn + a.out) || a.cat.localeCompare(b.cat, 'pt-BR'))
    const max = Math.max(1, ...cats.map(c => c.inn + c.out))
    const out: Opt[] = []
    if (q) out.push({ kind: 'text' })
    if (cat) out.push({ kind: 'all' })
    for (const c of cats) out.push({ kind: 'cat', ...c, share: (c.inn + c.out) / max })
    return out
  }, [items, type, known, query, cat])

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
      <input ref={input} type="search" placeholder="Buscar ou filtrar por categoria" aria-label="Buscar lançamentos ou filtrar por categoria"
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
                      <small>{o.n ? `${o.n} ${o.n === 1 ? 'lançamento' : 'lançamentos'}` : 'nenhum no mês'}</small>
                      <span className={'amt num' + (net > 0 ? ' in' : '')}>{o.n ? (net > 0 ? '+' : net < 0 ? '−' : '') + plain(Math.abs(net)) : ''}</span>
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
