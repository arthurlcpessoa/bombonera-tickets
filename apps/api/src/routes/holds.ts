/**
 * Reserva temporária: POST (criar), GET (consultar) e DELETE (cancelar) em /api/holds.
 *
 * Não há login nesta fase. Quem cria a reserva recebe um TOKEN secreto (a "chave do armário"), que
 * o site guarda e manda nas próximas chamadas no cabeçalho `Authorization: Bearer <token>`.
 */
import {
  API_ERROR_CODES,
  CreateHoldRequestSchema,
  IdParamSchema,
  parseSeatId,
  type CreateHoldResponse,
  type HoldResponse,
} from '@bombonera/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app';
import {
  createHoldToken,
  effectiveHoldStatus,
  hashToken,
  holdExpiresAt,
  tokenMatches,
} from '../domain/holds';
import { ApiError } from '../http/errors';
import type { HoldRecord, TicketingStore } from '../store/TicketingStore';

const HoldParams = z.object({ id: IdParamSchema });

export const holdRoutes: FastifyPluginAsync<AppDeps> = async (app, { store, now }) => {
  /** POST /api/holds { matchId, seatIds } → reserva por 10 minutos. 409 se alguma já não estiver livre. */
  app.post('/holds', async (request, reply): Promise<CreateHoldResponse> => {
    const { matchId, seatIds } = CreateHoldRequestSchema.parse(request.body);
    if (!(await store.getMatch(matchId))) {
      throw new ApiError(404, API_ERROR_CODES.notFound, 'Jogo não encontrado');
    }

    const token = createHoldToken();
    const result = await store.createHold({
      matchId,
      seatIds,
      tokenHash: hashToken(token),
      expiresAt: holdExpiresAt(now()),
    });

    if (!result.ok && result.reason === 'unavailable') {
      throw new ApiError(
        409,
        API_ERROR_CODES.holdConflict,
        result.unavailable.length === 1
          ? 'Uma das cadeiras acabou de ser reservada ou vendida.'
          : 'Algumas cadeiras acabaram de ser reservadas ou vendidas.',
        { unavailable: result.unavailable },
      );
    }
    if (!result.ok) {
      throw new ApiError(400, API_ERROR_CODES.unknownSeats, 'Cadeira inexistente neste jogo.', {
        unknown: result.unknown,
      });
    }

    reply.status(201); // 201 = "criado"
    // O preço e o total vêm do SERVIDOR (do inventário), nunca do navegador.
    return { ...toHoldResponse(result.hold, now()), token };
  });

  /** GET /api/holds/:id (com o token): estado atual da reserva. */
  app.get('/holds/:id', async (request): Promise<HoldResponse> => {
    const hold = await authorizedHold(store, request);
    return toHoldResponse(hold, now());
  });

  /** DELETE /api/holds/:id (com o token): cancela e libera as cadeiras. Repetir não faz mal. */
  app.delete('/holds/:id', async (request): Promise<HoldResponse> => {
    const hold = await authorizedHold(store, request);
    const cancelled = (await store.cancelHold(hold.id)) ?? hold;
    return toHoldResponse(cancelled, now());
  });
};

/**
 * Lê o token do cabeçalho e confere com a reserva.
 * - Sem token (ou mal formatado): 401, "faltou a chave".
 * - Reserva inexistente OU token errado: 404, a mesma resposta nos dois casos. Assim ninguém
 *   descobre quais ids de reserva existem testando chaves.
 */
async function authorizedHold(store: TicketingStore, request: FastifyRequest): Promise<HoldRecord> {
  const { id } = HoldParams.parse(request.params);
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization ?? '');
  if (!match) {
    throw new ApiError(
      401,
      API_ERROR_CODES.unauthorized,
      'Envie o token da reserva no cabeçalho Authorization: Bearer <token>.',
    );
  }
  const hold = await store.getHold(id);
  if (!hold || !tokenMatches(match[1], hold.tokenHash)) {
    throw new ApiError(404, API_ERROR_CODES.notFound, 'Reserva não encontrada.');
  }
  return hold;
}

/** Registro interno → resposta da API (status já com a expiração preguiçosa aplicada). */
function toHoldResponse(hold: HoldRecord, now: Date): HoldResponse {
  return {
    holdId: hold.id,
    matchId: hold.matchId,
    status: effectiveHoldStatus(hold, now),
    expiresAt: hold.expiresAt.toISOString(),
    seats: hold.seats.map(({ seatId, priceCents }) => {
      const parsed = parseSeatId(seatId);
      return {
        seatId,
        sectorId: parsed?.sectorId ?? '',
        row: parsed?.row ?? 1,
        number: parsed?.number ?? 1,
        priceCents,
      };
    }),
    totalCents: hold.totalCents,
  };
}
