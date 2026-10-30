# Backend (C#) · base

Base do backend em **ASP.NET Core (.NET 10) + PostgreSQL (EF Core / Npgsql)**. Ela já cumpre as convenções do
contrato; as regras de negócio e as rotas de cada fase ainda precisam ser implementadas.

- Contrato: [`../contracts/openapi.yaml`](../contracts/openapi.yaml). As rotas, campos e mensagens de erro de lá
  são o que o front usa: não mudar sem mudar o contrato antes.
- Divisão front/back e convenções: [`../docs/ARQUITETURA.md`](../docs/ARQUITETURA.md).
- Regras: [`../docs/especificacao.html`](../docs/especificacao.html), seções 3, 5, 6, 8, 10, 13 e 16.
- Aceitação: `node ../contracts/check.mjs http://localhost:8000` precisa terminar com 0 falhas.

## O que já existe

| Peça | Onde | O que faz |
|---|---|---|
| `Clock` | `src/Kognit.Api/Infrastructure/Clock.cs` | "hoje" em America/Sao_Paulo; `?hoje=` / `X-Hoje` quando `Features:AllowTodayOverride` |
| Erros do contrato | `Infrastructure/ApiErrors.cs` | helpers `{ error, field }` e 500 sem detalhes |
| Tempo real | `Infrastructure/Events.cs` | `GET /api/events` (SSE) com `EventBroker.Changed(casa)` e `Notice(casa, msg, undo)`; falta `IHouseholdResolver` (F3) |
| JWT | `Program.cs` | emissor/audiência `minhascontas`, chave em `Auth:JwtKey` |
| CORS | `appsettings.json` | origens do dev, do APK (`https://localhost`, `capacitor://localhost`) |
| Banco | `Data/AppDb.cs`, `docker-compose.yml` | Postgres 17, convenção snake_case (nomes iguais à 5.2) |
| Testes | `tests/Kognit.Tests` | convenções da base (xUnit + WebApplicationFactory) |

## Onde implementar

```
src/Kognit.Domain/        F1 · regras puras da seção 6 (+ 8.3 parser, 8.5 categorize, 8.9 mapRelease, 6.9 parseMoney).
                          Recebem (dados, hoje); nunca leem relógio nem banco.
src/Kognit.Api/Data/      entidades e migrações da 5.2 (households, recurring, transactions, ...)
src/Kognit.Api/Endpoints/ rotas do contrato, agrupadas por tag do openapi.yaml
src/Kognit.Api/Services/  login, desfazer, ingestão (8.6), Pluggy, Mercado Pago, agendamento diário (BackgroundService 11:00 UTC)
tests/Kognit.Tests/       todas as tabelas e cenários da seção 7 e os exemplos da 6.9
```

Ordem sugerida (seção 12): F1 domínio com testes → F2 rotas de telas e escrita → F3 login, casa, eventos →
F4 Pluggy e ingestão → F5 captura → F6 CSV.

Pontos que o front assume (detalhes no contrato):

- As telas vêm calculadas: `GET /api/overview`, `/api/statement?month=`, `/api/projection?variable=`.
  O extrato traz `dayBalances` de todos os dias do mês, já com previstos, e os itens na ordem da RF-04.
- Toda escrita responde `{ message, undo }`. O `undo` é opaco para o front e volta em `POST /api/undo`.
  Recusar com 409 `"Alterado por outra pessoa"` se a linha mudou depois (16.2).
- Toda escrita chama `EventBroker.Changed(casa)` para os outros aparelhos recarregarem.
- Mensagens de erro em português, voltadas ao usuário (o front mostra como vier).

## Rodar

Pré-requisitos: .NET SDK 10 e Docker.

```bash
docker compose up -d
```

```bash
dotnet run --project src/Kognit.Api
```

```bash
dotnet test
```

A API sobe em `http://localhost:8000`, o endereço que o front usa em desenvolvimento. Em produção, configure
`Auth:JwtKey` e `ConnectionStrings:Db` por variável de ambiente ou `dotnet user-secrets`; nunca no Git.
