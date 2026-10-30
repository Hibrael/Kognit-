# Contrato front ↔ back

- [`openapi.yaml`](openapi.yaml): todas as rotas que o front usa, em OpenAPI 3.1. É a fonte da verdade da
  integração; mudanças aqui vêm antes de mudar o front ou o back.
- [`examples/`](examples/): respostas de referência com o exemplo da seção 7.1 e `?hoje=2026-10-29`.
- [`check.mjs`](check.mjs): aceitação de um backend. Confere os números das seções 7.2 e 7.3:

```bash
node contracts/check.mjs http://localhost:8000
```

Para visualizar o contrato, abra o `openapi.yaml` em qualquer visualizador OpenAPI (ex.: a extensão
OpenAPI do VS Code ou https://editor.swagger.io).
