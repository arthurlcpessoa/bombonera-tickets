/**
 * Contas da visão do assento (TypeScript puro, sem React nem Three.js): fáceis de testar.
 */
import { PITCH, SEAT_VIEW } from '@/config/stadium';
import type { Point3 } from './stadiumPath';

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

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
