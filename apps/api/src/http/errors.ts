/**
 * Erros da API num formato único: `{ error: { code, message, details? } }`.
 * O site decide o que mostrar pelo `code` (veja API_ERROR_CODES no @bombonera/shared).
 */
import { API_ERROR_CODES, type ErrorResponse } from '@bombonera/shared';
import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

/** Um erro "esperado", com status HTTP e código próprios (ex.: 404 NOT_FOUND, 409 HOLD_CONFLICT). */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function errorBody(code: string, message: string, details?: unknown): ErrorResponse {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

/**
 * Um tratador de erros para a API inteira. Qualquer erro lançado numa rota acaba aqui e vira uma
 * resposta no formato único. Em produção, erros inesperados (500) nunca mostram detalhes internos
 * (nem o "stack trace", o caminho do erro no código), que poderiam ajudar um atacante.
 */
export function registerErrorHandling(
  app: FastifyInstance,
  { production }: { production: boolean },
) {
  app.setErrorHandler((err: FastifyError | ApiError | ZodError, request, reply) => {
    if (err instanceof ApiError) {
      return reply.status(err.statusCode).send(errorBody(err.code, err.message, err.details));
    }
    if (err instanceof ZodError) {
      const issues = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      const message = issues[0]?.message ?? 'Dados inválidos';
      return reply.status(400).send(errorBody(API_ERROR_CODES.validation, message, { issues }));
    }
    const status = err.statusCode ?? 500;
    if (status === 429) {
      return reply
        .status(429)
        .send(errorBody(API_ERROR_CODES.rateLimited, 'Muitas requisições. Espere um pouco.'));
    }
    if (status === 413) {
      return reply
        .status(413)
        .send(errorBody(API_ERROR_CODES.payloadTooLarge, 'Requisição grande demais.'));
    }
    if (status >= 400 && status < 500) {
      // Erros do próprio Fastify (JSON malformado, tipo de conteúdo errado...).
      return reply.status(status).send(errorBody(API_ERROR_CODES.badRequest, err.message));
    }
    request.log.error(err);
    const message = production ? 'Erro interno. Tente de novo em instantes.' : err.message;
    return reply.status(500).send(errorBody(API_ERROR_CODES.internal, message));
  });

  app.setNotFoundHandler((request, reply) => {
    reply
      .status(404)
      .send(
        errorBody(
          API_ERROR_CODES.notFound,
          `Rota não encontrada: ${request.method} ${request.url}`,
        ),
      );
  });
}
