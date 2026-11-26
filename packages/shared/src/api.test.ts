import { describe, expect, it } from 'vitest';
import { CreateHoldRequestSchema, SeatIdSchema, seatCode, seatIdFromCode } from './api';
import { ORDER_RULES } from './stadium';

const seat = (n: number) => `lower-4:F01-C${String(n).padStart(2, '0')}`;

describe('CreateHoldRequestSchema', () => {
  it('aceita de 1 a 6 cadeiras diferentes', () => {
    const ok = CreateHoldRequestSchema.safeParse({
      matchId: 'jogo-1',
      seatIds: [seat(1), seat(2)],
    });
    expect(ok.success).toBe(true);
    const six = Array.from({ length: ORDER_RULES.maxSeats }, (_, i) => seat(i + 1));
    expect(CreateHoldRequestSchema.safeParse({ matchId: 'jogo-1', seatIds: six }).success).toBe(
      true,
    );
  });

  it('recusa lista vazia, mais de 6 e cadeira repetida', () => {
    const tooMany = Array.from({ length: ORDER_RULES.maxSeats + 1 }, (_, i) => seat(i + 1));
    for (const seatIds of [[], tooMany, [seat(1), seat(1)]]) {
      expect(CreateHoldRequestSchema.safeParse({ matchId: 'jogo-1', seatIds }).success).toBe(false);
    }
  });

  it('ignora campos a mais, como um preço inventado pelo navegador', () => {
    const parsed = CreateHoldRequestSchema.parse({
      matchId: 'jogo-1',
      seatIds: [seat(1)],
      totalCents: 1,
    });
    expect(parsed).toEqual({ matchId: 'jogo-1', seatIds: [seat(1)] });
  });
});

describe('ids de cadeira', () => {
  it('aceita o formato do gerador e recusa o resto', () => {
    expect(SeatIdSchema.safeParse('upper-3:F12-C07').success).toBe(true);
    for (const bad of [
      '',
      'upper-3',
      'UPPER-3:F12-C07',
      'upper-3:F12-C07; DROP TABLE',
      'x'.repeat(50),
    ]) {
      expect(SeatIdSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('código curto ida e volta', () => {
    expect(seatCode('upper-3:F12-C07')).toBe('F12-C07');
    expect(seatIdFromCode('upper-3', 'F12-C07')).toBe('upper-3:F12-C07');
  });
});
