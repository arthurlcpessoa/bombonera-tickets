import { create } from 'zustand';
import { DEFAULT_PRESET, type CameraPresetId } from '@/features/stadium/cameraPresets';

/**
 * Estado global da visualização (Zustand).
 * Componentes fora do canvas (botões) e dentro dele (câmera) leem e escrevem aqui,
 * sem precisar passar props de um para o outro.
 */
interface ViewState {
  /** Preset ativo; `null` quando o usuário moveu a câmera livremente. */
  activePreset: CameraPresetId | null;
  /** Incrementa a cada pedido, para permitir clicar de novo no mesmo preset. */
  requestId: number;
  goToPreset: (id: CameraPresetId) => void;
  clearPreset: () => void;
}

export const useViewStore = create<ViewState>((set) => ({
  activePreset: DEFAULT_PRESET,
  requestId: 0,
  goToPreset: (id) => set((s) => ({ activePreset: id, requestId: s.requestId + 1 })),
  clearPreset: () => set({ activePreset: null }),
}));
