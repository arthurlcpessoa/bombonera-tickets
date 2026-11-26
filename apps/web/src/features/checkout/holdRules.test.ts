import { describe, expect, it } from 'vitest';
import type { ActiveHold } from '@/store/useHoldStore';
import { holdMatchesSelection, isHoldExpiredLocally } from './holdRules';
import { formatCountdown } from './useCountdown';

const hold = (seatIds: string[], expiresAt = '2026-12-01T12:10:00Z'): ActiveHold => ({
  holdId: 'h1',
  token: 't',
  matchId: 'jogo',
  expiresAt,
  seats: seatIds.map((seatId) => ({
    seatId,
    sectorId: 'lower-4',
    row: 1,
    number: 1,
    priceCents: 1,
  })),
  totalCents: seatIds.length,
});

describe('holdMatchesSelection', () => {
  it('vale quando a seleção é exatamente a da reserva, em qualquer ordem', () => {
    expect(holdMatchesSelection(hold(['a', 'b']), ['b', 'a'])).toBe(true);
  });

  it('não vale sem reserva, com cadeira a mais ou a menos, ou trocada', () => {
    expect(holdMatchesSelection(null, ['a'])).toBe(false);
    expect(holdMatchesSelection(hold(['a', 'b']), ['a'])).toBe(false);
    expect(holdMatchesSelection(hold(['a']), ['a', 'b'])).toBe(false);
    expect(holdMatchesSelection(hold(['a', 'b']), ['a', 'c'])).toBe(false);
  });
});

describe('isHoldExpiredLocally', () => {
  it('vence no instante marcado', () => {
    const h = hold(['a'], '2026-12-01T12:10:00Z');
    expect(isHoldExpiredLocally(h, Date.parse('2026-12-01T12:09:59Z'))).toBe(false);
    expect(isHoldExpiredLocally(h, Date.parse('2026-12-01T12:10:00Z'))).toBe(true);
  });
});

describe('formatCountdown', () => {
  it('mostra minutos e segundos, arredondando para cima (09:59 logo depois de reservar)', () => {
    expect(formatCountdown(600_000)).toBe('10:00');
    expect(formatCountdown(599_001)).toBe('10:00');
    expect(formatCountdown(599_000)).toBe('09:59');
    expect(formatCountdown(61_000)).toBe('01:01');
    expect(formatCountdown(0)).toBe('00:00');
  });
});
