/**
 * "Receitas" de busca do TanStack Query: o que buscar, com que chave guardar no cache e de quanto
 * em quanto tempo buscar de novo.
 *
 * A chave (queryKey) é o "nome da gaveta" no caderno do TanStack Query: ['sectors', 'jogo-1'].
 * Dois componentes que pedem a mesma chave recebem o mesmo dado (uma busca só). Para forçar uma
 * busca nova (ex.: depois de reservar), "invalidamos" a gaveta.
 */
import { QueryClient, queryOptions } from '@tanstack/react-query';
import { api, ApiRequestError } from './api';

/** De quanto em quanto tempo a disponibilidade é buscada de novo (a Fase 5B troca isto por SSE). */
export const REFRESH_MS = 15_000;

export const queryKeys = {
  currentMatch: ['match', 'current'] as const,
  sectors: (matchId: string) => ['sectors', matchId] as const,
  sectorSeats: (matchId: string, sectorId: string) => ['seats', matchId, sectorId] as const,
  /** Prefixo de todas as gavetas de cadeiras de um jogo (para invalidar todas de uma vez). */
  allSectorSeats: (matchId: string) => ['seats', matchId] as const,
};

export const currentMatchQuery = () =>
  queryOptions({
    queryKey: queryKeys.currentMatch,
    queryFn: ({ signal }) => api.getCurrentMatch(signal),
    // O jogo não muda durante a visita. Mas, se a API estava fora do ar, tenta de novo.
    staleTime: Infinity,
    refetchInterval: (query) => (query.state.status === 'error' ? REFRESH_MS : false),
  });

export const sectorsQuery = (matchId: string) =>
  queryOptions({
    queryKey: queryKeys.sectors(matchId),
    queryFn: ({ signal }) => api.getSectors(matchId, signal),
    refetchInterval: REFRESH_MS,
  });

export const sectorSeatsQuery = (matchId: string, sectorId: string) =>
  queryOptions({
    queryKey: queryKeys.sectorSeats(matchId, sectorId),
    queryFn: ({ signal }) => api.getSectorSeats(matchId, sectorId, signal),
    refetchInterval: REFRESH_MS,
  });

/** O "caderno" (cache) do TanStack Query: um só para o site inteiro. */
export const queryClient = createQueryClient();

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Erro "de verdade" da API (4xx) não melhora tentando de novo; falha de rede, talvez.
        retry: (failureCount, error) =>
          failureCount < 2 &&
          !(error instanceof ApiRequestError && error.status >= 400 && error.status < 500),
        // Busca de novo ao voltar para a aba: quem deixou o site aberto vê o estado atual.
        refetchOnWindowFocus: true,
      },
    },
  });
}
