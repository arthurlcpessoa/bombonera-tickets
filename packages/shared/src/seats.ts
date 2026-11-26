/**
 * Consultas de cadeiras por id. Fica fora de seatLayout.ts porque precisa da lista de
 * setores (sectors.ts), que por sua vez usa o gerador de cadeiras: juntar os dois num arquivo
 * criaria uma importação circular (um módulo esperando o outro terminar de carregar).
 */
import { getSectorSeats, parseSeatId, type Seat } from './seatLayout';
import type { StandsModel } from './sectorGeometry';
import { getSector, type Sector } from './sectors';

/** Índice "id → posição na lista" de cada lista de cadeiras (a posição é o instanceId no 3D). */
const indexCache = new WeakMap<readonly Seat[], Map<string, number>>();

export function seatIndexMap(seats: readonly Seat[]): Map<string, number> {
  let map = indexCache.get(seats);
  if (!map) {
    map = new Map(seats.map((seat, i) => [seat.id, i]));
    indexCache.set(seats, map);
  }
  return map;
}

/** Acha a cadeira (e o setor dela) a partir do id, ex.: "upper-3:F12-C07". */
export function findSeat(
  id: string,
  model: StandsModel,
): { seat: Seat; sector: Sector; index: number } | null {
  const parsed = parseSeatId(id);
  const sector = parsed && getSector(parsed.sectorId);
  if (!sector) return null;
  const seats = getSectorSeats(sector, model);
  const index = seatIndexMap(seats).get(id);
  return index === undefined ? null : { seat: seats[index], sector, index };
}
