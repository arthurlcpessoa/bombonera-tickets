import { describe, expect, it } from 'vitest';
import {
  createHoldToken,
  effectiveHoldStatus,
  hashToken,
  HOLD_TTL_MS,
  holdExpiresAt,
  holdTotal,
  isHoldExpired,
  tokenMatches,
} from './holds';

const T0 = new Date('2026-12-01T12:00:00Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

describe('validade da reserva', () => {
  it('vence 10 minutos depois de criada', () => {
    expect(holdExpiresAt(T0).getTime() - T0.getTime()).toBe(10 * 60 * 1000);
    expect(HOLD_TTL_MS).toBe(600_000);
  });

  it('expiração preguiçosa: vale como expirada a partir do instante do vencimento', () => {
    const hold = { status: 'ACTIVE' as const, expiresAt: holdExpiresAt(T0) };
    expect(isHoldExpired(hold, at(HOLD_TTL_MS - 1))).toBe(false);
    expect(isHoldExpired(hold, at(HOLD_TTL_MS))).toBe(true);
    expect(effectiveHoldStatus(hold, at(HOLD_TTL_MS - 1))).toBe('ACTIVE');
    expect(effectiveHoldStatus(hold, at(HOLD_TTL_MS))).toBe('EXPIRED');
  });

  it('só reserva ATIVA expira: cancelada continua cancelada', () => {
    const hold = { status: 'CANCELLED' as const, expiresAt: holdExpiresAt(T0) };
    expect(isHoldExpired(hold, at(HOLD_TTL_MS * 2))).toBe(false);
    expect(effectiveHoldStatus(hold, at(HOLD_TTL_MS * 2))).toBe('CANCELLED');
  });
});

describe('total', () => {
  it('soma em centavos inteiros (sem erro de arredondamento)', () => {
    // Com número "com vírgula", 0,1 + 0,2 daria 0,30000000000000004. Em centavos é exato.
    expect(
      holdTotal([
        { seatId: 'a', priceCents: 10 },
        { seatId: 'b', priceCents: 20 },
      ]),
    ).toBe(30);
    expect(
      holdTotal([
        { seatId: 'a', priceCents: 6_500_000 },
        { seatId: 'b', priceCents: 6_500_000 },
        { seatId: 'c', priceCents: 3_500_000 },
      ]),
    ).toBe(16_500_000);
    expect(holdTotal([])).toBe(0);
  });
});

describe('token da reserva', () => {
  it('é longo, aleatório e cabe numa URL', () => {
    const a = createHoldToken();
    const b = createHoldToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes em base64url
  });

  it('guardamos só o hash; o token certo confere e o errado não', () => {
    const token = createHoldToken();
    const stored = hashToken(token);
    expect(stored).not.toContain(token);
    expect(tokenMatches(token, stored)).toBe(true);
    expect(tokenMatches(createHoldToken(), stored)).toBe(false);
    expect(tokenMatches(token, 'hash-quebrado')).toBe(false);
  });
});
