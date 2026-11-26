import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { currentMatchQuery, sectorSeatsQuery, sectorsQuery } from '@/lib/queries';
import { useAvailabilityStore } from '@/store/useAvailabilityStore';
import { useSelectionStore } from '@/store/useSelectionStore';

/**
 * Busca o jogo, os setores e as cadeiras do setor aberto (TanStack Query, recarregando a cada
 * ~15 s) e copia tudo para o useAvailabilityStore. Não desenha nada.
 *
 * Só as cadeiras do setor ABERTO são pedidas: as dos outros setores nem aparecem na tela.
 */
export function AvailabilitySync() {
  const match = useQuery(currentMatchQuery());
  const matchId = match.data?.id;

  const sectors = useQuery({ ...sectorsQuery(matchId ?? ''), enabled: matchId !== undefined });

  const sectorId = useSelectionStore((s) => s.selectedSectorId);
  const seats = useQuery({
    ...sectorSeatsQuery(matchId ?? '', sectorId ?? ''),
    enabled: matchId !== undefined && sectorId !== null,
  });

  useEffect(() => {
    if (match.data) useAvailabilityStore.getState().setMatch(match.data);
  }, [match.data]);

  useEffect(() => {
    if (sectors.data) useAvailabilityStore.getState().setSectors(sectors.data.sectors);
  }, [sectors.data]);

  useEffect(() => {
    if (seats.data) {
      const { sectorId: id, sold, held } = seats.data;
      useAvailabilityStore.getState().setSectorSeats(id, sold, held);
    }
  }, [seats.data]);

  // Fora do ar = a última tentativa falhou (os dados antigos continuam na tela, com um aviso).
  const status =
    match.isError || sectors.isError || seats.isError
      ? 'offline'
      : match.isSuccess && sectors.isSuccess
        ? 'online'
        : 'loading';
  useEffect(() => useAvailabilityStore.getState().setApiStatus(status), [status]);

  return null;
}
