/**
 * Contrato da API (Zod): o formato de cada requisição e resposta.
 *
 * Um schema Zod é um "formulário" com as regras de cada campo. A API usa os schemas para recusar
 * dados errados (400) e o site usa os MESMOS schemas para conferir as respostas. Os tipos TypeScript
 * saem dos próprios schemas (`z.infer`), então os dois lados nunca discordam sobre o formato.
 *
 * Dinheiro: sempre em centavos inteiros (`...Cents`), nunca em número com vírgula.
 */
import { z } from 'zod';
import { ORDER_RULES } from './stadium';

// ---------------------------------------------------------------------------------------------
// Peças comuns
// ---------------------------------------------------------------------------------------------

/** Id de cadeira, ex.: "upper-3:F12-C07" (setor : fila - cadeira). */
export const SeatIdSchema = z
  .string()
  .max(40)
  .regex(/^[a-z]+-\d+:F\d{2,}-C\d{2,}$/, 'Id de cadeira inválido');

/** Id de jogo, setor ou reserva vindo da URL: texto curto, só letras, números, - e _. */
export const IdParamSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Id inválido');

/** Centavos: inteiro, nunca negativo. */
const CentsSchema = z.number().int().nonnegative();

/** Formato único de erro: `{ error: { code, message, details? } }`. */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ---------------------------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------------------------

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  /** Qual armazenamento está ligado na "tomada" (ex.: "memory"). */
  store: z.string(),
  time: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const TeamSchema = z.object({ id: z.string(), name: z.string() });

export const MatchSchema = z.object({
  id: z.string(),
  competition: z.string(),
  round: z.string(),
  home: TeamSchema,
  away: TeamSchema,
  /** ISO 8601 com o fuso de Buenos Aires (−03:00). */
  kickoff: z.string(),
  venue: z.string(),
});
export type Match = z.infer<typeof MatchSchema>;

export const SectorAvailabilitySchema = z.object({
  sectorId: z.string(),
  priceCents: CentsSchema,
  capacity: z.number().int().nonnegative(),
  available: z.number().int().nonnegative(),
  held: z.number().int().nonnegative(),
  sold: z.number().int().nonnegative(),
});
export type SectorAvailability = z.infer<typeof SectorAvailabilitySchema>;

export const SectorsResponseSchema = z.object({
  matchId: z.string(),
  sectors: z.array(SectorAvailabilitySchema),
});
export type SectorsResponse = z.infer<typeof SectorsResponseSchema>;

/**
 * Estado das cadeiras de um setor, em formato COMPACTO: só as ocupadas, pelo código curto
 * ("F12-C07", sem o setor, que já está na URL). O que não estiver nas listas está livre.
 * Veja seatCode() e seatIdFromCode().
 */
export const SectorSeatsResponseSchema = z.object({
  matchId: z.string(),
  sectorId: z.string(),
  sold: z.array(z.string()),
  held: z.array(z.string()),
});
export type SectorSeatsResponse = z.infer<typeof SectorSeatsResponseSchema>;

/** "upper-3:F12-C07" → "F12-C07" (o código dentro do setor). */
export function seatCode(seatId: string): string {
  return seatId.slice(seatId.indexOf(':') + 1);
}

/** ("upper-3", "F12-C07") → "upper-3:F12-C07". */
export function seatIdFromCode(sectorId: string, code: string): string {
  return `${sectorId}:${code}`;
}

// ---------------------------------------------------------------------------------------------
// Reserva temporária
// ---------------------------------------------------------------------------------------------

export const CreateHoldRequestSchema = z.object({
  matchId: IdParamSchema,
  seatIds: z
    .array(SeatIdSchema)
    .min(1, 'Escolha pelo menos uma cadeira')
    .max(ORDER_RULES.maxSeats, `No máximo ${ORDER_RULES.maxSeats} cadeiras por compra`)
    .refine((ids) => new Set(ids).size === ids.length, 'Cadeira repetida na lista'),
});
export type CreateHoldRequest = z.infer<typeof CreateHoldRequestSchema>;

export const HoldStatusSchema = z.enum(['ACTIVE', 'CONVERTED', 'EXPIRED', 'CANCELLED']);
export type HoldStatus = z.infer<typeof HoldStatusSchema>;

export const HoldSeatSchema = z.object({
  seatId: z.string(),
  sectorId: z.string(),
  row: z.number().int().positive(),
  number: z.number().int().positive(),
  priceCents: CentsSchema,
});
export type HoldSeat = z.infer<typeof HoldSeatSchema>;

export const HoldResponseSchema = z.object({
  holdId: z.string(),
  matchId: z.string(),
  status: HoldStatusSchema,
  /** Quando a reserva vence (ISO 8601, UTC). */
  expiresAt: z.string(),
  seats: z.array(HoldSeatSchema),
  /** Total calculado pelo SERVIDOR, em centavos. */
  totalCents: CentsSchema,
});
export type HoldResponse = z.infer<typeof HoldResponseSchema>;

/** Ao criar, a resposta traz também o token secreto (é a única vez que ele aparece). */
export const CreateHoldResponseSchema = HoldResponseSchema.extend({ token: z.string() });
export type CreateHoldResponse = z.infer<typeof CreateHoldResponseSchema>;

/** `details` do erro 409 (HOLD_CONFLICT): quais cadeiras já não estavam livres. */
export const HoldConflictDetailsSchema = z.object({ unavailable: z.array(z.string()) });
export type HoldConflictDetails = z.infer<typeof HoldConflictDetailsSchema>;

/** Códigos de erro da API, para o site decidir o que mostrar. */
export const API_ERROR_CODES = {
  validation: 'VALIDATION_ERROR',
  notFound: 'NOT_FOUND',
  holdConflict: 'HOLD_CONFLICT',
  unknownSeats: 'UNKNOWN_SEATS',
  unauthorized: 'UNAUTHORIZED',
  holdNotActive: 'HOLD_NOT_ACTIVE',
  rateLimited: 'RATE_LIMITED',
  payloadTooLarge: 'PAYLOAD_TOO_LARGE',
  badRequest: 'BAD_REQUEST',
  unavailable: 'SERVICE_UNAVAILABLE',
  internal: 'INTERNAL_ERROR',
} as const;
