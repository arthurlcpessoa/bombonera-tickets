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

describe('CORS', () => {
  it('libera a origem do site (do .env) e não libera outras', async () => {
    const { app } = await testApp();
    close = () => app.close();
    const allowed = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const other = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'https://site-malicioso.example' },
    });
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});
