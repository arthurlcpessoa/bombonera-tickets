import { HealthResponseSchema, MatchSchema } from '@bombonera/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { testApp } from '../test/helpers';

let close: (() => Promise<void>) | undefined;
afterEach(async () => close?.());

describe('GET /api/health', () => {
  it('responde ok e diz qual armazenamento está ligado', async () => {
    const { app } = await testApp();
    close = () => app.close();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = HealthResponseSchema.parse(res.json());
    expect(body.store).toBe('memory');
  });
});

describe('GET /api/matches/current', () => {
  it('devolve o jogo à venda', async () => {
    const { app } = await testApp();
    close = () => app.close();
    const res = await app.inject({ method: 'GET', url: '/api/matches/current' });
    expect(res.statusCode).toBe(200);
    const match = MatchSchema.parse(res.json());
    expect(match.home.id).toBe('boca');
    expect(match.away.id).toBe('river');
  });
});

describe('rota inexistente', () => {
  it('responde 404 no formato único de erro', async () => {
    const { app } = await testApp();
    close = () => app.close();
    const res = await app.inject({ method: 'GET', url: '/api/nao-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
