#!/usr/bin/env node
// Verificador de aceitação de um backend (docs/ARQUITETURA.md).
// Reproduz os números das seções 7.2 e 7.3 da especificação contra um back rodando em desenvolvimento.
//
//   node contracts/check.mjs http://localhost:8000
//
// Requisitos do back em desenvolvimento: ?hoje= aceito, POST /api/auth/dev ligado e o e-mail
// CHECK_EMAIL (padrão verificacao@exemplo.com) permitido. Use um e-mail só para isto: a casa dele é
// reiniciada com o exemplo da 7.1.

const BASE = (process.argv[2] ?? 'http://localhost:8000').replace(/\/$/, '')
const EMAIL = process.env.CHECK_EMAIL ?? 'verificacao@exemplo.com'

let token = null
let failures = 0
let passes = 0

async function call(method, path, { body, hoje } = {}) {
  const url = new URL(BASE + path)
  if (hoje) url.searchParams.set('hoje', hoje)
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* não é JSON */ }
  return { status: res.status, json, text }
}

async function ok(method, path, opts) {
  const r = await call(method, path, opts)
  if (r.status < 200 || r.status >= 300) throw new Error(`${method} ${path} → ${r.status} ${r.text.slice(0, 200)}`)
  return r.json
}

function eq(label, actual, expected) {
  const good = typeof expected === 'number'
    ? typeof actual === 'number' && Math.abs(actual - expected) < 0.005
    : actual === expected
  if (good) passes++
  else { failures++; console.log(`  ✗ ${label}: esperado ${JSON.stringify(expected)}, veio ${JSON.stringify(actual)}`) }
}

function section(title) { console.log(`\n${title}`) }

async function main() {
  console.log(`Backend: ${BASE}  ·  e-mail: ${EMAIL}`)

  section('Login de desenvolvimento e casa')
  const opts = await ok('GET', '/api/auth/options')
  eq('auth/options.dev', opts.dev, true)
  token = (await ok('POST', '/api/auth/dev', { body: { email: EMAIL } })).token
  let me = await ok('GET', '/api/me')
  if (!me.household) await ok('POST', '/api/households', { body: { name: 'Verificação', openingDate: '2026-10-01' } })
  me = await ok('GET', '/api/me')
  eq('me.household existe', !!me.household, true)
  await ok('POST', '/api/sample/restore', { hoje: '2026-10-29' })

  const D = '2026-10-29'
  section('7.2 · hoje = 29/10/2026')
  const ov = await ok('GET', '/api/overview', { hoje: D })
  eq('saldo atual', ov.balance, 796.35)
  eq('entrou em outubro', ov.monthIn, 3419.38)
  eq('lançamentos de entrada', ov.nIn, 3)
  eq('saiu em outubro', ov.monthOut, 3043.03)
  eq('lançamentos de saída', ov.nOut, 9)
  eq('previsto para 31/10', ov.endOfMonth, 796.35)
  eq('sobra em novembro', ov.nextNet, 1876.51)
  eq('últimos lançamentos', ov.recent.length, 6)

  const pj = await ok('GET', '/api/projection', { hoje: D })
  eq('resumo base · salário', pj.base.salary, 3339.38)
  eq('resumo base · fixas', pj.base.fixed, 2982.06)
  eq('resumo base · sobra', pj.base.net, 357.32)
  eq('gastos variáveis (média)', pj.varAvg, 68.69)
  const vig = name => pj.recurring.find(r => r.name === name)?.vigencia
  eq('vigência Caixa', vig('Caixa'), '5 de 6 parcelas restantes · até Mar/27')
  eq('vigência Santander', vig('Santander'), '1 de 2 parcela restante · até Nov/26')
  const table = [
    ['2026-10', 3419.38, 3043.03, 376.35, 796.35], ['2026-11', 5027.37, 3150.86, 1876.51, 2672.86],
    ['2026-12', 3339.38, 2877.06, 462.32, 3135.18], ['2027-01', 3339.38, 3477.06, -137.68, 2997.50],
    ['2027-02', 3339.38, 2877.06, 462.32, 3459.82], ['2027-03', 3339.38, 2877.06, 462.32, 3922.14],
    ['2027-04', 3339.38, 2625.94, 713.44, 4635.58],
  ]
  eq('projeção · 7 meses', pj.rows.length, 7)
  table.forEach(([k, inn, out, net, end], i) => {
    const r = pj.rows[i] ?? {}
    eq(`${k} mês`, r.k, k)
    eq(`${k} entradas`, r.in, inn)
    eq(`${k} saídas`, r.out, out)
    eq(`${k} sobra/falta`, r.net, net)
    eq(`${k} saldo no fim`, r.end, end)
  })
  const nov = pj.rows[1]?.lines ?? []
  eq('novembro · 13º', nov.find(l => l.name.startsWith('13º'))?.amount, 1687.99)
  eq('novembro · devolução', nov.find(l => l.name.startsWith('Devolução'))?.amount, 502.74)
  const pjVar = await ok('GET', '/api/projection?variable=true', { hoje: D })
  eq('com gastos variáveis · novembro', pjVar.rows[1]?.out, 3150.86 + 68.69)

  const oct = await ok('GET', '/api/statement?month=2026-10', { hoje: D })
  eq('extrato out · saldo do dia 25', oct.dayBalances['2026-10-25'], 796.35)
  eq('extrato out · saldo do dia 12', oct.dayBalances['2026-10-12'], 1340.54)
  eq('extrato out · itens', oct.items.length, 12)
  eq('extrato out · mais recente primeiro', oct.items[0]?.date, '2026-10-25')

  section('7.3 · virada de mês sem confirmar (hoje = 02/12/2026)')
  const D2 = '2026-12-02'
  const ov2 = await ok('GET', '/api/overview', { hoje: D2 })
  eq('saldo atual', ov2.balance, 796.35)
  eq('previsto para 31/12', ov2.endOfMonth, 3135.18)
  eq('atrasadas de novembro em "A pagar e a receber"', ov2.bills.filter(b => b.k === '2026-11' && b.overdue).length, 10)
  const pj2 = await ok('GET', '/api/projection', { hoje: D2 })
  eq('dezembro · entradas', pj2.rows[0]?.in, 8366.75)
  eq('dezembro · saídas', pj2.rows[0]?.out, 6027.92)
  eq('dezembro · sobra', pj2.rows[0]?.net, 2338.83)
  const dec = await ok('GET', '/api/statement?month=2026-12', { hoje: D2 })
  eq('dezembro · pendências', dec.items.filter(i => i.kind === 'prev').length, 18)

  section('7.3 · confirmar Luz de novembro com R$ 162,40 e desfazer')
  const luz = ov2.bills.find(b => b.name === 'Luz' && b.k === '2026-11')
  const conf = await ok('POST', '/api/transactions', { hoje: D2, body: {
    type: 'out', amount: 162.40, date: D2, description: 'Luz', category: 'Contas da casa', recurringId: luz?.recurringId, recurringMonth: '2026-11',
  } })
  const ov3 = await ok('GET', '/api/overview', { hoje: D2 })
  eq('saldo atual', ov3.balance, 633.95)
  eq('previsto para 31/12', ov3.endOfMonth, 3122.78)
  const dup = await call('POST', '/api/transactions', { hoje: D2, body: {
    type: 'out', amount: 150, date: D2, recurringId: luz?.recurringId, recurringMonth: '2026-11',
  } })
  eq('confirmar de novo → 409', dup.status, 409)
  await ok('POST', '/api/undo', { body: conf.undo })
  eq('desfeito', (await ok('GET', '/api/overview', { hoje: D2 })).balance, 796.35)
  const again = await call('POST', '/api/undo', { body: conf.undo })
  eq('desfazer duas vezes → 409', again.status, 409)

  section('7.3 · extrato além do horizonte (Jul/27)')
  const jul = await ok('GET', '/api/statement?month=2027-07', { hoje: D })
  eq('previstos de julho aparecem', jul.items.some(i => i.kind === 'prev'), true)
  eq('saldo previsto no fim de julho', jul.endBalance, 6775.90)

  section('Devolução sobre o bruto')
  const br = await ok('PUT', '/api/settings', { body: { titheBase: 'bruto' } })
  const pjB = await ok('GET', '/api/projection', { hoje: D })
  eq('devolução de um mês normal (dez)', pjB.rows[2]?.lines.find(l => l.name.startsWith('Devolução'))?.amount, 337.60)
  await ok('POST', '/api/undo', { body: br.undo })

  section('7.3 · apagar exemplos e lançamento avulso')
  const cl = await ok('POST', '/api/sample/clear', { hoje: D })
  const ov4 = await ok('GET', '/api/overview', { hoje: D })
  eq('saldo atual', ov4.balance, 0)
  eq('previsto para 31/10', ov4.endOfMonth, 0)
  eq('nenhuma conta de outubro atrasada', ov4.bills.filter(b => b.overdue).length, 0)
  const tx = await ok('POST', '/api/transactions', { hoje: D, body: { type: 'out', amount: 50, date: D, description: 'Avulso' } })
  eq('saída de R$ 50', (await ok('GET', '/api/overview', { hoje: D })).balance, -50)
  await ok('POST', '/api/undo', { body: tx.undo })
  eq('desfazer volta para 0,00', (await ok('GET', '/api/overview', { hoje: D })).balance, 0)
  await ok('POST', '/api/undo', { body: cl.undo })
  eq('exemplos de volta', (await ok('GET', '/api/overview', { hoje: D })).balance, 796.35)

  section('Erros no formato do contrato')
  const bad = await call('POST', '/api/transactions', { hoje: D, body: { type: 'out', amount: 0, date: D } })
  eq('valor zero → 400', bad.status, 400)
  eq('erro tem "error"', typeof bad.json?.error, 'string')
  const anon = await fetch(BASE + '/api/overview')
  eq('sem token → 401', anon.status, 401)

  console.log(`\n${passes} conferências ok, ${failures} falharam`)
  process.exit(failures ? 1 : 0)
}

main().catch(e => { console.error(`\nErro: ${e.message}`); process.exit(2) })
