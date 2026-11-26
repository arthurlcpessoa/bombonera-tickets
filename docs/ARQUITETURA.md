# Arquitetura

## Visão geral

A tela é montada em **duas camadas**:

```
┌───────────────────────────────────────────┐
│  Interface HTML (React + Tailwind)        │  ← header, legenda, tooltips, painel, resumo
│  ┌─────────────────────────────────────┐  │
│  │  <Canvas> WebGL (React Three Fiber) │  │  ← o estádio 3D + setores + cadeiras
│  └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

As duas camadas não se chamam diretamente. Elas conversam pelos **stores do Zustand** (`src/store/`),
como dois setores de uma empresa que se comunicam por um quadro de avisos:

| Store                  | O que guarda                                            | Quem escreve → quem lê                         |
| ---------------------- | ------------------------------------------------------- | ---------------------------------------------- |
| `useViewStore`         | visão pronta ativa (preset)                             | botões de visão → `CameraRig`                  |
| `useSelectionStore`    | setor sob o mouse, setor escolhido, mostrar/ocultar     | setores 3D ↔ tooltip, painel, legenda          |
| `useStandsStore`       | modelo das arquibancadas (forma + correção)             | painel `?debug` → setores 3D e `CameraRig`     |
| `useSeatStore`         | cadeira em hover, cadeiras escolhidas, aviso de limite  | cadeiras 3D ↔ mini-mapa, tooltip, resumo       |
| `useSeatViewStore`     | cadeira da visão do assento, zoom, visibilidade, aviso  | HUD, resumo, 3D, URL ↔ `CameraRig`             |
| `useAvailabilityStore` | disponibilidade real (vinda da API) e se a API responde | `AvailabilitySync` → 3D, painel, tooltips, HUD |
| `useHoldStore`         | a reserva temporária desta aba (com o token)            | "Continuar" e `HoldWatcher` ↔ resumo           |

Exemplo: clicar num setor chama `selectSector('upper-3')`. O painel HTML lê o setor escolhido e abre;
o `CameraRig`, que "assina" o store com `subscribe()`, calcula o enquadramento e voa até ele.

### Código compartilhado (`packages/shared`)

O site e a API (Fase 5) precisam gerar **as mesmas cadeiras**, com os mesmos ids (`upper-3:F12-C07`).
Por isso a lógica pura mora num pacote do workspace, `@bombonera/shared`, importado pelos dois como se
fosse uma biblioteca do npm (o npm cria um atalho em `node_modules/@bombonera/shared`). É a "planta do
prédio" que o arquiteto (site) e o síndico (API) consultam: uma só, para nunca divergir.

- **No shared:** caminho em U, perfis e calibração (`stadium.ts`, `stadiumPath.ts`,
  `standCalibration.ts`), superfícies dos setores (`sectorGeometry.ts`), gerador de cadeiras
  (`seatLayout.ts`, `random.ts`), setores e faixas de preço (`sectors.ts`), consulta por id
  (`seats.ts`) e regras da compra (`ORDER_RULES`).
- **No site:** tudo o que é desenho ou interface: a malha 3D dos setores
  (`features/seating/lib/sectorGeometry.ts`, com Three.js), as cores (`config/colors.ts`) e as
  constantes de câmera, painel, HUD e visão do assento (`config/stadium.ts`).
- **Regras:** o shared não importa React, Three.js nem nada de `apps/*`, e usa caminhos relativos
  (o alias `@/` é só do site). O pacote é consumido como TypeScript direto, sem etapa de build.

### O jogo à venda (`features/match`)

O topo da tela mostra o jogo do ingresso (`components/ui/MatchInfo.tsx`, que é o `h1` da página).
A partida é **fictícia**: Boca Juniors × River Plate, Campeonato Argentino, domingo 13/12/2026, 17h00.
Desde a Fase 5 os dados vêm da API (`GET /api/matches/current`); o site guarda só os escudos
(`match/data/teams.ts`, pelo id de cada time). `match/lib/formatKickoff.ts`
formata data e hora sempre no fuso de Buenos Aires, o horário impresso no ingresso, seja qual for o
fuso de quem abre o site.

Os times aparecem só pelos escudos (`src/assets/teams/*.webp`, reduzidos para 160 px de altura). O
nome de cada time fica no `alt` da imagem, e o leitor de tela lê "Boca Juniors contra River Plate".
Os escudos são marcas registradas dos clubes: o projeto é só de portfólio, sem vínculo com eles,
como dizem o selo do topo e os créditos.

## Sistema de coordenadas

O script `scripts/optimize-model.mjs` move o modelo para que **o centro do gramado fique em (0, 0, 0)**.
Unidades em **metros**, na escala real do estádio.

| Eixo | Direção                                           |
| ---- | ------------------------------------------------- |
| X    | largura do campo; **+X** é o lado reto dos palcos |
| Y    | altura (Y = 0 é o gramado)                        |
| Z    | comprimento do campo, de gol a gol                |

## Componentes 3D

| Componente (`src/features/...`) | Responsabilidade                                                            |
| ------------------------------- | --------------------------------------------------------------------------- |
| `stadium/StadiumCanvas`         | Cria o `<Canvas>` (renderer, cena, câmera) e organiza os filhos             |
| `stadium/StadiumModel`          | Carrega o `.glb` e segura eventos de ponteiro (bloqueio por estrutura, BVH) |
| `stadium/Environment`           | Céu, luzes e chão ao redor                                                  |
| `stadium/CameraRig`             | `CameraControls`: girar, zoom, limites, presets e voo até o setor           |
| `seating/SectorOverlay`         | Desenha todos os setores e as cadeiras do setor escolhido                   |
| `seating/SectorMesh`            | Um setor: superfície translúcida, eventos de ponteiro e contorno dourado    |
| `seating/SeatInstances`         | As cadeiras do setor escolhido, numa única `InstancedMesh`                  |

## Como os setores funcionam (Fase 2)

O modelo do Sketchfab é só o **cenário**: ele é agrupado por material e não tem setores separados.
Por isso os setores são uma **camada de dados + geometria gerada por código** por cima dele.

### 1. O caminho em "U" (`shared/src/stadiumPath.ts`)

Visto de cima, as três bandejas contornam o campo como um "U" de cantos arredondados, aberto do lado
dos palcos (+X). Cada ponto desse caminho tem um número **t** de 0 a 1, como a quilometragem de
uma estrada: t = 0 é a ponta em −Z, t = 0,5 é o meio da lateral e t = 1 é a ponta em +Z.

Cada bandeja tem um **perfil** (o "corte" visto de lado): a que distância do caminho ficam suas bordas
interna e externa, e a que altura. Um ponto da arquibancada é um par **(t, u)**: ande até t no
caminho e suba a fração u da rampa (0 = borda de baixo, 1 = borda de cima).

### 2. Modelo + correção medida

A Bombonera real não é um retângulo arredondado perfeito: as "retas" são levemente curvas e os
cantos são mais quadrados. O modelo geométrico erra até ~3,5 m. Numa arquibancada inclinada, isso
faria a superfície colorida flutuar ou afundar até 3 m.

A solução é a mesma de calibrar um instrumento: **modelo simples + tabela de correção**.

1. `scripts/probe-stands.mjs` carrega o `.glb` no Node e solta "raios" verticais sobre as
   arquibancadas (como um agrimensor medindo o terreno). Usa um BVH (índice espacial) para ser rápido.
2. Para 201 pontos ao longo do U, ele mede onde a rampa real de cada bandeja está e compara com o
   modelo. A diferença vira a tabela `shared/src/standCalibration.ts` (arquivo gerado).
3. `tierPoint()` soma a correção ao offset. Erro final: ~4 cm em média, máximo ~55 cm.

O script importa o **mesmo** `stadiumPath.ts` do site: o Node 26 executa TypeScript simples
direto. Assim, a medição confere exatamente a matemática que vai para a tela.

```bash
npm run stands:probe              # perfis de altura (cabeceiras, lateral, cantos, palcos)
npm run stands:probe -- materials # materiais do modelo e onde ficam
npm run stands:probe -- check     # erro, borda externa real × site e altura livre, ao longo do U
npm run stands:probe -- up x y z  # o que há acima de um ponto (altura livre)
npm run stands:calibrate          # mede de novo e regrava a tabela de correção
```

Se mudar `STAND_PATH` ou `TIER_PROFILES` em `shared/src/stadium.ts`, rode `stands:calibrate` de novo
(a correção é medida em relação a esses valores).

#### O "ponto cego" dos raios verticais

As bandejas são empilhadas como degraus de uma estante inclinada: a média avança por cima do fundo
da inferior, e a superior por cima do fundo da média, como uma marquise.

```
            superior ╱
         ▓▓▓▓▓▓▓▓▓▓▓╱      ↓ raio vertical: o 1º impacto é a bandeja de cima...
     média ╱  ↓
   ▓▓▓▓▓▓▓╱ ░░░            ...e as últimas filas de baixo (░) ficam escondidas.
 inferior ╱░░
```

Até a Fase 4, a sonda usava só o **primeiro** impacto de cada raio. Embaixo da marquise esse impacto
é a bandeja de cima, então as últimas filas da inferior e da média eram invisíveis para a medição.
Resultado: as bordas externas medidas ficavam onde a marquise começa, não onde as cadeiras acabam
(inferior ~0,8 m mais baixa e média ~4,4 m mais baixa que o real), e faltavam filas no site.

Agora a sonda pega **todos** os impactos do raio (como um espeto atravessando tudo) e procura entre
eles a superfície de cadeiras de cada bandeja (`seatHit`). Nos perfis, um `*` marca a bandeja coberta.
O `check` mostra também a **borda externa real × a última fila do site** ao longo do U.

Consequência esperada: na planta baixa (vista de cima), as bandejas se sobrepõem, em alturas
diferentes. Nada no site depende de os setores não se sobreporem vistos de cima.

#### Altura livre acima da cabeça

Quem senta nas últimas filas fica embaixo da bandeja de cima. Critério: do ponto dos olhos de cada
fila (o mesmo que o site usa: superfície + `SEAT_LAYOUT.eyeHeight`), um raio para **cima**. Se bater
em algo a menos de `SEAT_LAYOUT.minHeadroom` (0,3 m), não cabe uma pessoa sentada ali: é muro, viga,
corrimão ou corredor no modelo. Esses trechos `[fila, t0, t1]` vão para `noHeadroom` na tabela de
correção (1001 amostras ao longo do U), e o gerador de cadeiras pula as cadeiras dentro deles.

Medido hoje: a última fila tem pelo menos 1,5 m de folga (inferior) e 2,4 m (média). Só 6 trechos
de ~35 cm na média ficam de fora: é onde a cadeira cairia sobre o corrimão de uma escada (Metal04).
Para investigar um ponto: `npm run stands:probe -- up x y z`.

### 3. Setores como superfícies parametrizadas (`shared/src/sectorGeometry.ts`)

Todo setor vira uma função **(a, b) → ponto 3D**, como um lençol esticado com coordenadas:
`a` anda ao longo do setor e `b` sobe a arquibancada. Com essa função, um único código gera:

- a **malha** (`buildSectorGeometry`): uma grade de quadradinhos, cada um com 2 triângulos;
- o **contorno** do selecionado (`sectorOutline`);
- o **enquadramento** da câmera (`sectorFrame`): centro, direção do campo e tamanho;
- a **posição de cada cadeira** (Fase 3, veja abaixo).

Há dois tipos de forma: `curved` (trecho [t0, t1] de uma bandeja do U) e `straight` (fatia da
platea dos palcos, um retângulo inclinado).

### 4. Dados (`shared/src/sectors.ts`)

- 3 bandejas × 8 blocos ao longo do U (corredores de 1,6 m) + 5 blocos de palcos = **29 setores**.
  Os palcos seguem os corredores (escadas) **reais** do modelo, medidos na Fase 3 (`PALCOS_BLOCKS_Z`).
- Faixas de preço (`PRICE_CATEGORIES`, no shared), cada uma com cor própria (`CATEGORY_COLORS`, em
  `apps/web/src/config/colors.ts`, porque cor é assunto só do site). As cores evitam azul e amarelo, as cores
  das cadeiras do modelo, para não "sumirem" quando misturadas a elas.
- **Torcida visitante:** o bloco 8 da bandeja superior (id `upper-8`, nome "Visitante") é o setor da
  torcida visitante. Isso é um **dado**, não uma regra no código: o setor tem `audience: 'away'`
  (ausente = `'home'`) e a interface pergunta `isAwaySector(sector)`, nunca o id. O ajuste é feito em
  `SECTOR_OVERRIDES`, por cima do setor gerado; o id não muda, porque os ids das cadeiras
  (`upper-8:F12-C07`) dependem dele. O setor tem faixa própria, `visitante` (mesmo preço da Superior,
  cor verde-limão `#a3e635`, a mais distante das outras quatro, pura e misturada ao azul das cadeiras),
  e a interface mostra o selo "Torcida visitante" no tooltip, no painel e no resumo da seleção. As
  cadeiras continuam selecionáveis normalmente.
- Capacidade e lugares livres = **contagem das cadeiras geradas** (veja "Como as cadeiras funcionam").

### 5. Interação

- **Hover:** `onPointerOver` / `onPointerOut` do React Three Fiber, com `stopPropagation()` para só o
  setor mais próximo reagir. Ignorado no toque (não existe "passar o mouse" no celular).
- **Clique × arrasto:** o evento de clique traz `e.delta` (px andados entre apertar e soltar). Acima de
  6 px foi arrasto da câmera, e o clique é ignorado.
- **Bloqueio por estrutura:** o R3F só "enxerga" objetos com eventos. Para não dar para clicar
  através de telhados e muretas, o próprio estádio recebe os eventos e os segura (`stopPropagation`).
  Com 721 mil triângulos, isso só é viável com um **BVH** (`<Bvh>` do drei, estratégia CENTER, que
  monta em ~0,4 s contra ~2 s do padrão SAH). Nos palcos a superfície do setor fica 0,65 m acima do
  piso, por cima das cadeiras modeladas, senão elas "tampariam" o setor.
- **Voo da câmera:** alvo no centro do setor; câmera entre o setor e o campo, mais alta (34° nas
  bandejas, 12° nos palcos, para olhar por baixo da laje). Desde a Fase 3 ela chega mais perto,
  para as cadeiras ficarem legíveis. O _focal offset_ desloca a imagem para o setor não ficar atrás
  do painel.
- **Painel:** lateral no desktop, "gaveta" no celular (acima dos botões de visão), `role="dialog"`,
  fecha com Esc e volta à visão geral.

### 6. Modo `?debug`

Abra `http://localhost:5173/?debug`. O painel **leva** permite ajustar ao vivo o caminho em U, os perfis
e os palcos, ligar/desligar a correção e copiar os valores em JSON. Ele é carregado com `import()`
dinâmico (`React.lazy`), então fica num arquivo separado que o site normal nunca baixa.

## Como as cadeiras funcionam (Fase 3)

Ao escolher um setor, a superfície colorida dele quase some (fica o contorno dourado) e aparecem as
cadeiras: cada uma com fila e número, colorida pelo status.

### 1. Geração (`shared/src/seatLayout.ts`, TypeScript puro)

Nada de matemática nova: **toda cadeira é um ponto (a, b) da mesma superfície do setor** da Fase 2.

- **Filas:** `floor(profundidade / 0,8 m)`; a fila r fica em b = (r − 0,5) / filas. Fila 1 = a da frente.
- **Cadeiras por fila:** uma "fita métrica" anda pela superfície em passos de 20 cm e mede o
  comprimento real da fila. Nas curvas as filas de trás são mais compridas, então cabem mais
  cadeiras (ex.: Superior 3 vai de 123 a 146 por fila). As cadeiras ficam centralizadas, a cada
  0,5 m, e a fita converte "metros andados" de volta para `a`.
- **Orientação (yaw):** por **diferenças finitas**: compara um ponto um pouco acima e outro um pouco
  abaixo na arquibancada. Essa diferença aponta "morro acima", e a cadeira olha para o lado contrário
  (o campo). Vale igual para curvas e palcos.
- **Numeração:** cresce com `a`, que vai para a **direita de quem está sentado**. Ou seja, a cadeira 1
  fica à esquerda do torcedor (nos palcos o sentido de `a` foi invertido para manter essa regra).
- **Olhos (`eye`):** 1,15 m acima do assento, 8 cm para trás: o ponto de vista da Fase 4.
- **Disponibilidade:** desde a Fase 5, quem diz o estado de cada cadeira é a **API** (veja "Back-end").
  A simulação da Fase 3 continua só em `simulatedSoldSeatIds`, para o estado inicial do jogo: semente
  derivada do id do setor (hash FNV-1a), vendas em **grupos de 2 a 6** (famílias e amigos) e filas da
  frente vendendo mais. Nada de `Math.random()`.
- **Cache:** as listas ficam guardadas por setor num `WeakMap` por modelo; se o modelo mudar
  (`?debug`), elas são geradas de novo. Gerar o estádio inteiro leva ~30 ms.
- **Fonte única:** `sectors.ts` conta as cadeiras para preencher a capacidade (a API usa o mesmo número).

Total: **35.739 cadeiras** (Inferior 11.224 · Média 13.254 · Superior 10.085 · Palcos 1.176). A Bombonera
real tem ~54 mil lugares, mas muitos são de pé e os camarotes não fazem parte desta camada.
O maior setor é a **Média 3, com 2.297 cadeiras**.

**Palcos:** lá o modelo tem cadeiras 3D de verdade. O script mediu as 6 fileiras, o passo (0,482 m) e
os corredores, e as cadeiras geradas caem em cima das reais. Em vez de uma segunda cadeira por dentro
da primeira, desenhamos uma **"capa"** um pouco maior: a cadeira real aparece "pintada" com o status.

### 2. Desenho (`seating/components/SeatInstances.tsx`)

- **InstancedMesh:** um único "molde" de cadeira (assento + encosto, juntados com `mergeGeometries`)
  desenhado N vezes numa só chamada à placa de vídeo. Cada cópia tem sua matriz (posição + rotação)
  e sua cor. 1.881 cadeiras custam praticamente o mesmo que uma.
- **Cores:** livre = cor da faixa de preço; vendida = cinza escuro; hover = mais clara; escolhida = dourado.
- **Sem re-render no hover:** o componente "assina" o `useSeatStore` com `subscribe()` e, quando o
  hover ou a seleção mudam, repinta **só as cadeiras afetadas** com `setColorAt` +
  `instanceColor.needsUpdate`. O tooltip da cadeira e o destaque no mini-mapa também são atualizados
  direto no DOM. Medido: 80 passagens de mouse por 75 cadeiras = **0 commits do React**.
- **Memória:** trocar de setor desmonta o componente, que chama `dispose()` na geometria e no material.

### 3. Interação

- `e.instanceId` diz qual cadeira o raio atingiu. A regra clique × arrasto é compartilhada com os
  setores (`seating/components/pointerRules.ts`).
- Cadeira vendida mostra "Vendida", não tem cursor de mão e não é clicável.
- Até **6 cadeiras por compra** (`ORDER_RULES.maxSeats`). Passar disso mostra um aviso amigável.
- A seleção é do **usuário**, não do setor (`useSeatStore`): pode misturar setores, sobrevive a fechar
  o painel e só "Limpar seleção" apaga. (Sem `localStorage` por enquanto: vem com o carrinho, na Fase 5.)
- Um único `useSceneCursor` decide a mãozinha olhando setores e cadeiras.

### 4. Interface

- **Mini-mapa** (`components/ui/SeatMap.tsx`): grade de `<button>`s desenhada como vista do campo
  (fila 1 embaixo, cadeira 1 à direita), sincronizada com o 3D nos dois sentidos. É a alternativa
  **acessível por teclado**: um Tab entra no mapa ("tabindex itinerante"), as setas andam (↑/↓ vão
  para a cadeira mais alinhada da fila vizinha), Enter/Espaço escolhem, e cada botão se anuncia
  ("Fila 12, cadeira 7, livre").
- **Resumo** (`SeatSelectionSummary`): cadeiras por setor, remover, total em ARS, "Ver visão do
  assento" (Fase 4) e "Continuar" (em breve). No celular é uma barra compacta que expande.
- **`SelectionDock`** posiciona painel + resumo: coluna à direita no desktop, empilhados acima dos
  botões de visão no celular.

### 5. Testes automatizados (`npm test`)

Vitest testa as funções puras (`stadiumPath.test.ts`, `seatLayout.test.ts`): ids únicos, total
plausível, cadeiras dentro do setor e na altura do perfil, todas viradas para o campo, espaçamento,
numeração, determinismo, filas de trás ≥ filas da frente nas curvas e capacidade = contagem.
Funções puras (só dependem da entrada, sem tela nem estado escondido) são fáceis de testar:
basta chamar e comparar.

## Como a visão do assento funciona (Fase 4)

O torcedor "senta" numa cadeira e vê o campo como verá no dia do jogo, podendo olhar em volta,
comparar as vizinhas e compartilhar um link. Tudo parte dos dados que cada `Seat` já tinha desde a
Fase 3: `eye` (olhos, 1,15 m acima do assento) e `yaw` (para onde a cadeira olha).

### 1. Estado (`store/useSeatViewStore.ts`)

- `viewingSeatId` (null = fora da visão) e `requestId` (para voar de novo). `enterSeatView(id)`,
  `exitSeatView()` e `moveSeatView(direção)`.
- Entrar **não escolhe** a cadeira: dá para espiar vendidas e livres. O setor dela vira o selecionado
  sem voo (`focusSector`). Trocar de setor (`selectSector`) encerra a visão.
- Também guarda o zoom do binóculo (a câmera informa, a interface pede), o resultado da visibilidade,
  a chave "Mostrar cadeiras à venda" e avisos curtos (link inválido).

### 2. Câmera em primeira pessoa (`CameraRig`)

- **Alvo inicial** (`seatView.ts`, puro): andando no chão na direção da cadeira, o ponto mais perto
  do centro do campo (projeção do centro sobre essa reta, com um produto escalar), puxado para dentro
  do retângulo do gramado. Olhar dos olhos até ele já inclina a cabeça na medida certa.
- **"Girar a cabeça":** a câmera fica nos olhos e o ponto em volta do qual ela gira fica **5 cm à
  frente**. Girar em volta de um ponto quase colado nos olhos é virar a cabeça. A velocidade é
  negativa (arrastar "puxa" a paisagem, como no Street View).
- **Sem andar:** dolly e truck ficam desligados; scroll e pinça viram **zoom da lente** (`camera.zoom`,
  de 1× a 3×, o binóculo). Limites: ±110° em volta da frente da cadeira, 25° acima do horizonte e
  65° abaixo. Os limites de azimute ficam no mesmo "trecho da volta" do ângulo atual da câmera
  (`seatAzimuthRange`), senão ela daria um giro de 360° para entrar no limite.
- **Planos near e far:** a câmera só desenha o que está entre a distância near e a far. A
  profundidade de cada pixel é guardada com precisão limitada, e essa precisão depende da razão
  far/near, sobretudo do near: um near pequeno demais faz superfícies distantes "brigarem"
  (z-fighting). Por isso o near só desce para 0,05 m no modo assento (a fila da frente está a menos
  de 1 m) e volta a 0,5 m ao sair; o far fica em 3 km, o bastante para o céu.
- **Trocar de cadeira:** voo curto entre os olhos, mantendo a direção do olhar se ela couber no giro
  da cadeira nova (`isWithinTurn`).
- **Sair:** tudo volta (controles, limites, zoom, near/far) e a câmera voa até o setor da cadeira.
  A configuração normal é guardada uma única vez numa `ref` (no StrictMode o efeito monta duas vezes).
- **`prefers-reduced-motion`:** todos os voos (presets, setor, assento, zoom) viram cortes
  instantâneos, e o fade da interface e a animação do HUD são desligados.

### 3. Cena e interface

- Setores e marcadores de cadeira somem (a visão fica "limpa"). A chave "Mostrar cadeiras à venda"
  do HUD reexibe só as cadeiras do setor atual.
- O `<main>` ganha o atributo `data-seat-view`; a classe `hide-in-seat-view` (em `index.css`) faz o
  topo, a legenda, os botões de visão, a dica e o painel saírem com fade (`visibility: hidden` também os
  tira do Tab). Os créditos continuam visíveis (exigência da licença do modelo).
- **HUD** (`components/ui/SeatViewHud.tsx`): setor (com selo de visitante), fila, cadeira, preço e
  status; as quatro métricas; a visibilidade; escolher/remover (vendida desabilitada, limite de 6);
  setas para as vizinhas; binóculo; copiar link; sair. Teclado: setas, `Enter`, `Esc`, `+`/`-`.
- **HUD por tamanho de tela** (`SEAT_HUD_LAYOUT`): o que a pessoa quer ver é o campo. No desktop,
  cartão completo à esquerda. No celular em pé, uma barra recolhida embaixo (setor, fila, cadeira,
  selo Coberto/Descoberto, setas e sair; ~13% da altura em 390 × 844); tocar nela abre o cartão
  completo, com botão "Recolher". Em tela baixa (até 500 px de altura, como o celular deitado),
  cartão lateral compacto com rolagem própria, pela variante `short:` do `index.css`. O JavaScript
  lê as mesmas media queries com `useMediaQuery` (`src/lib`).
- **Vizinhas** (`seatNavigation.ts`, puro): direções de quem está sentado olhando o campo (↑ fila da
  frente, ← cadeira de número menor). Na fila vizinha, a de `a` mais próximo (as filas têm tamanhos
  diferentes nas curvas). Nunca sai do setor.
- **Pontos de entrada:** "olho" em cada cadeira do resumo e o botão "Ver visão do assento" (última
  escolhida); duplo clique numa cadeira no 3D; tecla `V` e botão no mini-mapa.

### 4. Métricas e visibilidade

- **Métricas** (`seatMetrics`, puras): distância dos olhos até o centro do campo e até o gol mais
  próximo, altura dos olhos e o **ângulo do campo** (no chão, a diferença entre o canto mais à
  esquerda e o mais à direita, medidos em relação à direção do centro para nenhum "dar a volta").
- **Visibilidade por raios** (`SeatVisibilityProbe`): dos olhos até cada um de 60 pontos sobre o
  gramado (grade 6 × 10, a 30 cm da grama), um raio. Se ele bate no estádio antes de chegar, aquele
  ponto está escondido; a fração de raios bloqueados vira "Visão livre", "quase livre", "parcialmente"
  ou "bastante obstruída". Usa o BVH do `StadiumModel` (espera ele ficar pronto) e roda só ao entrar ou
  trocar de cadeira, nunca por quadro.
- **O que não bloqueia:** materiais transparentes (`BLEND` no glTF: alambrado, vidros, telas), porque
  através deles se vê o jogo; e o que estiver a menos de 25 cm dos olhos (seria a própria cabeça).
- **Medido no modelo real:** as bandejas e as filas 1 a 5 dos palcos têm visão livre (a laje fica
  acima da cabeça, o campo abaixo). A fila 6 dos palcos tem divisórias de camarote, que obstruem a
  visão lateral das cadeiras vizinhas a elas. Algumas cadeiras geradas dessa fila caem rentes a uma
  divisória (limite da geração da Fase 3, que não conhece as divisórias).
- **A "marquise" não aparece nessa métrica.** As últimas filas da inferior e da média ficam embaixo
  da bandeja de cima, mas o gramado continua 100% visível: a marquise está ACIMA da linha de visão
  para baixo. A grade de 60 pontos mede só o gramado, então essas filas aparecem como "Visão livre",
  o que é correto para o que ela mede. O que a marquise tapa é o alto, e isso vira o teto da visão.
- **Teto da visão** (`ceilingRay`, `findCeiling` e `classifyCover`, puras; raios no
  `SeatVisibilityProbe`, no mesmo momento da visibilidade): dos olhos, raios rumo ao meio-campo, de
  90° (reto para cima) descendo 1° por vez enquanto batem em alguma estrutura. Cada raio para em cima
  do meio-campo, para não contar a arquibancada do outro lado. Se o raio reto para cima já sai livre,
  a cadeira é **"Descoberto"**. Senão, é **"Setor coberto"** (protegido de chuva e sol), e o menor
  ângulo bloqueado dá a altura até onde a bola fica visível sobre o meio-campo: olhos + distância no
  chão × tan(ângulo). A varredura vem de cima para baixo para achar o telhado: um obstáculo baixo e
  separado (corrimão) é assunto da visibilidade do campo, não do teto.
- **Medido no modelo:** última fila da média, bola visível até ~30 m (teto a ~5°); última fila da
  inferior na lateral, até ~50 m (~34°); fila 6 dos palcos, colada na laje, até ~10 m. A superior e
  as filas da frente da inferior e da média são descobertas.

### 5. Link compartilhável (`seatLink.ts` + `store/seatViewUrl.ts`)

- Na visão, a URL vira `?assento=upper-3:F12-C07` com `history.replaceState` (sem recarregar e sem
  encher o "voltar"). Outros parâmetros são mantidos (`?debug` continua funcionando).
- Antes do primeiro render, um link válido entra direto na visão (a câmera já nasce sentada). Id
  inválido: é ignorado, sai da URL e um aviso curto aparece. "Copiar link" usa `navigator.clipboard`.

### 6. Testes

`seatNavigation.test.ts` (vizinhas, pontas, filas de tamanhos diferentes), `seatView.test.ts` (alvo
inicial, ângulos, limites, métricas, grade e classificação) e `seatLink.test.ts` (ler/montar a URL).

## Back-end (Fase 5)

A Fase 5 tem três partes, cada uma com sua branch e seu Pull Request: **5A** (API, disponibilidade
real e reserva temporária), **5B** (checkout, pagamento, ingressos e tempo real) e **5C** (PostgreSQL).
Nas partes A e B, os dados ficam **na memória** da API; o banco entra na 5C sem mexer no resto.

```
 Navegador (apps/web)                         Servidor (apps/api, Fastify)
 ┌──────────────────────────────┐   HTTP     ┌──────────────────────────────────────────┐
 │ TanStack Query (cache, 15 s) │ ─────────▶ │ rotas /api/...  (validação Zod)          │
 │   └▶ useAvailabilityStore    │ ◀───────── │   │ só falam com a interface ↓           │
 │ useHoldStore (sessionStorage)│   JSON     │ TicketingStore  ("a tomada")             │
 └──────────────────────────────┘            │   ├ InMemoryStore   (5A/5B: Maps)        │
         ▲ geometria das cadeiras             │   └ PostgresStore   (5C: banco)          │
         └──── @bombonera/shared ────────────▶│ seed: inventário pelo MESMO gerador      │
                                              └──────────────────────────────────────────┘
```

### 1. A interface do repositório (`apps/api/src/store/TicketingStore.ts`)

As rotas **nunca** acessam os dados diretamente: pedem tudo à `TicketingStore`, uma interface com as
operações de que precisam (jogo, disponibilidade por setor, estado das cadeiras de um setor, criar,
ler e cancelar reserva, expirar as vencidas). É a **tomada padrão**: hoje está ligado nela o
`InMemoryStore`; na 5C, um `PostgresStore`. Regras:

- Todos os métodos são `async` (no banco, a resposta leva milissegundos; quem chama já espera).
- O relógio é **injetável** (`now: () => Date`): nos testes, um relógio falso avança 10 minutos na hora.
- `createHold` é **atômico** (tudo ou nada) e devolve as cadeiras indisponíveis em caso de conflito.

**Modelo de dados** (em memória, organizado como tabelas para a 5C ser só uma tradução):

| Tabela      | O que guarda                                                                  |
| ----------- | ----------------------------------------------------------------------------- |
| `Match`     | o jogo (campeonato, times, data, estádio)                                     |
| `Seat`      | o inventário fixo do estádio: id igual ao do site, setor, fila, número        |
| `MatchSeat` | a cadeira **naquele jogo**: `AVAILABLE`/`HELD`/`SOLD`, `holdId`, `priceCents` |
| `Hold`      | a reserva: id, hash do token, cadeiras, total, `expiresAt`, status            |

O inventário (`store/seed.ts`) vem do **gerador compartilhado**: 35.739 cadeiras com os mesmos ids do
3D. As cadeiras que a simulação antiga mostrava como vendidas começam `SOLD` (`simulatedSoldSeatIds`,
mesma semente), para o site manter a mesma "cara".

**Dinheiro em centavos inteiros.** Números "com vírgula" (`float`) não representam frações decimais
exatamente: em JavaScript, `0.1 + 0.2` dá `0.30000000000000004`. Somando preços, sobram ou somem
centavos. Com inteiros a conta é exata: $ 65.000 viram `6_500_000` centavos, e só na hora de mostrar
dividimos por 100 (`formatCents`).

### 2. Endpoints (prefixo `/api`)

| Método e rota                              | O que faz                                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `GET /health`                              | a API e o armazenamento respondem?                                                      |
| `GET /matches/current`                     | o jogo à venda                                                                          |
| `GET /matches/:id/sectors`                 | por setor: preço (centavos), capacidade, livres, reservadas, vendidas                   |
| `GET /matches/:id/sectors/:sectorId/seats` | só as ocupadas, pelo código curto (`{ sold: ["F12-C07"], held }`)                       |
| `POST /holds` `{ matchId, seatIds }`       | reserva por 10 min → `{ holdId, token, expiresAt, seats, totalCents }`; 409 em conflito |
| `GET /holds/:id` (token)                   | estado atual da reserva                                                                 |
| `DELETE /holds/:id` (token)                | cancela e libera (repetir não faz mal)                                                  |

- **Validação:** tudo passa pelos schemas Zod de `@bombonera/shared` (`api.ts`), os mesmos que o site
  usa para conferir as respostas. Erros sempre no formato `{ error: { code, message, details? } }`.
- **Formato compacto das cadeiras:** só as ocupadas, pelo **nome** curto. O que não está nas listas
  está livre. Pelo nome e não pela posição: se o gerador mudar a ordem, um nome errado vira "cadeira
  desconhecida", enquanto uma posição errada pintaria a cadeira errada.
- **Token:** sem login nesta fase. Quem cria a reserva recebe um token aleatório (32 bytes) e o manda
  em `Authorization: Bearer <token>`. A API guarda só o **hash** (SHA-256) e compara em tempo
  constante. Sem token → 401; token errado ou reserva inexistente → **404, a mesma resposta**, para não
  revelar quais reservas existem.
- **Preço:** quem calcula o total é o **servidor**, pelo inventário. Campos a mais no corpo (como um
  `totalCents` inventado) são descartados pelo Zod.

### 3. O fluxo da reserva

1. "Continuar" no site: se já existe uma reserva desta pessoa, ela é **cancelada** antes (uma ativa por
   pessoa); depois, `POST /holds` com as cadeiras escolhidas.
2. Sucesso: a reserva (com o token) vai para o `useHoldStore`, guardado no **`sessionStorage`** (um
   armário do navegador que dura enquanto a aba estiver aberta). Recarregar mantém a reserva: ao abrir,
   o `HoldWatcher` confere com `GET /holds/:id` se ela ainda vale. Cada aba é uma "pessoa".
3. **409:** o site avisa quais cadeiras foram pegas, tira-as da seleção e busca o setor de novo.
4. O cronômetro de 10 minutos aparece no resumo. Ao zerar, a reserva vence e a pessoa é avisada.
5. **Expiração preguiçosa:** uma reserva vencida já conta como livre em todas as consultas, mesmo antes
   de alguém limpá-la. Um **job** a cada minuto marca as vencidas como `EXPIRED` e libera as cadeiras
   (sem soltar a cadeira que outra pessoa já pegou depois do vencimento).

No site, o TanStack Query busca o jogo, os setores e as cadeiras do setor aberto (a cada 15 s, e ao
voltar para a aba) e o `AvailabilitySync` copia tudo para o `useAvailabilityStore`, de onde a cena 3D
e a interface leem (a regra de sempre: HTML e 3D só conversam por stores). Estados de cada cadeira:
**livre**, **reservada** (por outra pessoa: cinza-claro, não clicável), **vendida** e **desconhecida**
(carregando ou API fora do ar: não dá para escolher). Com a API fora do ar, um aviso aparece no topo e
o estádio continua navegável, porque a geometria vem do próprio site.

### 4. Concorrência: duas pessoas, a mesma cadeira, o mesmo milissegundo

Reservar tem duas etapas: "está livre?" e "agora é minha". Se a pessoa A faz a primeira, a pessoa B
também faz a primeira (ainda livre!), e só então as duas fazem a segunda, **as duas acham que
ganharam**: uma **condição de corrida**.

No `InMemoryStore`, o **event loop** do Node resolve: ele executa um trecho de código por vez e só
troca de tarefa num `await`. Em `createHold`, a checagem e a escrita acontecem **sem nenhum `await`
no meio**, então nada se intromete entre elas. Um `await` ali bastaria para quebrar tudo: o teste de
concorrência foi rodado com uma pausa colocada de propósito entre as duas etapas, e **as 20 tentativas
"ganharam" a mesma cadeira**. Na 5C, com vários processos da API ao mesmo tempo, o truque do event loop
deixa de valer e quem garante a atomicidade é a **transação** do banco.

### 5. Segurança básica

- **Helmet:** cabeçalhos de segurança em toda resposta. O `Cross-Origin-Resource-Policy` é liberado
  porque site e API ficam em endereços diferentes; quem decide quem lê as respostas é o CORS.
- **CORS:** só as origens do `.env` (`CORS_ORIGIN`).
- **Rate limit:** 300 requisições por minuto por IP no geral e 20 para criar reservas (sem isso, um robô
  poderia reservar o estádio inteiro de 6 em 6 e travar as vendas). 429 ao passar.
- **Corpo** limitado a 16 KB (413). Em produção, erro inesperado responde só "Erro interno", sem a
  mensagem nem o stack trace.
- **Segredos:** nunca no Git. `.env.example` documentado em `apps/api` e `apps/web`; o `.env` é ignorado.

### 6. Testes da API (`npm test`)

- **Suíte de contrato** (`store/storeContract.ts`): `describeStoreContract(nome, { createStore })` com os
  testes de comportamento que qualquer `TicketingStore` precisa passar (reservar, conflito tudo-ou-nada,
  vendida, inexistente, cancelar, expirar e reservar de novo, limpeza segura, 20 reservas simultâneas).
  Hoje roda contra o `InMemoryStore`; na 5C, **a mesma** roda contra o `PostgresStore`. É assim que se
  prova que a troca não muda nada.
- **API inteira** com `app.inject()` (requisições "de mentira", sem abrir porta): leitura, reserva,
  409, validação, token, expiração com relógio falso, CORS, Helmet, rate limit, 413 e 500 em produção.
- **Teste de concorrência:** 20 requisições simultâneas (`Promise.all`) pela mesma cadeira → **1 × 201 e
  19 × 409**.
- Regras puras: `domain/holds.test.ts` (validade, expiração, total, token) e `shared/src/api.test.ts`
  (máximo de 6, repetidas, ids inválidos, campos a mais descartados).

## Próximas fases

- **Fase 5B:** checkout, pagamento (provedor fake e Mercado Pago sandbox), pedidos, ingressos com QR
  code e tempo real (Server-Sent Events).
- **Fase 5C:** PostgreSQL + Prisma como implementação definitiva da `TicketingStore`.
- **Fase 6:** acabamento e deploy (Vercel + Railway/Render).
