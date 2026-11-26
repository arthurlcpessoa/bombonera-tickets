import { API_ERROR_CODES, type Match } from '@bombonera/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../app';
import { ApiError } from '../http/errors';

/** Rotas de leitura do jogo e da disponibilidade. */
export const matchRoutes: FastifyPluginAsync<AppDeps> = async (app, { store }) => {
  /** GET /api/matches/current: o jogo à venda. */
  app.get('/matches/current', async (): Promise<Match> => {
    const match = await store.getCurrentMatch();
    if (!match) throw new ApiError(404, API_ERROR_CODES.notFound, 'Nenhum jogo à venda');
    return match;
  });
};
