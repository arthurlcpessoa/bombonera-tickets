/**
 * Constantes VISUAIS do site: câmera, painel, HUD e visão do assento.
 * As medidas do estádio e as regras da compra ficam em @bombonera/shared (packages/shared),
 * porque a API precisa delas também.
 */

export const STADIUM_MODEL_URL = '/models/bombonera.glb';

/** Medidas só do desenho dos setores (as do estádio vêm de @bombonera/shared). */
export const SECTOR_RENDER = {
  /**
   * Quanto a superfície colorida fica acima da arquibancada, para não "piscar" com ela.
   * Nos palcos ela passa por cima das cadeiras modeladas (assento a ~0,5 m do piso): se ficasse
   * por baixo, as cadeiras do próprio estádio "tampariam" o setor e ele não receberia o clique.
   */
  lift: { curved: 0.15, straight: 0.65 },
  /** Tamanho máximo de cada "fatia" da malha ao longo do U (menor = curva mais lisa). */
  segmentLength: 1.5,
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

/**
 * HUD da visão do assento por tamanho de tela:
 *   - desktop: cartão completo à esquerda;
 *   - celular em pé (`barQuery`): barra recolhida embaixo, que expande ao tocar;
 *   - tela baixa, como o celular deitado (até `shortMaxHeight` px de altura): cartão lateral
 *     compacto. O mesmo limite está na variante `short:` do index.css.
 */
const SEAT_HUD_SHORT_MAX_HEIGHT = 500;
export const SEAT_HUD_LAYOUT = {
  shortMaxHeight: SEAT_HUD_SHORT_MAX_HEIGHT,
  shortQuery: `(max-height: ${SEAT_HUD_SHORT_MAX_HEIGHT}px)`,
  barQuery: `(max-width: ${SECTOR_PANEL_LAYOUT.desktopMinWidth - 1}px) and (min-height: ${SEAT_HUD_SHORT_MAX_HEIGHT + 1}px)`,
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
  /**
   * Teto da visão (setor coberto): raios dos olhos em direção ao meio-campo, de 90° (reto para
   * cima) até 0°, a cada `ceilingStepDeg` graus. A altura da bola é arredondada para múltiplos de
   * `ballHeightRound` m; acima de `ballHeightMax` m, mostramos "mais de".
   */
  ceilingStepDeg: 1,
  ballHeightRound: 5,
  ballHeightMax: 100,
} as const;

/** Limites da câmera orbital para o usuário não "atravessar" o estádio. */
export const CAMERA_LIMITS = {
  minDistance: 25,
  maxDistance: 600,
  /** Ângulo máximo a partir do topo (radianos). Um pouco abaixo de 90° impede olhar por baixo do chão. */
  maxPolarAngle: Math.PI * 0.47,
} as const;
