import { describe, expect, it } from 'vitest';
import { formatKickoff } from './formatKickoff';

describe('formatKickoff', () => {
  it('formata data e hora no fuso de Buenos Aires', () => {
    expect(formatKickoff('2026-12-13T17:00:00-03:00')).toEqual({
      date: 'Dom, 13 dez',
      time: '17h00',
    });
  });

  it('não depende do fuso de quem abre o site', () => {
    // Mesmo instante escrito em UTC: continua 17h00 em Buenos Aires.
    expect(formatKickoff('2026-12-13T20:00:00Z').time).toBe('17h00');
  });
});
