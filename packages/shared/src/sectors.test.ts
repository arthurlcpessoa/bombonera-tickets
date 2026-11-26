/**
 * Testes dos dados dos setores. Rode com `npm test`.
 */
import { describe, expect, it } from 'vitest';
import { getCategory, isAwaySector, PRICE_CATEGORIES, SECTORS } from './sectors';

describe('setor visitante', () => {
  it('existe exatamente um setor visitante, e ele é o upper-8', () => {
    const away = SECTORS.filter(isAwaySector);
    expect(away.map((s) => s.id)).toEqual(['upper-8']);
  });

  it('usa a faixa própria "visitante", com o preço da Superior', () => {
    const [away] = SECTORS.filter(isAwaySector);
    expect(away.name).toBe('Visitante');
    expect(away.categoryId).toBe('visitante');
    expect(getCategory('visitante').price).toBe(getCategory('superior').price);
  });

  it('todos os outros setores são da torcida da casa', () => {
    const others = SECTORS.filter((s) => s.id !== 'upper-8');
    expect(others.some(isAwaySector)).toBe(false);
  });
});

describe('PRICE_CATEGORIES', () => {
  it('cada faixa tem um id único e preço inteiro positivo', () => {
    const ids = PRICE_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of PRICE_CATEGORIES) {
      expect(Number.isInteger(c.price)).toBe(true);
      expect(c.price).toBeGreaterThan(0);
    }
  });
});
