import { API_ERROR_CODES, type HealthResponse } from '@bombonera/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../app';
import { ApiError } from '../http/errors';

/**
 * GET /api/health: "a API está de pé e o armazenamento responde?". Usado por quem monitora o
 * servidor (e, na Fase 6, pela hospedagem para saber se a API subiu).
 */
export const healthRoutes: FastifyPluginAsync<AppDeps> = async (app, { store, storeName, now }) => {
  app.get('/health', async (): Promise<HealthResponse> => {
    try {
      await store.health();
    } catch {
      throw new ApiError(503, API_ERROR_CODES.unavailable, 'Armazenamento indisponível');
    }
    return { status: 'ok', store: storeName, time: now().toISOString() };
  });
};
