/**
 * Navegação entre cadeiras vizinhas na visão do assento (TypeScript puro, sem React).
 *
 * As direções são as de quem está SENTADO olhando o campo:
 *
 *              campo
 *   ─────────────────────────
 *   fila 1   ○ ○ ○ ○ ○ ○        ↑ 'front' = fila da frente (mais perto do campo)
 *   fila 2   ○ ○ ● ○ ○ ○        ↓ 'back'  = fila de trás
 *   fila 3   ○ ○ ○ ○ ○ ○ ○      ← 'left' = cadeira de número menor; → 'right' = número maior
 *
 * (A cadeira 1 fica à esquerda do torcedor: veja lib/seatLayout.ts.)
 * Nunca sai do setor: na ponta da fila, na fila 1 ou na última fila, devolve null.
 */
import { seatsByRow, type Seat } from './seatLayout';

export type SeatDirection = 'left' | 'right' | 'front' | 'back';

/** Cadeira vizinha na direção pedida, ou null se não houver (ponta do setor). */
export function neighborSeat(
  seats: readonly Seat[],
  current: Seat,
  direction: SeatDirection,
): Seat | null {
  const rows = seatsByRow(seats);
  const row = rows[current.row - 1];
  if (!row) return null;
  switch (direction) {
    case 'left':
      return row[current.number - 2] ?? null;
    case 'right':
      return row[current.number] ?? null;
    case 'front':
      return nearestByA(rows[current.row - 2], current);
    case 'back':
      return nearestByA(rows[current.row], current);
  }
}

/**
 * Na fila vizinha, a cadeira mais alinhada com a atual. As filas têm tamanhos diferentes nas
 * curvas (as de trás são mais compridas), então "mesmo número" não é "mesma posição": comparamos
 * `a`, a posição ao longo do setor (de 0 a 1), que vale para todas as filas.
 */
export function nearestByA(row: readonly Seat[] | undefined, from: Seat): Seat | null {
  if (!row?.length) return null;
  return row.reduce((best, seat) =>
    Math.abs(seat.a - from.a) < Math.abs(best.a - from.a) ? seat : best,
  );
}
