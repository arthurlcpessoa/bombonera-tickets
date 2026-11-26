/**
 * Configuração da API, lida das variáveis de ambiente (no desenvolvimento, do arquivo .env).
 * Tudo passa por um schema Zod: um valor errado (ex.: PORT=abc) faz a API se recusar a subir,
 * com uma mensagem clara, em vez de falhar mais tarde de um jeito confuso.
 */
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  /** Endereço em que a API escuta. 127.0.0.1 = só este computador; 0.0.0.0 = toda a rede. */
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  /** Origens (sites) que podem chamar a API pelo navegador, separadas por vírgula. */
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Quantas requisições por minuto cada IP pode fazer (geral e para criar reservas). */
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_HOLDS_MAX: z.coerce.number().int().positive().default(20),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Configuração inválida no .env:\n${problems.join('\n')}`);
  }
  return parsed.data;
}
