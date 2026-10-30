import { describe, expect, it } from 'vitest'
import { decodeText, detectSep, parseCsv } from './sheet'

describe('leitura de CSV (8.4)', () => {
  it('aspas, separador e linhas vazias', () => {
    const t = '﻿Data;Descrição;Valor\r\n01/10/2026;"Pix ""Maria""; venda";80,00\r\n\r\n02/10/2026;Padaria;-23,50'
    expect(detectSep(t)).toBe(';')
    expect(parseCsv(t, ';')).toEqual([
      ['Data', 'Descrição', 'Valor'],
      ['01/10/2026', 'Pix "Maria"; venda', '80,00'],
      ['02/10/2026', 'Padaria', '-23,50'],
    ])
  })
  it('vírgula como separador', () => expect(detectSep('date,description,amount\n')).toBe(','))
  it('Windows-1252 quando não é UTF-8', () => {
    const bytes = new Uint8Array([0x41, 0xe7, 0xe3, 0x6f])   // "Açãо" em 1252
    expect(decodeText(bytes.buffer)).toBe('Ação')
  })
})
