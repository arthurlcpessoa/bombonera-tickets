/**
 * SUÍTE DE CONTRATO do armazenamento: os testes de comportamento que QUALQUER implementação da
 * TicketingStore precisa passar.
 *
 * Hoje ela roda contra o InMemoryStore (InMemoryStore.test.ts). Na Fase 5C, a MESMA função roda
 * contra o PostgresStore. Se os dois passam na mesma prova, trocar um pelo outro não muda nada para
 * as rotas, o site ou quem compra: é assim que provamos que a troca é segura.
 *
 * Os testes só usam a interface (nunca os detalhes de uma implementação) e o gerador compartilhado
 * para saber os ids das cadeiras.
 */
import { DEFAULT_STANDS_MODEL, getSector, getSectorSeats } from '@bombonera/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { effectiveHoldStatus, hashToken, HOLD_TTL_MS, holdExpiresAt } from '../domain/holds';
import type { Clock, TicketingStore } from './TicketingStore';

/** Relógio falso controlado pelo teste. */
export interface TestClock {
  now: Clock;
  advance(ms: number): void;
}

export interface StoreContractContext {
  /** Cria um armazenamento NOVO (estado inicial do jogo), usando o relógio dado. */
  createStore(clock: TestClock): Promise<TicketingStore> | TicketingStore;
  /** Id do jogo à venda no estado inicial. */
  matchId: string;
}

const SECTOR = 'lower-4';

export function describeStoreContract(name: string, ctx: StoreContractContext) {
  describe(`contrato da TicketingStore: ${name}`, () => {
    let store: TicketingStore;
    let clock: TestClock;
    let free: string[]; // cadeiras livres do setor de teste, no estado inicial
    let sold: string[]; // cadeiras vendidas do setor de teste, no estado inicial

    beforeEach(async () => {
      let current = new Date('2026-12-01T12:00:00Z').getTime();
      clock = { now: () => new Date(current), advance: (ms) => (current += ms) };
      store = await ctx.createStore(clock);
      const states = await store.getSectorSeatStates(ctx.matchId, SECTOR);
      const occupied = new Set([...(states?.sold ?? []), ...(states?.held ?? [])]);
      const all = getSectorSeats(getSector(SECTOR)!, DEFAULT_STANDS_MODEL).map((s) => s.id);
      free = all.filter((id) => !occupied.has(id));
      sold = states?.sold ?? [];
    });

    /** Atalho: tenta reservar com um token qualquer e o prazo padrão de 10 minutos. */
    const hold = (seatIds: string[], token = 'token-de-teste') =>
      store.createHold({
        matchId: ctx.matchId,
        seatIds,
        tokenHash: hashToken(token),
        expiresAt: holdExpiresAt(clock.now()),
      });

    const sectorRow = async () =>
      (await store.getSectorAvailability(ctx.matchId)).find((s) => s.sectorId === SECTOR)!;

    it('responde ao health e tem o jogo à venda', async () => {
      await expect(store.health()).resolves.toBeUndefined();
      expect((await store.getCurrentMatch())?.id).toBe(ctx.matchId);
      expect(await store.getMatch('nao-existe')).toBeNull();
    });

    it('reserva cadeiras livres: ACTIVE, total calculado pelo armazenamento e cadeiras "held"', async () => {
      const before = await sectorRow();
      const result = await hold(free.slice(0, 3));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.hold.status).toBe('ACTIVE');
      expect(result.hold.seats.map((s) => s.seatId)).toEqual(free.slice(0, 3));
      expect(result.hold.totalCents).toBe(before.priceCents * 3);

      const states = await store.getSectorSeatStates(ctx.matchId, SECTOR);
      expect(states?.held.sort()).toEqual(free.slice(0, 3).sort());
      const after = await sectorRow();
      expect(after.available).toBe(before.available - 3);
      expect(after.held).toBe(3);
    });

    it('conflito é TUDO OU NADA: se uma cadeira não está livre, nenhuma é reservada', async () => {
      await hold([free[0]]);
      const before = await sectorRow();

      const result = await hold([free[1], free[0], free[2]]);
      expect(result).toEqual({ ok: false, reason: 'unavailable', unavailable: [free[0]] });

      // free[1] e free[2] continuam livres: nada foi reservado pela metade.
      const after = await sectorRow();
      expect(after).toEqual(before);
      expect(await hold([free[1], free[2]])).toMatchObject({ ok: true });
    });

    it('cadeira vendida não pode ser reservada', async () => {
      expect(await hold([sold[0], free[0]])).toEqual({
        ok: false,
        reason: 'unavailable',
        unavailable: [sold[0]],
      });
    });

    it('cadeira que não existe no jogo é recusada sem reservar nada', async () => {
      const result = await hold([free[0], 'lower-4:F99-C99']);
      expect(result).toEqual({ ok: false, reason: 'unknown-seats', unknown: ['lower-4:F99-C99'] });
      expect((await sectorRow()).held).toBe(0);
    });

    it('cancelar libera as cadeiras; cancelar de novo não muda nada', async () => {
      const result = await hold(free.slice(0, 2));
      if (!result.ok) throw new Error('deveria reservar');

      const cancelled = await store.cancelHold(result.hold.id);
      expect(cancelled?.status).toBe('CANCELLED');
      expect((await sectorRow()).held).toBe(0);
      expect((await store.cancelHold(result.hold.id))?.status).toBe('CANCELLED');
      expect((await store.getHold(result.hold.id))?.status).toBe('CANCELLED');
      expect(await store.cancelHold('nao-existe')).toBeNull();

      // Liberadas de verdade: outra pessoa consegue reservar.
      expect(await hold(free.slice(0, 2), 'outra-pessoa')).toMatchObject({ ok: true });
    });

    it('expiração preguiçosa: depois de 10 min a cadeira já conta como livre, antes de qualquer limpeza', async () => {
      const result = await hold([free[0]]);
      if (!result.ok) throw new Error('deveria reservar');

      clock.advance(HOLD_TTL_MS - 1);
      expect((await sectorRow()).held).toBe(1);
      expect(await hold([free[0]], 'outra-pessoa')).toMatchObject({ ok: false });

      clock.advance(1); // vence exatamente agora
      expect((await sectorRow()).held).toBe(0);
      const stored = await store.getHold(result.hold.id);
      expect(effectiveHoldStatus(stored!, clock.now())).toBe('EXPIRED');
      // E dá para reservar de novo, mesmo sem o job ter rodado.
      expect(await hold([free[0]], 'outra-pessoa')).toMatchObject({ ok: true });
    });

    it('expireHolds marca as vencidas como EXPIRED e devolve quantas foram', async () => {
      const first = await hold([free[0]]);
      clock.advance(5 * 60_000);
      const second = await hold([free[1]]);
      if (!first.ok || !second.ok) throw new Error('deveria reservar');

      clock.advance(5 * 60_000); // só a primeira venceu
      expect(await store.expireHolds()).toBe(1);
      expect((await store.getHold(first.hold.id))?.status).toBe('EXPIRED');
      expect((await store.getHold(second.hold.id))?.status).toBe('ACTIVE');
      expect(await store.expireHolds()).toBe(0); // nada novo para expirar
    });

    it('limpar uma reserva vencida não solta a cadeira que outra pessoa já pegou', async () => {
      const old = await hold([free[0]], 'pessoa-a');
      clock.advance(HOLD_TTL_MS);
      const fresh = await hold([free[0]], 'pessoa-b'); // pegou a cadeira da reserva vencida
      if (!old.ok || !fresh.ok) throw new Error('deveria reservar');

      expect(await store.expireHolds()).toBe(1);
      await store.cancelHold(old.hold.id);
      const states = await store.getSectorSeatStates(ctx.matchId, SECTOR);
      expect(states?.held).toEqual([free[0]]); // continua da pessoa B
    });

    it('cancelar uma reserva que já venceu registra EXPIRED (não CANCELLED)', async () => {
      const result = await hold([free[0]]);
      if (!result.ok) throw new Error('deveria reservar');
      clock.advance(HOLD_TTL_MS + 1);
      expect((await store.cancelHold(result.hold.id))?.status).toBe('EXPIRED');
    });

    it('CONCORRÊNCIA: 20 reservas simultâneas da mesma cadeira → exatamente 1 vencedora', async () => {
      const seat = free[0];
      const results = await Promise.all(
        Array.from({ length: 20 }, (_, i) => hold([seat], `pessoa-${i}`)),
      );
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok)).toHaveLength(19);
      expect((await store.getSectorSeatStates(ctx.matchId, SECTOR))?.held).toEqual([seat]);
    });

    it('consultas de jogo ou setor inexistente não quebram', async () => {
      expect(await store.getSectorAvailability('nao-existe')).toEqual([]);
      expect(await store.getSectorSeatStates(ctx.matchId, 'upper-99')).toBeNull();
      expect(await store.getHold('nao-existe')).toBeNull();
    });
  });
}
