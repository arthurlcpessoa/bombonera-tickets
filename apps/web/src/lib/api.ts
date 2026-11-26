/**
 * Cliente HTTP da API, tipado pelos schemas Zod do @bombonera/shared.
 *
 * Cada função faz o pedido, confere a resposta com o schema (se a API mudar o formato, o erro
 * aparece aqui, com clareza, e não lá na tela) e devolve dados já com o tipo certo. Erros viram um
 * ApiRequestError com o `code` da API (ex.: HOLD_CONFLICT), para a interface decidir o que mostrar.
 */
import {
  CreateHoldResponseSchema,
  ErrorResponseSchema,
  HealthResponseSchema,
  HoldResponseSchema,
  MatchSchema,
  SectorSeatsResponseSchema,
  SectorsResponseSchema,
  type CreateHoldRequest,
} from '@bombonera/shared';
import type { z } from 'zod';

/** Endereço da API (apps/web/.env). Sem barra no fim. */
export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

/** Código usado quando nem chegou a haver resposta (API fora do ar, sem internet...). */
export const NETWORK_ERROR = 'NETWORK_ERROR';

export class ApiRequestError extends Error {
  /** Status HTTP (0 = não houve resposta). */
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  /** Token da reserva, enviado como "Authorization: Bearer <token>". */
  token?: string;
  /** Permite cancelar o pedido (o TanStack Query cancela quando o dado deixa de interessar). */
  signal?: AbortSignal;
}

async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  { method = 'GET', body, token, signal }: RequestOptions = {},
): Promise<z.infer<S>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err; // cancelado de propósito: não é falha de rede
    throw new ApiRequestError(0, NETWORK_ERROR, 'Sem conexão com o servidor de ingressos.');
  }

  // 204 = "deu certo, sem conteúdo".
  const json: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = ErrorResponseSchema.safeParse(json);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiRequestError(response.status, code, message, details);
    }
    throw new ApiRequestError(
      response.status,
      'HTTP_ERROR',
      `Erro ${response.status} no servidor.`,
    );
  }
  return schema.parse(json);
}

const enc = encodeURIComponent;

export const api = {
  health: (signal?: AbortSignal) => request('/api/health', HealthResponseSchema, { signal }),

  getCurrentMatch: (signal?: AbortSignal) =>
    request('/api/matches/current', MatchSchema, { signal }),

  getSectors: (matchId: string, signal?: AbortSignal) =>
    request(`/api/matches/${enc(matchId)}/sectors`, SectorsResponseSchema, { signal }),

  getSectorSeats: (matchId: string, sectorId: string, signal?: AbortSignal) =>
    request(
      `/api/matches/${enc(matchId)}/sectors/${enc(sectorId)}/seats`,
      SectorSeatsResponseSchema,
      { signal },
    ),

  createHold: (body: CreateHoldRequest) =>
    request('/api/holds', CreateHoldResponseSchema, { method: 'POST', body }),

  getHold: (holdId: string, token: string, signal?: AbortSignal) =>
    request(`/api/holds/${enc(holdId)}`, HoldResponseSchema, { token, signal }),

  cancelHold: (holdId: string, token: string) =>
    request(`/api/holds/${enc(holdId)}`, HoldResponseSchema, { method: 'DELETE', token }),
};
