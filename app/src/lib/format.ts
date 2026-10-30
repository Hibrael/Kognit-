// Formatação pt-BR e datas locais, iguais ao protótipo (4.1, 6.9, 16.7). Datas são sempre "AAAA-MM-DD" locais.

export const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
export const MES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
export const CATS_IN = ['Salário', 'Renda extra', 'Reembolso', 'Outros']
export const CATS_OUT = ['Moradia', 'Contas da casa', 'Mercado', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Parcelas', 'Devolução', 'Outros']

export const round2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100
export const sum = <T,>(arr: T[], f: (x: T) => number) => round2(arr.reduce((s, x) => s + f(x), 0))
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const fMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const fPlain = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const neg = (s: string) => s.replace('-', '−')
/** R$ 1.092,00 com o sinal de menos tipográfico. */
export const brl = (v: number) => neg(fMoney.format(round2(v) || 0)).replace(/ /g, ' ')
/** Com "+" quando positivo. */
export const brlS = (v: number) => (round2(v) > 0 ? '+' : '') + brl(v)
export const plain = (v: number) => neg(fPlain.format(round2(v) || 0))
/** Abreviação do calendário (RF-05): 950 · 3,3k · 12k. */
export const short = (v: number) => {
  const a = Math.abs(v)
  return a >= 1000 ? (a / 1000).toFixed(a >= 10000 ? 0 : 1).replace('.', ',').replace(',0', '') + 'k' : String(Math.round(a))
}

/** parseMoney da 6.9 (para os campos de valor; o servidor arredonda de novo). */
export function parseMoney(str: string | null | undefined): number {
  let s = String(str ?? '').replace(/[R$\s ]/g, '').replace(/−/g, '-')
  if (!s) return NaN
  const commas = (s.match(/,/g) || []).length
  if (commas && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (commas) {
    if (commas > 1) return NaN
    s = s.replace(',', '.')
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  const n = Number(s)
  return Number.isFinite(n) ? round2(n) : NaN
}

/** minúsculas e sem acentos, para busca (RF-07). */
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// ---------- datas ----------
const pad2 = (n: number) => String(n).padStart(2, '0')
export const isDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d)
export const parseKey = (k: string) => { const [y, m] = k.split('-').map(Number); return { y, m } }
export const addM = (k: string, n: number) => { const { y, m } = parseKey(k); const t = y * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${pad2((t % 12) + 1)}` }
export const diffM = (a: string, b: string) => { const A = parseKey(a), B = parseKey(b); return (B.y * 12 + B.m) - (A.y * 12 + A.m) }
export const daysIn = (k: string) => { const { y, m } = parseKey(k); return new Date(y, m, 0).getDate() }
export const dateFor = (k: string, day: number) => `${k}-${pad2(Math.min(Math.max(1, day), daysIn(k)))}`
export const monthOf = (d: string) => d.slice(0, 7)
export const dayOf = (d: string) => Number(d.slice(8, 10))
export const toDate = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd) }
export const fromDate = (dt: Date) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`
export const mLabel = (k: string) => MES[parseKey(k).m - 1]
export const mLabelY = (k: string) => { const { y, m } = parseKey(k); return `${MES[m - 1]}/${String(y).slice(2)}` }
export const mLong = (k: string) => { const { y, m } = parseKey(k); return `${MES_LONGO[m - 1]} de ${y}` }
export const mName = (k: string) => MES_LONGO[parseKey(k).m - 1]
const fDay = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
export const dayLabel = (d: string) => cap(fDay.format(toDate(d)).replace(/\./g, ''))
export const dShort = (d: string) => `${pad2(dayOf(d))}/${pad2(parseKey(monthOf(d)).m)}`

/** "Hoje" no fuso de São Paulo (16.7); ?hoje=AAAA-MM-DD simula outra data, como no protótipo. */
export function todaySP(): string {
  const q = new URLSearchParams(location.search).get('hoje')
  if (isDate(q)) return q
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}
