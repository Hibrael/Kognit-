# Arquitetura

O produto está dividido em dois serviços que só se conhecem pelo contrato
[`contracts/openapi.yaml`](../contracts/openapi.yaml):

```
┌──────── Celular Android (APK) / navegador ────────┐            ┌──────────── Backend (qualquer linguagem) ────────────┐
│ app/  React + Vite (+ Capacitor no APK)            │  HTTPS     │ API REST /api/*  (contrato OpenAPI)                  │
│  · telas da seção 4 e filtros locais               │◄──────────►│ Banco: modelo da seção 5.2                           │
│  · pilha de desfazer (tokens opacos)               │  JSON      │ Regras da seção 6 (todos os cálculos)                │
│  · plugin nativo MpCapture (10.6) → POST captures  │            │ Login, casa e convite (RF-16)                         │
│  · lê CSV/XLSX e manda as linhas (8.4)             │  SSE       │ Ingestão, Pluggy, Mercado Pago, parser (seção 8)      │
│                                                     │◄───────────│ Tempo real: GET /api/events                          │
└─────────────────────────────────────────────────────┘            │ Agendamento diário 08:00 BRT; segredos só aqui       │
                                                                     └──────────────────────────────────────────────────────┘
```

O front não depende da linguagem do back: nada é importado de lá, só HTTP/JSON e Server-Sent Events,
que qualquer linguagem serve.

## Quem faz o quê

| Responsabilidade | Front (`app/`) | Back |
|---|---|---|
| Saldo, pendências, projeção, contas do mês, vigência, média de variáveis (seção 6) | não calcula | calcula e entrega pronto |
| Filtros do extrato (tipo, categoria, texto, dia), calendário, resumo filtrado, painel de categorias (RF-05 a RF-07) | filtra e soma os itens que o back entregou | entrega os itens do mês e os saldos por dia (que nunca são filtrados) |
| Formatação pt-BR, datas locais, abreviações do calendário | sim | não |
| Validação de campos | só para dar o aviso na hora (ex.: `parseMoney`) | **sempre** valida de novo; é a fonte da verdade |
| Desfazer (16.2) | guarda até 20 tokens e devolve em `POST /api/undo` | gera o token, aplica e recusa se a linha mudou |
| Preferências do aparelho (16.5): tema, aba, chave Previstos, gastos variáveis | `localStorage` | não |
| Dados da casa: saldo inicial, base da devolução, modo de captura, regras, mapeamento CSV | só exibe e edita | guarda |
| Login | guarda o token e o envia como `Bearer` | Google, link mágico, só e-mails permitidos |
| Captura de notificações (8.3, 10.6) | plugin nativo, fila local, envia em lote | parser, caixa "Para revisar", conciliação |
| Importação CSV/XLSX (8.4) | lê o arquivo e envia cabeçalhos + linhas como texto | mapeia, detecta o relatório de Liberações, deduplica, grava |
| Pluggy, Mercado Pago, agendamento, webhook | só telas de configuração | tudo, com os segredos |

Regra de ouro: **o front nunca calcula saldo, pendência ou projeção**. Os únicos números que o front
soma são os do resumo e do calendário do extrato, e só sobre os itens que o back entregou.

## Convenções do contrato

- JSON em `camelCase`. Datas sem hora `"AAAA-MM-DD"`, meses `"AAAA-MM"`, instantes em ISO 8601 com fuso.
- Dinheiro: número com no máximo 2 casas (`1092.5`), sempre positivo em `amount`; o sentido vem de `type: "in" | "out"`.
- "Hoje" é o dia em `America/Sao_Paulo` (16.7). Em **desenvolvimento** o back aceita `?hoje=AAAA-MM-DD`
  (ou o cabeçalho `X-Hoje`) em qualquer rota, para reproduzir a seção 7. Em produção, ignora.
- Erros: status HTTP + corpo `{ "error": "mensagem para mostrar", "field": "campo opcional" }`.
  O front mostra `error` como está, então a mensagem é em português e voltada ao usuário.
  - `400` validação · `401` sem login ou token vencido · `403` sem permissão / sem casa (`"sem casa"`)
  - `404` não existe · `409` conflito (ex.: `"Esta conta já foi confirmada por outra pessoa"`, `"Alterado por outra pessoa"`)
  - `429` limite (`"Muitas tentativas, tente em 1 hora"`, `"Aguarde alguns minutos"`)
- Toda escrita responde `{ "message": "...", "undo": <UndoToken>, "id"?: "..." }`. O `UndoToken` é
  **opaco** para o front: ele só guarda e devolve.
- CORS: o back precisa aceitar as origens `http://localhost:5173` (dev), `https://localhost` (WebView do
  APK no Android), `capacitor://localhost` e o domínio da versão web.

## Login (RF-16, 10.3)

O token é um texto opaco (o back pode usar JWT) enviado em `Authorization: Bearer <token>`.

1. `GET /api/auth/options` diz quais métodos existem (`google`, `magicLink`, `dev`).
2. **Link mágico:** `POST /api/auth/magic-link { email, client: "web" | "app" }`. O back envia um e-mail
   com `https://<app>/?token=XYZ` (web) ou `minhascontas://auth?token=XYZ` (APK). O front troca em
   `POST /api/auth/verify { token }` → `{ token }`.
3. **Google:** o front abre `GET /api/auth/google/start?client=web|app` (na web, navegação; no APK, no
   navegador do sistema via `@capacitor/browser`, porque o Google bloqueia login em WebView). O back faz o
   OAuth e volta para `https://<app>/?code=XYZ` ou `minhascontas://auth?code=XYZ`. O front troca em
   `POST /api/auth/exchange { token: code }` → `{ token }`. Erro volta como `?error=mensagem`.
4. **Dev:** `POST /api/auth/dev { email }` → `{ token }`, só em desenvolvimento.
5. Só e-mails cadastrados no back entram (`403 "Este e-mail não tem acesso"`).
6. `GET /api/me` → `{ email, name, household: { id, name, role } | null }`. Sem casa, o front mostra
   "Bem-vindo": `POST /api/households` (criar) ou `POST /api/households/join { code }` (convite).
7. `401` em qualquer rota → o front volta para o login sem perder a aba atual.

## Tempo real

`GET /api/events?access_token=<token>` responde `text/event-stream` (Server-Sent Events). O token vai na
query porque o `EventSource` do navegador não envia cabeçalhos. Eventos:

| Evento | Dados | O front faz |
|---|---|---|
| `changed` | `{}` | recarrega a tela atual (outra pessoa ou a sincronização gravou algo) |
| `notice` | `{ "message": "...", "undo": UndoToken? }` | mostra o aviso, com "Desfazer" se houver token (ex.: "Luz · Nov/26 confirmada automaticamente", 8.7) |

O back manda um comentário (`: ping`) a cada ~25 s para manter a conexão. Se cair, o front reconecta.

## Fases (seção 12) e o que cada lado entrega

| Fase | Back | Front |
|---|---|---|
| F1 · Domínio | regras da seção 6 com testes de todas as tabelas e cenários da seção 7 e da 6.9 | — |
| F2 · App | rotas de leitura (visão geral, extrato, projeção, opções de vínculo, configurações, categorias), escrita de lançamentos e contas fixas, desfazer, exportar/importar JSON, exemplos | telas da seção 4 com os números da seção 7 |
| F3 · Login e casa | login, casa, convite, apagar conta, eventos, isolamento por casa | login, "Bem-vindo", Configurações › Casa, tempo real, estados da 16.1 |
| F4 · Pluggy | Pluggy (sincronização diária, webhook, "Sincronizar agora"), ingestão 8.6, vínculo automático 8.7, regras de categoria, Mercado Pago 8.9 | Configurações › Pluggy, Mercado Pago, Regras de categoria; "transferência" no extrato |
| F5 · Notificações | `POST /api/captures`, parser 8.3, caixa "Para revisar", regras do parser | plugin nativo (10.6), envio da fila, tela "Para revisar", captura automática |
| F6 · CSV + web | prévia e importação de linhas (8.4, 8.9) | leitura de CSV/XLSX, mapeamento de colunas, prévia; build web |

## Aceitação de um backend

`node contracts/check.mjs <url-do-back>` (Node ≥ 22, sem dependências) entra com o login de
desenvolvimento, cria uma casa, restaura o exemplo da seção 7.1 e confere, com `?hoje=2026-10-29` e
`?hoje=2026-12-02`, os números das seções 7.2 e 7.3 (saldo, entradas/saídas, projeção de 7 meses,
resumo base, vigências, média de variáveis, cenários de virada de mês e extrato além do horizonte) e o
ciclo criar → desfazer. As respostas completas de referência estão em `contracts/examples/`.

O back precisa, em desenvolvimento: aceitar `?hoje=`, ter `POST /api/auth/dev` ligado e permitir o
e-mail `verificacao@exemplo.com` (ou o definido em `CHECK_EMAIL`).

## Configuração do front

| Variável | Uso |
|---|---|
| `VITE_API_URL` | endereço do back no build (APK e web). Vazio = mesma origem; em `npm run dev` o Vite repassa `/api` para `http://localhost:8000` |
