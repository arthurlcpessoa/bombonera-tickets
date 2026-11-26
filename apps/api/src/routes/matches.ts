import {
  API_ERROR_CODES,
  IdParamSchema,
  seatCode,
  type Match,
  type SectorSeatsResponse,
  type SectorsResponse,
} from '@bombonera/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app';
import { ApiError } from '../http/errors';

const MatchParams = z.object({ id: IdParamSchema });
const SectorParams = z.object({ id: IdParamSchema, sectorId: IdParamSchema });

/** Rotas de leitura do jogo e da disponibilidade. */
export const matchRoutes: FastifyPluginAsync<AppDeps> = async (app, { store }) => {
  /** Lança 404 se o jogo não existe. */
  async function requireMatch(matchId: string) {
    const match = await store.getMatch(matchId);
    if (!match) throw new ApiError(404, API_ERROR_CODES.notFound, 'Jogo não encontrado');
    return match;
  }

  /** GET /api/matches/current: o jogo à venda. */
  app.get('/matches/current', async (): Promise<Match> => {
    const match = await store.getCurrentMatch();
    if (!match) throw new ApiError(404, API_ERROR_CODES.notFound, 'Nenhum jogo à venda');
    return match;
  });

  /** GET /api/matches/:id/sectors: por setor, preço, capacidade e lugares livres. */
  app.get('/matches/:id/sectors', async (request): Promise<SectorsResponse> => {
    const { id } = MatchParams.parse(request.params);
    await requireMatch(id);
    return { matchId: id, sectors: await store.getSectorAvailability(id) };
  });

  /**
   * GET /api/matches/:id/sectors/:sectorId/seats: estado das cadeiras do setor, COMPACTO.
   *
   * Só as ocupadas, pelo código curto ("F12-C07"); o que não estiver nas listas está livre.
   * Um setor tem até ~2.300 cadeiras: listar só as ocupadas, sem repetir o nome do setor em cada
   * uma, deixa a resposta pequena (e ela é pedida de novo a cada ~15 s por quem está olhando).
   * Usamos o NOME da cadeira, não a posição numa lista: se um dia o gerador mudar a ordem, um nome
   * errado vira "cadeira desconhecida", enquanto uma posição errada pintaria a cadeira errada.
   */
  app.get('/matches/:id/sectors/:sectorId/seats', async (request): Promise<SectorSeatsResponse> => {
    const { id, sectorId } = SectorParams.parse(request.params);
    await requireMatch(id);
    const states = await store.getSectorSeatStates(id, sectorId);
    if (!states) throw new ApiError(404, API_ERROR_CODES.notFound, 'Setor não encontrado');
    return {
      matchId: id,
      sectorId,
      sold: states.sold.map(seatCode),
      held: states.held.map(seatCode),
    };
  });
};
