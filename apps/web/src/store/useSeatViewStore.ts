import { create } from 'zustand';
import { SEAT_VIEW } from '@/config/stadium';
import { findSeat } from '@/features/seating/data/seats';
import { getSectorSeats } from '@/features/seating/lib/seatLayout';
import { neighborSeat, type SeatDirection } from '@/features/seating/lib/seatNavigation';
import { useSeatStore } from './useSeatStore';
import { useSelectionStore } from './useSelectionStore';
import { useStandsStore } from './useStandsStore';

/**
 * Visão do assento (Zustand): qual cadeira está sendo "experimentada" em primeira pessoa.
 *
 * Entrar na visão NÃO escolhe a cadeira: dá para espiar qualquer uma, livre ou vendida.
 * A câmera (CameraRig), o HUD e a cena leem daqui; ninguém se chama diretamente.
 */
interface SeatViewState {
  /** Cadeira cuja visão está na tela (null = fora da visão do assento). */
  viewingSeatId: string | null;
  /** Incrementa a cada entrada ou troca de cadeira, para a câmera voar de novo. */
  requestId: number;
  /** Entra na visão (ou troca de cadeira). Devolve false se o id não existe. */
  enterSeatView: (id: string) => boolean;
  exitSeatView: () => void;
  /** Vai para a cadeira vizinha. Na ponta do setor, não faz nada. */
  moveSeatView: (direction: SeatDirection) => void;

  /** Zoom atual do binóculo (1 = olho nu). Escrito pela câmera, lido pelo HUD. */
  zoom: number;
  /** Pedido de zoom vindo da interface (teclas +/−, botões): a câmera atende. */
  zoomRequest: { value: number; id: number };
  /** Pede para aproximar (step > 0) ou afastar (step < 0) o binóculo. */
  zoomBy: (step: number) => void;
  /** A câmera informa o zoom atual (scroll, pinça ou fim de uma animação). */
  reportZoom: (zoom: number) => void;
}

export const useSeatViewStore = create<SeatViewState>((set, get) => ({
  viewingSeatId: null,
  requestId: 0,
  enterSeatView: (id) => {
    const found = findSeat(id, useStandsStore.getState().model);
    if (!found) return false;
    // O setor da cadeira passa a ser o escolhido (sem voo: quem move a câmera agora é a visão).
    useSelectionStore.getState().focusSector(found.sector.id);
    useSeatStore.getState().setHoveredSeat(null);
    set((s) => ({ viewingSeatId: id, requestId: s.requestId + 1 }));
    return true;
  },
  exitSeatView: () => {
    if (get().viewingSeatId) set({ viewingSeatId: null });
  },
  moveSeatView: (direction) => {
    const { viewingSeatId } = get();
    const model = useStandsStore.getState().model;
    const found = viewingSeatId ? findSeat(viewingSeatId, model) : null;
    if (!found) return;
    const next = neighborSeat(getSectorSeats(found.sector, model), found.seat, direction);
    if (next) set((s) => ({ viewingSeatId: next.id, requestId: s.requestId + 1 }));
  },

  zoom: 1,
  zoomRequest: { value: 1, id: 0 },
  zoomBy: (step) =>
    set((s) => ({
      zoomRequest: {
        value: Math.min(SEAT_VIEW.maxZoom, Math.max(1, s.zoom + step)),
        id: s.zoomRequest.id + 1,
      },
    })),
  reportZoom: (zoom) => {
    if (Math.abs(get().zoom - zoom) > 0.01) set({ zoom });
  },
}));
