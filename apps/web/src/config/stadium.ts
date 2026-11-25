/**
 * Constantes do estádio. O modelo foi recentralizado (scripts/optimize-model.mjs)
 * para que o centro do gramado fique na origem (0, 0, 0).
 *
 * Eixos (unidades em metros):
 *   X → largura do campo; +X aponta para o lado reto dos palcos
 *   Y → altura
 *   Z → comprimento do campo (de gol a gol)
 */
export const STADIUM_MODEL_URL = '/models/bombonera.glb';

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
