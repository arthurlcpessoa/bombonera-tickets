import { create } from 'zustand';
import { ORDER_RULES } from '@/config/stadium';

/**
 * Cadeiras (Zustand). A seleção é do USUÁRIO, não do setor: dá para escolher cadeiras de setores
 * diferentes, e ela sobrevive a fechar o painel e navegar. Só "Limpar seleção" apaga tudo.
 * (Ainda sem localStorage: isso vem com o carrinho real, na Fase 5.)
 *
 * Desempenho: o hover muda o tempo todo. Por isso, quem desenha o hover (as cores no 3D, o
 * destaque no mini-mapa e o tooltip) NÃO lê `hoveredSeatId` com o hook. Eles usam
 * `useSeatStore.subscribe(...)` e atualizam a tela direto, sem re-renderizar o React.
 */
export type HoverSource = 'scene' | 'map';

interface SeatState {
  /** Cadeira sob o mouse ou com foco no mini-mapa (null = nenhuma). */
  hoveredSeatId: string | null;
  /** De onde veio o hover: do 3D (o tooltip segue o mouse) ou do mini-mapa (mouse ou teclado). */
  hoverSource: HoverSource;
  /** Cadeiras escolhidas, na ordem em que foram escolhidas. */
  selectedSeatIds: string[];
  /** Incrementa quando alguém tenta passar do limite: a interface mostra um aviso. */
  limitWarningId: number;
  setHoveredSeat: (id: string | null, source?: HoverSource) => void;
  /** Escolhe ou desfaz a escolha. Devolve false se bateu no limite de cadeiras. */
  toggleSeat: (id: string) => boolean;
  removeSeat: (id: string) => void;
  clearSeats: () => void;
}

export const useSeatStore = create<SeatState>((set, get) => ({
  hoveredSeatId: null,
  hoverSource: 'scene',
  selectedSeatIds: [],
  limitWarningId: 0,
  setHoveredSeat: (id, source = 'scene') => {
    const s = get();
    if (s.hoveredSeatId !== id || s.hoverSource !== source)
      set({ hoveredSeatId: id, hoverSource: source });
  },
  toggleSeat: (id) => {
    const { selectedSeatIds } = get();
    if (selectedSeatIds.includes(id)) {
      set({ selectedSeatIds: selectedSeatIds.filter((s) => s !== id) });
      return true;
    }
    if (selectedSeatIds.length >= ORDER_RULES.maxSeats) {
      set((s) => ({ limitWarningId: s.limitWarningId + 1 }));
      return false;
    }
    set({ selectedSeatIds: [...selectedSeatIds, id] });
    return true;
  },
  removeSeat: (id) => set((s) => ({ selectedSeatIds: s.selectedSeatIds.filter((x) => x !== id) })),
  clearSeats: () => set({ selectedSeatIds: [] }),
}));
