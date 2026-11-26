/**
 * Monta a API (sem abrir porta). Quem usa: server.ts (de verdade) e os testes (com app.inject()).
 *
 * Injeção de dependência: o armazenamento e o relógio chegam de FORA. Nos testes, entregamos um
 * armazenamento novinho e um relógio falso; em produção, o InMemoryStore (5C: PostgresStore) e o
 * relógio de verdade. A API em si não sabe nem se importa com qual é qual.
 */
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type { Config } from './config';
import { registerErrorHandling } from './http/errors';
import { healthRoutes } from './routes/health';
import { holdRoutes } from './routes/holds';
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

  // Helmet: "etiquetas" de segurança em toda resposta (ex.: não deixar outro site exibir a API num
  // quadro, não "adivinhar" o tipo do conteúdo). A API e o site ficam em endereços diferentes, e
  // quem controla quem pode ler as respostas é o CORS (abaixo); por isso liberamos o
  // Cross-Origin-Resource-Policy, que, no padrão, só aceitaria o próprio endereço da API.
  await app.register(helmet, { crossOriginResourcePolicy: { policy: 'cross-origin' } });

  // CORS: o navegador só deixa o site (outra "origem": outra porta ou domínio) ler as respostas se a
  // API disser que aquela origem pode. A lista vem do .env (CORS_ORIGIN).
  await app.register(cors, {
    origin: deps.config.CORS_ORIGIN,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Limite de requisições por IP por minuto (429 ao passar). Cada rota pode ter um limite próprio:
  // criar reserva é bem mais rígido (veja routes/holds.ts).
  await app.register(rateLimit, { max: deps.config.RATE_LIMIT_MAX, timeWindow: '1 minute' });

  // Todas as rotas ficam sob /api. Cada grupo é um "plugin" do Fastify: uma função que registra
  // as suas rotas e recebe as dependências.
  await app.register(
    async (api) => {
      await api.register(healthRoutes, deps);
      await api.register(matchRoutes, deps);
      await api.register(holdRoutes, deps);
    },
    { prefix: '/api' },
  );

  return app;
}
