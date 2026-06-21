# Projeto

## Gerenciador de pacotes: bun (NÃO npm)

Este projeto usa **bun**. **Nunca** use `npm`, `npx`, `yarn` ou `pnpm` — eles geram
lockfiles concorrentes (`package-lock.json` etc., que estão no `.gitignore`) e
divergem do `bun.lock` versionado.

| Tarefa           | Use                | Não use             |
| ---------------- | ------------------ | ------------------- |
| Instalar deps    | `bun install`      | `npm install`       |
| Rodar um script  | `bun run <script>` | `npm run <script>`  |
| Executar binário | `bunx <bin>`       | `npx <bin>`         |
| Adicionar dep    | `bun add <pkg>`    | `npm install <pkg>` |

Scripts disponíveis (ver `package.json`):

```bash
bun run dev        # vite dev
bun run build      # vite build
bun run check      # svelte-kit sync && svelte-check
bun run lint       # prettier --check . && eslint .
bun run format     # prettier --write .
bun run test:unit  # vitest
```

Após mudanças, valide com `bun run check` e `bun run lint`. Para testes de
unidade: `bunx vitest run` (ou `bun run test:unit -- --run`).
