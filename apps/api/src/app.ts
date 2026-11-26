/**
 * Monta a API (sem abrir porta). Quem usa: server.ts (de verdade) e os testes (com app.inject()).
 *
 * Injeção de dependência: o armazenamento e o relógio chegam de FORA. Nos testes, entregamos um
 * armazenamento novinho e um relógio falso; em produção, o InMemoryStore (5C: PostgresStore) e o
 * relógio de verdade. A API em si não sabe nem se importa com qual é qual.
 */
import Fastify, { type FastifyServerOptions } from 'fastify';
import type { Config } from './config';
import { registerErrorHandling } from './http/errors';
import { healthRoutes } from './routes/health';
import { matchRoutes } from './routes/matches';
import type { Clock, TicketingStore } from './store/TicketingStore';

export interface AppDeps {
  store: TicketingStore;
  /** Nome do armazenamento, mostrado no /api/health (ex.: "memory"). */
  storeName: string;
  now: Clock;
  config: Config;
}

export interface BuildAppOptions extends AppDeps {
  logger?: FastifyServerOptions['logger'];
}

/** Tamanho máximo do corpo de uma requisição: uma reserva tem no máximo 6 ids (~300 bytes). */
const BODY_LIMIT_BYTES = 16 * 1024;

export async function buildApp({ logger = false, ...deps }: BuildAppOptions) {
  const app = Fastify({ logger, bodyLimit: BODY_LIMIT_BYTES });

  registerErrorHandling(app, { production: deps.config.NODE_ENV === 'production' });

  // Todas as rotas ficam sob /api. Cada grupo é um "plugin" do Fastify: uma função que registra
  // as suas rotas e recebe as dependências.
  await app.register(
    async (api) => {
      await api.register(healthRoutes, deps);
      await api.register(matchRoutes, deps);
    },
    { prefix: '/api' },
  );

  return app;
}
