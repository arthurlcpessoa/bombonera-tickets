/**
 * Gerador de números "aleatórios" com semente (algoritmo mulberry32).
 *
 * Analogia: um baralho que é sempre embaralhado do mesmo jeito. Os números parecem
 * aleatórios, mas a mesma semente produz sempre a mesma sequência. Assim os dados de
 * exemplo (disponibilidade) não mudam a cada recarregamento da página, como aconteceria
 * com Math.random().
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let r = Math.imul(state ^ (state >>> 15), 1 | state);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296; // número entre 0 (inclusive) e 1 (exclusive)
  };
}
