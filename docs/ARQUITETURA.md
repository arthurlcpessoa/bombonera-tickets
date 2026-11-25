# Arquitetura

## Visão geral

A tela é montada em **duas camadas**:

```
┌───────────────────────────────────────────┐
│  Interface HTML (React + Tailwind)        │  ← header, legenda, tooltip, painel do setor
│  ┌─────────────────────────────────────┐  │
│  │  <Canvas> WebGL (React Three Fiber) │  │  ← o estádio 3D + camada de setores
│  └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

As duas camadas não se chamam diretamente. Elas conversam pelos **stores do Zustand** (`src/store/`),
como dois setores de uma empresa que se comunicam por um quadro de avisos:

| Store               | O que guarda                                        | Quem escreve → quem lê                     |
| ------------------- | --------------------------------------------------- | ------------------------------------------ |
| `useViewStore`      | visão pronta ativa (preset)                         | botões de visão → `CameraRig`              |
| `useSelectionStore` | setor sob o mouse, setor escolhido, mostrar/ocultar | setores 3D ↔ tooltip, painel, legenda      |
| `useStandsStore`    | modelo das arquibancadas (forma + correção)         | painel `?debug` → setores 3D e `CameraRig` |

Exemplo: clicar num setor chama `selectSector('upper-3')`. O painel HTML lê o setor escolhido e abre;
o `CameraRig`, que "assina" o store com `subscribe()`, calcula o enquadramento e voa até ele.

## Sistema de coordenadas

O script `scripts/optimize-model.mjs` move o modelo para que **o centro do gramado fique em (0, 0, 0)**.
Unidades em **metros**, na escala real do estádio.

| Eixo | Direção                                           |
| ---- | ------------------------------------------------- |
| X    | largura do campo; **+X** é o lado reto dos palcos |
| Y    | altura (Y = 0 é o gramado)                        |
| Z    | comprimento do campo, de gol a gol                |

## Componentes 3D

| Componente (`src/features/...`) | Responsabilidade                                                         |
| ------------------------------- | ------------------------------------------------------------------------ |
| `stadium/StadiumCanvas`         | Cria o `<Canvas>` (renderer, cena, câmera) e organiza os filhos          |
| `stadium/StadiumModel`          | Carrega o `.glb` com `useGLTF` (com cache e pré-carregamento)            |
| `stadium/Environment`           | Céu, luzes e chão ao redor                                               |
| `stadium/CameraRig`             | `CameraControls`: girar, zoom, limites, presets e voo até o setor        |
| `seating/SectorOverlay`         | Desenha todos os setores + o bloqueador invisível sobre os palcos        |
| `seating/SectorMesh`            | Um setor: superfície translúcida, eventos de ponteiro e contorno dourado |

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
- a **capacidade estimada** (`estimateCapacity`): filas × cadeiras por fila.

Há dois tipos de forma: `curved` (trecho [t0, t1] de uma bandeja do U) e `straight` (fatia da
platea dos palcos, um retângulo inclinado). Na Fase 3, cada cadeira também será um (a, b).

### 4. Dados (`seating/data/sectors.ts`)

- 3 bandejas × 8 blocos ao longo do U + 3 blocos de palcos = **27 setores**, com corredores de 1,6 m.
- Faixas de preço com cor própria (`PRICE_CATEGORIES`). As cores evitam azul e amarelo, as cores
  das cadeiras do modelo, para não "sumirem" quando misturadas a elas.
- Disponibilidade simulada com um gerador de números **com semente** (`lib/random.ts`): parece
  aleatória, mas é sempre a mesma a cada recarga.

### 5. Interação

- **Hover:** `onPointerOver` / `onPointerOut` do React Three Fiber, com `stopPropagation()` para só o
  setor mais próximo reagir. Ignorado no toque (não existe "passar o mouse" no celular).
- **Clique × arrasto:** o evento de clique traz `e.delta` (px andados entre apertar e soltar). Acima de
  6 px foi arrasto da câmera, e o clique é ignorado.
- **Bloqueador:** o R3F só "enxerga" objetos com eventos, então daria para clicar na platea através
  do telhado dos palcos. Uma caixa invisível sobre o prédio dos palcos segura esses eventos.
- **Voo da câmera:** alvo no centro do setor; câmera entre o setor e o campo, mais alta (32° nas
  bandejas, 7° nos palcos, para olhar por baixo da laje). O _focal offset_ desloca a imagem para o
  setor não ficar atrás do painel.
- **Painel:** lateral no desktop, "gaveta" no celular, `role="dialog"`, fecha com Esc e volta à visão geral.

### 6. Modo `?debug`

Abra `http://localhost:5173/?debug`. O painel **leva** permite ajustar ao vivo o caminho em U, os perfis
e os palcos, ligar/desligar a correção e copiar os valores em JSON. Ele é carregado com `import()`
dinâmico (`React.lazy`), então fica num arquivo separado que o site normal nunca baixa.

## Próximas fases

- **Fase 3:** cadeiras com `InstancedMesh`, posicionadas por (a, b) sobre a mesma superfície do setor.
- **Fase 4:** visão do assento: a câmera vai à coordenada da cadeira, a ~1,2 m de altura, olhando o campo.
