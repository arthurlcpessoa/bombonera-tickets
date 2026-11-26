/**
 * Malha 3D (Three.js) de um setor, a partir da superfície matemática do @bombonera/shared.
 * Fica no site porque desenhar é assunto do navegador: a API só precisa da matemática.
 */
import { BufferGeometry, Float32BufferAttribute } from 'three';
import {
  type SectorShape,
  sectorSurface,
  segmentsAlong,
  type StandsModel,
} from '@bombonera/shared';

/**
 * Gera a malha (BufferGeometry) de um setor: uma grade de (nA × nB) quadradinhos, cada um
 * formado por 2 triângulos.
 *
 * @param lift quanto subir a superfície (m), para ela não "brigar" com a arquibancada do modelo
 */
export function buildSectorGeometry(
  shape: SectorShape,
  model: StandsModel,
  { lift = 0, maxSegment = 1.5, segmentsB = 2 } = {},
): BufferGeometry {
  const surface = sectorSurface(shape, model);
  const nA = segmentsAlong(shape, model, maxSegment);
  const nB = segmentsB;

  // 1) Vértices: uma grade de (nA + 1) × (nB + 1) pontos sobre a superfície.
  const positions: number[] = [];
  for (let i = 0; i <= nA; i++) {
    for (let j = 0; j <= nB; j++) {
      const [x, y, z] = surface(i / nA, j / nB);
      positions.push(x, y + lift, z);
    }
  }

  // 2) Triângulos: cada quadradinho da grade vira dois triângulos (índices dos vértices).
  const indices: number[] = [];
  const at = (i: number, j: number) => i * (nB + 1) + j;
  for (let i = 0; i < nA; i++) {
    for (let j = 0; j < nB; j++) {
      indices.push(at(i, j), at(i + 1, j), at(i, j + 1));
      indices.push(at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
