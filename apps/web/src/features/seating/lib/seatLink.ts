/**
 * Link compartilhável da visão do assento: ?assento=upper-3:F12-C07 (TypeScript puro).
 * Os outros parâmetros da URL (ex.: ?debug) são mantidos.
 */
export const SEAT_PARAM = 'assento';

/** Lê o id da cadeira da query string (ex.: location.search). Vazio ou ausente → null. */
export function readSeatParam(search: string): string | null {
  return new URLSearchParams(search).get(SEAT_PARAM)?.trim() || null;
}

/**
 * Devolve a query string com o parâmetro do assento trocado (ou removido, com null).
 * Resultado: "?debug&assento=upper-3:F12-C07", ou "" se não sobrar nenhum parâmetro.
 */
export function withSeatParam(search: string, seatId: string | null): string {
  const params = new URLSearchParams(search);
  if (seatId) params.set(SEAT_PARAM, seatId);
  else params.delete(SEAT_PARAM);
  const query = params
    .toString()
    // ":" é permitido na query: deixamos o id legível em vez de "%3A".
    .replaceAll('%3A', ':')
    // Parâmetros sem valor continuam sem valor: "debug", e não "debug=".
    .replace(/=(?=&|$)/g, '');
  return query ? `?${query}` : '';
}
