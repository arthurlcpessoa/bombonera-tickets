import { useEffect } from 'react';
import { useHoldStore } from '@/store/useHoldStore';
import { expireHoldLocally, restoreHold } from './holdFlow';
import { useCountdown } from './useCountdown';

/**
 * Cuida da reserva em segundo plano. Não desenha nada.
 * - Ao abrir a página: confere com a API a reserva guardada nesta aba (restoreHold).
 * - Quando o cronômetro zera: a reserva venceu (as cadeiras voltam a ficar livres para todos).
 */
export function HoldWatcher() {
  const expiresAt = useHoldStore((s) => s.hold?.expiresAt ?? null);
  const remaining = useCountdown(expiresAt);

  useEffect(() => {
    void restoreHold();
  }, []);

  useEffect(() => {
    if (expiresAt && remaining === 0) expireHoldLocally();
  }, [expiresAt, remaining]);

  return null;
}
