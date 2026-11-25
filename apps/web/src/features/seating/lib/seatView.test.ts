import { describe, expect, it } from 'vitest';
import { PITCH, SEAT_VIEW } from '@/config/stadium';
import { initialLookTarget, isWithinTurn, seatAzimuthRange, wrapAngle } from './seatView';

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
