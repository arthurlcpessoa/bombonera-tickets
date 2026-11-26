/**
 * Disponibilidade REAL, vinda da API (Zustand).
 *
 * Quem busca é o TanStack Query (features/availability/AvailabilitySync.tsx), que copia o resultado
 * para cá. Por que copiar? A regra do projeto é que a interface HTML e a cena 3D só conversam por
 * stores Zustand: as cadeiras 3D e os cliques leem a disponibilidade daqui, na hora, sem React.
 *
 * A GEOMETRIA (onde fica cada cadeira) continua vindo do gerador do @bombonera/shared.
 * A API só diz o ESTADO: livre, reservada ou vendida.
 */
import { seatCode, type Match, type SectorAvailability } from '@bombonera/shared';
import { create } from 'zustand';
import { isInMyHold, useHoldStore } from './useHoldStore';

/**
 * Estado de uma cadeira para a interface:
 * - available: livre (pode escolher);
 * - held: reservada por OUTRA pessoa nos últimos 10 minutos (não pode escolher). As cadeiras da
 *   MINHA reserva contam como livres para mim;
 * - sold: vendida;
 * - unknown: ainda não sabemos (carregando, ou a API está fora do ar).
 */
export type SeatAvailability = 'available' | 'held' | 'sold' | 'unknown';

/** A API respondeu da última vez? (loading = ainda não deu tempo de saber) */
export type ApiStatus = 'loading' | 'online' | 'offline';

/** Cadeiras ocupadas de um setor, pelo código curto ("F12-C07"). */
export interface SectorSeatSets {
  sold: ReadonlySet<string>;
  held: ReadonlySet<string>;
}

interface AvailabilityState {
  apiStatus: ApiStatus;
  match: Match | null;
  /** Por setor: preço, capacidade e livres (null = ainda não chegou). */
  sectors: ReadonlyMap<string, SectorAvailability> | null;
  /** Cadeiras ocupadas dos setores já consultados. */
  seatSets: ReadonlyMap<string, SectorSeatSets>;
  setApiStatus: (status: ApiStatus) => void;
  setMatch: (match: Match) => void;
  setSectors: (sectors: readonly SectorAvailability[]) => void;
  setSectorSeats: (sectorId: string, sold: readonly string[], held: readonly string[]) => void;
}

export const useAvailabilityStore = create<AvailabilityState>((set) => ({
  apiStatus: 'loading',
  match: null,
  sectors: null,
  seatSets: new Map(),
  setApiStatus: (apiStatus) => set((s) => (s.apiStatus === apiStatus ? s : { apiStatus })),
  setMatch: (match) => set({ match }),
  setSectors: (sectors) => set({ sectors: new Map(sectors.map((s) => [s.sectorId, s])) }),
  setSectorSeats: (sectorId, sold, held) =>
    set((s) => {
      const seatSets = new Map(s.seatSets);
      seatSets.set(sectorId, { sold: new Set(sold), held: new Set(held) });
      return { seatSets };
    }),
}));

/** Estado de uma cadeira agora (para usar fora do React, ex.: num clique ou na cena 3D). */
export function seatAvailability(
  seatId: string,
  state: Pick<AvailabilityState, 'seatSets'> = useAvailabilityStore.getState(),
): SeatAvailability {
  const availability = availabilityInSector(
    state.seatSets.get(seatId.slice(0, seatId.indexOf(':'))),
    seatId,
  );
  return availability === 'held' && isInMyHold(seatId) ? 'available' : availability;
}

/** Estado de uma cadeira, dados os conjuntos do setor dela (undefined = ainda não chegaram). */
export function availabilityInSector(
  sets: SectorSeatSets | undefined,
  seatId: string,
): SeatAvailability {
  if (!sets) return 'unknown';
  const code = seatCode(seatId);
  if (sets.sold.has(code)) return 'sold';
  if (sets.held.has(code)) return 'held';
  return 'available';
}

/** O mesmo, como hook: o componente re-renderiza quando o estado daquela cadeira muda. */
export function useSeatAvailability(seatId: string): SeatAvailability {
  // Assina também a minha reserva: criar ou cancelar muda o que é "meu".
  useHoldStore((s) => s.hold);
  return useAvailabilityStore((s) => seatAvailability(seatId, s));
}

/** Disponibilidade de um setor (undefined = ainda não chegou ou a API está fora do ar). */
export function useSectorAvailability(sectorId: string): SectorAvailability | undefined {
  return useAvailabilityStore((s) => s.sectors?.get(sectorId));
}
