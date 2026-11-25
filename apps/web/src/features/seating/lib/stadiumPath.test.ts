/**
 * Testes do caminho em U. Rode com `npm test`.
 * Cada `it(...)` é uma afirmação que deve ser verdadeira; `expect(x).toBe(y)` confere o resultado.
 */
import { describe, expect, it } from 'vitest';
import { STAND_PATH, TIER_PROFILES } from '@/config/stadium';
import { pathLength, samplePath, tierHeight, tierOffset, tierPoint } from './stadiumPath';

describe('samplePath (caminho em U)', () => {
  it('começa e termina nas pontas do U, perto dos palcos', () => {
    const start = samplePath(0, STAND_PATH);
    const end = samplePath(1, STAND_PATH);
    expect(start.x).toBeCloseTo(STAND_PATH.tipX);
    expect(start.z).toBeCloseTo(-STAND_PATH.endZ);
    expect(end.x).toBeCloseTo(STAND_PATH.tipX);
    expect(end.z).toBeCloseTo(STAND_PATH.endZ);
  });

  it('passa pelo meio da lateral −X em t = 0,5, com a normal apontando para −X', () => {
    const mid = samplePath(0.5, STAND_PATH);
    expect(mid.x).toBeCloseTo(STAND_PATH.sideX);
    expect(mid.z).toBeCloseTo(0);
    expect(mid.nx).toBeCloseTo(-1);
    expect(mid.nz).toBeCloseTo(0);
  });

  it('é simétrico: t e 1 − t são espelhos em z', () => {
    for (const t of [0.05, 0.2, 0.3, 0.45]) {
      const a = samplePath(t, STAND_PATH);
      const b = samplePath(1 - t, STAND_PATH);
      expect(a.x).toBeCloseTo(b.x);
      expect(a.z).toBeCloseTo(-b.z);
    }
  });

  it('é contínuo e t é proporcional à distância percorrida', () => {
    const steps = 2000;
    const expectedStep = pathLength(STAND_PATH) / steps;
    let prev = samplePath(0, STAND_PATH);
    for (let i = 1; i <= steps; i++) {
      const p = samplePath(i / steps, STAND_PATH);
      // Num caminho sem "saltos", passos iguais de t andam a mesma distância.
      expect(Math.hypot(p.x - prev.x, p.z - prev.z)).toBeCloseTo(expectedStep, 3);
      prev = p;
    }
  });

  it('a normal sempre tem tamanho 1 e aponta para fora do campo', () => {
    for (let t = 0; t <= 1; t += 0.01) {
      const p = samplePath(t, STAND_PATH);
      expect(Math.hypot(p.nx, p.nz)).toBeCloseTo(1);
      // "Para fora" = andar pela normal afasta o ponto do centro do campo.
      const farther = Math.hypot(p.x + p.nx, p.z + p.nz) > Math.hypot(p.x, p.z);
      expect(farther).toBe(true);
    }
  });
});

describe('perfil e tierPoint', () => {
  it('as bordas da bandeja ficam nas alturas e distâncias do perfil', () => {
    const profile = TIER_PROFILES.upper;
    expect(tierHeight(profile, 0)).toBe(profile.innerHeight);
    expect(tierHeight(profile, 1)).toBe(profile.outerHeight);
    expect(tierOffset(profile, 0.3, 0)).toBe(profile.innerOffset);
    expect(tierOffset(profile, 0.3, 1)).toBe(profile.outerOffset);
  });

  it('soma a correção medida, interpolando entre as bordas', () => {
    const profile = TIER_PROFILES.lower;
    const correction = { inner: [1, 1], outer: [3, 3] };
    // No meio da bandeja (u = 0,5) a correção é a média das duas bordas: (1 + 3) / 2 = 2.
    const base = tierOffset(profile, 0.5, 0.5);
    expect(tierOffset(profile, 0.5, 0.5, correction)).toBeCloseTo(base + 2);
  });

  it('tierPoint sobe a arquibancada: u maior → mais alto e mais longe do campo', () => {
    const low = tierPoint(0.5, 0.1, STAND_PATH, TIER_PROFILES.middle);
    const high = tierPoint(0.5, 0.9, STAND_PATH, TIER_PROFILES.middle);
    expect(high[1]).toBeGreaterThan(low[1]);
    expect(Math.hypot(high[0], high[2])).toBeGreaterThan(Math.hypot(low[0], low[2]));
  });
});
