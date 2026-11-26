/**
 * Medidas do estádio e regras da compra, compartilhadas entre o site e a API.
 *
 * O modelo 3D foi recentralizado (scripts/optimize-model.mjs) para que o centro do gramado fique
 * na origem (0, 0, 0). Eixos (unidades em metros):
 *   X → largura do campo; +X aponta para o lado reto dos palcos
 *   Y → altura
 *   Z → comprimento do campo (de gol a gol)
 *
 * As constantes VISUAIS (câmera, cores, painel) ficam no site, em apps/web/src/config/.
 */
// Só imports de TIPO aqui: o script Node scripts/probe-stands.mjs importa este arquivo direto,
// sem bundler (imports de tipo são apagados antes de rodar, então não atrapalham).
import type { InclinedRect } from './sectorGeometry';
import type { CurvedTier, TierProfile, UPathParams } from './stadiumPath';

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
 * A tabela de correção (standCalibration.ts) é medida em cima destes valores:
 * se mudar algo aqui, rode `npm run stands:calibrate` de novo.
 */
export const TIER_PROFILES: Record<CurvedTier, TierProfile> = {
  // Inferior e média: a borda externa fica EMBAIXO da bandeja de cima (veja o "ponto cego" em
  // scripts/probe-stands.mjs). Altura = a menor borda real medida ao longo do U; offset mantém
  // a inclinação do perfil.
  lower: { innerOffset: 0, outerOffset: 16.3, innerHeight: 0, outerHeight: 6.5 },
  middle: { innerOffset: 15.6, outerOffset: 32, innerHeight: 9.2, outerHeight: 22.4 },
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

/** Medidas usadas pelos setores (as visuais, como a altura da superfície, ficam no site). */
export const SECTOR_LAYOUT = {
  /** Largura do corredor entre dois blocos vizinhos. */
  aisleWidth: 1.6,
  /** Largura de uma cadeira e profundidade de uma fila: definem quantas cadeiras cabem. */
  seatWidth: SECTOR_LAYOUT_SEAT_WIDTH,
  rowDepth: 0.8,
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
  /**
   * Folga mínima acima dos olhos (m). As últimas filas da inferior e da média ficam embaixo da
   * bandeja de cima: fila com menos folga que isto não vira cadeira à venda (seria um muro, uma
   * viga ou um corredor no modelo). Medida por `npm run stands:probe -- check`.
   */
  minHeadroom: 0.3,
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

export const PITCH = {
  width: 68,
  length: 105,
} as const;
