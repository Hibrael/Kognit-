import { describe, expect, it } from 'vitest'
import { addM, brl, brlS, diffM, parseMoney, short } from './format'

describe('parseMoney (6.9)', () => {
  it.each([
    ['1.092,50', 1092.5], ['1,092.50', 1092.5], ['1092,5', 1092.5], ['1,5', 1.5],
    ['1.092', 1092], ['1.092.500', 1092500], ['1092.50', 1092.5], ['R$ 1.092,00', 1092], ['−42,90', -42.9],
  ])('%s → %d', (s, v) => expect(parseMoney(s)).toBe(v))
  it('rejeita inválidos', () => {
    expect(parseMoney('1,2,3')).toBeNaN()
    expect(parseMoney('')).toBeNaN()
  })
})

describe('formatos', () => {
  it('moeda com menos tipográfico', () => {
    expect(brl(1092)).toBe('R$ 1.092,00')
    expect(brl(-137.68)).toBe('−R$ 137,68')
    expect(brlS(1876.51)).toBe('+R$ 1.876,51')
  })
  it('abreviação do calendário (RF-05)', () => {
    expect(short(950)).toBe('950')
    expect(short(3339.38)).toBe('3,3k')
    expect(short(3000)).toBe('3k')
    expect(short(12400)).toBe('12k')
  })
  it('meses', () => {
    expect(addM('2026-10', 5)).toBe('2027-03')
    expect(diffM('2026-10', '2027-07')).toBe(9)
  })
})
