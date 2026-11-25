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

| Store               | O que guarda                                           | Quem escreve → quem lê                     |
| ------------------- | ------------------------------------------------------ | ------------------------------------------ |
| `useViewStore`      | visão pronta ativa (preset)                            | botões de visão → `CameraRig`              |
| `useSelectionStore` | setor sob o mouse, setor escolhido, mostrar/ocultar    | setores 3D ↔ tooltip, painel, legenda      |
| `useStandsStore`    | modelo das arquibancadas (forma + correção)            | painel `?debug` → setores 3D e `CameraRig` |
| `useSeatStore`      | cadeira em hover, cadeiras escolhidas, aviso de limite | cadeiras 3D ↔ mini-mapa, tooltip, resumo   |
| `useSeatViewStore`  | cadeira da visão do assento, zoom, visibilidade, aviso | HUD, resumo, 3D, URL ↔ `CameraRig`         |

Exemplo: clicar num setor chama `selectSector('upper-3')`. O painel HTML lê o setor escolhido e abre;
o `CameraRig`, que "assina" o store com `subscribe()`, calcula o enquadramento e voa até ele.

### O jogo à venda (`features/match`)

O topo da tela mostra o jogo do ingresso (`components/ui/MatchInfo.tsx`, que é o `h1` da página).
A partida é **fictícia**: Boca Juniors × River Plate, Campeonato Argentino, domingo 13/12/2026, 17h00.
Os dados ficam em `match/data/match.ts` (na Fase 5 virão da API) e `match/lib/formatKickoff.ts`
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

### 1. O caminho em "U" (`seating/lib/stadiumPath.ts`)

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
   modelo. A diferença vira a tabela `seating/data/standCalibration.ts` (arquivo gerado).
3. `tierPoint()` soma a correção ao offset. Erro final: ~1 cm em média, máximo ~30 cm.

O script importa o **mesmo** `stadiumPath.ts` do site: o Node 26 executa TypeScript simples
direto. Assim, a medição confere exatamente a matemática que vai para a tela.

```bash
npm run stands:probe              # perfis de altura (cabeceiras, lateral, cantos, palcos)
npm run stands:probe -- materials # materiais do modelo e onde ficam
npm run stands:probe -- check     # erro restante do modelo, ao longo do U
npm run stands:calibrate          # mede de novo e regrava a tabela de correção
```

Se mudar `STAND_PATH` ou `TIER_PROFILES` em `src/config/stadium.ts`, rode `stands:calibrate` de novo
(a correção é medida em relação a esses valores).

### 3. Setores como superfícies parametrizadas (`seating/lib/sectorGeometry.ts`)

Todo setor vira uma função **(a, b) → ponto 3D**, como um lençol esticado com coordenadas:
`a` anda ao longo do setor e `b` sobe a arquibancada. Com essa função, um único código gera:

- a **malha** (`buildSectorGeometry`): uma grade de quadradinhos, cada um com 2 triângulos;
- o **contorno** do selecionado (`sectorOutline`);
- o **enquadramento** da câmera (`sectorFrame`): centro, direção do campo e tamanho;
- a **posição de cada cadeira** (Fase 3, veja abaixo).

Há dois tipos de forma: `curved` (trecho [t0, t1] de uma bandeja do U) e `straight` (fatia da
platea dos palcos, um retângulo inclinado).

### 4. Dados (`seating/data/sectors.ts`)

- 3 bandejas × 8 blocos ao longo do U (corredores de 1,6 m) + 5 blocos de palcos = **29 setores**.
  Os palcos seguem os corredores (escadas) **reais** do modelo, medidos na Fase 3 (`PALCOS_BLOCKS_Z`).
- Faixas de preço com cor própria (`PRICE_CATEGORIES`). As cores evitam azul e amarelo, as cores
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

### 1. Geração (`seating/lib/seatLayout.ts`, TypeScript puro)

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
- **Status simulado:** semente derivada do id do setor (hash FNV-1a). As vendas saem em **grupos de 2 a
  6** (famílias e amigos) e as filas da frente vendem mais. Nada de `Math.random()`.
- **Cache:** as listas ficam guardadas por setor num `WeakMap` por modelo; se o modelo mudar
  (`?debug`), elas são geradas de novo. Gerar o estádio inteiro leva ~30 ms.
- **Fonte única:** `sectors.ts` conta as cadeiras para preencher capacidade e lugares livres.

Total: **29.089 cadeiras** (Inferior 9.433 · Média 8.395 · Superior 10.085 · Palcos 1.176). A Bombonera
real tem ~54 mil lugares, mas muitos são de pé e os camarotes não fazem parte desta camada.
O maior setor é a **Superior 3, com 1.881 cadeiras**.

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

### 5. Link compartilhável (`seatLink.ts` + `store/seatViewUrl.ts`)

- Na visão, a URL vira `?assento=upper-3:F12-C07` com `history.replaceState` (sem recarregar e sem
  encher o "voltar"). Outros parâmetros são mantidos (`?debug` continua funcionando).
- Antes do primeiro render, um link válido entra direto na visão (a câmera já nasce sentada). Id
  inválido: é ignorado, sai da URL e um aviso curto aparece. "Copiar link" usa `navigator.clipboard`.

### 6. Testes

`seatNavigation.test.ts` (vizinhas, pontas, filas de tamanhos diferentes), `seatView.test.ts` (alvo
inicial, ângulos, limites, métricas, grade e classificação) e `seatLink.test.ts` (ler/montar a URL).

## Próximas fases

- **Fase 5:** back-end (Fastify + Prisma + PostgreSQL) com o status real das cadeiras, reserva
  temporária e checkout Mercado Pago sandbox.
- **Fase 6:** acabamento e deploy (Vercel + Railway/Render).
