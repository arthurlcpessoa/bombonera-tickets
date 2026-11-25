/**
 * Constantes do estádio. O modelo foi recentralizado (scripts/optimize-model.mjs)
 * para que o centro do gramado fique na origem (0, 0, 0).
 *
 * Eixos (unidades em metros):
 *   X → largura do campo; +X aponta para o lado reto dos palcos
 *   Y → altura
 *   Z → comprimento do campo (de gol a gol)
 */
// Só imports de TIPO aqui: o script Node scripts/probe-stands.mjs importa este arquivo, e o Node
// não entende o alias "@/" (imports de tipo são apagados antes de rodar, então não atrapalham).
import type { InclinedRect } from '@/features/seating/lib/sectorGeometry';
import type { CurvedTier, TierProfile, UPathParams } from '@/features/seating/lib/stadiumPath';

export const STADIUM_MODEL_URL = '/models/bombonera.glb';

/**
 * Caminho-base em "U" das bandejas curvas ≈ borda interna da bandeja inferior (rente ao fosso).
 * Medido com `npm run stands:probe` e ajustável ao vivo no modo ?debug.
 */
export const STAND_PATH: UPathParams = {
  sideX: -46.5,
  endZ: 66.6,
  cornerRadius: 30,
  tipX: 39,
};

/**
 * Perfil (corte lateral) de cada bandeja, relativo ao caminho-base.
 * A tabela de correção (data/standCalibration.ts) é medida em cima destes valores:
 * se mudar algo aqui, rode `npm run stands:calibrate` de novo.
 */
export const TIER_PROFILES: Record<CurvedTier, TierProfile> = {
  lower: { innerOffset: 0, outerOffset: 14.3, innerHeight: 0, outerHeight: 5.7 },
  middle: { innerOffset: 15.6, outerOffset: 26.5, innerHeight: 9.2, outerHeight: 18 },
  upper: { innerOffset: 25.8, outerOffset: 37.8, innerHeight: 24.1, outerHeight: 34.8 },
};

/**
 * Platea dos palcos (lado reto +X): 6 degraus baixos sob a laje dos camarotes, com cadeiras
 * modeladas no .glb. Descrita como um retângulo inclinado (borda da frente → borda de trás).
 *
 * Medida com `npm run stands:probe`: as fileiras de cadeiras ficam em x ≈ 37,5 / 38,4 / 39,15 /
 * 40,0 / 40,85 / 41,65, com o piso em y ≈ 4,1 … 7,4. A rampa abaixo passa pelo piso de cada
 * degrau e as 6 filas (0,8 m cada) caem exatamente sobre as fileiras reais.
 */
export const PALCOS_PLATEA: InclinedRect = {
  frontX: 37.085,
  frontY: 3.758,
  backX: 42.065,
  backY: 7.749,
};

/**
 * Blocos da platea [z0, z1], entre os corredores (escadas) reais do modelo. Cada bloco vai da
 * borda da primeira à borda da última cadeira modelada (centro ± meio passo), para as cadeiras
 * geradas caírem em cima das reais. Pontas com poucas cadeiras (|z| > 51) ficam de fora.
 */
export const PALCOS_BLOCKS_Z: readonly (readonly [number, number])[] = [
  [-51.05, -32.22],
  [-30.5, -11.67],
  [-9.95, 9.23],
  [11.15, 29.98],
  [31.65, 50.48],
];

const SECTOR_LAYOUT_SEAT_WIDTH = 0.5;

/** Medidas usadas pelos setores. */
export const SECTOR_LAYOUT = {
  /**
   * Quanto a superfície colorida fica acima da arquibancada, para não "piscar" com ela.
   * Nos palcos ela passa por cima das cadeiras modeladas (assento a ~0,5 m do piso): se ficasse
   * por baixo, as cadeiras do próprio estádio "tampariam" o setor e ele não receberia o clique.
   */
  lift: { curved: 0.15, straight: 0.65 },
  /** Largura do corredor entre dois blocos vizinhos. */
  aisleWidth: 1.6,
  /** Largura de uma cadeira e profundidade de uma fila: definem quantas cadeiras cabem. */
  seatWidth: SECTOR_LAYOUT_SEAT_WIDTH,
  rowDepth: 0.8,
  /** Tamanho máximo de cada "fatia" da malha ao longo do U (menor = curva mais lisa). */
  segmentLength: 1.5,
} as const;

/** Medidas das cadeiras (Fase 3). A profundidade da fila vem de SECTOR_LAYOUT.rowDepth. */
export const SEAT_LAYOUT = {
  /**
   * Distância entre os centros de duas cadeiras vizinhas (m). Nas bandejas curvas, a largura
   * padrão; nos palcos, o passo MEDIDO das cadeiras modeladas, para coincidir com elas.
   */
  pitch: { curved: SECTOR_LAYOUT_SEAT_WIDTH, straight: 0.482 },
  /** Espaço livre em cada ponta da fila (m). Nos palcos o bloco já começa na borda da cadeira. */
  rowEndMargin: { curved: 0.35, straight: 0 },

  /** Altura dos olhos de quem está sentado, acima do assento (m). Usada na Fase 4. */
  eyeHeight: 1.15,
  /** Os olhos ficam um pouco atrás do centro do assento (m), perto do encosto. */
  eyeBack: 0.08,
  /** Passo da "fita métrica" que mede cada fila (m). Menor = cadeiras mais bem espaçadas. */
  rowSampleSpacing: 0.2,
  /** Passo das "diferenças finitas" usadas para achar a inclinação da arquibancada. */
  slopeStep: 0.01,
} as const;

/** Regras da compra. */
export const ORDER_RULES = {
  /** Máximo de cadeiras por compra. */
  maxSeats: 6,
} as const;

/**
 * Enquadramento da câmera ao voar até um setor. Desde a Fase 3 o setor escolhido mostra as
 * cadeiras, então a câmera chega mais perto (cada cadeira tem só 0,5 m).
 */
export const SECTOR_CAMERA = {
  /** Ângulo acima do horizonte (graus). Os palcos ficam sob uma laje: é preciso olhar mais de lado. */
  elevationDeg: { curved: 34, straight: 12 },
  /** Distância = maior dimensão do setor × fator (com mínimo e máximo, em metros). */
  distanceFactor: 0.8,
  minDistance: 26,
  maxDistance: 65,
  /** Em telas verticais (celular em pé) o campo de visão horizontal é estreito: afasta mais. */
  portraitZoomOut: 1.5,
} as const;

/**
 * Medidas do painel do setor, compartilhadas entre o HTML (SectorPanel) e a câmera (CameraRig),
 * que desloca a imagem para o setor não ficar escondido atrás do painel.
 */
export const SECTOR_PANEL_LAYOUT = {
  /** A partir desta largura de tela (px), o painel é lateral; abaixo, é uma "gaveta" embaixo. */
  desktopMinWidth: 768,
  /** Largura do painel lateral, incluindo a margem (px). */
  sideWidth: 384,
  /** Altura aproximada da gaveta no celular (px), com o mini-mapa de cadeiras. */
  sheetHeight: 430,
} as const;

export const PITCH = {
  width: 68,
  length: 105,
} as const;

/**
 * Visão do assento (Fase 4): câmera em primeira pessoa nos olhos do torcedor.
 * Ângulos em graus; distâncias em metros.
 */
export const SEAT_VIEW = {
  /**
   * Planos de corte da câmera no modo assento. A fila da frente está a menos de 1 m dos olhos:
   * com o near padrão (0,5 m) ela seria "cortada". O far cobre o céu (um cubo que vai até ~2,6 km).
   */
  near: 0.05,
  far: 3000,
  /** O ponto em volta do qual a câmera gira fica a poucos centímetros à frente dos olhos. */
  lookAhead: 0.05,
  /** Quanto dá para virar a cabeça para cada lado, a partir da frente da cadeira. */
  turnDeg: 110,
  /** Quanto dá para olhar para cima (acima do horizonte) e para baixo. */
  lookUpDeg: 25,
  lookDownDeg: 65,
  /** Sensibilidade do arrastar (negativa na câmera: arrastar "puxa" a paisagem, como no Street View). */
  rotateSpeed: 0.35,
  /** Binóculo: zoom da lente, de 1× a 3×, e o passo das teclas +/−. */
  maxZoom: 3,
  zoomStep: 0.25,
  /** O alvo inicial do olhar fica pelo menos a esta distância das linhas do campo. */
  fieldMargin: 4,
  /**
   * Visibilidade do campo: uma grade de pontos sobre o gramado (colunas na largura × linhas no
   * comprimento = 60 raios), a esta altura acima da grama (m), mais ou menos a da bola e dos pés.
   */
  visibilityGrid: { cols: 6, rows: 10 },
  visibilitySampleHeight: 0.3,
  /** Um raio só conta como bloqueado se bater em algo antes de chegar a esta distância do ponto (m). */
  visibilityTolerance: 0.5,
  /**
   * Os raios começam um pouco à frente dos olhos (m): o que estiver mais perto que isso seria a
   * própria cabeça encostando (ex.: cadeiras geradas rentes a uma divisória de camarote).
   */
  visibilityNear: 0.25,
} as const;

/** Limites da câmera orbital para o usuário não "atravessar" o estádio. */
export const CAMERA_LIMITS = {
  minDistance: 25,
  maxDistance: 600,
  /** Ângulo máximo a partir do topo (radianos). Um pouco abaixo de 90° impede olhar por baixo do chão. */
  maxPolarAngle: Math.PI * 0.47,
} as const;
