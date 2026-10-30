// Leitura de extrato no cliente (8.4): CSV (";" ou ",", UTF-8 ou Windows-1252) ou XLSX (SheetJS).
// O resultado é só texto: o back faz o mapeamento, a deduplicação e a gravação.

export interface Table { headers: string[]; rows: string[][] }

/** parseCsv da 8.9: aspas com "" escapado, \r\n ou \n, linhas vazias descartadas. */
export function parseCsv(text: string, sep: string): string[][] {
  const lines: string[][] = []
  let row: string[] = [], cell = '', q = false
  text = text.replace(/^﻿/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === sep) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); lines.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell || row.length) { row.push(cell); lines.push(row) }
  return lines.filter(l => l.some(v => v.trim() !== ''))
}

/** Separador pela 1ª linha: o que aparecer mais entre ";" e ",". */
export function detectSep(text: string) {
  const first = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? ''
  return (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ';' : ','
}

/** UTF-8 se for válido; senão Windows-1252 (exportações antigas do Excel). */
export function decodeText(buf: ArrayBuffer) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf) }
  catch { return new TextDecoder('windows-1252').decode(buf) }
}

function toTable(lines: string[][]): Table {
  const [head = [], ...body] = lines
  const width = head.length
  return { headers: head.map(h => h.trim()), rows: body.map(r => Array.from({ length: width }, (_, i) => (r[i] ?? '').trim())) }
}

export async function readSpreadsheet(file: File): Promise<Table> {
  const buf = await file.arrayBuffer()
  if (/\.xlsx?$/i.test(file.name)) {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(buf, { type: 'array', cellDates: false })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const lines = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
      .map(r => r.map(v => String(v ?? '')))
      .filter(r => r.some(v => v.trim() !== ''))
    return toTable(lines)
  }
  const text = decodeText(buf)
  return toTable(parseCsv(text, detectSep(text)))
}
