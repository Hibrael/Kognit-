import { describe, expect, it } from 'vitest'
import { Ledger, type MRec, type MTx } from './ledger'

// O simulador do modo demonstração precisa mostrar os mesmos números da seção 7 que o back de verdade.

const R = (o: Partial<MRec> & Pick<MRec, 'id' | 'type' | 'name' | 'day'>): MRec => ({
  note: '', amount: 0, gross: null, isSalary: false, tithe: false, formula: null, freq: 'mensal', startMonth: '2026-10',
  endMonth: null, parcels: null, category: 'Outros', matchKeywords: [], skipMonths: [], isSample: true, updatedAt: '', ...o,
})
const rec: MRec[] = [
  R({ id: 'sh', type: 'in', name: 'Salário Hibrael', amount: 2408.83, gross: 2369.98, isSalary: true, day: 5 }),
  R({ id: 'sr', type: 'in', name: 'Salário Raiane', amount: 930.55, gross: 1006, isSalary: true, day: 5 }),
  R({ id: 'd1', type: 'in', name: '13º', formula: 'decimo', tithe: true, freq: 'unica', startMonth: '2026-11', day: 30 }),
  R({ id: 'dv', type: 'out', name: 'Devolução', formula: 'tithe', day: 6 }),
  R({ id: 'mp', type: 'out', name: 'Mercado Pago', amount: 950, day: 8 }),
  R({ id: 'ca', type: 'out', name: 'Carro', amount: 1092, day: 10 }),
  R({ id: 'lz', type: 'out', name: 'Luz', amount: 150, day: 15 }),
  R({ id: 'ag', type: 'out', name: 'Água', amount: 100, day: 15 }),
  R({ id: 'cx', type: 'out', name: 'Caixa', amount: 251.12, day: 20, freq: 'parcelas', parcels: 6 }),
  R({ id: 'st', type: 'out', name: 'Santander', amount: 105, day: 20, freq: 'parcelas', parcels: 2 }),
  R({ id: 'ip', type: 'out', name: 'IPVA', amount: 600, day: 20, freq: 'unica', startMonth: '2027-01' }),
]
let n = 0
const T = (date: string, type: 'in' | 'out', amount: number, recurringId: string | null = null): MTx => ({
  id: `t${++n}`, date, type, amount, description: '', category: 'Outros', recurringId, recurringMonth: recurringId ? date.slice(0, 7) : null,
  isTransfer: false, isSample: true, source: 'manual', createdAt: '',
})
const tx = [
  T('2026-10-05', 'in', 2408.83, 'sh'), T('2026-10-05', 'in', 930.55, 'sr'), T('2026-10-06', 'out', 333.94, 'dv'),
  T('2026-10-08', 'out', 950, 'mp'), T('2026-10-10', 'out', 1092, 'ca'), T('2026-10-12', 'out', 42.9),
  T('2026-10-15', 'out', 148.37, 'lz'), T('2026-10-15', 'out', 96.2, 'ag'), T('2026-10-18', 'out', 23.5),
  T('2026-10-20', 'out', 251.12, 'cx'), T('2026-10-20', 'out', 105, 'st'), T('2026-10-25', 'in', 80),
]
const settings = { openingBalance: 420, openingDate: '2026-10-01', titheBase: 'liquido' as const }

describe('simulador do modo demonstração · seção 7', () => {
  const l = new Ledger(settings, rec, tx, '2026-10-29')
  it('visão geral e resumo base', () => {
    expect(l.balance).toBe(796.35)
    expect(l.flows('2026-11').net).toBe(1876.51)
    expect(l.base()).toMatchObject({ salary: 3339.38, fixed: 2982.06, net: 357.32 })
    expect(l.varAvg).toBe(68.69)
    expect(l.vigencia(rec[8])).toBe('5 de 6 parcelas restantes · até Mar/27')
  })
  it('projeção de 7 meses', () => {
    expect(l.projection().map(r => [r.in, r.out, r.net, r.end])).toEqual([
      [3419.38, 3043.03, 376.35, 796.35], [5027.37, 3150.86, 1876.51, 2672.86], [3339.38, 2877.06, 462.32, 3135.18],
      [3339.38, 3477.06, -137.68, 2997.5], [3339.38, 2877.06, 462.32, 3459.82], [3339.38, 2877.06, 462.32, 3922.14],
      [3339.38, 2625.94, 713.44, 4635.58],
    ])
  })
  it('virada de mês e extrato além do horizonte', () => {
    const dec = new Ledger(settings, rec, tx, '2026-12-02')
    expect(dec.flows(dec.cur)).toMatchObject({ in: 8366.75, out: 6027.92, net: 2338.83 })
    expect(new Ledger(settings, rec, tx, '2026-10-29', '2027-07').endOf('2027-07')).toBe(6775.9)
  })
})
