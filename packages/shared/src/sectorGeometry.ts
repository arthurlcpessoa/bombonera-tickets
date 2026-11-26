/**
 * Geometria dos setores: a forma de cada setor como uma superfície matemática.
 * (A malha 3D desenhada pelo site, com Three.js, fica em apps/web: features/seating/lib/sectorGeometry.ts.)
 *
 * Ideia central: todo setor é uma "superfície parametrizada", uma função (a, b) → ponto 3D,
 * como um lençol esticado com coordenadas:
 *   a ∈ [0, 1] → anda AO LONGO do setor (de uma ponta à outra)
 *   b ∈ [0, 1] → SOBE a arquibancada (da borda interna à externa)
 *
 * Com essa função, a malha (no site), o contorno e o centro são o mesmo código para as bandejas
 * curvas e para os palcos. Cada cadeira também é um (a, b): veja seatLayout.ts.
 */
import {
  pathLength,
  samplePath,
  tierOffset,
  tierPoint,
  type CurvedTier,
  type Point3,
  type TierCorrection,
  type TierProfile,
  type UPathParams,
} from './stadiumPath';

/** Retângulo inclinado (palcos): da borda da frente (perto do campo) à de trás. */
export interface InclinedRect {
  frontX: number;
  frontY: number;
  backX: number;
  backY: number;
}

/** Forma de um setor. */
export type SectorShape =
  /** Trecho [t0, t1] do caminho em U, numa das bandejas curvas. */
  | { kind: 'curved'; tier: CurvedTier; t0: number; t1: number }
  /** Fatia [z0, z1] da platea dos palcos (lado reto +X). */
  | { kind: 'straight'; z0: number; z1: number };

/** Tudo o que descreve as arquibancadas (vem de stadium.ts, ou do painel ?debug do site). */
export interface StandsModel {
  path: UPathParams;
  profiles: Record<CurvedTier, TierProfile>;
  /** Tabela de correção medida; `null` desliga a correção (útil ao calibrar no ?debug). */
  corrections: Record<CurvedTier, TierCorrection> | null;
  palcos: InclinedRect;
}

/** Superfície parametrizada: (a ao longo, b subindo) → ponto 3D. */
export type Surface = (a: number, b: number) => Point3;

/** Cria a função-superfície de um setor. */
export function sectorSurface(shape: SectorShape, model: StandsModel): Surface {
  if (shape.kind === 'curved') {
    const profile = model.profiles[shape.tier];
    const correction = model.corrections?.[shape.tier];
    return (a, b) =>
      tierPoint(lerp(shape.t0, shape.t1, a), b, model.path, profile, correction ?? undefined);
  }
  const r = model.palcos;
  return (a, b) => [
    lerp(r.frontX, r.backX, b),
    lerp(r.frontY, r.backY, b),
    lerp(shape.z0, shape.z1, a),
  ];
}

/** Comprimento do setor (metros), medido no meio da bandeja (b = 0,5). */
export function sectorLength(shape: SectorShape, model: StandsModel): number {
  if (shape.kind === 'straight') return Math.abs(shape.z1 - shape.z0);
  // No caminho-base, t é proporcional à distância; nos cantos, quem está mais para fora anda mais:
  // cada canto (¼ de círculo) ganha (π/2) × offset. Somamos essa diferença proporcionalmente.
  const offset = tierOffset(model.profiles[shape.tier], (shape.t0 + shape.t1) / 2, 0.5);
  const total = pathLength(model.path) + Math.PI * offset;
  return Math.abs(shape.t1 - shape.t0) * total;
}

/** Profundidade horizontal do setor (metros), da borda interna à externa. */
export function sectorDepth(shape: SectorShape, model: StandsModel): number {
  if (shape.kind === 'straight') return Math.abs(model.palcos.backX - model.palcos.frontX);
  const p = model.profiles[shape.tier];
  return Math.abs(p.outerOffset - p.innerOffset);
}

/** Quantas fatias usar ao longo do setor para a curva ficar lisa. */
export function segmentsAlong(shape: SectorShape, model: StandsModel, maxSegment: number): number {
  if (shape.kind === 'straight') return 1; // reta: uma fatia basta
  return Math.max(2, Math.ceil(sectorLength(shape, model) / maxSegment));
}

/** Contorno fechado do setor (para a borda dourada do selecionado). */
export function sectorOutline(
  shape: SectorShape,
  model: StandsModel,
  { lift = 0, maxSegment = 1.5 } = {},
): Point3[] {
  const surface = sectorSurface(shape, model);
  const n = segmentsAlong(shape, model, maxSegment);
  const up = ([x, y, z]: Point3): Point3 => [x, y + lift, z];
  const points: Point3[] = [];
  for (let i = 0; i <= n; i++) points.push(up(surface(i / n, 0))); // borda interna →
  for (let i = n; i >= 0; i--) points.push(up(surface(i / n, 1))); // ← borda externa
  points.push(points[0]); // fecha o laço
  return points;
}

/** O que a câmera precisa para enquadrar um setor. */
export interface SectorFrame {
  /** Centro da superfície do setor. */
  center: Point3;
  /** Direção horizontal (x, z) do setor para o campo: de onde a câmera deve olhar. */
  toField: [x: number, z: number];
  /** Maior dimensão do setor (m). */
  size: number;
}

export function sectorFrame(shape: SectorShape, model: StandsModel): SectorFrame {
  const center = sectorSurface(shape, model)(0.5, 0.5);
  const size = Math.max(sectorLength(shape, model), sectorDepth(shape, model));
  if (shape.kind === 'straight') return { center, toField: [-1, 0], size };
  // A normal do caminho aponta para fora do campo; para o campo é o contrário.
  const p = samplePath((shape.t0 + shape.t1) / 2, model.path);
  return { center, toField: [-p.nx, -p.nz], size };
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}
