/**
 * Inventário inicial, gerado pelo MESMO código que desenha as cadeiras no site (@bombonera/shared).
 * Assim os ids da API ("upper-3:F12-C07") são exatamente os do 3D.
 */
import {
  DEFAULT_STANDS_MODEL,
  getCategory,
  getSectorSeats,
  SECTORS,
  simulatedSoldSeatIds,
} from '@bombonera/shared';
import type { MatchRecord, MatchSeatRecord, SeatRecord } from './TicketingStore';

export interface Inventory {
  match: MatchRecord;
  seats: SeatRecord[];
  matchSeats: MatchSeatRecord[];
}

/** Pesos → centavos. O catálogo guarda pesos inteiros; a API trabalha sempre em centavos. */
export const pesosToCents = (pesos: number) => Math.round(pesos * 100);

/**
 * Monta as tabelas Seat e MatchSeat para um jogo. As cadeiras que a simulação antiga mostrava como
 * vendidas (mesma semente) começam SOLD, para o site continuar com a mesma "cara" de antes.
 */
export function buildInventory(match: MatchRecord): Inventory {
  const seats: SeatRecord[] = [];
  const matchSeats: MatchSeatRecord[] = [];
  for (const sector of SECTORS) {
    const priceCents = pesosToCents(getCategory(sector.categoryId).price);
    const sold = simulatedSoldSeatIds(sector, DEFAULT_STANDS_MODEL);
    for (const seat of getSectorSeats(sector, DEFAULT_STANDS_MODEL)) {
      seats.push({ id: seat.id, sectorId: sector.id, row: seat.row, number: seat.number });
      matchSeats.push({
        matchId: match.id,
        seatId: seat.id,
        status: sold.has(seat.id) ? 'SOLD' : 'AVAILABLE',
        holdId: null,
        priceCents,
      });
    }
  }
  return { match, seats, matchSeats };
}
