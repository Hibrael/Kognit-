# Kognit

> **O front (`app/`) agora usa a [API KOGNIT](https://github.com/correaaugusto/KOGNIT)** (gestor do caixa do pequeno
> negócio: extrato, contas a pagar, previsão de 30 dias com semáforo e "E se…?"). O `backend/` e o `contracts/`
> deste repositório não são usados por ele. Veja **"Rodar o front com a API KOGNIT"** abaixo.
>
> O que mudou: login por e-mail e senha; as abas Visão geral, Extrato e Contas e previsão mostram os dados da API;
> saíram a casa do casal, desfazer, importação CSV, Mercado Pago, captura de notificações e o modo demonstração
> antigo (o banco de demonstração agora vem da API).

## Rodar o front com a API KOGNIT

Pré-requisitos: Node.js ≥ 22 e a API KOGNIT rodando em `http://localhost:5080`
(`dotnet run --project src/Kognit.Api --urls http://localhost:5080` no repositório dela).

```bash
cd app
npm ci
npm run dev
```

Abra `http://localhost:5173`, crie uma conta e toque em **Usar banco de demonstração**. O Vite repassa `/api`
para `http://localhost:5080`. Em produção (Vercel), defina `VITE_API_URL` com o endereço público da API
(ex.: `https://kognit-api.onrender.com`) e libere o endereço do front no `Cors__Origens__0` da API.

---

Texto original do projeto (contas do casal), mantido como referência:

Gestor de contas pessoais de um casal: saldo atual, extrato por dia com calendário, contas fixas
(salário, mensais, parcelas) e projeção dos próximos 6 meses.

Este repositório contém **o front, a arquitetura e a base do backend em C#**. O front fala com o back só
pelo contrato em [`contracts/openapi.yaml`](contracts/openapi.yaml), então não depende da linguagem do back.

- Especificação completa com o protótipo navegável: [`docs/especificacao.html`](docs/especificacao.html)
  (abra no navegador, aba **Documentação**).
- Como front e back se dividem: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).
- Escolhas e desvios da especificação: [`docs/DECISOES.md`](docs/DECISOES.md).

## Estrutura

```
app/          React + Vite + TypeScript (+ Capacitor para o APK). Fala com o back só por HTTP/JSON e SSE.
contracts/    openapi.yaml (o contrato), examples/ (respostas de referência) e check.mjs (aceitação do back)
backend/      base do backend em C# (ASP.NET Core + PostgreSQL) pronta para receber a implementação
docs/         especificação, arquitetura e decisões
```

No PowerShell, se aparecer "a execução de scripts foi desabilitada neste sistema", use `npm.cmd` no lugar de
`npm` (ex.: `npm.cmd ci`, `npm.cmd run dev`) ou rode no Prompt de Comando (`cmd`).

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

## Gerar o APK (10.7)

Pré-requisito: Android Studio 2025.2.1+ (JDK 21 e SDK da API 36). Com `VITE_API_URL` apontando para o back:

```bash
cd app
npm run build
npx cap sync android
npx cap open android
```

Ícone (10.7), só quando for gerar o APK: `npx @capacitor/assets@3.0.5 generate --android` a partir de
`app/assets/icon-only.png`.

No Android Studio: Build › Generate Signed App Bundle or APK › APK. O keystore (`.jks`) e a senha nunca vão
para o Git. O plugin nativo de captura (10.6) está em `app/android/app/src/main/java/br/com/minhascontas/app/capture`.

## Versão web (10.8)

O mesmo build estático serve a web. Na Vercel: Root Directory `app`, framework Vite, saída `dist`, variável
`VITE_API_URL` com o endereço do back (criada antes do primeiro deploy). `app/vercel.json` manda todas as rotas
para o `index.html`. O back precisa liberar a origem da versão web no CORS.
