import { describe, expect, it } from 'vitest';
import { PRICE_CATEGORIES } from '@bombonera/shared';
import { CATEGORY_COLORS } from './colors';

describe('CATEGORY_COLORS', () => {
  it('toda faixa de preço tem uma cor, e cada faixa tem uma cor diferente', () => {
    const colors = PRICE_CATEGORIES.map((c) => CATEGORY_COLORS[c.id].toLowerCase());
    expect(colors.every(Boolean)).toBe(true);
    expect(new Set(colors).size).toBe(colors.length);
  });
});
