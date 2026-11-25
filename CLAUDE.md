# Bombonera Tickets: contexto para o Claude Code

Site de portfólio de venda de ingressos do Boca Juniors com escolha de assento em 3D na La Bombonera.
O usuário navega pelo estádio em 3D, escolhe setor e cadeira e vê a visão exata daquele assento.

## Modo de trabalho (importante)

- O dono do projeto está **aprendendo**. Ao implementar, explique em português, de forma simples:
  **o que** está sendo feito, **por que** desse jeito e **como** funciona. Prefira analogias a jargão;
  quando usar um termo técnico, explique-o na primeira vez.
- Trabalhe em passos pequenos e mostre o progresso. Ao final de cada etapa, diga como testar no navegador.
- O ambiente do dono é **Windows + PowerShell + VS Code**. Comandos sugeridos devem funcionar no PowerShell.

## Stack

- Monorepo com npm workspaces. Front-end em `apps/web`; a API entrará em `apps/api` na Fase 5.
- React 19 + Vite + TypeScript, Three.js + React Three Fiber + drei, Zustand e Tailwind CSS 4.
- Lint: oxlint. Formatação: Prettier (aspas simples, ponto e vírgula, 100 colunas).
- Alias de import: `@/` → `apps/web/src/`.

## Comandos (rodar na raiz)

| Comando                  | Uso                                      |
| ------------------------ | ---------------------------------------- |
| `npm run dev`            | servidor em http://localhost:5173        |
| `npm run typecheck`      | checagem de tipos                        |
| `npm run lint`           | lint                                     |
| `npm run format`         | formata tudo                             |
| `npm run build`          | build de produção                        |
| `npm run model:optimize` | regera o .glb (precisa de `assets-src/`) |

Antes de cada commit, rode `npm run typecheck`, `npm run lint` e `npm run format`.

## Convenções

- Identificadores em inglês (`SectorOverlay`, `useSelectionStore`). Comentários, documentação e textos da UI em **português**.
- Organização por _feature_: `src/features/<feature>/{components,data,lib}`. A UI HTML genérica fica em `src/components/ui`.
- Interface HTML (fora do canvas) e cena 3D (dentro do `<Canvas>`) **só conversam via stores Zustand** em `src/store/`.
- Constantes do estádio ficam em `src/config/stadium.ts`. Evite números mágicos espalhados.
- Não versionar `assets-src/` (modelo bruto, pesado).
- Mensagens de commit em português, no imperativo, com corpo explicando o que mudou.

## Sistema de coordenadas do modelo

O modelo (`apps/web/public/models/bombonera.glb`) foi recentralizado: **o centro do gramado é (0, 0, 0)**. Unidades em metros, escala real.

- **X**: largura do campo. **+X** é o lado reto dos palcos (estrutura vertical, ~x = 34 a 44).
- **Y**: altura (gramado em y ≈ 0).
- **Z**: comprimento do campo, de gol a gol (linhas de fundo em z ≈ ±52,5).
- O "U" das três bandejas (inferior, média e superior) contorna o lado −X e as duas cabeceiras (±Z).
- Bounding box do modelo: min (−122, −9, −128), max (63, 57, 135).

O modelo é agrupado **por material**, não por setor. Nas bandejas curvas, as cadeiras são uma
superfície texturizada. Por isso, **setores e cadeiras são uma camada de dados gerada por código**
sobre o modelo, não partes do .glb.

## Roadmap

1. ✅ Setup + estádio 3D navegável
2. Setores interativos (veja `docs/prompts/fase-2.md`)
3. Cadeiras com InstancedMesh e seleção
4. Visão do assento em primeira pessoa
5. Back-end (Fastify + Prisma + PostgreSQL), reserva temporária, checkout Mercado Pago sandbox
6. Acabamento e deploy (Vercel + Railway/Render)
