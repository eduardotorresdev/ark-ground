# ark-ground

Um simulador de arquiteturas no navegador. Monte um sistema arrastando blocos
para o canvas, ligue-os e veja a carga fluir em tempo real — sem backend, tudo
roda client-side.

🎮 **Jogue agora:** https://eduardotorresdev.github.io/ark-ground/

## O que dá pra fazer

- Arraste componentes da paleta para o canvas e conecte-os.
- Tipos de nó disponíveis: **load** (gerador de carga), **api-gateway**,
  **load-balancer**, **service**, **pool** e **database**.
- A simulação propaga _quanta_ de carga pelas conexões e mostra métricas
  (vazão, fila, saturação) por nó, em tempo real.
- As conexões respeitam regras de compatibilidade entre portas de entrada/saída.
- O grafo é salvo automaticamente no `localStorage` e migrado entre versões de
  schema, então você não perde o que montou.

## Stack

SvelteKit (SPA) + Svelte 5 (runes), `@xyflow/svelte` para o canvas, Tailwind v4.
Build estático via `@sveltejs/adapter-static`.

## Desenvolvimento

```sh
bun install
bun run dev
```

Outros scripts úteis:

```sh
bun run build      # build de produção em build/
bun run preview    # serve o build localmente
bun run test:unit  # testes unitários (vitest)
bun run check      # type-check
```

## Deploy

O deploy para o GitHub Pages é automático: cada push na branch `main` dispara o
workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), que faz
o build estático e publica o conteúdo de `build/` no Pages.

Em produção a app é servida sob o caminho `/ark-ground`, configurado via
`paths.base` no [`vite.config.ts`](vite.config.ts). O SPA usa `404.html` como
fallback para o roteamento client-side.

Para habilitar no seu fork: **Settings → Pages → Source: GitHub Actions**.
