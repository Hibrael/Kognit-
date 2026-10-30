// Modo demonstração: cálculo da seção 6 para o back simulado no navegador (npm run demo).
// NÃO é usado com um back de verdade, onde todo cálculo é do servidor (docs/ARQUITETURA.md). Segue o protótipo.

import { addM, dateFor, daysIn, diffM, fromDate, monthOf, round2, toDate } from '../lib/format'

export type T = 'in' | 'out'

export interface MRec {
  id: string; type: T; name: string; note: string; amount: number; gross: number | null; isSalary: boolean; tithe: boolean
  formula: 'decimo' | 'tithe' | null; day: number; freq: 'mensal' | 'parcelas' | 'unica'; startMonth: string; endMonth: string | null
  parcels: number | null; category: string; matchKeywords: string[]; skipMonths: string[]; isSample: boolean; updatedAt: string
}

export interface MTx {
  id: string; date: string; type: T; amount: number; description: string; category: string
  recurringId: string | null; recurringMonth: string | null; isTransfer: boolean; isSample: boolean; source: string
  createdAt: string
}

export interface MSettings { openingBalance: number; openingDate: string; titheBase: 'liquido' | 'bruto' }

export interface Pend { rec: MRec; k: string; due: string; date: string; overdue: boolean; amount: number }

export const H = 6
const sum = (v: number[]) => round2(v.reduce((s, x) => s + x, 0))
const signed = (t: T, v: number) => (t === 'in' ? v : -v)
const lastDay = (k: string) => `${k}-${String(daysIn(k)).padStart(2, '0')}`
const addDays = (d: string, n: number) => { const x = toDate(d); x.setDate(x.getDate() + n); return fromDate(x) }

export function isActive(r: MRec, k: string) {
  const d = diffM(r.startMonth, k)
  if (d < 0 || (r.endMonth && k > r.endMonth)) return false
  if (r.freq === 'unica') return d === 0
  if (r.freq === 'parcelas') return d < (r.parcels ?? 1)
  return true
}

const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
export const monthYear = (k: string) => `${MES[Number(k.slice(5, 7)) - 1]}/${k.slice(2, 4)}`

export class Ledger {
  readonly cur: string
  readonly calc: MTx[]
  readonly prevs: Pend[]
  readonly balance: number
  readonly varAvg: number
  private readonly events: { date: string; v: number; prev: boolean }[]
  readonly s: MSettings
  readonly rec: MRec[]
  readonly tx: MTx[]
  readonly today: string

  constructor(s: MSettings, rec: MRec[], tx: MTx[], today: string, horizon?: string) {
    this.s = s
    this.rec = rec
    this.tx = tx
    this.today = today
    this.cur = monthOf(today)
    this.calc = tx.filter(t => !t.isTransfer)   // transferências ficam fora de tudo (6.4)
    const op = s.openingDate
    const first = monthOf(op) > addM(this.cur, -12) ? monthOf(op) : addM(this.cur, -12)
    const last = addM(this.cur, Math.max(H, horizon ? diffM(this.cur, horizon) : 0))
    const prevs: Pend[] = []
    for (let k = first; k <= last; k = addM(k, 1)) prevs.push(...this.pendings(k))
    this.prevs = prevs
    this.events = [
      ...this.calc.filter(t => t.date >= op).map(t => ({ date: t.date, v: signed(t.type, t.amount), prev: false })),
      ...prevs.map(p => ({ date: p.date, v: signed(p.rec.type, p.amount), prev: true })),
    ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    this.balance = this.through(today, false)
    const start = op > addDays(today, -89) ? op : addDays(today, -89)
    const days = Math.max(1, Math.round((toDate(today).getTime() - toDate(start).getTime()) / 864e5) + 1)
    const total = sum(this.calc.filter(t => t.type === 'out' && !t.recurringId && t.date >= start && t.date <= today).map(t => t.amount))
    this.varAvg = days < 7 ? 0 : round2(total / days * 30)
  }

  grossSum(k: string) { return sum(this.rec.filter(r => r.isSalary && isActive(r, k)).map(r => r.gross ?? 0)) }

  titheBase(k: string, salaryOnly = false) {
    let b = 0
    for (const r of this.rec) {
      if (r.type !== 'in' || !isActive(r, k)) continue
      if (r.isSalary) b += this.s.titheBase === 'bruto' ? r.gross ?? 0 : r.amount
      else if (r.tithe && !salaryOnly) b += this.recAmount(r, k)
    }
    return b
  }

  recAmount(r: MRec, k: string): number {
    if (r.formula === 'decimo') return round2(this.grossSum(k) * 0.5)
    if (r.formula === 'tithe') return round2(this.titheBase(k) * 0.1)
    return r.amount
  }

  linkOf(recId: string, k: string) { return this.tx.find(t => t.recurringId === recId && t.recurringMonth === k) }

  pendings(k: string): Pend[] {
    return this.rec.filter(r => isActive(r, k) && !this.linkOf(r.id, k) && !r.skipMonths.includes(k)).map(r => {
      const due = dateFor(k, r.day)
      const overdue = due < this.today
      return { rec: r, k, due, date: overdue ? this.today : due, overdue, amount: this.recAmount(r, k) }
    }).filter(p => p.amount > 0 && p.due >= this.s.openingDate)
  }

  prevsFor(k: string) { return k < this.cur ? [] : this.prevs.filter(p => p.k === k || (k === this.cur && p.k < this.cur)) }

  through(date: string, withPrev = true) {
    let b = this.s.openingBalance
    for (const e of this.events) { if (e.date > date) break; if (withPrev || !e.prev) b += e.v }
    return round2(b)
  }

  endOf(k: string) { return this.through(lastDay(k)) }

  flows(k: string, variable = false) {
    const tx = this.calc.filter(t => monthOf(t.date) === k)
    const pend = this.prevsFor(k)
    const t = this.today
    const f = {
      k, tx, pend,
      realIn: sum(tx.filter(x => x.type === 'in' && x.date <= t).map(x => x.amount)),
      realOut: sum(tx.filter(x => x.type === 'out' && x.date <= t).map(x => x.amount)),
      schedIn: sum(tx.filter(x => x.type === 'in' && x.date > t).map(x => x.amount)),
      schedOut: sum(tx.filter(x => x.type === 'out' && x.date > t).map(x => x.amount)),
      pIn: sum(pend.filter(p => p.rec.type === 'in').map(p => p.amount)),
      pOut: sum(pend.filter(p => p.rec.type === 'out').map(p => p.amount)),
      varOut: variable && k > this.cur ? this.varAvg : 0,
    }
    const inn = round2(f.realIn + f.schedIn + f.pIn), out = round2(f.realOut + f.schedOut + f.pOut + f.varOut)
    return { ...f, in: inn, out, net: round2(inn - out) }
  }

  projection(variable = false) {
    let cum = 0
    return Array.from({ length: H + 1 }, (_, i) => {
      const k = addM(this.cur, i)
      const f = this.flows(k, variable)
      cum = round2(cum + f.varOut)
      return { ...f, end: round2(this.endOf(k) - cum) }
    })
  }

  bills(k: string) {
    const cur = this.rec.filter(r => isActive(r, k) && this.recAmount(r, k) > 0).flatMap(r => {
      const tx = this.linkOf(r.id, k)
      const due = dateFor(k, r.day)
      if (!tx && (due < this.s.openingDate || r.skipMonths.includes(k))) return []
      return [{ rec: r, k, tx, due, amount: tx ? tx.amount : this.recAmount(r, k), overdue: !tx && due < this.today, today: !tx && due === this.today }]
    })
    const past = this.prevs.filter(p => p.k < k).map(p => ({ rec: p.rec, k: p.k, tx: undefined, due: p.due, amount: p.amount, overdue: true, today: false }))
    return [...past, ...cur].sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.rec.type === 'in' ? -1 : 1))
  }

  base() {
    const k = addM(this.cur, 1)
    const recs = this.rec.filter(r => isActive(r, k))
    const salary = sum(recs.filter(r => r.type === 'in' && r.isSalary).map(r => this.recAmount(r, k)))
    const fixed = sum(recs.filter(r => r.type === 'out' && r.freq !== 'unica')
      .map(r => (r.formula === 'tithe' ? round2(this.titheBase(k, true) * 0.1) : this.recAmount(r, k))))
    return { k, salary, fixed, net: round2(salary - fixed) }
  }

  vigencia(r: MRec) {
    if (r.freq === 'unica') return `só em ${monthYear(r.startMonth)}`
    if (r.freq === 'parcelas') {
      const n = r.parcels ?? 1, end = addM(r.startMonth, n - 1)
      if (end < this.cur) return `quitado em ${monthYear(end)}`
      const paid = isActive(r, this.cur) && (this.linkOf(r.id, this.cur) || r.skipMonths.includes(this.cur)) ? 1 : 0
      const rem = Math.min(n, diffM(this.cur, end) + 1) - paid
      if (rem <= 0) return `última parcela paga · ${monthYear(end)}`
      return `${rem} de ${n} ${rem === 1 ? 'parcela restante' : 'parcelas restantes'} · até ${monthYear(end)}`
    }
    const s = r.startMonth > this.cur ? `todo mês · desde ${monthYear(r.startMonth)}` : 'todo mês'
    return r.endMonth ? `${s} · até ${monthYear(r.endMonth)}` : s
  }

  displayAmount(r: MRec) {
    if (!r.formula) return r.amount
    return this.recAmount(r, isActive(r, this.cur) ? this.cur : r.formula === 'decimo' ? r.startMonth : addM(this.cur, 1))
  }

  ended(r: MRec) {
    return (r.freq === 'parcelas' && addM(r.startMonth, (r.parcels ?? 1) - 1) < this.cur) || (r.freq === 'unica' && r.startMonth < this.cur)
      || (!!r.endMonth && r.endMonth < this.cur)
  }

  linkOptions(type: T, date: string, editing?: string | null) {
    const m = monthOf(date)
    return [m, addM(m, -1), addM(m, 1)].flatMap(k => this.rec
      .filter(r => r.type === type && isActive(r, k) && !r.skipMonths.includes(k))
      .filter(r => { const t = this.linkOf(r.id, k); return !t || t.id === editing })
      .map(r => ({ r, k, expected: this.recAmount(r, k) })))
  }
}
