/**
 * Contas da visão do assento (TypeScript puro, sem React nem Three.js): fáceis de testar.
 */
import { PITCH, type Point3 } from '@bombonera/shared';
import { SEAT_VIEW } from '@/config/stadium';

// ---------------------------------------------------------------------------------------------
// Alvo inicial do olhar
// ---------------------------------------------------------------------------------------------

/**
 * Para onde o torcedor olha ao "sentar": um ponto do gramado bem na frente da cadeira.
 *
 * Visto de cima:
 *
 *        campo (retângulo)
 *    ┌───────────────────────┐
 *    │           ✕ centro    │      1) andamos em linha reta na direção da cadeira (yaw);
 *    │           ·           │      2) paramos no ponto dessa linha mais perto do centro do
 *    │           ● alvo      │         campo: é a "projeção" do centro sobre a linha, calculada
 *    └───────────────────────┘         com um produto escalar (quanto o centro "anda" na direção f);
 *                ↑ f                3) se o ponto cair fora do campo (cadeiras de canto), puxamos
 *                ○ olhos               para dentro do retângulo (clamp), com uma margem.
 *
 * O alvo fica no gramado (y = 0). Olhar dos olhos até ele já "inclina a cabeça para baixo" na
 * medida certa: quem está no alto olha mais para baixo, quem está na fila 1 olha quase reto.
 */
export function initialLookTarget(eye: Point3, yaw: number): Point3 {
  // Direção da cadeira no chão. Com yaw = 0 a cadeira olha para +Z (veja lib/seatLayout.ts).
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  // Projeção do centro (0, 0) na reta "olhos + t·f": t = (centro − olhos) · f
  const t = Math.max(0, -(eye[0] * fx + eye[2] * fz));
  const halfW = PITCH.width / 2 - SEAT_VIEW.fieldMargin;
  const halfL = PITCH.length / 2 - SEAT_VIEW.fieldMargin;
  return [clamp(eye[0] + fx * t, -halfW, halfW), 0, clamp(eye[2] + fz * t, -halfL, halfL)];
}

// ---------------------------------------------------------------------------------------------
// Limites para "virar a cabeça"
// ---------------------------------------------------------------------------------------------

/** Leva um ângulo (radianos) para o intervalo (−π, π]. */
export function wrapAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  const wrapped = ((((angle + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
  return wrapped === -Math.PI ? Math.PI : wrapped;
}

/**
 * Limites de azimute (giro horizontal) da câmera para quem está sentado nesta cadeira.
 *
 * A câmera orbital descreve sua posição em relação ao ponto que ela olha com um ângulo θ, medido
 * no chão (θ = atan2(x, z) do vetor "alvo → câmera"). Quem olha para a frente da cadeira tem a
 * câmera ATRÁS do alvo: θ da frente = atan2(−fx, −fz). O limite é esse ângulo ± `turnDeg`.
 *
 * Detalhe: ângulos "dão a volta" (10° e 370° são o mesmo). A câmera guarda o seu θ atual num certo
 * "trecho" da volta; por isso o centro do limite é colocado no trecho mais perto de `currentTheta`,
 * senão a câmera daria um giro de 360° para entrar no limite.
 */
export function seatAzimuthRange(
  yaw: number,
  currentTheta: number,
  turnDeg: number = SEAT_VIEW.turnDeg,
): [min: number, max: number] {
  const front = Math.atan2(-Math.sin(yaw), -Math.cos(yaw));
  const center = currentTheta + wrapAngle(front - currentTheta);
  const turn = (turnDeg * Math.PI) / 180;
  return [center - turn, center + turn];
}

/**
 * A direção do olhar `dir` (x, z no chão) está dentro do giro permitido para a cadeira?
 * Usada ao trocar de cadeira: se sim, mantemos para onde a pessoa estava olhando.
 */
export function isWithinTurn(yaw: number, dir: [x: number, z: number]): boolean {
  const angle = Math.abs(wrapAngle(Math.atan2(dir[0], dir[1]) - yaw));
  return angle <= (SEAT_VIEW.turnDeg * Math.PI) / 180;
}

// ---------------------------------------------------------------------------------------------
// Métricas da visão
// ---------------------------------------------------------------------------------------------

export interface SeatMetrics {
  /** Distância dos olhos até o centro do campo (m). */
  centerDistance: number;
  /** Distância dos olhos até o gol mais próximo (centro da linha de gol, no chão) (m). */
  goalDistance: number;
  /** Altura dos olhos em relação ao gramado (m). */
  height: number;
  /** Quantos graus de largura o campo ocupa a partir da cadeira (de um canto ao outro). */
  fieldAngleDeg: number;
}

/**
 * Métricas a partir do ponto dos olhos. O gramado está em y = 0 e o centro do campo é a origem.
 *
 * Ângulo de visão do campo: medimos, no chão, o ângulo de cada um dos 4 cantos visto dos olhos e
 * pegamos a diferença entre o mais à esquerda e o mais à direita. Os ângulos são medidos em relação
 * à direção do centro do campo, para nenhum deles "dar a volta" (passar de 180°).
 */
export function seatMetrics(eye: Point3): SeatMetrics {
  const [ex, ey, ez] = eye;
  const halfW = PITCH.width / 2;
  const halfL = PITCH.length / 2;
  const toCenter = Math.atan2(-ex, -ez);
  const corners = [
    [-halfW, -halfL],
    [halfW, -halfL],
    [-halfW, halfL],
    [halfW, halfL],
  ].map(([cx, cz]) => wrapAngle(Math.atan2(cx - ex, cz - ez) - toCenter));
  return {
    centerDistance: Math.hypot(ex, ey, ez),
    goalDistance: Math.min(Math.hypot(ex, ey, ez - halfL), Math.hypot(ex, ey, ez + halfL)),
    height: ey,
    fieldAngleDeg: ((Math.max(...corners) - Math.min(...corners)) * 180) / Math.PI,
  };
}

// ---------------------------------------------------------------------------------------------
// Visibilidade do campo
// ---------------------------------------------------------------------------------------------

/**
 * Pontos espalhados pelo gramado para testar a visibilidade: o centro de cada célula de uma
 * grade cols × rows sobre o campo, um pouco acima da grama.
 */
export function fieldSamplePoints(
  cols: number = SEAT_VIEW.visibilityGrid.cols,
  rows: number = SEAT_VIEW.visibilityGrid.rows,
  height: number = SEAT_VIEW.visibilitySampleHeight,
): Point3[] {
  const points: Point3[] = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      points.push([
        ((i + 0.5) / cols - 0.5) * PITCH.width,
        height,
        ((j + 0.5) / rows - 0.5) * PITCH.length,
      ]);
    }
  }
  return points;
}

export type VisibilityLevel = 'clear' | 'minor' | 'partial' | 'heavy';

export interface Visibility {
  level: VisibilityLevel;
  /** Porcentagem (0 a 100, inteira) dos pontos do campo escondidos por alguma estrutura. */
  blockedPercent: number;
  label: string;
}

/** Até quanto (fração) de raios bloqueados ainda conta como "visão livre": 1 ou 2 raios rentes. */
const CLEAR_MAX = 0.03;
const MINOR_MAX = 0.12;
const PARTIAL_MAX = 0.35;

/** Transforma "x de y raios bloqueados" num nível e num texto para a interface. */
export function classifyVisibility(blocked: number, total: number): Visibility {
  const share = total > 0 ? blocked / total : 0;
  const blockedPercent = Math.round(share * 100);
  if (share <= CLEAR_MAX) return { level: 'clear', blockedPercent, label: 'Visão livre' };
  if (share <= MINOR_MAX)
    return {
      level: 'minor',
      blockedPercent,
      label: `Visão quase livre (${blockedPercent}% obstruída)`,
    };
  if (share <= PARTIAL_MAX)
    return {
      level: 'partial',
      blockedPercent,
      label: `Visão parcialmente obstruída (${blockedPercent}%)`,
    };
  return { level: 'heavy', blockedPercent, label: `Visão bastante obstruída (${blockedPercent}%)` };
}

// ---------------------------------------------------------------------------------------------
// Teto da visão: setor coberto ou descoberto
// ---------------------------------------------------------------------------------------------

/**
 * Raio do "teto": sai dos olhos na direção do centro do campo, inclinado `elevationDeg` acima do
 * horizonte, e para quando chega em cima do meio-campo (`far`). Não interessa o que está além
 * (a arquibancada do outro lado), só o que fica entre o torcedor e a bola.
 *
 *            ╱ 90°: reto para cima
 *     ▓▓▓▓▓▓╱▓▓ bandeja de cima       ← a varredura desce de 90° até achar um raio livre
 *       ●──╱───── 5°: ainda bate?
 *     olhos ─────────────────── ✕ meio-campo
 */
export function ceilingRay(eye: Point3, elevationDeg: number): { direction: Point3; far: number } {
  const h = Math.hypot(eye[0], eye[2]) || 1; // distância no chão até o centro do campo
  const r = (elevationDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  return {
    direction: [(-eye[0] / h) * cos, Math.sin(r), (-eye[2] / h) * cos],
    // Em 90° o raio nunca chega "em cima do meio-campo": vai até o céu.
    far: cos > 1e-6 ? h / cos : Infinity,
  };
}

/**
 * Varre os ângulos de cima para baixo (90°, 89°, …, 0°) enquanto o raio bate em alguma estrutura.
 * O teto é o MENOR ângulo dessa faixa bloqueada que começa no zênite (reto para cima).
 *
 * Por que de cima para baixo: o que interessa é a cobertura, o "telhado" sobre a cadeira.
 * Um obstáculo baixo e isolado (corrimão, mureta) não é telhado: quem cuida dele é a visibilidade
 * do campo. Se o raio reto para cima já sai livre, não há nada sobre a cadeira: `null`.
 *
 * @param isBlocked diz se o raio naquele ângulo (graus) bate em algo
 * @returns ângulo do teto em graus, ou null = descoberto
 */
export function findCeiling(
  isBlocked: (elevationDeg: number) => boolean,
  stepDeg: number = SEAT_VIEW.ceilingStepDeg,
): number | null {
  let ceiling: number | null = null;
  for (let deg = 90; deg >= 0; deg -= stepDeg) {
    if (!isBlocked(deg)) break;
    ceiling = deg;
  }
  return ceiling;
}

export interface Cover {
  covered: boolean;
  /** Altura (m, acima da grama) até onde a bola fica visível sobre o meio-campo. null = sem limite. */
  ballHeight: number | null;
  label: string;
  detail: string;
}

/**
 * Texto do teto da visão, a partir do ângulo medido por `findCeiling`.
 *
 * Altura da bola: no limite do teto, a linha de visão sobe `tan(ângulo)` metros a cada metro
 * andado no chão. Até o meio-campo (distância h no chão), sobe h × tan(ângulo), a partir dos olhos.
 */
export function classifyCover(eye: Point3, ceilingDeg: number | null): Cover {
  if (ceilingDeg === null) {
    return { covered: false, ballHeight: null, label: 'Descoberto', detail: 'A céu aberto' };
  }
  const h = Math.hypot(eye[0], eye[2]);
  const ballHeight = Math.max(0, eye[1] + h * Math.tan((ceilingDeg * Math.PI) / 180));
  const { ballHeightRound, ballHeightMax } = SEAT_VIEW;
  const ball =
    ballHeight > ballHeightMax
      ? `mais de ${ballHeightMax} m`
      : `~${Math.max(ballHeightRound, Math.round(ballHeight / ballHeightRound) * ballHeightRound)} m`;
  return {
    covered: true,
    ballHeight,
    label: 'Setor coberto',
    detail: `Protegido de chuva e sol · bola visível até ${ball} de altura sobre o meio-campo`,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
