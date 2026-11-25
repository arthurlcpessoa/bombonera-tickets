import { create } from 'zustand';
import { DEFAULT_STANDS_MODEL } from '@/features/seating/data/standsModel';
import type { StandsModel } from '@/features/seating/lib/sectorGeometry';

/**
 * Modelo das arquibancadas em uso (caminho em U, perfis, correção, palcos).
 * No site normal ele nunca muda. No modo ?debug, o painel leva escreve aqui e a cena
 * se redesenha na hora: é assim que calibramos "ao vivo".
 */
interface StandsState {
  model: StandsModel;
  setModel: (model: StandsModel) => void;
}

export const useStandsStore = create<StandsState>((set) => ({
  model: DEFAULT_STANDS_MODEL,
  setModel: (model) => set({ model }),
}));
