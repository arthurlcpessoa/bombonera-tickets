import { afterEach, describe, expect, it } from 'vitest';
import { CURRENT_MATCH } from '../domain/match';
import { freeSeats, testApp, testInventory } from '../test/helpers';

let close: (() => Promise<void>) | undefined;
afterEach(async () => close?.());

describe('segurança básica', () => {
  it('cabeçalhos do Helmet em toda resposta', async () => {
    const { app } = await testApp();
    close = () => app.close();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('criar reserva tem limite próprio por minuto: passou, 429 no formato único', async () => {
    const { app } = await testApp({ RATE_LIMIT_HOLDS_MAX: '2' });
    close = () => app.close();
    const seats = freeSeats(testInventory(), 3);
    const post = (seatId: string) =>
      app.inject({
        method: 'POST',
        url: '/api/holds',
        payload: { matchId: CURRENT_MATCH.id, seatIds: [seatId] },
      });
    expect((await post(seats[0])).statusCode).toBe(201);
    expect((await post(seats[1])).statusCode).toBe(201);
    const blocked = await post(seats[2]);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
    // O limite das reservas não atrapalha as consultas.
    expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
  });

  it('limite geral por minuto', async () => {
    const { app } = await testApp({ RATE_LIMIT_MAX: '3' });
    close = () => app.close();
    const codes = [];
    for (let i = 0; i < 4; i++) {
      codes.push((await app.inject({ method: 'GET', url: '/api/health' })).statusCode);
    }
    expect(codes).toEqual([200, 200, 200, 429]);
  });

  it('corpo grande demais → 413, sem detalhes internos', async () => {
    const { app } = await testApp();
    close = () => app.close();
    const res = await app.inject({
      method: 'POST',
      url: '/api/holds',
      payload: { matchId: CURRENT_MATCH.id, seatIds: ['x'.repeat(40_000)] },
    });
    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Requisição grande demais.' },
    });
  });

  it('em produção, erro inesperado (500) não mostra a mensagem interna nem o stack trace', async () => {
    const { app, store } = await testApp({ NODE_ENV: 'production' });
    close = () => app.close();
    store.getCurrentMatch = async () => {
      throw new Error('segredo interno: conexão em 10.0.0.5');
    };
    const res = await app.inject({ method: 'GET', url: '/api/matches/current' });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('segredo');
    expect(res.body).not.toContain('at ');
    expect(res.json()).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
  });
});
