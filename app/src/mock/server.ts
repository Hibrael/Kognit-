// Modo demonstração (npm run demo): responde as rotas do contrato (contracts/openapi.yaml) dentro do navegador,
// para ver e usar o front sem nenhum back. Os dados ficam no localStorage deste navegador e começam com o
// exemplo da seção 7.1. Integrações (Pluggy, Mercado Pago, captura, CSV) respondem "indisponível".

import { addM, CATS_IN, CATS_OUT, daysIn, monthOf, norm, round2, todaySP } from '../lib/format'
import { isActive, Ledger, monthYear, type MRec, type MSettings, type MTx, type T } from './ledger'

interface State {
  name: string; settings: MSettings; captureMode: 'inbox' | 'parse'
  rec: MRec[]; tx: MTx[]; rules: { id: string; matchType: string; matchValue: string; category: string; priority: number }[]
}

const KEY = 'minhascontas:demo'
const uid = () => crypto.randomUUID()
const stamp = () => new Date().toISOString()
const clone = <X,>(x: X): X => JSON.parse(JSON.stringify(x))

function seed(): State {
  const R = (o: Partial<MRec> & Pick<MRec, 'id' | 'type' | 'name' | 'day' | 'category'>): MRec => ({
    note: '', amount: 0, gross: null, isSalary: false, tithe: false, formula: null, freq: 'mensal', startMonth: '2026-10',
    endMonth: null, parcels: null, matchKeywords: [], skipMonths: [], isSample: true, updatedAt: stamp(), ...o,
  })
  const rec = [
    R({ id: 'sal-hibrael', type: 'in', name: 'Salário Hibrael', amount: 2408.83, gross: 2369.98, isSalary: true, day: 5, category: 'Salário' }),
    R({ id: 'sal-raiane', type: 'in', name: 'Salário Raiane', amount: 930.55, gross: 1006, isSalary: true, day: 5, category: 'Salário' }),
    R({ id: 'decimo-1', type: 'in', name: '13º salário · 1ª parcela', formula: 'decimo', tithe: true, freq: 'unica', startMonth: '2026-11', day: 30, category: 'Salário' }),
    R({ id: 'devolucao', type: 'out', name: 'Devolução 10%', formula: 'tithe', day: 6, category: 'Devolução' }),
    R({ id: 'mercado-pago', type: 'out', name: 'Mercado Pago', note: 'Aporte · custo de vida', amount: 950, day: 8, category: 'Mercado' }),
    R({ id: 'carro', type: 'out', name: 'Carro', amount: 1092, day: 10, category: 'Transporte' }),
    R({ id: 'luz', type: 'out', name: 'Luz', amount: 150, day: 15, category: 'Contas da casa', matchKeywords: ['enel'] }),
    R({ id: 'agua', type: 'out', name: 'Água', amount: 100, day: 15, category: 'Contas da casa' }),
    R({ id: 'caixa', type: 'out', name: 'Caixa', note: 'Parcelamento sem juros', amount: 251.12, day: 20, category: 'Parcelas', freq: 'parcelas', parcels: 6 }),
    R({ id: 'santander', type: 'out', name: 'Santander', note: 'Parcelamento', amount: 105, day: 20, category: 'Parcelas', freq: 'parcelas', parcels: 2 }),
    R({ id: 'ipva', type: 'out', name: 'IPVA do carro', note: 'Estimativa', amount: 600, day: 20, category: 'Transporte', freq: 'unica', startMonth: '2027-01' }),
  ]
  let n = 0
  const Tx = (date: string, type: T, description: string, amount: number, category: string, recurringId?: string): MTx => ({
    id: uid(), date, type, description, amount, category, recurringId: recurringId ?? null,
    recurringMonth: recurringId ? monthOf(date) : null, isTransfer: false, isSample: true, source: 'manual',
    createdAt: new Date(Date.UTC(2026, 9, 1, 12, ++n)).toISOString(),
  })
  const tx = [
    Tx('2026-10-05', 'in', 'Salário Hibrael', 2408.83, 'Salário', 'sal-hibrael'),
    Tx('2026-10-05', 'in', 'Salário Raiane', 930.55, 'Salário', 'sal-raiane'),
    Tx('2026-10-06', 'out', 'Devolução 10%', 333.94, 'Devolução', 'devolucao'),
    Tx('2026-10-08', 'out', 'Mercado Pago', 950, 'Mercado', 'mercado-pago'),
    Tx('2026-10-10', 'out', 'Carro', 1092, 'Transporte', 'carro'),
    Tx('2026-10-12', 'out', 'Farmácia', 42.9, 'Saúde'),
    Tx('2026-10-15', 'out', 'Luz', 148.37, 'Contas da casa', 'luz'),
    Tx('2026-10-15', 'out', 'Água', 96.2, 'Contas da casa', 'agua'),
    Tx('2026-10-18', 'out', 'Padaria', 23.5, 'Alimentação'),
    Tx('2026-10-20', 'out', 'Caixa · parcela', 251.12, 'Parcelas', 'caixa'),
    Tx('2026-10-20', 'out', 'Santander · parcela', 105, 'Parcelas', 'santander'),
    Tx('2026-10-25', 'in', 'Pix recebido · venda', 80, 'Renda extra'),
  ]
  return { name: 'Casa (demonstração)', settings: { openingBalance: 420, openingDate: '2026-10-01', titheBase: 'liquido' }, captureMode: 'inbox', rec, tx, rules: [] }
}

let state: State = (() => {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as State } catch { /* sem armazenamento */ }
  return seed()
})()
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* sem armazenamento */ } }

// desfazer: cada escrita guarda uma cópia do estado anterior; o token só aponta para ela
const snapshots = new Map<string, State>()
function mutation(message: string, change: () => void, id?: string) {
  const before = clone(state)
  change()
  save()
  const key = uid()
  snapshots.set(key, before)
  return { message, undo: { demo: key }, ...(id ? { id } : {}) }
}

class Fail extends Error {
  readonly status: number
  readonly field?: string
  constructor(status: number, msg: string, field?: string) { super(msg); this.status = status; this.field = field }
}
const bad = (msg: string, field?: string) => new Fail(400, msg, field)
const unavailable = () => new Fail(400, 'Indisponível no modo demonstração')

const brl = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d),)/g, '.')
const ledger = (today: string, horizon?: string) => new Ledger(state.settings, state.rec, state.tx, today, horizon)
const recName = (id: string | null) => state.rec.find(r => r.id === id)?.name ?? null

function txDto(t: MTx) {
  const { isTransfer, isSample, source, createdAt, ...rest } = t
  return { ...rest, recurringName: recName(t.recurringId), isTransfer, isSample, source, createdAt, beforeOpening: t.date < state.settings.openingDate }
}

function recDto(r: MRec, l: Ledger) {
  return { ...r, vigencia: l.vigencia(r), displayAmount: l.displayAmount(r), ended: l.ended(r) }
}

// ---------- telas ----------

function overview(today: string) {
  const l = ledger(today)
  const f = l.flows(l.cur)
  const next = l.flows(addM(l.cur, 1))
  return {
    today, cur: l.cur, balance: l.balance, endOfMonth: l.endOf(l.cur), monthIn: f.realIn, monthOut: f.realOut,
    nIn: f.tx.filter(t => t.type === 'in' && t.date <= today).length, nOut: f.tx.filter(t => t.type === 'out' && t.date <= today).length,
    toReceive: round2(f.pIn + f.schedIn), toPay: round2(f.pOut + f.schedOut), nextMonth: next.k, nextNet: next.net,
    bills: l.bills(l.cur).map(b => ({
      recurringId: b.rec.id, name: b.rec.name, type: b.rec.type, category: b.rec.category, k: b.k, due: b.due, amount: b.amount,
      overdue: b.overdue, dueToday: b.today, txId: b.tx?.id ?? null, txDate: b.tx?.date ?? null,
    })),
    pOut: f.pOut, pIn: f.pIn,
    recent: state.tx.filter(t => t.date <= today).sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date))).slice(0, 6).map(txDto),
    hasRecurring: state.rec.length > 0, hasSalary: state.rec.some(r => r.isSalary),
  }
}

function statement(today: string, k: string) {
  if (!/^\d{4}-\d{2}$/.test(k)) throw bad('mês inválido', 'month')
  const l = ledger(today, k)
  const items = [
    ...state.tx.filter(t => monthOf(t.date) === k).map(t => ({ kind: 'tx' as const, date: t.date, type: t.type, amount: t.amount, description: t.description, category: t.category, tx: txDto(t), prev: null, c: t.createdAt })),
    ...l.prevsFor(k).map(p => ({
      kind: 'prev' as const, date: p.date, type: p.rec.type, amount: p.amount, description: p.rec.name, category: p.rec.category, tx: null, c: '',
      prev: { recurringId: p.rec.id, k: p.k, name: p.rec.name, category: p.rec.category, type: p.rec.type, amount: p.amount, due: p.due, date: p.date, overdue: p.overdue },
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || (a.kind === b.kind ? 0 : a.kind === 'tx' ? -1 : 1)
    || (a.type === b.type ? 0 : a.type === 'in' ? -1 : 1) || b.c.localeCompare(a.c))
  const dayBalances: Record<string, number> = {}
  for (let d = 1; d <= daysIn(k); d++) { const ds = `${k}-${String(d).padStart(2, '0')}`; dayBalances[ds] = l.through(ds) }
  const known = [...new Set([...CATS_IN, ...CATS_OUT, ...state.tx.map(t => t.category), ...state.rec.map(r => r.category)])]
  return { month: k, today, cur: l.cur, openingDate: state.settings.openingDate, items: items.map(({ c: _c, ...i }) => i), dayBalances, endBalance: l.endOf(k), knownCategories: known }
}

function projection(today: string, variable: boolean) {
  const l = ledger(today)
  const include = variable && l.varAvg > 0
  const dShort = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
  const rows = l.projection(include).map(r => ({
    k: r.k, in: r.in, out: r.out, net: r.net, end: r.end, varOut: r.varOut,
    lines: [
      ...r.tx.map(t => ({ type: t.type, name: t.description || '(sem descrição)', amount: t.amount, note: `${t.date > today ? 'agendado' : 'realizado'} ${dShort(t.date)}` })),
      ...r.pend.map(p => ({ type: p.rec.type, name: p.rec.name, amount: p.amount, note: p.overdue ? 'atrasada' : `previsto dia ${Number(p.due.slice(8))}` })),
      ...(r.varOut ? [{ type: 'out' as T, name: 'Gastos variáveis (média)', amount: r.varOut, note: 'estimativa' }] : []),
    ].sort((a, b) => b.amount - a.amount),
  }))
  return { today, cur: l.cur, balance: l.balance, varAvg: l.varAvg, includeVariable: include, rows, base: l.base(), recurring: state.rec.map(r => recDto(r, l)), titheBase: state.settings.titheBase }
}

function settingsView(today: string) {
  const l = ledger(today)
  const hasReal = state.tx.some(t => !t.isSample) || state.rec.some(r => !r.isSample)
  return {
    name: state.name, ...state.settings, netTotal: round2(state.rec.filter(r => r.isSalary && isActive(r, l.cur)).reduce((s, r) => s + r.amount, 0)),
    grossTotal: l.grossSum(l.cur), hasSampleTx: state.tx.some(t => t.isSample), canRestoreSample: !hasReal, captureMode: state.captureMode, mpSwapCreditDebit: false,
  }
}

// ---------- escrita ----------

type Body = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v))

function applyTx(b: Body, t: MTx) {
  const type = b.type as T
  if (type !== 'in' && type !== 'out') throw bad('Tipo inválido', 'type')
  const amount = round2(num(b.amount))
  if (!(amount > 0)) throw bad('Informe um valor maior que zero', 'amount')
  const date = str(b.date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad('Data inválida', 'date')
  const recId = (b.recurringId as string | null) || null
  const rec = recId ? state.rec.find(r => r.id === recId) : undefined
  if (recId && !rec) throw bad('Conta fixa não encontrada', 'link')
  const k = recId ? str(b.recurringMonth).slice(0, 7) : null
  if (rec && k && state.tx.some(x => x.id !== t.id && x.recurringId === rec.id && x.recurringMonth === k))
    throw new Fail(409, 'Esta conta já foi confirmada por outra pessoa', 'link')
  Object.assign(t, {
    type, amount, date, description: (str(b.description).trim() || rec?.name || '').slice(0, 60),
    category: str(b.category).trim() || (type === 'in' ? 'Renda extra' : 'Outros'), recurringId: rec ? rec.id : null, recurringMonth: rec ? k : null, isSample: false,
  })
}

function applyRec(b: Body, r: MRec) {
  const type = b.type as T
  const name = str(b.name).trim()
  if (!name || name.length > 60) throw bad('Informe um nome de 1 a 60 caracteres', 'name')
  const formula = b.formula === 'decimo' || b.formula === 'tithe' ? b.formula : null
  if (formula === 'decimo' && type !== 'in') throw bad('O 13º só pode ser uma entrada', 'formula')
  if (formula === 'tithe' && type !== 'out') throw bad('A devolução só pode ser uma saída', 'formula')
  const amount = round2(num(b.amount ?? 0) || 0)
  if (!formula && !(amount > 0)) throw bad('Informe um valor maior que zero', 'amount')
  const day = num(b.day)
  if (!(day >= 1 && day <= 31)) throw bad('Dia entre 1 e 31', 'day')
  const freq = b.freq as MRec['freq']
  if (freq === 'parcelas' && !(num(b.parcels) >= 1)) throw bad('Informe o número de parcelas', 'parcels')
  const salary = type === 'in' && !formula && !!b.isSalary
  Object.assign(r, {
    type, name, formula, amount: formula ? 0 : amount, isSalary: salary,
    gross: salary ? (num(b.gross) > 0 ? round2(num(b.gross)) : amount) : null, tithe: type === 'in' && !salary && !!b.tithe,
    day, freq, startMonth: str(b.startMonth).slice(0, 7), parcels: freq === 'parcelas' ? num(b.parcels) : null,
    category: str(b.category).trim() || 'Outros', matchKeywords: (b.matchKeywords as string[] | undefined)?.map(norm) ?? r.matchKeywords,
    isSample: false, updatedAt: stamp(),
  })
}

const findTx = (id: string) => { const t = state.tx.find(x => x.id === id); if (!t) throw new Fail(404, 'Lançamento não encontrado'); return t }
const findRec = (id: string) => { const r = state.rec.find(x => x.id === id); if (!r) throw new Fail(404, 'Conta fixa não encontrada'); return r }

// segundos segmentos que são nomes de rota (o resto é um id)
const LITERALS = new Set(['options', 'dev', 'refresh', 'magic-link', 'verify', 'exchange', 'google', 'members', 'invite', 'join',
  'clear', 'restore', 'items', 'sync-now', 'accounts', 'import', 'apply-similar', 'csv'])

function route(method: string, path: string, q: URLSearchParams, b: Body): unknown {
  const today = q.get('hoje') && /^\d{4}-\d{2}-\d{2}$/.test(q.get('hoje')!) ? q.get('hoje')! : todaySP()
  const seg = path.replace(/^\/api\//, '').split('/')
  const literal = seg[1] !== undefined && LITERALS.has(seg[1])
  const M = `${method} ${seg[0]}${seg[1] ? '/' + (literal ? seg[1] : ':id') : ''}${seg[2] ? '/' + seg[2] : ''}`
  const id = seg[1]

  switch (M) {
    // login e casa
    case 'GET auth/options': return { google: false, magicLink: false, dev: true }
    case 'POST auth/dev': case 'POST auth/refresh': return { token: 'demo' }
    case 'POST auth/magic-link': case 'POST auth/verify': case 'POST auth/exchange': throw unavailable()
    case 'GET me': return { email: 'demo@exemplo.com', name: null, household: { id: 'demo', name: state.name, role: 'owner' } }
    case 'GET households/members': return [{ email: 'demo@exemplo.com', role: 'owner', me: true }]
    case 'POST households/invite': return { code: 'DEMO2026', expiresAt: new Date(Date.now() + 48 * 3600e3).toISOString() }
    case 'DELETE account': state = seed(); save(); return { deleted: true }

    // telas
    case 'GET overview': return overview(today)
    case 'GET statement': return statement(today, q.get('month') ?? '')
    case 'GET projection': return projection(today, q.get('variable') === 'true')
    case 'GET settings': return settingsView(today)
    case 'GET categories': {
      const all = [...state.tx, ...state.rec]
      return { in: [...new Set(all.filter(x => x.type === 'in').map(x => x.category))].sort(), out: [...new Set(all.filter(x => x.type === 'out').map(x => x.category))].sort() }
    }
    case 'GET link-options':
      return ledger(today).linkOptions(q.get('type') as T, q.get('date') ?? today, q.get('txId')).map(o => ({
        value: `${o.r.id}|${o.k}`, recurringId: o.r.id, k: o.k, label: `${o.r.name} · ${monthYear(o.k)}`, name: o.r.name, category: o.r.category, expected: o.expected,
      }))

    // lançamentos
    case 'POST transactions': {
      const t: MTx = { id: uid(), date: today, type: 'out', amount: 0, description: '', category: 'Outros', recurringId: null, recurringMonth: null, isTransfer: false, isSample: false, source: 'manual', createdAt: stamp() }
      applyTx(b, t)
      return mutation(t.recurringId ? `${t.description} confirmada` : `${t.type === 'in' ? 'Entrada' : 'Saída'} de ${brl(t.amount)} registrada${t.date > today ? ' (agendada)' : ''}`,
        () => state.tx.push(t), t.id)
    }
    case 'PUT transactions/:id': {
      const t = clone(findTx(id))
      applyTx(b, t)
      return mutation('Lançamento atualizado', () => { state.tx = state.tx.map(x => (x.id === id ? t : x)) }, id)
    }
    case 'DELETE transactions/:id': {
      const t = findTx(id)
      return mutation(`“${t.description || 'Lançamento'}” excluído`, () => { state.tx = state.tx.filter(x => x.id !== id) })
    }
    case 'POST transactions/:id/not-transfer': return mutation('Marcado como lançamento comum', () => { findTx(id).isTransfer = false })

    // contas fixas
    case 'POST recurring': {
      const r: MRec = { id: uid(), type: 'out', name: '', note: '', amount: 0, gross: null, isSalary: false, tithe: false, formula: null, day: 1, freq: 'mensal', startMonth: monthOf(today), endMonth: null, parcels: null, category: 'Outros', matchKeywords: [], skipMonths: [], isSample: false, updatedAt: stamp() }
      applyRec(b, r)
      return mutation(`“${r.name}” adicionada às contas fixas`, () => state.rec.push(r), r.id)
    }
    case 'PUT recurring/:id': {
      const r = clone(findRec(id))
      applyRec({ ...b, formula: r.formula ?? b.formula }, r)
      return mutation('Conta fixa atualizada', () => { state.rec = state.rec.map(x => (x.id === id ? r : x)) }, id)
    }
    case 'DELETE recurring/:id': {
      const r = findRec(id)
      return mutation(`“${r.name}” excluída das contas fixas`, () => {
        state.rec = state.rec.filter(x => x.id !== id)
        state.tx.forEach(t => { if (t.recurringId === id) { t.recurringId = null; t.recurringMonth = null } })
      })
    }
    case 'POST recurring/:id/change-from': {
      const r = findRec(id)
      const k = str(b.month).slice(0, 7)
      if (!(k > r.startMonth)) throw bad('Escolha um mês depois do início da conta', 'month')
      const copy: MRec = { ...clone(r), id: uid(), endMonth: r.endMonth, skipMonths: r.skipMonths.filter(m => m >= k) }
      applyRec({ ...(b.values as Body), startMonth: k, formula: r.formula }, copy)
      return mutation(`“${copy.name}” muda a partir de ${monthYear(k)}`, () => {
        r.endMonth = addM(k, -1)
        state.rec.push(copy)
        state.tx.forEach(t => { if (t.recurringId === r.id && (t.recurringMonth ?? '') >= k) t.recurringId = copy.id })
      }, copy.id)
    }
    case 'POST recurring/:id/skip': case 'POST recurring/:id/unskip': {
      const r = findRec(id)
      const k = str(b.month).slice(0, 7)
      const skip = seg[2] === 'skip'
      return mutation(`${r.name} ${skip ? 'ignorada' : 'restaurada'} em ${monthYear(k)}`, () => {
        r.skipMonths = r.skipMonths.filter(m => m !== k).concat(skip ? [k] : [])
      })
    }

    // configurações, desfazer, dados
    case 'PUT settings':
      return mutation('Configurações salvas', () => {
        if (b.openingBalance !== undefined) state.settings.openingBalance = round2(num(b.openingBalance))
        if (b.openingDate) state.settings.openingDate = str(b.openingDate)
        if (b.titheBase === 'liquido' || b.titheBase === 'bruto') state.settings.titheBase = b.titheBase
        if (b.captureMode === 'inbox' || b.captureMode === 'parse') state.captureMode = b.captureMode
        if (str(b.name).trim()) state.name = str(b.name).trim()
      })
    case 'POST undo': {
      const snap = snapshots.get(str(b.demo))
      if (!snap) throw new Fail(409, 'Alterado por outra pessoa')
      snapshots.delete(str(b.demo))
      state = snap
      save()
      return { message: 'Desfeito' }
    }
    case 'POST sample/clear': {
      const n = state.tx.filter(t => t.isSample).length
      return mutation(`${n} lançamentos de exemplo apagados · saldo inicial zerado em hoje`, () => {
        state.tx = state.tx.filter(t => !t.isSample)
        state.settings.openingBalance = 0
        state.settings.openingDate = today
      })
    }
    case 'POST sample/restore':
      if (state.tx.some(t => !t.isSample) || state.rec.some(r => !r.isSample)) throw new Fail(409, 'A casa já tem dados próprios')
      return mutation('Dados de exemplo restaurados', () => { state = seed() })
    case 'GET export': return { version: 'demo', ...clone(state) }
    case 'POST import': {
      if (b.version !== 'demo' || !Array.isArray(b.rec) || !Array.isArray(b.tx)) throw bad('Arquivo não reconhecido (no modo demonstração, só arquivos exportados por ele)')
      if (q.get('dryRun') === 'true') return { transactions: state.tx.length, recurring: state.rec.length, importTransactions: (b.tx as []).length, importRecurring: (b.rec as []).length }
      const { version: _v, ...next } = b
      return mutation(`Importado: ${(b.tx as []).length} lançamentos, ${(b.rec as []).length} contas fixas`, () => { state = next as unknown as State })
    }

    // regras de categoria (só ficam guardadas: no modo demonstração não há lançamentos importados)
    case 'GET category-rules': return [...state.rules].sort((a, b2) => a.priority - b2.priority)
    case 'POST category-rules': case 'POST category-rules/apply-similar': {
      const r = { id: uid(), matchType: str(b.matchType) || 'description_contains', matchValue: norm(str(b.matchValue)).trim(), category: str(b.category), priority: seg[1] === 'apply-similar' ? 50 : num(b.priority) || 100 }
      if (!r.matchValue || !r.category) throw bad('Informe o texto e a categoria')
      return mutation('Regra criada', () => state.rules.push(r), r.id)
    }
    case 'PUT category-rules/:id':
      return mutation('Regra atualizada', () => {
        state.rules = state.rules.map(r => (r.id === id ? { ...r, matchValue: norm(str(b.matchValue)), category: str(b.category), priority: num(b.priority) || 100 } : r))
      })
    case 'DELETE category-rules/:id': return mutation('Regra excluída', () => { state.rules = state.rules.filter(r => r.id !== id) })

    // integrações: não existem sem o back
    case 'GET pluggy/items': case 'GET mp/accounts': case 'GET parser-rules': return []
    case 'GET inbox': return { items: [], newCount: 0 }
    case 'POST pluggy/items': case 'POST pluggy/sync-now': case 'POST mp/import': case 'POST parser-rules':
    case 'POST import/csv': case 'POST captures':
      throw unavailable()
  }
  if (path.startsWith('/api/import/csv')) throw unavailable()
  throw new Fail(404, 'Não encontrado')
}

/** fetch simulado: mesma forma de resposta e de erro do back de verdade. */
export async function mockFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(input, location.origin)
  let body: Body = {}
  try { if (typeof init.body === 'string' && init.body) body = JSON.parse(init.body) } catch { /* corpo inválido */ }
  await new Promise(r => setTimeout(r, 60))   // um pouco de latência, como numa rede
  try {
    const out = route((init.method ?? 'GET').toUpperCase(), url.pathname, url.searchParams, body)
    return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    const f = e instanceof Fail ? e : new Fail(500, 'Não foi salvo · Tentar de novo')
    if (!(e instanceof Fail)) console.error(e)
    return new Response(JSON.stringify({ error: f.message, field: f.field }), { status: f.status, headers: { 'Content-Type': 'application/json' } })
  }
}
