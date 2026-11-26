/**
 * Regras da reserva temporária, em funções puras (sem banco, sem HTTP): fáceis de testar.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { HeldSeat, HoldRecord, HoldStatus } from '../store/TicketingStore';

/** Quanto tempo as cadeiras ficam seguras para quem clicou em "Continuar". */
export const HOLD_TTL_MS = 10 * 60 * 1000;

/** Quando uma reserva criada agora vence. */
export function holdExpiresAt(now: Date, ttlMs: number = HOLD_TTL_MS): Date {
  return new Date(now.getTime() + ttlMs);
}

/**
 * Expiração "preguiçosa": uma reserva ACTIVE cujo prazo passou já VALE como expirada, mesmo que o
 * job de limpeza (que roda a cada minuto) ainda não a tenha marcado. Analogia: o leite vence à
 * meia-noite, mesmo que ninguém tenha tirado a caixa da geladeira ainda.
 */
export function isHoldExpired(hold: Pick<HoldRecord, 'status' | 'expiresAt'>, now: Date): boolean {
  return hold.status === 'ACTIVE' && hold.expiresAt.getTime() <= now.getTime();
}

/** O status "de verdade" agora, já considerando a expiração preguiçosa. */
export function effectiveHoldStatus(
  hold: Pick<HoldRecord, 'status' | 'expiresAt'>,
  now: Date,
): HoldStatus {
  return isHoldExpired(hold, now) ? 'EXPIRED' : hold.status;
}

/** Soma dos preços (centavos inteiros: a conta é sempre exata). */
export function holdTotal(seats: readonly HeldSeat[]): number {
  return seats.reduce((sum, seat) => sum + seat.priceCents, 0);
}

// ---------------------------------------------------------------------------------------------
// Token da reserva
// ---------------------------------------------------------------------------------------------

/**
 * Token secreto da reserva: 32 bytes aleatórios (impossível de adivinhar), em texto "base64url"
 * (letras, números, - e _), que cabe numa URL ou num cabeçalho. Funciona como a chave do armário:
 * quem tem o token pode consultar e cancelar a reserva. Não há login nesta fase.
 */
export function createHoldToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Guardamos só o hash (uma "impressão digital" de mão única) do token. Para conferir, calculamos o
 * hash do token recebido e comparamos. Assim, mesmo quem lesse os dados guardados não teria os tokens.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * O token confere com o hash guardado? `timingSafeEqual` compara sempre no mesmo tempo, para um
 * atacante não descobrir o hash "letra por letra" medindo quanto cada resposta demora.
 */
export function tokenMatches(token: string, tokenHash: string): boolean {
  const a = Buffer.from(hashToken(token), 'hex');
  const b = Buffer.from(tokenHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
