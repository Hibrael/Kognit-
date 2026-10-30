# Kognit · Minhas contas

Gestor de contas pessoais de um casal: saldo atual, extrato por dia com calendário, contas fixas
(salário, mensais, parcelas) e projeção dos próximos 6 meses.

Este repositório contém **o front e a arquitetura**. O backend é um serviço separado, em qualquer
linguagem, que implementa o contrato em [`contracts/openapi.yaml`](contracts/openapi.yaml).

- Especificação completa com o protótipo navegável: [`docs/especificacao.html`](docs/especificacao.html)
  (abra no navegador, aba **Documentação**).
- Como front e back se dividem: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).
- Escolhas e desvios da especificação: [`docs/DECISOES.md`](docs/DECISOES.md).

## Estrutura

```
app/          React + Vite + TypeScript (+ Capacitor para o APK). Fala com o back só por HTTP/JSON e SSE.
contracts/    openapi.yaml (o contrato), examples/ (respostas de referência) e check.mjs (aceitação do back)
docs/         especificação, arquitetura e decisões
```

## Rodar o front

Pré-requisito: Node.js ≥ 22 e um backend que cumpra o contrato rodando localmente.

```bash
cd app
npm ci
npm run dev
```

Por padrão o Vite repassa `/api` para `http://localhost:8000`. Para outro endereço, crie `app/.env.local`
com `VITE_API_URL=https://endereco-do-back`. Para simular outra data (seção 7), abra
`http://localhost:5173/?hoje=2026-10-29` (o back só aceita isso em desenvolvimento).

```bash
cd app
npm test
```

## Conferir um backend

Qualquer backend que diga cumprir o contrato precisa passar no verificador, que reproduz os números da
seção 7 da especificação:

```bash
node contracts/check.mjs http://localhost:8000
```
