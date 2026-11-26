import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STANDS_MODEL,
  getSector,
  getSectorSeats,
  type Seat,
  seatsByRow,
} from '@bombonera/shared';
import { nearestByA, neighborSeat } from './seatNavigation';

/** Cadeira de mentira: só o que a navegação usa. */
function fakeSeat(row: number, number: number, a: number): Seat {
  return {
    id: `t:F${row}-C${number}`,
    sectorId: 't',
    row,
    number,
    a,
    b: 0,
    position: [0, 0, 0],
    yaw: 0,
    eye: [0, 0, 0],
  };
}

// Fila 1 com 3 cadeiras; fila 2 (mais comprida, como nas curvas) com 5.
const seats = [
  fakeSeat(1, 1, 0.2),
  fakeSeat(1, 2, 0.5),
  fakeSeat(1, 3, 0.8),
  ...[0.1, 0.3, 0.5, 0.7, 0.9].map((a, i) => fakeSeat(2, i + 1, a)),
];
const at = (row: number, number: number) =>
  seats.find((s) => s.row === row && s.number === number)!;

describe('neighborSeat', () => {
  it('esquerda e direita andam na mesma fila', () => {
    expect(neighborSeat(seats, at(1, 2), 'left')).toBe(at(1, 1));
    expect(neighborSeat(seats, at(1, 2), 'right')).toBe(at(1, 3));
  });

  it('frente e trás escolhem a cadeira mais alinhada (por a), não o mesmo número', () => {
    expect(neighborSeat(seats, at(1, 2), 'back')).toBe(at(2, 3)); // a = 0,5 → 0,5
    expect(neighborSeat(seats, at(2, 5), 'front')).toBe(at(1, 3)); // a = 0,9 → 0,8
    expect(neighborSeat(seats, at(2, 1), 'front')).toBe(at(1, 1)); // a = 0,1 → 0,2
  });

  it('nas pontas do setor não faz nada (null)', () => {
    expect(neighborSeat(seats, at(1, 1), 'left')).toBeNull();
    expect(neighborSeat(seats, at(2, 5), 'right')).toBeNull();
    expect(neighborSeat(seats, at(1, 2), 'front')).toBeNull();
    expect(neighborSeat(seats, at(2, 3), 'back')).toBeNull();
  });

  it('num setor real, ida e volta pela frente/trás chega perto de onde começou', () => {
    const sector = getSector('lower-3')!;
    const real = getSectorSeats(sector, DEFAULT_STANDS_MODEL);
    const rows = seatsByRow(real);
    const start = rows[4][Math.floor(rows[4].length / 2)];
    const back = neighborSeat(real, start, 'back')!;
    expect(back.row).toBe(start.row + 1);
    expect(neighborSeat(real, back, 'front')!.row).toBe(start.row);
    expect(Math.abs(back.a - start.a)).toBeLessThan(0.02);
  });
});

describe('nearestByA', () => {
  it('fila inexistente ou vazia → null', () => {
    expect(nearestByA(undefined, seats[0])).toBeNull();
    expect(nearestByA([], seats[0])).toBeNull();
  });
});
