/**
 * O "molde" 3D de uma cadeira, desenhado milhares de vezes pelo InstancedMesh.
 *
 * Simples de propósito: um assento e um encosto (duas caixas), juntados numa geometria só com
 * mergeGeometries. Poucos triângulos por cadeira = milhares de cadeiras a 60 fps.
 *
 * Dois moldes:
 * - Bandejas curvas: lá as cadeiras do modelo são só uma textura, então desenhamos uma cadeira
 *   de verdade (assento + encosto) apoiada na arquibancada.
 * - Palcos: o modelo já tem cadeiras 3D. Uma segunda cadeira "dentro" delas brigaria com o
 *   modelo, então usamos uma "capa": a mesma cadeira, um pouco maior que a modelada, na mesma
 *   posição (as fileiras e o passo dos palcos foram medidos no .glb). A cadeira real fica embrulhada
 *   e aparece "pintada" com a cor do status.
 *
 * Convenção: a cadeira olha para +Z (a frente do assento) e o encosto fica em −Z.
 * A origem (0, 0, 0) é o ponto Seat.position (o piso da arquibancada).
 */
import { BoxGeometry, type BufferGeometry } from 'three';
import type { SectorShape } from './sectorGeometry';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Medidas de uma cadeira (m). */
interface ChairDimensions {
  width: number;
  /** Assento: espessura e profundidade. */
  seatThickness: number;
  seatDepth: number;
  /** Altura do assento acima do piso. */
  seatHeight: number;
  /** Encosto: altura acima do assento e espessura. */
  backHeight: number;
  backThickness: number;
}

/** Cadeira desenhada nas bandejas curvas (apoiada na textura da arquibancada). */
export const SEAT_MODEL: ChairDimensions = {
  width: 0.42,
  seatThickness: 0.06,
  seatDepth: 0.36,
  seatHeight: 0.16,
  backHeight: 0.3,
  backThickness: 0.05,
};

/**
 * "Capa" das cadeiras modeladas dos palcos: assento a ~0,3 m do piso (medido com
 * npm run stands:probe) e encosto até ~0,95 m (ajustado olhando o resultado: o encosto real é
 * fino demais para os raios verticais do script). Um pouco maior que a cadeira real, para cobri-la.
 */
export const PALCOS_COVER_MODEL: ChairDimensions = {
  width: 0.44,
  seatThickness: 0.08,
  seatDepth: 0.42,
  seatHeight: 0.3,
  backHeight: 0.65,
  backThickness: 0.1,
};

export function createSeatGeometry(m: ChairDimensions = SEAT_MODEL): BufferGeometry {
  const seat = new BoxGeometry(m.width, m.seatThickness, m.seatDepth);
  seat.translate(0, m.seatHeight, 0);

  const back = new BoxGeometry(m.width, m.backHeight, m.backThickness);
  back.translate(
    0,
    m.seatHeight + m.backHeight / 2,
    -(m.seatDepth / 2) + m.backThickness / 2, // na borda de trás do assento
  );

  const merged = mergeGeometries([seat, back]);
  seat.dispose();
  back.dispose();
  return merged;
}

/** O molde certo para cada tipo de setor. */
export function createSeatMarkerGeometry(kind: SectorShape['kind']): BufferGeometry {
  return createSeatGeometry(kind === 'straight' ? PALCOS_COVER_MODEL : SEAT_MODEL);
}
