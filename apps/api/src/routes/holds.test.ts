import {
  CreateHoldResponseSchema,
  HoldConflictDetailsSchema,
  HoldResponseSchema,
  SectorSeatsResponseSchema,
} from '@bombonera/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { HOLD_TTL_MS } from '../domain/holds';
import { CURRENT_MATCH } from '../domain/match';
import { freeSeats, testApp, testInventory } from '../test/helpers';

const MATCH_ID = CURRENT_MATCH.id;
let close: (() => Promise<void>) | undefined;
afterEach(async () => close?.());

async function setup() {
  const t = await testApp();
  close = () => t.app.close();
  const post = (body: Record<string, unknown>) =>
    t.app.inject({ method: 'POST', url: '/api/holds', payload: body });
  const get = (id: string, token?: string) =>
    t.app.inject({
      method: 'GET',
      url: `/api/holds/${id}`,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const del = (id: string, token: string) =>
    t.app.inject({
      method: 'DELETE',
      url: `/api/holds/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
  const sectorSeats = async (sectorId = 'lower-4') =>
    SectorSeatsResponseSchema.parse(
      (
        await t.app.inject({
          method: 'GET',
          url: `/api/matches/${MATCH_ID}/sectors/${sectorId}/seats`,
        })
      ).json(),
    );
  return { ...t, post, get, del, sectorSeats };
}

describe('POST /api/holds', () => {
  it('reserva por 10 minutos e devolve token, cadeiras e total calculado pelo servidor', async () => {
    const { post, clock } = await setup();
    const seatIds = freeSeats(testInventory(), 2);
    const res = await post({ matchId: MATCH_ID, seatIds, totalCents: 1 }); // preço "adulterado"
    expect(res.statusCode).toBe(201);
    const body = CreateHoldResponseSchema.parse(res.json());

    expect(body.status).toBe('ACTIVE');
    expect(body.token.length).toBeGreaterThan(30);
    expect(new Date(body.expiresAt).getTime()).toBe(clock.now().getTime() + HOLD_TTL_MS);
    expect(body.seats.map((s) => s.seatId)).toEqual(seatIds);
    expect(body.seats[0]).toMatchObject({ sectorId: 'lower-4', priceCents: 6_500_000 });
    expect(body.totalCents).toBe(13_000_000); // 2 × $65.000, ignorando o "totalCents: 1"
  });

  it('a cadeira reservada aparece como "held" para todo mundo', async () => {
    const { post, sectorSeats } = await setup();
    const seatIds = freeSeats(testInventory(), 1);
    await post({ matchId: MATCH_ID, seatIds });
    expect((await sectorSeats()).held).toEqual([seatIds[0].split(':')[1]]);
  });

  it('409 com a lista das cadeiras que já não estavam livres', async () => {
    const { post } = await setup();
    const [a, b, c] = freeSeats(testInventory(), 3);
    await post({ matchId: MATCH_ID, seatIds: [a] });
    const res = await post({ matchId: MATCH_ID, seatIds: [b, a, c] });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('HOLD_CONFLICT');
    expect(HoldConflictDetailsSchema.parse(res.json().error.details).unavailable).toEqual([a]);
  });

  it('400 para mais de 6 cadeiras, cadeira repetida, id inválido ou corpo malformado', async () => {
    const { post, app } = await setup();
    const seats = freeSeats(testInventory(), 7);
    for (const body of [
      { matchId: MATCH_ID, seatIds: seats },
      { matchId: MATCH_ID, seatIds: [seats[0], seats[0]] },
      { matchId: MATCH_ID, seatIds: ['nao-e-uma-cadeira'] },
      { seatIds: [seats[0]] },
    ]) {
      const res = await post(body);
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    }
    const broken = await app.inject({
      method: 'POST',
      url: '/api/holds',
      headers: { 'content-type': 'application/json' },
      payload: '{ isto não é JSON',
    });
    expect(broken.statusCode).toBe(400);
    expect(broken.json().error).toBeDefined();
  });

  it('400 para cadeira que não existe, 404 para jogo que não existe', async () => {
    const { post } = await setup();
    const unknown = await post({ matchId: MATCH_ID, seatIds: ['lower-4:F99-C99'] });
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json().error.code).toBe('UNKNOWN_SEATS');
    const noMatch = await post({ matchId: 'outro-jogo', seatIds: freeSeats(testInventory(), 1) });
    expect(noMatch.statusCode).toBe(404);
  });

  it('CONCORRÊNCIA: 20 requisições simultâneas pela mesma cadeira → 1 × 201 e 19 × 409', async () => {
    const { post } = await setup();
    const seatIds = freeSeats(testInventory(), 1);
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => post({ matchId: MATCH_ID, seatIds })),
    );
    const codes = responses.map((r) => r.statusCode);
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(19);
  });
});

describe('GET /api/holds/:id', () => {
  it('com o token: estado atual; depois de 10 min, EXPIRED', async () => {
    const { post, get, clock } = await setup();
    const created = CreateHoldResponseSchema.parse(
      (await post({ matchId: MATCH_ID, seatIds: freeSeats(testInventory(), 1) })).json(),
    );
    const res = await get(created.holdId, created.token);
    expect(res.statusCode).toBe(200);
    expect(HoldResponseSchema.parse(res.json()).status).toBe('ACTIVE');
    expect(res.json()).not.toHaveProperty('token'); // o token só aparece ao criar

    clock.advance(HOLD_TTL_MS);
    expect((await get(created.holdId, created.token)).json().status).toBe('EXPIRED');
  });

  it('sem token → 401; token errado ou reserva inexistente → 404 (a mesma resposta)', async () => {
    const { post, get } = await setup();
    const created = CreateHoldResponseSchema.parse(
      (await post({ matchId: MATCH_ID, seatIds: freeSeats(testInventory(), 1) })).json(),
    );
    expect((await get(created.holdId)).statusCode).toBe(401);
    const wrong = await get(created.holdId, 'token-errado');
    const missing = await get('reserva-que-nao-existe', created.token);
    expect(wrong.statusCode).toBe(404);
    expect(missing.statusCode).toBe(404);
    expect(wrong.json()).toEqual(missing.json());
  });
});

describe('DELETE /api/holds/:id', () => {
  it('cancela, libera as cadeiras e pode ser repetido', async () => {
    const { post, del, sectorSeats } = await setup();
    const seatIds = freeSeats(testInventory(), 2);
    const created = CreateHoldResponseSchema.parse(
      (await post({ matchId: MATCH_ID, seatIds })).json(),
    );
    const res = await del(created.holdId, created.token);
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('CANCELLED');
    expect((await sectorSeats()).held).toEqual([]);
    expect((await del(created.holdId, created.token)).json().status).toBe('CANCELLED');

    // Liberadas: outra pessoa reserva na hora.
    expect((await post({ matchId: MATCH_ID, seatIds })).statusCode).toBe(201);
  });

  it('token errado não cancela', async () => {
    const { post, del, sectorSeats } = await setup();
    const created = CreateHoldResponseSchema.parse(
      (await post({ matchId: MATCH_ID, seatIds: freeSeats(testInventory(), 1) })).json(),
    );
    expect((await del(created.holdId, 'token-errado')).statusCode).toBe(404);
    expect((await sectorSeats()).held).toHaveLength(1);
  });
});
