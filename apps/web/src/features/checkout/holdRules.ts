/** Regras puras da reserva no site (sem stores nem rede): fáceis de testar. */
import type { ActiveHold } from '@/store/useHoldStore';

/** A reserva ativa corresponde exatamente às cadeiras escolhidas agora? */
export function holdMatchesSelection(hold: ActiveHold | null, selectedIds: readonly string[]) {
  if (!hold || hold.seats.length !== selectedIds.length) return false;
  const held = new Set(hold.seats.map((s) => s.seatId));
  return selectedIds.every((id) => held.has(id));
}

/** A reserva já venceu pelo relógio deste computador? */
export function isHoldExpiredLocally(hold: ActiveHold, now = Date.now()): boolean {
  return new Date(hold.expiresAt).getTime() <= now;
}
