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
 * Platea dos palcos (lado reto +X): degraus baixos sob a laje dos camarotes.
 * Descrita como um retângulo inclinado: borda da frente (perto do campo) e borda de trás.
 */
export const PALCOS_PLATEA: InclinedRect = {
  frontX: 36.8,
  frontY: 4,
  backX: 41.6,
  backY: 7.4,
  zMin: -54,
  zMax: 54,
};

/**
 * Caixa invisível sobre o prédio dos palcos (laje, camarotes e telhado). Ela "segura" o ponteiro
 * para que não dê para clicar na platea através do telhado. [mínimo xyz, máximo xyz]
 */
export const PALCOS_OCCLUDER = { min: [36.5, 8.8, -56], max: [44.6, 23, 56] } as const;

/** Medidas usadas pelos setores. */
export const SECTOR_LAYOUT = {
  /** Quanto a superfície colorida fica acima da arquibancada, para não "piscar" com ela. */
  lift: 0.15,
  /** Largura do corredor entre dois blocos vizinhos. */
  aisleWidth: 1.6,
  /** Largura de uma cadeira e profundidade de uma fila: usadas para estimar a capacidade. */
  seatWidth: 0.5,
  rowDepth: 0.8,
  /** Tamanho máximo de cada "fatia" da malha ao longo do U (menor = curva mais lisa). */
  segmentLength: 1.5,
} as const;

/** Enquadramento da câmera ao voar até um setor. */
export const SECTOR_CAMERA = {
  /** Ângulo acima do horizonte (graus). Os palcos ficam sob uma laje: é preciso olhar mais de lado. */
  elevationDeg: { curved: 32, straight: 7 },
  /** Distância = maior dimensão do setor × fator (com mínimo e máximo, em metros). */
  distanceFactor: 1.25,
  minDistance: 35,
  maxDistance: 110,
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
  /** Altura aproximada da gaveta no celular (px). */
  sheetHeight: 300,
} as const;

export const PITCH = {
  width: 68,
  length: 105,
} as const;

/** Limites da câmera orbital para o usuário não "atravessar" o estádio. */
export const CAMERA_LIMITS = {
  minDistance: 25,
  maxDistance: 600,
  /** Ângulo máximo a partir do topo (radianos). Um pouco abaixo de 90° impede olhar por baixo do chão. */
  maxPolarAngle: Math.PI * 0.47,
} as const;
