/**
 * Job de limpeza: a cada minuto, marca as reservas vencidas como EXPIRED e libera as cadeiras.
 *
 * Não é ele que faz a reserva vencida "valer como livre": isso a expiração preguiçosa já garante
 * em todas as consultas (domain/holds.ts). O job só arruma a casa, como o funcionário que passa
 * recolhendo as caixas de leite vencidas da geladeira.
 */
import type { FastifyBaseLogger } from 'fastify';
import type { TicketingStore } from '../store/TicketingStore';

export const EXPIRE_HOLDS_INTERVAL_MS = 60_000;

export function startExpireHoldsJob(
  store: TicketingStore,
  log: FastifyBaseLogger,
  intervalMs: number = EXPIRE_HOLDS_INTERVAL_MS,
): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return; // a rodada anterior ainda não acabou (no banco, pode demorar)
    running = true;
    store
      .expireHolds()
      .then((count) => count > 0 && log.info(`${count} reserva(s) vencida(s) liberada(s).`))
      .catch((err: unknown) => log.error({ err }, 'Falha ao expirar reservas'))
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  // unref: o timer não impede o Node de encerrar (ex.: nos testes).
  timer.unref();
  return () => clearInterval(timer);
}
