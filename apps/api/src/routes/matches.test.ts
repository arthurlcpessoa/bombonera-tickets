import {
  DEFAULT_STANDS_MODEL,
  SECTORS,
  simulatedSoldSeatIds,
  SectorSeatsResponseSchema,
  SectorsResponseSchema,
  getCategory,
  seatIdFromCode,
} from '@bombonera/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { CURRENT_MATCH } from '../domain/match';
import { testApp, testInventory } from '../test/helpers';

const MATCH_ID = CURRENT_MATCH.id;
let close: (() => Promise<void>) | undefined;
afterEach(async () => close?.());

async function app() {
  const t = await testApp();
  close = () => t.app.close();
  return t;
}

describe('GET /api/matches/:id/sectors', () => {
  it('lista os 29 setores com preço em centavos, capacidade e livres', async () => {
    const { app: api } = await app();
    const res = await api.inject({ method: 'GET', url: `/api/matches/${MATCH_ID}/sectors` });
    expect(res.statusCode).toBe(200);
    const body = SectorsResponseSchema.parse(res.json());
    expect(body.sectors).toHaveLength(SECTORS.length);

    for (const sector of SECTORS) {
      const row = body.sectors.find((s) => s.sectorId === sector.id)!;
      // Mesma capacidade que o site calcula pela geometria, e o preço do catálogo × 100.
      expect(row.capacity).toBe(sector.capacity);
      expect(row.priceCents).toBe(getCategory(sector.categoryId).price * 100);
      expect(row.available + row.held + row.sold).toBe(row.capacity);
      expect(row.held).toBe(0);
    }
  });

  it('a disponibilidade inicial é a mesma da simulação antiga (mesma semente)', async () => {
    const { app: api } = await app();
    const res = await api.inject({ method: 'GET', url: `/api/matches/${MATCH_ID}/sectors` });
    const body = SectorsResponseSchema.parse(res.json());
    for (const sector of SECTORS) {
      const row = body.sectors.find((s) => s.sectorId === sector.id)!;
      const sold = simulatedSoldSeatIds(sector, DEFAULT_STANDS_MODEL).size;
      expect(row.sold).toBe(sold);
      expect(row.available).toBe(sector.capacity - sold);
    }
  });

  it('jogo inexistente → 404', async () => {
    const { app: api } = await app();
    const res = await api.inject({ method: 'GET', url: '/api/matches/nao-existe/sectors' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('id com caracteres estranhos → 400', async () => {
    const { app: api } = await app();
    const res = await api.inject({ method: 'GET', url: '/api/matches/a%20b%3Cc/sectors' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});

describe('GET /api/matches/:id/sectors/:sectorId/seats', () => {
  it('lista só as ocupadas, pelo código curto, e elas batem com o inventário', async () => {
    const { app: api } = await app();
    const res = await api.inject({
      method: 'GET',
      url: `/api/matches/${MATCH_ID}/sectors/lower-4/seats`,
    });
    expect(res.statusCode).toBe(200);
    const body = SectorSeatsResponseSchema.parse(res.json());
    expect(body.held).toEqual([]);
    expect(body.sold[0]).toMatch(/^F\d{2}-C\d{2}$/);

    const soldInInventory = testInventory()
      .matchSeats.filter((ms) => ms.status === 'SOLD' && ms.seatId.startsWith('lower-4:'))
      .map((ms) => ms.seatId);
    expect(body.sold.map((code) => seatIdFromCode('lower-4', code))).toEqual(soldInInventory);
  });

  it('setor inexistente → 404', async () => {
    const { app: api } = await app();
    const res = await api.inject({
      method: 'GET',
      url: `/api/matches/${MATCH_ID}/sectors/upper-99/seats`,
    });
    expect(res.statusCode).toBe(404);
  });
});
