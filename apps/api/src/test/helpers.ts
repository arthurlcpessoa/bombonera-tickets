/**
 * Ajudantes de teste: API com armazenamento novo e um relógio falso.
 */
import { buildApp } from '../app';
import { loadConfig } from '../config';
import { CURRENT_MATCH } from '../domain/match';
import { InMemoryStore } from '../store/InMemoryStore';
import { buildInventory, type Inventory } from '../store/seed';

/** Gerar as 35,7 mil cadeiras leva um instante: geramos uma vez e cada teste ganha uma CÓPIA. */
let cached: Inventory | null = null;
export function testInventory(): Inventory {
  cached ??= buildInventory(CURRENT_MATCH);
  return structuredClone(cached);
}

/**
 * Relógio falso: começa numa data fixa e só anda quando o teste manda (`advance`). Assim dá para
 * testar "a reserva vence em 10 minutos" sem esperar 10 minutos.
 */
export function fakeClock(start = new Date('2026-12-01T12:00:00Z')) {
  let current = start.getTime();
  const now = () => new Date(current);
  return {
    now,
    advance(ms: number) {
      current += ms;
    },
  };
}

export async function testApp(env: Record<string, string> = {}) {
  const clock = fakeClock();
  const store = new InMemoryStore({ inventory: testInventory(), now: clock.now });
  // Nos testes, o limite de reservas por minuto fica alto (o teste de concorrência faz 20 de uma vez).
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    RATE_LIMIT_HOLDS_MAX: '1000',
    ...env,
  });
  const app = await buildApp({ store, storeName: 'memory', now: clock.now, config });
  return { app, store, clock };
}

/** Um setor e algumas cadeiras LIVRES dele no estado inicial (para os testes de reserva). */
export function freeSeats(inventory: Inventory, count: number, sectorId = 'lower-4'): string[] {
  return inventory.matchSeats
    .filter((ms) => ms.status === 'AVAILABLE' && ms.seatId.startsWith(`${sectorId}:`))
    .slice(0, count)
    .map((ms) => ms.seatId);
}
