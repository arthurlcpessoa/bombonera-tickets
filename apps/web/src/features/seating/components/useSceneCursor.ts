import { useEffect } from 'react';
import { findSeat } from '@/features/seating/data/seats';
import { useSeatStore } from '@/store/useSeatStore';
import { useSelectionStore } from '@/store/useSelectionStore';
import { useStandsStore } from '@/store/useStandsStore';

/**
 * Cursor de "mãozinha" sobre o que é clicável no 3D: um setor ou uma cadeira LIVRE.
 *
 * Um único lugar decide o cursor, olhando os dois stores. Se setores e cadeiras mexessem no
 * cursor cada um por si, um poderia desfazer o do outro. Usa subscribe(): nada re-renderiza.
 */
export function useSceneCursor() {
  useEffect(() => {
    let current = '';

    const update = () => {
      const { hoveredSectorId, showSectors } = useSelectionStore.getState();
      const { hoveredSeatId, hoverSource } = useSeatStore.getState();
      let clickable = showSectors && hoveredSectorId !== null;
      if (hoveredSeatId && hoverSource === 'scene') {
        const found = findSeat(hoveredSeatId, useStandsStore.getState().model);
        clickable = found?.seat.status === 'available';
      }
      const next = clickable ? 'pointer' : '';
      if (next !== current) {
        document.body.style.cursor = next;
        current = next;
      }
    };

    const unsubscribeSelection = useSelectionStore.subscribe(update);
    const unsubscribeSeats = useSeatStore.subscribe(update);
    return () => {
      unsubscribeSelection();
      unsubscribeSeats();
      document.body.style.cursor = '';
    };
  }, []);
}
