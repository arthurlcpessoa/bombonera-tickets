/**
 * A "tomada padrão" do armazenamento (padrão repositório, ou "portas e adaptadores").
 *
 * As rotas da API só falam com esta interface, nunca com os dados diretamente. Hoje o que está
 * ligado nela é o InMemoryStore (dados na memória); na Fase 5C será um PostgresStore. Como as duas
 * implementações cumprem o MESMO contrato (veja storeContract.ts), trocar uma pela outra não muda
 * rotas, regras, front nem testes.
 *
 * Todos os métodos são `async`: na memória a resposta é imediata, mas no banco leva milissegundos,
 * e quem chama já está preparado para esperar.
 */

/** Estado de uma cadeira num jogo. */
export type SeatStatus = 'AVAILABLE' | 'HELD' | 'SOLD';

/** Estado de uma reserva temporária. */
export type HoldStatus = 'ACTIVE' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';

export interface TeamRecord {
  /** Identificador curto, usado pelo site para achar o escudo (ex.: "boca"). */
  id: string;
  name: string;
}

/** Tabela Match: o jogo. */
export interface MatchRecord {
  id: string;
  competition: string;
  round: string;
  home: TeamRecord;
  away: TeamRecord;
  /** Data e hora no padrão ISO, com o fuso de Buenos Aires (−03:00). */
  kickoff: string;
  venue: string;
}

/** Tabela Seat: o inventário fixo do estádio (igual em todos os jogos). */
export interface SeatRecord {
  /** Mesmo id do site, ex.: "upper-3:F12-C07". */
  id: string;
  sectorId: string;
  row: number;
  number: number;
}

/** Tabela MatchSeat: o estado de cada cadeira NAQUELE jogo. */
export interface MatchSeatRecord {
  matchId: string;
  seatId: string;
  status: SeatStatus;
  /** Reserva que segura a cadeira (só quando HELD). */
  holdId: string | null;
  /** Preço em centavos de peso argentino (inteiro). */
  priceCents: number;
}

/** Uma cadeira dentro de uma reserva, com o preço calculado pelo servidor. */
export interface HeldSeat {
  seatId: string;
  priceCents: number;
}

/** Tabela Hold: a reserva temporária. */
export interface HoldRecord {
  id: string;
  matchId: string;
  /**
   * "Impressão digital" (hash SHA-256) do token secreto. O token em si só existe na resposta que
   * criou a reserva: se alguém copiar os dados guardados, não consegue usar as reservas.
   */
  tokenHash: string;
  seats: HeldSeat[];
  totalCents: number;
  createdAt: Date;
  expiresAt: Date;
  status: HoldStatus;
}

/** Resumo de um setor para o mapa: quantas cadeiras há e quantas estão livres. */
export interface SectorAvailability {
  sectorId: string;
  /** Preço de uma cadeira do setor, em centavos. */
  priceCents: number;
  capacity: number;
  available: number;
  held: number;
  sold: number;
}

/** Estado das cadeiras de um setor: só as ocupadas; o que não estiver nas listas está livre. */
export interface SectorSeatStates {
  sold: string[];
  held: string[];
}

export interface CreateHoldInput {
  matchId: string;
  seatIds: readonly string[];
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Resultado de createHold. Em vez de lançar um erro no conflito, devolvemos quais cadeiras
 * estavam indisponíveis: para quem chama, conflito é um resultado esperado, não uma falha.
 */
export type CreateHoldResult =
  | { ok: true; hold: HoldRecord }
  | { ok: false; reason: 'unavailable'; unavailable: string[] }
  | { ok: false; reason: 'unknown-seats'; unknown: string[] };

export interface TicketingStore {
  /** Confere se o armazenamento está respondendo (lança um erro se não estiver). */
  health(): Promise<void>;

  /** O jogo à venda agora (null se não houver). */
  getCurrentMatch(): Promise<MatchRecord | null>;
  getMatch(matchId: string): Promise<MatchRecord | null>;

  /** Por setor: preço, capacidade e livres. Reserva vencida conta como livre. */
  getSectorAvailability(matchId: string): Promise<SectorAvailability[]>;
  /** Ids vendidos e reservados de um setor (null se o setor não existe). */
  getSectorSeatStates(matchId: string, sectorId: string): Promise<SectorSeatStates | null>;

  /**
   * Reserva as cadeiras de uma vez: ATÔMICO (tudo ou nada). Se alguma não estiver livre, nenhuma é
   * reservada e o resultado diz quais estavam indisponíveis.
   */
  createHold(input: CreateHoldInput): Promise<CreateHoldResult>;
  /** A reserva como está guardada (o status pode estar "ACTIVE" e já vencida: veja effectiveHoldStatus). */
  getHold(holdId: string): Promise<HoldRecord | null>;
  /** Cancela uma reserva ativa e libera as cadeiras. Devolve a reserva atualizada (null se não existe). */
  cancelHold(holdId: string): Promise<HoldRecord | null>;
  /** Marca como EXPIRED as reservas ativas vencidas e libera as cadeiras. Devolve quantas expiraram. */
  expireHolds(): Promise<number>;
}

/** O "relógio" do sistema. Injetável: nos testes, um relógio falso avança 10 minutos na hora. */
export type Clock = () => Date;
