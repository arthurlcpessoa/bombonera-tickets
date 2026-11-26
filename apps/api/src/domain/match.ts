import type { MatchRecord } from '../store/TicketingStore';

/**
 * O jogo à venda. Partida FICTÍCIA, só para o portfólio: data, horário e rodada são inventados.
 * Os escudos são imagens do site (apps/web/src/assets/teams); aqui fica só o id de cada time.
 */
export const CURRENT_MATCH: MatchRecord = {
  id: '2026-12-13-boca-river',
  competition: 'Campeonato Argentino',
  round: 'Rodada 15',
  home: { id: 'boca', name: 'Boca Juniors' },
  away: { id: 'river', name: 'River Plate' },
  kickoff: '2026-12-13T17:00:00-03:00',
  venue: 'La Bombonera',
};
