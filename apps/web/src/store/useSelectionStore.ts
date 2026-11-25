import { create } from 'zustand';
import { useSeatViewStore } from './useSeatViewStore';
import { useViewStore } from './useViewStore';

/**
 * Seleção de setores (Zustand). O canvas 3D escreve aqui (hover, clique) e a interface HTML
 * lê (tooltip, painel), e vice-versa (fechar o painel, ligar/desligar os setores).
 */
interface SelectionState {
  /** Setor sob o mouse (null = nenhum). */
  hoveredSectorId: string | null;
  /** Setor escolhido com clique: a câmera voa até ele e o painel abre. */
  selectedSectorId: string | null;
  /** Mostrar as superfícies coloridas dos setores. */
  showSectors: boolean;
  /** Incrementa a cada clique, para a câmera voar de novo mesmo se o setor já estava escolhido. */
  selectRequestId: number;
  setHovered: (id: string | null) => void;
  selectSector: (id: string) => void;
  /** Marca o setor como escolhido SEM pedir voo de câmera (usado pela visão do assento). */
  focusSector: (id: string) => void;
  clearSelection: () => void;
  setShowSectors: (show: boolean) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  hoveredSectorId: null,
  selectedSectorId: null,
  showSectors: true,
  selectRequestId: 0,
  setHovered: (id) => set({ hoveredSectorId: id }),
  selectSector: (id) => {
    // Trocar de setor encerra a visão do assento (a câmera volta a voar até o setor).
    useSeatViewStore.getState().exitSeatView();
    // A câmera vai sair do preset atual: nenhum botão de visão fica marcado.
    useViewStore.getState().clearPreset();
    // O hover do setor é limpo: o setor escolhido deixa de reagir ao ponteiro (as cadeiras reagem).
    set((s) => ({
      selectedSectorId: id,
      hoveredSectorId: null,
      selectRequestId: s.selectRequestId + 1,
    }));
  },
  focusSector: (id) => set({ selectedSectorId: id, hoveredSectorId: null }),
  clearSelection: () => set({ selectedSectorId: null }),
  setShowSectors: (show) => set({ showSectors: show, hoveredSectorId: null }),
}));
