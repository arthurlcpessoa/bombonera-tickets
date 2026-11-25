/** Formatação de preço e de disponibilidade para a interface. */

/**
 * Intl.NumberFormat é o formatador de números embutido no navegador.
 * 'es-AR' + ARS → "$ 35.000,00" no padrão argentino. Criamos uma vez e reaproveitamos.
 */
const currency = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

export function formatPrice(value: number): string {
  return currency.format(value);
}

const count = new Intl.NumberFormat('pt-BR');

/** Nível de disponibilidade, para escolher cor e texto. */
export type AvailabilityLevel = 'sold-out' | 'low' | 'ok';

/** Abaixo desta fração de lugares livres, o setor é mostrado como "últimos lugares". */
const LOW_AVAILABILITY = 0.1;

export function availabilityLevel(available: number, capacity: number): AvailabilityLevel {
  if (available <= 0) return 'sold-out';
  return available / capacity < LOW_AVAILABILITY ? 'low' : 'ok';
}

export function formatAvailability(available: number): string {
  if (available <= 0) return 'Esgotado';
  if (available === 1) return '1 lugar disponível';
  return `${count.format(available)} lugares disponíveis`;
}
