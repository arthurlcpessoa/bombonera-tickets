import { describe, expect, it } from 'vitest';
import { SEAT_VIEW } from '@/config/stadium';
import { PITCH } from '@bombonera/shared';
import {
  ceilingRay,
  classifyCover,
  classifyVisibility,
  findCeiling,
  fieldSamplePoints,
  initialLookTarget,
  isWithinTurn,
  seatAzimuthRange,
  seatMetrics,
  wrapAngle,
} from './seatView';

const halfW = PITCH.width / 2 - SEAT_VIEW.fieldMargin;
const halfL = PITCH.length / 2 - SEAT_VIEW.fieldMargin;
const deg = (d: number) => (d * Math.PI) / 180;

describe('initialLookTarget', () => {
  it('cadeira na lateral (−X) olhando para +X mira a mesma altura do campo (mesmo z)', () => {
    const [x, y, z] = initialLookTarget([-60, 10, 20], deg(90));
    expect(x).toBeCloseTo(0);
    expect(y).toBe(0);
    expect(z).toBeCloseTo(20);
  });

  it('cadeira atrás do gol olhando para o centro mira o centro', () => {
    const [x, y, z] = initialLookTarget([0, 10, -70], 0);
    expect([x, y]).toEqual([0, 0]);
    expect(z).toBeCloseTo(0);
  });

  it('o alvo sempre fica dentro do campo, com margem (cadeiras de canto)', () => {
    for (const yaw of [0, 30, 45, 60, 135, 200, 300].map(deg)) {
      const [x, y, z] = initialLookTarget([-70, 20, -80], yaw);
      expect(y).toBe(0);
      expect(Math.abs(x)).toBeLessThanOrEqual(halfW);
      expect(Math.abs(z)).toBeLessThanOrEqual(halfL);
    }
  });
});

describe('wrapAngle', () => {
  it('leva qualquer ângulo para (−π, π]', () => {
    expect(wrapAngle(0)).toBeCloseTo(0);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(deg(370))).toBeCloseTo(deg(10));
    expect(wrapAngle(deg(-190))).toBeCloseTo(deg(170));
  });
});

describe('seatAzimuthRange', () => {
  it('centra o limite na frente da cadeira (câmera atrás do alvo), ± turnDeg', () => {
    // Cadeira olhando para +Z (yaw 0): câmera atrás = −Z → θ = atan2(0, −1) = π.
    const [min, max] = seatAzimuthRange(0, Math.PI, 110);
    expect((min + max) / 2).toBeCloseTo(Math.PI);
    expect(max - min).toBeCloseTo(deg(220));
  });

  it('coloca o limite no mesmo "trecho da volta" do ângulo atual da câmera', () => {
    // A câmera está em θ = −π + 0,1 (quase o mesmo lugar que π, mas do outro lado da volta).
    const [min, max] = seatAzimuthRange(0, -Math.PI + 0.1, 110);
    expect((min + max) / 2).toBeCloseTo(-Math.PI);
  });
});

describe('isWithinTurn', () => {
  it('aceita olhar para a frente e para os lados, recusa olhar para trás', () => {
    expect(isWithinTurn(0, [0, 1])).toBe(true);
    expect(isWithinTurn(0, [1, 0])).toBe(true); // 90°
    expect(isWithinTurn(0, [0, -1])).toBe(false); // 180°
  });
});

describe('seatMetrics', () => {
  it('fila 1 da lateral: perto do meio-campo, baixo e com o campo bem largo', () => {
    const m = seatMetrics([-46.9, 1.3, -16.9]);
    expect(m.height).toBeCloseTo(1.3);
    expect(m.centerDistance).toBeCloseTo(Math.hypot(46.9, 1.3, 16.9));
    expect(m.goalDistance).toBeCloseTo(Math.hypot(46.9, 1.3, 52.5 - 16.9));
    expect(m.fieldAngleDeg).toBeGreaterThan(120);
  });

  it('quanto mais longe, menor o ângulo que o campo ocupa', () => {
    const near = seatMetrics([-50, 5, 0]).fieldAngleDeg;
    const far = seatMetrics([-90, 35, 0]).fieldAngleDeg;
    expect(far).toBeLessThan(near);
  });

  it('atrás do gol: o gol mais perto é o da mesma cabeceira', () => {
    const m = seatMetrics([0, 10, -70]);
    expect(m.goalDistance).toBeCloseTo(Math.hypot(10, 70 - 52.5));
  });
});

describe('fieldSamplePoints', () => {
  it('gera cols × rows pontos, todos dentro do campo e na altura pedida', () => {
    const points = fieldSamplePoints(6, 10, 0.3);
    expect(points).toHaveLength(60);
    for (const [x, y, z] of points) {
      expect(Math.abs(x)).toBeLessThan(PITCH.width / 2);
      expect(Math.abs(z)).toBeLessThan(PITCH.length / 2);
      expect(y).toBe(0.3);
    }
  });
});

describe('classifyVisibility', () => {
  it('classifica pela fração de raios bloqueados', () => {
    expect(classifyVisibility(0, 60)).toMatchObject({ level: 'clear', label: 'Visão livre' });
    expect(classifyVisibility(1, 60).level).toBe('clear'); // um raio rente não muda nada
    expect(classifyVisibility(3, 60)).toMatchObject({ level: 'minor', blockedPercent: 5 });
    expect(classifyVisibility(12, 60)).toMatchObject({
      level: 'partial',
      label: 'Visão parcialmente obstruída (20%)',
    });
    expect(classifyVisibility(30, 60).level).toBe('heavy');
  });

  it('sem raios não divide por zero', () => {
    expect(classifyVisibility(0, 0).level).toBe('clear');
  });
});

describe('ceilingRay', () => {
  const eye: [number, number, number] = [-80, 23, 0]; // lateral −X, alto

  it('em 0° aponta reto para o centro do campo e para em cima do meio-campo', () => {
    const { direction, far } = ceilingRay(eye, 0);
    expect(direction[0]).toBeCloseTo(1);
    expect(direction[1]).toBeCloseTo(0);
    expect(direction[2]).toBeCloseTo(0);
    expect(far).toBeCloseTo(80);
  });

  it('em 90° aponta para cima e não tem limite', () => {
    const { direction, far } = ceilingRay(eye, 90);
    expect(direction[1]).toBeCloseTo(1);
    expect(far).toBe(Infinity);
  });

  it('a direção tem sempre tamanho 1 e o raio termina em cima do meio-campo', () => {
    for (const deg of [10, 33, 60]) {
      const { direction, far } = ceilingRay([30, 5, -70], deg);
      expect(Math.hypot(...direction)).toBeCloseTo(1);
      const end = [30 + direction[0] * far, 5 + direction[1] * far, -70 + direction[2] * far];
      expect(end[0]).toBeCloseTo(0);
      expect(end[2]).toBeCloseTo(0);
    }
  });
});

describe('findCeiling', () => {
  it('acha o menor ângulo da faixa bloqueada que começa no zênite', () => {
    expect(findCeiling((deg) => deg >= 40, 1)).toBe(40);
  });

  it('sem nada reto para cima, é descoberto (null)', () => {
    expect(findCeiling((deg) => deg < 89, 1)).toBeNull();
    expect(findCeiling(() => false, 1)).toBeNull();
  });

  it('ignora um obstáculo baixo separado do telhado (corrimão, mureta)', () => {
    expect(findCeiling((deg) => deg >= 40 || (deg >= 5 && deg <= 10), 1)).toBe(40);
  });

  it('tudo bloqueado: o teto fica no horizonte', () => {
    expect(findCeiling(() => true, 1)).toBe(0);
  });
});

describe('classifyCover', () => {
  it('sem teto: descoberto, sem limite para a bola', () => {
    const cover = classifyCover([-80, 23, 0], null);
    expect(cover.covered).toBe(false);
    expect(cover.label).toBe('Descoberto');
    expect(cover.ballHeight).toBeNull();
  });

  it('com teto: coberto, com a altura da bola sobre o meio-campo', () => {
    // 23 m + 80 m × tan(5°) ≈ 30 m
    const cover = classifyCover([-80, 23, 0], 5);
    expect(cover.covered).toBe(true);
    expect(cover.label).toBe('Setor coberto');
    expect(cover.ballHeight).toBeCloseTo(23 + 80 * Math.tan((5 * Math.PI) / 180));
    expect(cover.detail).toContain('chuva e sol');
    expect(cover.detail).toContain('~30 m');
  });

  it('quanto mais alto o teto, mais alta a bola visível', () => {
    const low = classifyCover([-60, 7, 0], 20).ballHeight!;
    const high = classifyCover([-60, 7, 0], 40).ballHeight!;
    expect(high).toBeGreaterThan(low);
  });

  it('teto muito alto vira "mais de" o limite', () => {
    expect(classifyCover([-60, 7, 0], 80).detail).toContain(`mais de ${SEAT_VIEW.ballHeightMax} m`);
  });
});
