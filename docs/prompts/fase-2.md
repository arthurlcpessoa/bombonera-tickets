# Fase 2: setores interativos

> Prompt para o Claude Code. Leia antes o `CLAUDE.md` (contexto, convenções e sistema de coordenadas)
> e `docs/ARQUITETURA.md`. Explique cada etapa de forma didática enquanto implementa.

## Objetivo

Sobre o modelo 3D, criar uma **camada de setores clicáveis**, inspirada no seletor do Liverpool
(venues.3ddigitalvenue.com/liverpool), porém já em 3D desde a visão geral:

- Cada setor aparece como uma **superfície translúcida colorida pela faixa de preço**, colada sobre a arquibancada.
- **Hover**: o setor acende e um tooltip mostra nome, preço e disponibilidade.
- **Clique**: a câmera voa até o setor e abre um painel com os detalhes.
- **Legenda** das faixas de preço e opção para mostrar ou ocultar os setores.

## Abordagem: setores como dados + geometria gerada

O .glb não tem setores separados. Então:

1. **Um caminho em "U"** descreve a planta das bandejas curvas: um retângulo de cantos arredondados que
   contorna o lado −X e as duas cabeceiras (±Z), aberto no lado +X (palcos). Parametrize-o por `t ∈ [0, 1]`,
   indo de uma ponta do U (perto de x ≈ +30, z < 0) até a outra (x ≈ +30, z > 0).
2. **Perfil de cada bandeja**: distância horizontal do caminho até as bordas interna e externa
   (`innerOffset`, `outerOffset`) e alturas dessas bordas (`innerHeight`, `outerHeight`). Com isso,
   a superfície de qualquer trecho da bandeja é uma "faixa inclinada" entre duas curvas.
3. **Um setor** = bandeja + intervalo `[t0, t1]` do caminho + metadados (nome, preço, capacidade).
4. **Os palcos** (lado reto +X) são retângulos inclinados definidos diretamente por coordenadas.
5. Uma função pura gera a `BufferGeometry` de cada setor a partir dos dados. Essa mesma matemática
   (posição ao longo do U + perfil da bandeja) será reaproveitada na Fase 3 para posicionar cada cadeira,
   então mantenha-a isolada, tipada e documentada em `src/features/seating/lib/`.

### Calibração (encaixar as superfícies no modelo)

Os números iniciais abaixo são **aproximados** (medidos por amostragem de vértices). Calibre-os:

- Crie `scripts/probe-stands.mjs`: carrega `apps/web/public/models/bombonera.glb` com glTF Transform
  e o decoder do meshoptimizer (`MeshoptDecoder`, `registerDependencies({'meshopt.decoder': ...})`),
  monta a geometria em Three.js (que funciona no Node para raycasting) e lança raios de cima para baixo
  ao longo de linhas de interesse. Imprima perfis de altura (ex.: ao longo de x = 0 em direção a −Z,
  ao longo de z = 0 em direção a −X e nas diagonais dos cantos). Use os resultados para definir os perfis.
- Crie um **modo debug** ativado por `?debug` na URL, com painel **leva** carregado sob demanda
  (`import()` dinâmico, fora do bundle normal). Ele deve permitir ajustar ao vivo os parâmetros do
  caminho em U e dos perfis das bandejas, e ter um botão "Copiar JSON" com os valores atuais.

Medições aproximadas de partida (eixos do `CLAUDE.md`):

| Onde                 | Observado                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Cabeceira −Z (x = 0) | inferior começa ~z −65 (y ~4) e sobe até ~z −80 (y ~10); média ~z −85 a −95 (y 12–21); superior ~z −95 a −110 (y 24–30); cobertura ~y 37 |
| Cabeceira +Z         | espelhada: ~z +65 a +110                                                                                                                 |
| Lateral −X (z = 0)   | pista em x ~−45 (y ~0); bandejas de x ~−60 (y ~9) até x ~−90 (y ~39)                                                                     |
| Palcos +X            | cadeiras baixas modeladas ~x 36–40, y 0–6, z −50 a +50; camarotes acima até y ~22                                                        |

## Setores (nomes e preços fictícios, plausíveis)

- **Bandeja Inferior**, **Média** e **Superior**, cada uma dividida em ~8 blocos ao longo do U,
  nomeados por bandeja + número (ex.: "Superior 3"). Distribua os blocos simetricamente
  (cabeceiras e lateral) e deixe pequenos vãos entre eles, como corredores.
- **Platea Palcos** (cadeiras baixas do lado +X): 3 blocos.
- Faixas de preço (ARS), cada uma com uma cor:
  - Superior: 35.000
  - Média: 50.000
  - Inferior: 65.000
  - Palcos: 90.000
- Capacidade estimada por setor e disponibilidade mockada, determinística (seed fixa, sem `Math.random()` solto),
  para a UI mostrar "X lugares disponíveis".

Os dados ficam em `src/features/seating/data/sectors.ts`, tipados (`Sector`, `Tier`, `PriceCategory`).

## Interação e UI

- **Overlay 3D** (`SectorOverlay`): um mesh por setor, material translúcido (`transparent`,
  `depthWrite: false`, `polygonOffset` ou leve elevação de ~0,15 m para não piscar contra o modelo).
  Opacidade baixa em repouso, maior no hover e máxima no selecionado (contorno dourado `#f2b51c`).
- Use os eventos de ponteiro do React Three Fiber (`onPointerOver`, `onPointerOut`, `onClick`), com
  `stopPropagation`, e cursor `pointer` no hover.
- **Arrastar a câmera não pode selecionar setor.** Ignore o clique se o ponteiro se moveu mais que alguns pixels.
- **Store** `src/store/useSelectionStore.ts`: `hoveredSectorId`, `selectedSectorId`, `showSectors`,
  com ações. Selecionar um setor limpa o preset ativo do `useViewStore`.
- **Câmera até o setor**: o alvo é o centro do setor. A câmera fica entre o setor e o campo, mais alta,
  olhando para o setor e enquadrando-o. Use `setLookAt` animado do `CameraRig`, seguindo o mesmo padrão
  de `subscribe` já usado lá.
- **Tooltip** (HTML, fora do canvas) segue o mouse: nome, bandeja, preço formatado
  (`Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`) e disponibilidade.
  Não exibir no touch.
- **Painel do setor** (`SectorPanel`): lateral direita no desktop e _bottom sheet_ no celular. Mostra nome,
  preço, disponibilidade e o botão "Escolher cadeira" desabilitado com o texto "Em breve". Tem botão de
  fechar e fecha também com `Esc`; ao fechar, volta para a visão geral.
- **Legenda** com as faixas de preço e um toggle "Mostrar setores".
- Acessibilidade: botões com `aria-label`, foco visível, painel com `role="dialog"`.
- Não quebre o layout atual (header, botões de visão, créditos) em 390 px de largura.

## Estrutura esperada

```
apps/web/src/
├── features/seating/
│   ├── components/   SectorOverlay.tsx, SectorMesh.tsx
│   ├── data/         sectors.ts
│   └── lib/          stadiumPath.ts (caminho em U), sectorGeometry.ts, pricing.ts
├── components/ui/    SectorTooltip.tsx, SectorPanel.tsx, PriceLegend.tsx
├── features/debug/   DebugPanel.tsx (carregado só com ?debug)
└── store/            useSelectionStore.ts
scripts/probe-stands.mjs
```

Ajuste a estrutura se tiver um bom motivo, e explique o motivo.

## Critérios de aceite

- [ ] Os setores ficam bem encaixados nas arquibancadas, sem atravessar o modelo nem flutuar visivelmente, vistos das 4 visões prontas.
- [ ] Hover acende o setor e mostra o tooltip. Clique voa até o setor e abre o painel. `Esc` fecha.
- [ ] Arrastar para girar a câmera não seleciona setor por engano.
- [ ] Legenda e toggle funcionam. Layout ok em 390 px e em desktop.
- [ ] `?debug` abre o painel leva, e o bundle normal não inclui o leva.
- [ ] `npm run typecheck`, `npm run lint` e `npm run build` passam sem erros. Código formatado.
- [ ] `docs/ARQUITETURA.md` e o README atualizados (status da Fase 2 e como os setores funcionam).

## Ordem sugerida

1. `probe-stands.mjs`: medir e mostrar os perfis.
2. `stadiumPath.ts` + `sectorGeometry.ts` (funções puras) e um setor de teste na cena.
3. Modo `?debug` com leva e calibração dos perfis.
4. Dados de todos os setores + overlay com cores por preço.
5. Store, hover, tooltip, clique, câmera e painel.
6. Legenda, toggle, ajustes mobile e acessibilidade.
7. Documentação, checagens e commit. **Pergunte antes de fazer push.**

Ao final, resuma o que foi feito, o que aprender com cada parte e como testar.
