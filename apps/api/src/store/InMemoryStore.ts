/**
 * Armazenamento em MEMÓRIA: as "tabelas" são Maps dentro do processo da API.
 * Rápido e sem instalar nada, mas os dados somem ao reiniciar o servidor (esperado até a Fase 5C).
 *
 * ATOMICIDADE SEM BANCO (o ponto mais importante deste arquivo)
 *
 * O Node executa um trecho de código por vez: o "event loop" é uma fila de tarefas com um único
 * atendente, que só troca de tarefa quando a atual chega num `await`. Em `createHold`, a checagem
 * ("todas estão livres?") e a escrita ("agora são desta reserva") acontecem SEM nenhum `await` no
 * meio. Por isso nenhuma outra requisição consegue se intrometer entre as duas etapas.
 *
 *   Pessoa A: [está livre? sim → agora é minha]                     ← um bloco só, sem pausa
 *   Pessoa B:                                   [está livre? NÃO → 409]
 *
 * Se houvesse um `await` entre as etapas, o atendente poderia atender B justamente ali:
 *
 *   Pessoa A: [está livre? sim]  ⏸ await …                [agora é minha]
 *   Pessoa B:                    [está livre? sim] [agora é minha]          ← as DUAS "ganham"
 *
 * Isso é uma condição de corrida. Na Fase 5C, com vários processos da API ao mesmo tempo, o truque
 * do event loop deixa de valer e quem garante a atomicidade é a transação do banco.
 */
import { holdTotal, isHoldExpired } from '../domain/holds';
import type { Inventory } from './seed';
import type {
  Clock,
  CreateHoldInput,
  CreateHoldResult,
  HoldRecord,
  MatchRecord,
  MatchSeatRecord,
  SectorAvailability,
  SectorSeatStates,
  SeatRecord,
  TicketingStore,
} from './TicketingStore';

/** Estado efetivo de uma cadeira agora (com a expiração preguiçosa aplicada). */
type EffectiveSeatState = 'free' | 'held' | 'sold';

export interface InMemoryStoreOptions {
  inventory: Inventory;
  now: Clock;
  /** Gera ids de reserva. Padrão: UUID aleatório. */
  newId?: () => string;
}

export class InMemoryStore implements TicketingStore {
  private readonly now: Clock;
  private readonly newId: () => string;
  private readonly matches = new Map<string, MatchRecord>();
  private readonly currentMatchId: string;
  private readonly seats = new Map<string, SeatRecord>();
  /** Ids das cadeiras de cada setor, na ordem do gerador. */
  private readonly seatsBySector = new Map<string, string[]>();
  /** Chave "matchId|seatId", como a chave única (matchId, seatId) da tabela no banco. */
  private readonly matchSeats = new Map<string, MatchSeatRecord>();
  private readonly holds = new Map<string, HoldRecord>();

  constructor({ inventory, now, newId = () => crypto.randomUUID() }: InMemoryStoreOptions) {
    this.now = now;
    this.newId = newId;
    this.matches.set(inventory.match.id, inventory.match);
    this.currentMatchId = inventory.match.id;
    for (const seat of inventory.seats) {
      this.seats.set(seat.id, seat);
      const list = this.seatsBySector.get(seat.sectorId) ?? [];
      list.push(seat.id);
      this.seatsBySector.set(seat.sectorId, list);
    }
    for (const ms of inventory.matchSeats)
      this.matchSeats.set(key(ms.matchId, ms.seatId), { ...ms });
  }

  async health(): Promise<void> {
    if (this.matchSeats.size === 0) throw new Error('Inventário vazio');
  }

  async getCurrentMatch(): Promise<MatchRecord | null> {
    return this.getMatch(this.currentMatchId);
  }

  async getMatch(matchId: string): Promise<MatchRecord | null> {
    const match = this.matches.get(matchId);
    return match ? structuredClone(match) : null;
  }

  async getSectorAvailability(matchId: string): Promise<SectorAvailability[]> {
    if (!this.matches.has(matchId)) return [];
    const now = this.now();
    const result: SectorAvailability[] = [];
    for (const [sectorId, seatIds] of this.seatsBySector) {
      const counts = { free: 0, held: 0, sold: 0 };
      let priceCents = 0;
      for (const seatId of seatIds) {
        const ms = this.matchSeats.get(key(matchId, seatId));
        if (!ms) continue;
        priceCents = ms.priceCents;
        counts[this.stateOf(ms, now)]++;
      }
      result.push({
        sectorId,
        priceCents,
        capacity: seatIds.length,
        available: counts.free,
        held: counts.held,
        sold: counts.sold,
      });
    }
    return result;
  }

  async getSectorSeatStates(matchId: string, sectorId: string): Promise<SectorSeatStates | null> {
    const seatIds = this.seatsBySector.get(sectorId);
    if (!seatIds || !this.matches.has(matchId)) return null;
    const now = this.now();
    const sold: string[] = [];
    const held: string[] = [];
    for (const seatId of seatIds) {
      const ms = this.matchSeats.get(key(matchId, seatId));
      if (!ms) continue;
      const state = this.stateOf(ms, now);
      if (state === 'sold') sold.push(seatId);
      else if (state === 'held') held.push(seatId);
    }
    return { sold, held };
  }

  /**
   * Atômico: do começo ao fim NÃO há nenhum `await` (veja o comentário no topo do arquivo).
   * Uma função `async` roda de forma síncrona até o primeiro `await`; aqui não há nenhum.
   */
  async createHold({
    matchId,
    seatIds,
    tokenHash,
    expiresAt,
  }: CreateHoldInput): Promise<CreateHoldResult> {
    const now = this.now();

    // 1) Todas existem neste jogo?
    const unknown = seatIds.filter((id) => !this.matchSeats.has(key(matchId, id)));
    if (unknown.length > 0) return { ok: false, reason: 'unknown-seats', unknown };

    // 2) Todas estão livres? (reserva vencida conta como livre)
    const rows = seatIds.map((id) => this.matchSeats.get(key(matchId, id))!);
    const unavailable = rows
      .filter((ms) => this.stateOf(ms, now) !== 'free')
      .map((ms) => ms.seatId);
    if (unavailable.length > 0) return { ok: false, reason: 'unavailable', unavailable };

    // 3) Agora são desta reserva. Nada aconteceu entre o passo 2 e este (sem await).
    const seats = rows.map((ms) => ({ seatId: ms.seatId, priceCents: ms.priceCents }));
    const hold: HoldRecord = {
      id: this.newId(),
      matchId,
      tokenHash,
      seats,
      totalCents: holdTotal(seats),
      createdAt: now,
      expiresAt,
      status: 'ACTIVE',
    };
    for (const ms of rows) {
      ms.status = 'HELD';
      ms.holdId = hold.id;
    }
    this.holds.set(hold.id, hold);
    return { ok: true, hold: structuredClone(hold) };
  }

  async getHold(holdId: string): Promise<HoldRecord | null> {
    const hold = this.holds.get(holdId);
    return hold ? structuredClone(hold) : null;
  }

  async cancelHold(holdId: string): Promise<HoldRecord | null> {
    const hold = this.holds.get(holdId);
    if (!hold) return null;
    if (hold.status === 'ACTIVE') {
      // Já vencida? Então ela expirou (não foi cancelada): o registro fica fiel ao que aconteceu.
      hold.status = isHoldExpired(hold, this.now()) ? 'EXPIRED' : 'CANCELLED';
      this.release(hold);
    }
    return structuredClone(hold);
  }

  async expireHolds(): Promise<number> {
    const now = this.now();
    let count = 0;
    for (const hold of this.holds.values()) {
      if (!isHoldExpired(hold, now)) continue;
      hold.status = 'EXPIRED';
      this.release(hold);
      count++;
    }
    return count;
  }

  // -------------------------------------------------------------------------------------------

  /**
   * Libera as cadeiras de uma reserva. Só mexe nas que AINDA são dela: se a reserva venceu e outra
   * pessoa já pegou a cadeira, a cadeira agora pertence à reserva nova e fica como está.
   */
  private release(hold: HoldRecord): void {
    for (const { seatId } of hold.seats) {
      const ms = this.matchSeats.get(key(hold.matchId, seatId));
      if (ms && ms.status === 'HELD' && ms.holdId === hold.id) {
        ms.status = 'AVAILABLE';
        ms.holdId = null;
      }
    }
  }

  /** Estado efetivo: HELD por uma reserva vencida (ou que não está mais ativa) conta como livre. */
  private stateOf(ms: MatchSeatRecord, now: Date): EffectiveSeatState {
    if (ms.status === 'SOLD') return 'sold';
    if (ms.status === 'AVAILABLE') return 'free';
    const hold = ms.holdId ? this.holds.get(ms.holdId) : undefined;
    if (!hold || hold.status !== 'ACTIVE' || isHoldExpired(hold, now)) return 'free';
    return 'held';
  }
}

function key(matchId: string, seatId: string): string {
  return `${matchId}|${seatId}`;
}
