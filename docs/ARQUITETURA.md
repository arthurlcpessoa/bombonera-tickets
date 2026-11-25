# Arquitetura

## Visão geral

A tela é montada em **duas camadas**:

```
┌───────────────────────────────────────────┐
│  Interface HTML (React + Tailwind)        │  ← botões, header, loading, créditos
│  ┌─────────────────────────────────────┐  │
│  │  <Canvas> WebGL (React Three Fiber) │  │  ← o estádio 3D
│  └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

As duas camadas não se chamam diretamente. Elas conversam pelo **store do Zustand**
(`src/store/useViewStore.ts`): o botão "Vista aérea" grava `goToPreset('aerial')` no store,
e o `CameraRig`, dentro do canvas, escuta essa mudança e anima a câmera.

## Sistema de coordenadas

O script `scripts/optimize-model.mjs` move o modelo para que **o centro do gramado fique em (0, 0, 0)**.
Unidades em **metros**, na escala real do estádio.

| Eixo | Direção                                           |
| ---- | ------------------------------------------------- |
| X    | largura do campo; **+X** é o lado reto dos palcos |
| Y    | altura (Y = 0 é o gramado)                        |
| Z    | comprimento do campo, de gol a gol                |

## Componentes 3D (`src/features/stadium/components`)

| Componente      | Responsabilidade                                                        |
| --------------- | ----------------------------------------------------------------------- |
| `StadiumCanvas` | Cria o `<Canvas>` (renderer, cena, câmera) e organiza os filhos         |
| `StadiumModel`  | Carrega o `.glb` com `useGLTF` (com cache e pré-carregamento)           |
| `Environment`   | Céu, luzes e chão ao redor                                              |
| `CameraRig`     | `CameraControls`: girar, zoom, mover, limites e animação até os presets |

## Como os setores e as cadeiras vão funcionar (fases 2 a 4)

O modelo do Sketchfab é só o **cenário**: ele não tem setores nem cadeiras individuais clicáveis.
Por cima dele vamos criar uma **camada de dados**:

1. Cada setor é descrito por uma "receita" em JSON (posição inicial, nº de filas, cadeiras por fila,
   altura e profundidade do degrau, arco da curva).
2. O código calcula a coordenada 3D de cada cadeira a partir da receita.
3. As cadeiras são desenhadas com `InstancedMesh`: um único modelo de cadeira replicado
   milhares de vezes numa só chamada à GPU, com cor por status (livre, ocupada, selecionada).
4. A visão do assento coloca a câmera na coordenada da cadeira, a ~1,2 m de altura (altura dos olhos),
   olhando para o campo.
