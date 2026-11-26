# Fase 5: back-end, reserva e pagamento

> Prompt para o Claude Code. Leia antes o `CLAUDE.md`, o `docs/ARQUITETURA.md` e o código de
> `apps/web/src/features/seating/`, `features/match/` e `src/store/`. É o primeiro código de servidor
> do projeto: explique cada conceito novo (API, banco, ORM, migração, transação, concorrência, webhook)
> de forma didática, com analogias, antes de usá-lo.

## Objetivo

Hoje a disponibilidade das cadeiras é simulada no navegador. Ao final desta fase:

- um **servidor** (API) guarda o estado real de cada cadeira num **banco de dados**;
- ao clicar em "Continuar", as cadeiras escolhidas ficam **reservadas por 10 minutos** para aquela pessoa.
  Ninguém mais consegue pegá-las, nem se duas pessoas clicarem no mesmo milissegundo;
- a pessoa preenche nome e e-mail, **paga** (ambiente de teste) e recebe os **ingressos com QR code**;
- quem está olhando o estádio vê a cadeira ficar ocupada **em tempo real**.

A fase é grande. Divida-a em **duas partes, cada uma com sua branch e seu Pull Request**:

- **5A** (`fase-5a-api-reservas`): API, banco, inventário, disponibilidade real e reserva temporária.
- **5B** (`fase-5b-checkout-pagamento`): checkout, pagamento, pedidos, ingressos e tempo real.

## Decisões de arquitetura (já tomadas; explique-as ao implementar)

| Peça                    | Escolha                                                                       | Por quê                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Servidor                | **Fastify** + TypeScript em `apps/api`                                        | Rápido, tipado, com plugins oficiais (CORS, rate limit, helmet)                            |
| Banco                   | **PostgreSQL 17** via **Docker Compose** (`docker-compose.yml` na raiz)       | Banco relacional de verdade, com transações; o Docker evita instalar o Postgres no Windows |
| Acesso ao banco         | **Prisma** (schema, migrações, cliente tipado)                                | Migrações versionadas e tipos gerados a partir do schema                                   |
| Validação               | **Zod** nos dois lados                                                        | Um schema valida a entrada da API e gera os tipos usados pelo front                        |
| Busca de dados no front | **TanStack Query**                                                            | Cache, recarregamento, estados de carregando/erro e invalidação prontos                    |
| Rotas no front          | **React Router** (`/` e `/pedido/:id`)                                        | O retorno do pagamento precisa de uma URL própria                                          |
| Testes da API           | **Vitest** com um banco Postgres de teste (outro database no mesmo container) | Testar reserva e concorrência exige um banco real, não mock                                |

Se alguma escolha não fizer sentido diante do código real, proponha a alternativa **antes** de implementar.

### Código compartilhado: `packages/shared`

O servidor precisa gerar **exatamente as mesmas cadeiras** que o front desenha (mesmos ids, como
`upper-3:F12-C07`). Por isso, mova a lógica pura para um pacote do workspace, `@bombonera/shared`:

- `stadiumPath`, `sectorGeometry`, `seatLayout`, `random`, a tabela de calibração, os dados dos setores e das
  faixas de preço, e as constantes de que eles dependem (hoje em `config/stadium.ts`);
- os **schemas Zod da API** (requisições e respostas), para o front e o back usarem os mesmos tipos.

Regras: o pacote não importa React, Three.js de renderização nem nada de `apps/*`; não use o alias `@/` lá
dentro. O front passa a importar de `@bombonera/shared`, e as constantes **visuais** (cores, câmera, layout
do painel) continuam no front. Mova os testes junto. Isso deve ser um commit só de refatoração: o site
continua idêntico e todos os testes passam antes de seguir.

## Parte 5A: API, banco e reserva

### Modelo de dados (Prisma)

Explique o diagrama das tabelas antes de criar.

- **Match**: o jogo (dados que hoje estão em `features/match/data/match.ts`).
- **Seat**: o inventário fixo do estádio. Uma linha por cadeira, com `id` igual ao id do front, setor, fila e número.
- **MatchSeat**: o estado de cada cadeira **naquele jogo**: `status` (`AVAILABLE` | `HELD` | `SOLD`),
  `holdId` opcional e `price` (centavos, inteiro). Chave única `(matchId, seatId)`.
- **Hold**: a reserva temporária: `id`, `token` secreto, `expiresAt`, `status`
  (`ACTIVE` | `CONVERTED` | `EXPIRED` | `CANCELLED`).
- **Order** e **Ticket** ficam para a 5B. Crie-os na migração da 5B, não antes.

Dinheiro sempre em **centavos inteiros**, nunca `float`. Explique por quê.

### Seed

`npm run db:seed` cria o jogo e o inventário a partir do **gerador compartilhado** (~35,7 mil cadeiras), e
marca como `SOLD` as mesmas cadeiras que hoje aparecem vendidas na simulação (mesma semente), para o site
continuar com a mesma "cara". Use inserção em lote. Ele precisa ser idempotente: rodar duas vezes não duplica nada.

### Endpoints

Prefixo `/api`. Valide tudo com Zod e devolva erros num formato único (`{ error: { code, message } }`).

- `GET /api/health`: checa a API e o banco.
- `GET /api/matches/current`: o jogo à venda.
- `GET /api/matches/:id/sectors`: por setor, preço, capacidade e lugares livres (contando reservas expiradas como livres).
- `GET /api/matches/:id/sectors/:sectorId/seats`: estado das cadeiras do setor, num formato **compacto**
  (ex.: listas de ids vendidos e reservados). O que não estiver nas listas está livre. Justifique o formato.
- `POST /api/holds` `{ matchId, seatIds }` → reserva por 10 minutos e devolve `{ holdId, token, expiresAt, seats, total }`.
- `GET /api/holds/:id` (com o token): estado atual da reserva.
- `DELETE /api/holds/:id` (com o token): cancela e libera as cadeiras.

O token vai no cabeçalho `Authorization: Bearer <token>`. Sem login nesta fase.

### Regras da reserva (o coração da fase)

- **Atomicidade:** reservar N cadeiras é tudo ou nada. Use uma transação com um `UPDATE ... WHERE status
= 'AVAILABLE' OR (status = 'HELD' AND a reserva expirou)` nas cadeiras pedidas. Se o número de linhas
  atualizadas for menor que N, desfaça tudo e responda **409** com a lista de cadeiras indisponíveis.
  Explique a **condição de corrida** com o exemplo de duas pessoas e por que "ler e depois escrever"
  (`SELECT` seguido de `UPDATE`) é errado.
- **Expiração preguiçosa:** uma reserva vencida conta como livre em todas as consultas, mesmo antes de
  alguém limpá-la. Um job a cada minuto marca as vencidas como `EXPIRED` e libera as cadeiras (limpeza).
- **Limites:** máximo de 6 cadeiras (`ORDER_RULES.maxSeats`, compartilhado); todas do mesmo jogo; nenhuma repetida.
- **Preço:** quem calcula o total é o **servidor**, a partir do banco. Nunca confie em preço vindo do navegador.
- **Uma reserva ativa por pessoa:** ao criar uma nova, o front cancela a anterior.

### Segurança básica

`@fastify/helmet`, `@fastify/cors` (só a origem do front, vinda do `.env`), `@fastify/rate-limit`
(mais rígido em `POST /holds`), limite de tamanho do corpo, e nada de stack trace na resposta em produção.
Crie `.env.example` documentado. **Nenhum segredo no Git.**

### Front (5A)

- Cliente HTTP tipado em `apps/web/src/lib/api.ts`, usando os schemas do `@bombonera/shared`, e a URL da API em `VITE_API_URL`.
- TanStack Query para o jogo, os setores e as cadeiras do setor aberto (recarregar a cada ~15 s nesta parte).
- A disponibilidade simulada sai: tooltip, painel, mini-mapa, cores do 3D e capacidade passam a vir da API.
  A **geometria** continua vindo do gerador compartilhado. A API só diz o estado.
- Novo estado visual **"reservada"** (por outra pessoa): cor própria, não clicável, legenda atualizada.
- "Continuar" cria a reserva. Em caso de 409, avise quais cadeiras foram perdidas, tire-as da seleção e
  atualize o setor. Com a reserva criada, mostre um **cronômetro** de 10 min, e a reserva sobrevive a
  recarregar a página (token em `sessionStorage`).
- Estados de carregamento e erro amigáveis. Se a API estiver fora do ar, o estádio 3D continua navegável, com um aviso.

### Testes (5A)

- Unitários: as regras puras (validação, cálculo de total, expiração).
- Integração (Vitest + banco de teste): reservar, conflito 409, cancelar, expirar e reservar de novo.
- **Teste de concorrência:** 20 requisições simultâneas tentando reservar a mesma cadeira → exatamente
  1 sucesso e 19 respostas 409. É o teste mais importante da fase.

### Scripts na raiz

`npm run dev` sobe a API e o front juntos. Mais `db:up` (docker compose up), `db:migrate`, `db:seed`,
`db:reset` e `test` (todos os workspaces). Atualize a tabela de comandos do `CLAUDE.md`.

## Parte 5B: checkout, pagamento e ingressos

### Pagamento: interface com dois provedores

Crie uma interface `PaymentProvider` (`createCheckout(order)` → URL de pagamento; `getPayment(id)` → status) com:

1. **`fake`** (padrão em desenvolvimento e nos testes): uma página simples da própria API simula o
   pagamento, com os botões "Aprovar" e "Recusar", e redireciona de volta como faria o provedor real.
   Assim o projeto roda inteiro sem conta em lugar nenhum.
2. **`mercadopago`**: Checkout Pro em modo de teste (sandbox), com o SDK oficial.
   - Credenciais de teste no `.env` (`MP_ACCESS_TOKEN`), nunca no código.
   - **Moeda:** a moeda da preferência precisa ser a do país da conta do Mercado Pago. Os preços do site
     estão em ARS. Se a conta de teste for de outro país (ex.: Brasil → BRL), use `MP_CURRENCY` e uma taxa de
     conversão configurável, e avise isso na tela de pagamento. Confirme na documentação atual do Mercado Pago.
   - Confirmação: ao voltar do pagamento (`back_urls`), a API **consulta o pagamento na API do Mercado Pago**
     pelo id. Nunca confie só nos parâmetros da URL. Implemente também o **webhook** (`notification_url`) com
     verificação da assinatura (`x-signature`) e **idempotência** (a mesma notificação duas vezes não gera
     dois pedidos pagos). Explique que, em `localhost`, o webhook só chega com um túnel (ex.: cloudflared),
     e por isso a consulta no retorno é o caminho principal no desenvolvimento.

O provedor é escolhido por `PAYMENT_PROVIDER=fake|mercadopago`.

### Pedido e ingressos

- `POST /api/orders` `{ holdId, buyer: { name, email } }` (com o token da reserva): cria o pedido `PENDING`
  com o total calculado no servidor, renova a reserva por mais alguns minutos durante o pagamento e devolve a URL de pagamento.
- Pagamento aprovado → numa transação: pedido `PAID`, cadeiras `SOLD`, reserva `CONVERTED` e um **Ticket** por
  cadeira, com código único. Recusado ou expirado → pedido `FAILED`/`EXPIRED` e cadeiras liberadas.
- `GET /api/orders/:id` (com um token do pedido): status, cadeiras e ingressos.
- Página `/pedido/:id` no front: aguardando confirmação (com consulta periódica), aprovado (ingressos com
  **QR code**, setor, fila, cadeira, portão sugerido e um botão para ver a visão daquele assento) ou recusado
  (com opção de tentar de novo enquanto a reserva valer).
- Formulário de checkout (nome e e-mail validados com o mesmo schema Zod), resumo com o total e o cronômetro.
  Para o setor Visitante, mostre o aviso de entrada separada também no checkout e no ingresso.

### Tempo real

`GET /api/matches/:id/stream` com **Server-Sent Events**: a cada reserva, cancelamento, expiração ou venda,
envie as cadeiras que mudaram. O front aplica a mudança no cache do TanStack Query, e o 3D e o mini-mapa
repintam só aquelas cadeiras (o mesmo caminho sem re-render da Fase 3). Explique SSE versus WebSocket e por
que SSE basta aqui. Com o stream ativo, o recarregamento periódico vira só um plano B.

### Testes (5B)

Pedido com provedor fake aprovado e recusado; webhook repetido (idempotência); reserva expirando no meio
do pagamento; preço adulterado pelo cliente é ignorado.

## Critérios de aceite

- [ ] Com o Docker Desktop instalado, `npm run db:up`, `npm run db:migrate`, `npm run db:seed` e
      `npm run dev` sobem tudo do zero no Windows. Documente o passo a passo no README.
- [ ] O site mostra a mesma disponibilidade de antes, agora vinda do banco.
- [ ] Duas abas: reservar na aba A faz a cadeira aparecer "reservada" na aba B (na 5A em até ~15 s; na 5B na hora, via SSE).
- [ ] O teste de concorrência passa: 20 tentativas simultâneas, 1 vencedora.
- [ ] A reserva expira em 10 minutos e as cadeiras voltam a ficar livres.
- [ ] Compra completa com o provedor fake: escolher → reservar → pagar → ingressos com QR → cadeiras vendidas para todos.
- [ ] Compra completa no sandbox do Mercado Pago (documente as credenciais de teste necessárias e como
      obtê-las; se faltar conta, deixe o provedor pronto e testado com mocks e diga o que falta).
- [ ] `npm test`, `npm run typecheck`, `npm run lint` e `npm run build` passam em todos os workspaces.
- [ ] `docs/ARQUITETURA.md` (seção "Back-end": diagrama das tabelas, fluxo da reserva e do pagamento,
      concorrência), README e `CLAUDE.md` atualizados.

## Ordem sugerida

**5A**

1. Refatoração: `packages/shared` (commit só disso, com o site idêntico).
2. `apps/api` com Fastify, `docker-compose.yml`, Prisma, schema, migração e seed.
3. Endpoints de leitura + cliente no front + disponibilidade real.
4. Reserva (transação, 409, expiração, job de limpeza) + testes de integração e de concorrência.
5. Front da reserva: "Continuar", cronômetro, estado "reservada", tratamento do 409.
6. Segurança, `.env.example`, docs. Push da `fase-5a-api-reservas` e PR. **Pergunte antes do push.**

**5B** (depois do merge da 5A)

7. Order/Ticket, provedor fake e página `/pedido/:id` com QR code.
8. SSE em tempo real.
9. Provedor Mercado Pago (retorno + webhook com assinatura e idempotência).
10. Testes, docs, push da `fase-5b-checkout-pagamento` e PR. **Pergunte antes do push.**

Ao final de cada parte, resuma o que foi feito, o que aprender com cada parte e como testar.
