import bocaCrest from '@/assets/teams/boca.webp';
import riverCrest from '@/assets/teams/river.webp';

/**
 * O jogo à venda. Partida FICTÍCIA, só para o portfólio: data, horário e rodada são inventados.
 * Na Fase 5 estes dados virão da API; por enquanto ficam aqui, num lugar só.
 */

export interface Team {
  /** Nome completo: texto alternativo do escudo (leitores de tela e imagem que não carregou). */
  name: string;
  /** URL do escudo. O import da imagem faz o Vite copiá-la para o build e devolver o endereço. */
  crest: string;
}

export interface Match {
  competition: string;
  round: string;
  home: Team;
  away: Team;
  /** Data e hora no padrão ISO, com o fuso de Buenos Aires (−03:00). */
  kickoff: string;
  venue: string;
}

export const MATCH: Match = {
  competition: 'Campeonato Argentino',
  round: 'Rodada 15',
  home: {
    name: 'Boca Juniors',
    crest: bocaCrest,
  },
  away: {
    name: 'River Plate',
    crest: riverCrest,
  },
  kickoff: '2026-12-13T17:00:00-03:00',
  venue: 'La Bombonera',
};
