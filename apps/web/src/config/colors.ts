import { type PriceCategoryId } from '@bombonera/shared';

/** Cores usadas no 3D (o CSS tem as mesmas como tokens do Tailwind, em index.css). */
export const COLORS = {
  /** Dourado do Boca (--color-boca-gold): seleção. */
  gold: '#f2b51c',
  /** Cadeira vendida: cinza escuro, para "sumir" no meio das livres. */
  soldSeat: '#3a3f4b',
  /**
   * Cadeira reservada por OUTRA pessoa (Fase 5): cinza-claro azulado. Também não dá para escolher,
   * mas é diferente da vendida: em até 10 minutos ela pode voltar a ficar livre.
   */
  heldSeat: '#9aa3b8',
  /** Quanto clarear a cor no hover (0 = nada, 1 = branco). */
  hoverLighten: 0.45,
} as const;

/**
 * Cor de cada faixa de preço, no 3D e na legenda. Os preços ficam em @bombonera/shared; as cores,
 * por serem só visuais, ficam aqui.
 *
 * Escolhidas pelo que fica EMBAIXO delas: as cadeiras do modelo são azuis (inferior e superior),
 * amarelas (média) e bordô (palcos). Evitamos azul e amarelo (sumiriam) e usamos tons que continuam
 * parecidos com a legenda depois de "misturados" com a cor de baixo.
 */
export const CATEGORY_COLORS: Record<PriceCategoryId, string> = {
  superior: '#2dd4bf',
  // Verde-limão: a cor mais distante das outras quatro, pura e misturada ao azul das cadeiras.
  visitante: '#a3e635',
  media: '#fb923c',
  inferior: '#c084fc',
  palcos: '#f472b6',
};
