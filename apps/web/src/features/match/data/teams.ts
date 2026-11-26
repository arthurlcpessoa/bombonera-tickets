import bocaCrest from '@/assets/teams/boca.webp';
import riverCrest from '@/assets/teams/river.webp';

/**
 * Escudo de cada time, pelo id que a API manda (o jogo em si vem de GET /api/matches/current).
 * O import da imagem faz o Vite copiá-la para o build e devolver o endereço.
 */
export const TEAM_CRESTS: Record<string, string> = {
  boca: bocaCrest,
  river: riverCrest,
};
