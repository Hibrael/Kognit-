// Contratos da API KOGNIT (repositório correaaugusto/KOGNIT, src/Kognit.Api/Contratos/Contratos.cs).
// Datas chegam como "AAAA-MM-DD"; enums em camelCase.

export type TipoLancamento = 'entrada' | 'saida' | 'retirada' | 'aporte'

export interface Usuario { id: string; nome: string; email: string; nomeNegocio: string; cpf: string | null; caixaDinheiro: number }
export interface TokenResponse { token: string; expiraEm: string; usuario: Usuario }

export interface Lancamento {
  id: string; data: string; valor: number; tipo: TipoLancamento; categoria: string; descricao: string; meio: string | null
  origem: 'banco' | 'manual'; motivo: string | null; revisar: boolean; simulado: boolean
  contaPaga: { id: string | null; descricao: string; fixa: boolean } | null
}

export interface Totais { entrou: number; saiu: number; praMim: number; lucro: number }

export interface Extrato {
  totais: Totais
  movimentacoes: { itens: Lancamento[]; pagina: number; tamanhoPagina: number; total: number }
}

export type SituacaoConta = 'atrasada' | 'venceHoje' | 'proximos7Dias' | 'depois' | 'paga'

export interface Conta {
  id: string; descricao: string; valor: number; categoria: string; vencimento: string; recorrente: boolean; paga: boolean
  pagaEm: string | null; pagaPeloBanco: boolean; origem: 'manual' | 'detectada' | 'faturaCartao'; situacao: SituacaoConta
}

export interface Contas { totalAPagar: { ate30Dias: number; de31a60Dias: number; de61a90Dias: number }; contas: Conta[] }

export type CorSemaforo = 'verde' | 'amarelo' | 'vermelho'
export interface Semaforo { cor: CorSemaforo; titulo: string; texto: string; menorSaldo: number; diaMenorSaldo: string; primeiroDiaNegativo: string | null }
export interface Alerta { id: string; nivel: 'alto' | 'medio' | 'info'; titulo: string; texto: string; sugestao: string | null }
export interface ContaResumo { descricao: string; valor: number; vencimento: string }

export interface Conexao {
  id: string; provedor: 'pluggy' | 'demo'; nomeBanco: string; status: 'conectando' | 'conectado' | 'atualizando' | 'erro'
  mensagem: string | null; ultimaSincronizacao: string | null; saldoContas: number; contas: { tipo: string; nome: string; saldo: number }[]
}

export interface Painel {
  nomeNegocio: string; saldo: number; semaforo: Semaforo
  hoje: { entrou: number; saiu: number; sobrou: number; venceAmanha: ContaResumo[] }
  mes: Totais; alertas: Alerta[]; paraConferir: number
  ultimasMovimentacoes: Lancamento[]; proximasContas: Conta[]; conexoes: Conexao[]
}

export interface Previsao {
  saldoAtual: number; semaforo: Semaforo
  pontos: { data: string; saldo: number; contas: ContaResumo[] }[]
  medias: { entradaPorDia: number; gastoPorDia: number; retiradaPorDia: number; diasConsiderados: number }
  contasNoPeriodo: number
  gastosDoMes: { categoria: string; valor: number; percentual: number }[]
  evolucao: { ano: number; mes: number; totais: Totais }[]
}

export interface Provedores { pluggyConfigurado: boolean; sandbox: boolean; demoHabilitado: boolean; simulacaoHabilitada: boolean }

/** Dinheiro que entra no caixa (verde no extrato). */
export const entra = (t: TipoLancamento) => t === 'entrada' || t === 'aporte'
