/**
 * Ponto de entrada: lê a configuração, monta o armazenamento e a API e abre a porta.
 * `npm run dev` (na raiz) sobe isto junto com o site.
 */
import { existsSync } from 'node:fs';
import { buildApp } from './app';
import { loadConfig } from './config';
import { CURRENT_MATCH } from './domain/match';
import { InMemoryStore } from './store/InMemoryStore';
import { buildInventory } from './store/seed';

// No desenvolvimento, as variáveis vêm do arquivo .env (que nunca vai para o Git).
if (existsSync('.env')) process.loadEnvFile('.env');
const config = loadConfig();

const now = () => new Date();
const started = performance.now();
const inventory = buildInventory(CURRENT_MATCH);
const store = new InMemoryStore({ inventory, now });

const app = await buildApp({
  store,
  storeName: 'memory',
  now,
  config,
  // Uma linha de log (em JSON) por requisição: método, URL, status e tempo de resposta.
  logger: { level: config.LOG_LEVEL },
});

app.log.info(
  `Inventário: ${inventory.seats.length.toLocaleString('pt-BR')} cadeiras geradas em ` +
    `${Math.round(performance.now() - started)} ms (jogo ${inventory.match.id}).`,
);
app.log.warn(
  'Armazenamento em MEMÓRIA: reservas e vendas somem ao reiniciar a API. ' +
    'Isso é esperado até a Fase 5C (PostgreSQL).',
);

// Ao apertar Ctrl+C (ou a hospedagem pedir para desligar), fecha com calma: termina as
// requisições em andamento e para os jobs antes de sair.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info(`Recebi ${signal}: desligando…`);
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ host: config.HOST, port: config.PORT });
