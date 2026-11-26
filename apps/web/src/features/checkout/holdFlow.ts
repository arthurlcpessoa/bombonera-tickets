/**
 * Fluxo da reserva no site: "Continuar", cancelar, vencer e restaurar depois de recarregar.
 *
 * Funções comuns (não hooks): leem e escrevem nos stores na hora, como os cliques no 3D.
 */
import {
  API_ERROR_CODES,
  HoldConflictDetailsSchema,
  type CreateHoldResponse,
} from '@bombonera/shared';
import { api, ApiRequestError } from '@/lib/api';
import { queryClient, queryKeys } from '@/lib/queries';
import { useAvailabilityStore } from '@/store/useAvailabilityStore';
import { useHoldStore, type ActiveHold } from '@/store/useHoldStore';
import { useSeatStore } from '@/store/useSeatStore';
import { isHoldExpiredLocally } from './holdRules';

export { holdMatchesSelection } from './holdRules';

/** Pede ao TanStack Query para buscar de novo a disponibilidade (setores e cadeiras). */
function refreshAvailability(matchId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.sectors(matchId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.allSectorSeats(matchId) });
}

function toActiveHold(created: CreateHoldResponse): ActiveHold {
  const { holdId, token, matchId, expiresAt, seats, totalCents } = created;
  return { holdId, token, matchId, expiresAt, seats, totalCents };
}

/**
 * "Continuar": reserva as cadeiras escolhidas por 10 minutos.
 *
 * 1. Se já existe uma reserva minha, ela é cancelada antes (uma reserva ativa por pessoa).
 * 2. Cria a reserva nova.
 * 3. 409 (alguém pegou alguma cadeira): avisa quais, tira da seleção e atualiza o setor.
 */
export async function continueToHold(): Promise<void> {
  const { selectedSeatIds } = useSeatStore.getState();
  const match = useAvailabilityStore.getState().match;
  const holdStore = useHoldStore.getState();
  if (!match || selectedSeatIds.length === 0 || holdStore.busy) return;

  holdStore.setBusy(true);
  holdStore.setNotice(null);
  try {
    await cancelActiveHold({ keepSelection: true });
    const created = await api.createHold({ matchId: match.id, seatIds: selectedSeatIds });
    useHoldStore.getState().setHold(toActiveHold(created));
  } catch (err) {
    handleHoldError(err);
  } finally {
    useHoldStore.getState().setBusy(false);
    refreshAvailability(match.id);
  }
}

function handleHoldError(err: unknown) {
  const { setNotice } = useHoldStore.getState();
  if (err instanceof ApiRequestError && err.code === API_ERROR_CODES.holdConflict) {
    const details = HoldConflictDetailsSchema.safeParse(err.details);
    const lost = details.success ? details.data.unavailable : [];
    const { removeSeat } = useSeatStore.getState();
    lost.forEach(removeSeat);
    setNotice({ kind: 'lost', seatIds: lost });
    return;
  }
  setNotice({
    kind: 'error',
    message:
      err instanceof ApiRequestError
        ? err.message
        : 'Não foi possível reservar agora. Tente de novo em instantes.',
  });
}

/**
 * Cancela a minha reserva (se houver) e libera as cadeiras para os outros.
 * Por padrão a seleção continua (dá para clicar em "Continuar" de novo).
 */
export async function cancelActiveHold({ keepSelection = true } = {}): Promise<void> {
  const { hold, setHold } = useHoldStore.getState();
  if (!hold) return;
  setHold(null);
  try {
    await api.cancelHold(hold.holdId, hold.token);
  } catch {
    // Já vencida, já cancelada ou API fora do ar: em 10 minutos ela vence sozinha de qualquer jeito.
  }
  if (!keepSelection) useSeatStore.getState().clearSeats();
  refreshAvailability(hold.matchId);
}

/** O cronômetro chegou a zero: a reserva venceu (as cadeiras continuam escolhidas). */
export function expireHoldLocally(): void {
  const { hold, setHold, setNotice } = useHoldStore.getState();
  if (!hold) return;
  setHold(null);
  setNotice({ kind: 'expired' });
  refreshAvailability(hold.matchId);
}

/**
 * Ao abrir a página: se havia uma reserva guardada nesta aba, pergunta à API se ela ainda vale.
 * Se valer, as cadeiras dela voltam a ser a seleção; se não, a reserva guardada é esquecida.
 */
export async function restoreHold(): Promise<void> {
  const { hold, setHold } = useHoldStore.getState();
  if (!hold) return;
  if (isHoldExpiredLocally(hold)) {
    setHold(null);
    return;
  }
  // As cadeiras reservadas voltam a ser a seleção já; a API confirma logo abaixo.
  useSeatStore.setState({ selectedSeatIds: hold.seats.map((s) => s.seatId) });
  try {
    const current = await api.getHold(hold.holdId, hold.token);
    if (current.status !== 'ACTIVE') {
      setHold(null);
      return;
    }
    setHold({
      ...hold,
      expiresAt: current.expiresAt,
      seats: current.seats,
      totalCents: current.totalCents,
    });
    useSeatStore.setState({ selectedSeatIds: current.seats.map((s) => s.seatId) });
  } catch (err) {
    // 404/401: a reserva não existe mais (ex.: a API reiniciou e os dados em memória sumiram).
    // Falha de rede: mantemos a reserva guardada; o cronômetro continua e a API confirma depois.
    if (err instanceof ApiRequestError && err.status >= 400 && err.status < 500) setHold(null);
  }
}
