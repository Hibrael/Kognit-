// Contratos da API (backend/src/Kognit.Api/Endpoints/Dtos.cs).

export type TxType = 'in' | 'out'

export interface Tx {
  id: string; date: string; type: TxType; amount: number; description: string; category: string
  recurringId: string | null; recurringMonth: string | null; recurringName: string | null
  isTransfer: boolean; isSample: boolean; source: string; createdAt: string; beforeOpening: boolean
}

export interface Pending {
  recurringId: string; k: string; name: string; category: string; type: TxType; amount: number
  due: string; date: string; overdue: boolean
}

export interface Bill {
  recurringId: string; name: string; type: TxType; category: string; k: string; due: string; amount: number
  overdue: boolean; dueToday: boolean; txId: string | null; txDate: string | null
}

export interface Overview {
  today: string; cur: string; balance: number; endOfMonth: number; monthIn: number; monthOut: number; nIn: number; nOut: number
  toReceive: number; toPay: number; nextMonth: string; nextNet: number; bills: Bill[]; pOut: number; pIn: number
  recent: Tx[]; hasRecurring: boolean; hasSalary: boolean
}

export interface StatementItem {
  kind: 'tx' | 'prev'; date: string; type: TxType; amount: number; description: string; category: string
  tx: Tx | null; prev: Pending | null
}

export interface Statement {
  month: string; today: string; cur: string; openingDate: string; items: StatementItem[]
  dayBalances: Record<string, number>; endBalance: number; knownCategories: string[]
}

export interface DetailLine { type: TxType; name: string; amount: number; note: string }
export interface ProjectionRow { k: string; in: number; out: number; net: number; end: number; varOut: number; lines: DetailLine[] }

export interface Recurring {
  id: string; type: TxType; name: string; note: string; amount: number; gross: number | null; isSalary: boolean; tithe: boolean
  formula: 'decimo' | 'tithe' | null; day: number; freq: 'mensal' | 'parcelas' | 'unica'; startMonth: string; endMonth: string | null
  parcels: number | null; category: string; matchKeywords: string[]; skipMonths: string[]; isSample: boolean
  vigencia: string; displayAmount: number; ended: boolean; updatedAt: string
}

export interface Projection {
  today: string; cur: string; balance: number; varAvg: number; includeVariable: boolean; rows: ProjectionRow[]
  base: { k: string; salary: number; fixed: number; net: number }; recurring: Recurring[]; titheBase: 'liquido' | 'bruto'
}

export interface LinkOption { value: string; recurringId: string; k: string; label: string; name: string; category: string; expected: number }

export interface Settings {
  name: string; openingBalance: number; openingDate: string; titheBase: 'liquido' | 'bruto'; netTotal: number; grossTotal: number
  hasSampleTx: boolean; canRestoreSample: boolean; captureMode: 'inbox' | 'parse'; mpSwapCreditDebit?: boolean
}

/** Opaco: o back define o conteúdo; o front só guarda e devolve em POST /api/undo. */
export type UndoToken = Record<string, unknown>
export interface MutationResult { message: string; undo: UndoToken; id?: string }

// ---------- F4: integrações ----------
export interface PluggyAccount { id: string; type: 'BANK' | 'CREDIT'; subtype: string; name: string; number: string }
export interface PluggyItem {
  id: string; itemId: string; connectorName: string | null; owner: string | null; includeAccountIds: string[]
  accounts: PluggyAccount[]; lastSyncAt: string | null; status: string; lastError: string | null
}
export interface SyncResult { inserted: number; errors?: string[] }
export interface MpAccount { id: string; label: string; status: 'new' | 'requested' | 'error'; lastImportAt: string | null; lastError: string | null }
export interface CategoryRule { id: string; matchType: 'description_contains' | 'pluggy_category'; matchValue: string; category: string; priority: number }

// ---------- F5: captura ----------
export interface InboxItem {
  id: string; package: string; deviceLabel: string | null; title: string | null; body: string | null; postedAt: string
  status: 'new' | 'imported' | 'ignored'; action: 'create' | 'review-delete' | 'info'; transactionId: string | null
  parsed: { type: TxType; amount: number | null; description: string | null; date: string } | null
}
export interface ParserRule { id: string; pattern: string; type: 'in' | 'out' | 'ignore'; priority: number }

// ---------- F6: CSV ----------
export interface CsvMapping { date: string; description: string; amount: string | null; credit: string | null; debit: string | null; id: string | null }
export interface CsvLine {
  n: number; date: string; type: TxType; amount: number; description: string; category: string
  status: 'new' | 'existing' | 'duplicate'; similarTo: string | null; error: string | null
}
export interface CsvPreview {
  kind: 'generic' | 'release'; needsMapping: boolean; needsOwner: boolean; owners: string[]; mapping: CsvMapping | null
  counts: { new: number; existing: number; duplicate: number }; lines: CsvLine[]
}
