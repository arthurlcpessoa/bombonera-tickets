/**
 * A reserva temporária desta pessoa (Zustand), guardada no sessionStorage.
 *
 * sessionStorage é um "armário" do navegador que guarda texto enquanto ESTA ABA estiver aberta:
 * recarregar a página mantém a reserva (e o token, a "chave" para consultá-la e cancelá-la), mas
 * cada aba é uma pessoa diferente, e fechar a aba esquece tudo. Ao recarregar, o site confere com
 * a API se a reserva ainda vale (features/checkout/holdFlow.ts).
 *
 * O `persist` do Zustand faz a ponte: a cada mudança, salva o estado escolhido no armário; ao abrir
 * a página, lê de volta.
 */
import type { HoldSeat } from '@bombonera/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface ActiveHold {
  holdId: string;
  /** A "chave do armário": vai no cabeçalho Authorization das chamadas desta reserva. */
  token: string;
  matchId: string;
  /** Quando vence (ISO 8601). */
  expiresAt: string;
  seats: HoldSeat[];
  /** Total calculado pelo SERVIDOR, em centavos. */
  totalCents: number;
}

/** Aviso mostrado no resumo depois de uma tentativa de reserva ou de um vencimento. */
export type HoldNotice =
  { kind: 'lost'; seatIds: string[] } | { kind: 'expired' } | { kind: 'error'; message: string };

interface HoldState {
  hold: ActiveHold | null;
  /** Criando ou cancelando uma reserva agora (o botão mostra "Reservando…"). */
  busy: boolean;
  notice: HoldNotice | null;
  setHold: (hold: ActiveHold | null) => void;
  setBusy: (busy: boolean) => void;
  setNotice: (notice: HoldNotice | null) => void;
}

export const useHoldStore = create<HoldState>()(
  persist(
    (set) => ({
      hold: null,
      busy: false,
      notice: null,
      setHold: (hold) => set({ hold }),
      setBusy: (busy) => set({ busy }),
      setNotice: (notice) => set({ notice }),
    }),
    {
      name: 'bombonera:hold',
      storage: createJSONStorage(() => sessionStorage),
      // Só a reserva vai para o armário (não o "carregando" nem os avisos).
      partialize: (state) => ({ hold: state.hold }),
    },
  ),
);

/** Esta cadeira está na MINHA reserva ativa? (Para mim, ela não é "reservada por outra pessoa".) */
export function isInMyHold(seatId: string, hold = useHoldStore.getState().hold): boolean {
  return hold?.seats.some((s) => s.seatId === seatId) ?? false;
}
