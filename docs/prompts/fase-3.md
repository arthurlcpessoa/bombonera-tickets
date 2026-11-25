# Fase 3: cadeiras

> Prompt para o Claude Code. Leia antes o `CLAUDE.md`, o `docs/ARQUITETURA.md` (seção "Como os setores
> funcionam") e o código de `src/features/seating/`. Explique cada etapa de forma didática enquanto implementa.

## Objetivo

Ao escolher um setor, o usuário vê **as cadeiras daquele setor em 3D**, cada uma com fila e número,
colorida pelo status (livre ou vendida). Ele pode passar o mouse, escolher uma ou mais cadeiras e ver
um resumo com o total. A visão em primeira pessoa é da Fase 4, mas os dados para ela já nascem aqui.

## Ponto de partida (o que a Fase 2 já entrega)

- `sectorSurface(shape, model)` devolve a função **(a, b) → ponto 3D** de qualquer setor:
  `a` ∈ [0, 1] anda ao longo do setor e `b` ∈ [0, 1] sobe a arquibancada. Ela vale para setores
  `curved` (bandejas do U, já com a tabela de correção) e `straight` (palcos).
- `sectorFrame`, `sectorLength`, `sectorDepth` e `estimateCapacity` em `sectorGeometry.ts`.
- `SECTOR_LAYOUT.seatWidth` (0,5 m) e `rowDepth` (0,8 m) em `config/stadium.ts`.
- `createRandom(seed)` para dados simulados determinísticos.
- Stores `useSelectionStore` (setor em hover/selecionado), `useViewStore` e `useStandsStore`.
- `SectorPanel`, `SectorTooltip`, `CameraRig.flyToSector` e a regra clique × arrasto (`e.delta > 6`).

**Não duplique essa matemática:** toda cadeira é um ponto (a, b) da superfície do setor.

## 1. Geração das cadeiras: `seating/lib/seatLayout.ts` (TypeScript puro)

```ts
export interface Seat {
  id: string; // estável e legível, ex.: "upper-3:F12-C07"
  sectorId: string;
  row: number; // 1 = fila mais perto do campo
  number: number; // 1..n dentro da fila
  position: Point3; // centro do assento, sobre a arquibancada
  yaw: number; // rotação em Y (radianos) para a cadeira olhar para o campo
  eye: Point3; // ponto dos olhos de quem está sentado (Fase 4)
  status: 'available' | 'sold';
}

export function generateSeats(sector: Sector, model: StandsModel): Seat[];
```

Regras:

- **Filas:** `rows = floor(sectorDepth / rowDepth)`. A fila `r` fica em `b = (r − 0,5) / rows`.
- **Cadeiras por fila:** meça o comprimento real da fila amostrando a superfície ao longo de `a` naquele `b`.
  Nas curvas, as filas de cima são mais compridas e por isso cabem mais cadeiras, como num estádio de verdade.
  Deixe uma pequena margem nas pontas e distribua as cadeiras centralizadas, com passo `seatWidth`.
- **Orientação (`yaw`):** calcule pela própria superfície, com diferenças finitas. O vetor "subindo a
  arquibancada" (∂/∂b), projetado no chão, aponta para longe do campo, então a cadeira olha no sentido
  contrário. Isso funciona igual para `curved` e `straight`.
- **Olhos:** `eye` fica uns 1,15 m acima do assento, deslocado alguns centímetros para trás.
  Coloque as medidas em `SEAT_LAYOUT` no `config/stadium.ts`.
- **Numeração:** fila 1 na frente (b baixo). Cadeiras numeradas no sentido de `a` crescente. Documente
  esse sentido no código.
- **Status simulado:** determinístico (semente derivada do id do setor), com vendas **agrupadas**, como
  na vida real: grupos de 2 a 6 vendidos juntos, filas da frente mais vendidas. Nada de `Math.random()`.
- **Cache:** gere sob demanda e guarde por setor (`Map`). Só gere de novo se o `StandsModel` mudar (modo `?debug`).
- **Fonte única da verdade:** a capacidade e os lugares livres de cada setor passam a vir da contagem real
  das cadeiras. Atualize `sectors.ts` para isso e remova `estimateCapacity` se ficar sem uso. O tooltip
  e o painel do setor precisam bater com o que se vê em 3D.

## 2. Testes automatizados (novo no projeto)

Adicione **Vitest** ao `apps/web` (script `test`, também exposto na raiz como `npm test`) e teste as
funções puras de `seatLayout.ts` e `stadiumPath.ts`:

- ids únicos em todo o estádio;
- número de cadeiras por setor > 0 e capacidade total plausível (imprima o total; a Bombonera real tem ~54 mil lugares);
- toda cadeira dentro dos limites do setor (a e b em [0, 1]) e com a altura esperada pelo perfil;
- `yaw` apontando para o campo (o produto escalar entre a direção da cadeira e a direção do campo é > 0);
- mesma semente → mesmo status (determinismo);
- filas de cima com ≥ cadeiras que as de baixo nas curvas.

Explique o que é um teste unitário e por que funções puras são fáceis de testar.

## 3. Renderização: `seating/components/SeatInstances.tsx`

- **Só o setor selecionado** mostra cadeiras. Uma `InstancedMesh` para o setor inteiro. Explique o
  InstancedMesh: um único "molde" desenhado N vezes numa só chamada à GPU, cada cópia com sua matriz e cor.
- **Geometria da cadeira:** simples e leve, criada em código (assento + encosto, ~0,45 m, com
  `mergeGeometries` do `three/examples/jsm/utils/BufferGeometryUtils.js`). Avalie visualmente como ela fica
  sobre as cadeiras texturizadas do modelo. Se brigar visualmente, use um marcador mais discreto (ex.: um
  assento achatado) e justifique a escolha.
- **Cores:** livre = cor da faixa de preço; vendida = cinza escuro; hover = mais clara; selecionada = dourado `#f2b51c`.
  Atualize as cores com `setColorAt` + `instanceColor.needsUpdate` **apenas nos índices que mudaram**.
  O hover não pode re-renderizar o React nem recriar a malha.
- **Transição:** ao selecionar o setor, a superfície colorida dele some (ou fica bem tênue, mantendo o
  contorno dourado) e as cadeiras aparecem. Ao fechar, volta ao estado da Fase 2.
- **Desempenho:** libere geometrias e materiais com `dispose()` ao trocar de setor e mantenha 60 fps.
  Meça e informe o maior setor (número de cadeiras).

## 4. Interação

- Eventos do R3F na `InstancedMesh`: `e.instanceId` diz qual cadeira foi atingida. Reaproveite a regra
  clique × arrasto da Fase 2 (extraia para um helper compartilhado, se fizer sentido).
- **Hover:** tooltip "Fila 12 · Cadeira 7" + preço. Cadeira vendida mostra "Vendida" e não é clicável (sem cursor de mão).
- **Clique:** alterna a cadeira na seleção. Limite de **6 cadeiras por compra**, com aviso amigável ao passar disso.
- **Câmera:** ao selecionar o setor, enquadre mais de perto que na Fase 2, para as cadeiras ficarem
  legíveis. Mantenha o _focal offset_ do painel.
- **Bloqueio por estrutura:** as cadeiras são pequenas e ficam perto das marquises. Se o estádio ainda não
  bloqueia eventos de ponteiro, envolva o `StadiumModel` com `<Bvh firstHitOnly>` do drei e faça-o segurar
  `onPointerOver` e `onClick` (`stopPropagation`). Avalie se o `PALCOS_OCCLUDER` ainda é necessário.

## 5. Estado: `src/store/useSeatStore.ts`

- `hoveredSeatId`, `selectedSeatIds` (ordem de escolha), ações `toggleSeat`, `clearSeats` e `removeSeat`.
- Selecionar cadeiras de **outro setor** é permitido: a seleção é do usuário, não do setor. O resumo agrupa por setor.
- A seleção sobrevive a fechar o painel e navegar. Só "Limpar seleção" a apaga.
- Ainda sem `localStorage` (vem com o carrinho real na Fase 5).

## 6. Interface

- **`SectorPanel`:** o botão "Escolher cadeira" sai. No lugar entram:
  - **Mini-mapa 2D do setor:** grade de filas × cadeiras feita com `<button>`s, sincronizada com o 3D
    (hover e seleção nos dois sentidos). Ele é a alternativa **acessível por teclado** à escolha em 3D:
    setas navegam, Enter/Espaço selecionam, e cada botão tem `aria-label` "Fila 12, cadeira 7, livre". Nas curvas,
    as filas têm tamanhos diferentes: centralize cada fila para lembrar o formato real.
  - Legenda livre / vendida / selecionada.
- **`SeatSelectionSummary`** (novo): lista das cadeiras escolhidas (setor, fila, cadeira, preço), botão de remover
  em cada uma, total em ARS e o botão "Continuar" desabilitado com "Em breve". No desktop fica abaixo do painel
  ou integrado a ele. No celular, uma barra compacta "3 cadeiras · $ 195.000" que expande.
  Quando houver uma cadeira selecionada, mostre "Ver visão do assento" desabilitado com "Fase 4".
- Ao trocar de setor com o painel aberto, a câmera voa e o mini-mapa troca. A seleção continua.
- Layout ok em 390 px. Não cubra os botões de visão nem os créditos.

## Critérios de aceite

- [ ] Ao clicar num setor, as cadeiras dele aparecem bem assentadas na arquibancada (sem flutuar/afundar
      visivelmente) e viradas para o campo, nas bandejas curvas e nos palcos.
- [ ] Fila 1 é a da frente, e a numeração é consistente entre 3D, mini-mapa e tooltip.
- [ ] Hover e clique em cadeira funcionam. Vendida não é selecionável. O limite de 6 funciona.
- [ ] O mini-mapa e o 3D ficam sincronizados. O mini-mapa é totalmente usável só com o teclado.
- [ ] Capacidade e disponibilidade do setor = contagem real das cadeiras.
- [ ] O hover não causa re-render do React (verifique com o React DevTools "Highlight updates" e explique como fez).
- [ ] `npm test`, `npm run typecheck`, `npm run lint` e `npm run build` passam. Código formatado.
- [ ] `docs/ARQUITETURA.md` (nova seção "Como as cadeiras funcionam"), README (status) e `CLAUDE.md`
      (roadmap e comando `npm test`) atualizados.

## Ordem sugerida

1. `seatLayout.ts` + Vitest + testes. Mostre o total de cadeiras por bandeja.
2. `SeatInstances` com cores por status, só para o setor selecionado.
3. Ajuste visual: geometria da cadeira, altura e orientação. Mande prints das bandejas e dos palcos.
4. `useSeatStore`, hover, clique, limite de 6 e bloqueio por estrutura.
5. Mini-mapa no painel + resumo da seleção.
6. Capacidade real nos setores, mobile, acessibilidade.
7. Documentação, checagens, commit numa branch `fase-3-cadeiras` e Pull Request. **Pergunte antes de fazer push.**

Ao final, resuma o que foi feito, o que aprender com cada parte e como testar.
