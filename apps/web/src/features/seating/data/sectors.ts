/**
 * Setores à venda: dados + forma de cada um. Nomes e preços são fictícios.
 *
 * As bandejas curvas são divididas em 8 blocos iguais ao longo do U (numerados de 1, na ponta
 * −Z, até 8, na ponta +Z), com um corredor entre blocos vizinhos. A divisão é simétrica:
 * o meio da lateral (t = 0,5) é sempre a fronteira entre os blocos 4 e 5.
 */
import { PALCOS_PLATEA, SECTOR_LAYOUT } from '@/config/stadium';
import { createRandom } from '@/features/seating/lib/random';
import { estimateCapacity, type SectorShape } from '@/features/seating/lib/sectorGeometry';
import { pathLength, tierOffset, type CurvedTier } from '@/features/seating/lib/stadiumPath';
import { DEFAULT_STANDS_MODEL } from './standsModel';

/** Os quatro "andares" à venda: as três bandejas do U + a platea dos palcos. */
export type Tier = CurvedTier | 'palcos';

export type PriceCategoryId = 'superior' | 'media' | 'inferior' | 'palcos';

/** Faixa de preço: cada uma tem uma cor própria no 3D e na legenda. */
export interface PriceCategory {
  id: PriceCategoryId;
  label: string;
  /** Preço em pesos argentinos (ARS). */
  price: number;
  color: string;
}

export interface Sector {
  /** Identificador estável, ex.: "upper-3". */
  id: string;
  /** Nome exibido, ex.: "Superior 3". */
  name: string;
  tier: Tier;
  categoryId: PriceCategoryId;
  shape: SectorShape;
  /** Capacidade estimada (lugares). */
  capacity: number;
  /** Lugares livres (dado simulado). */
  available: number;
}

/** Faixas de preço, da mais barata para a mais cara. */
export const PRICE_CATEGORIES: readonly PriceCategory[] = [
  // Cores escolhidas pelo que fica EMBAIXO delas: as cadeiras do modelo são azuis (inferior e
  // superior), amarelas (média) e bordô (palcos). Evitamos azul e amarelo (sumiriam) e usamos
  // tons que continuam parecidos com a legenda depois de "misturados" com a cor de baixo.
  { id: 'superior', label: 'Superior', price: 35_000, color: '#2dd4bf' },
  { id: 'media', label: 'Média', price: 50_000, color: '#fb923c' },
  { id: 'inferior', label: 'Inferior', price: 65_000, color: '#c084fc' },
  { id: 'palcos', label: 'Palcos', price: 90_000, color: '#f472b6' },
];

const CATEGORY_BY_ID = new Map(PRICE_CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: PriceCategoryId): PriceCategory {
  return CATEGORY_BY_ID.get(id)!;
}

export const TIER_LABELS: Record<Tier, string> = {
  lower: 'Bandeja Inferior',
  middle: 'Bandeja Média',
  upper: 'Bandeja Superior',
  palcos: 'Platea Palcos',
};

/** Como cada bandeja curva aparece nos nomes e qual faixa de preço ela usa. */
const CURVED_TIERS: { tier: CurvedTier; short: string; categoryId: PriceCategoryId }[] = [
  { tier: 'lower', short: 'Inferior', categoryId: 'inferior' },
  { tier: 'middle', short: 'Média', categoryId: 'media' },
  { tier: 'upper', short: 'Superior', categoryId: 'superior' },
];

const BLOCKS_PER_TIER = 8;
const PALCOS_BLOCKS = 3;
/** Trecho do U usado pelos setores (as pontas encostam no prédio dos palcos). */
const T_START = 0.008;
const T_END = 0.992;
/** Semente fixa da disponibilidade simulada (1905: ano de fundação do Boca). */
const AVAILABILITY_SEED = 1905;

type SectorDraft = Omit<Sector, 'capacity' | 'available'>;

function curvedSectors(): SectorDraft[] {
  const model = DEFAULT_STANDS_MODEL;
  return CURVED_TIERS.flatMap(({ tier, short, categoryId }) => {
    // Converte a largura do corredor (metros) para "unidades de t" nesta bandeja.
    const offset = tierOffset(model.profiles[tier], 0.5, 0.5);
    const gapT = SECTOR_LAYOUT.aisleWidth / (pathLength(model.path) + Math.PI * offset);
    const step = (T_END - T_START) / BLOCKS_PER_TIER;

    return Array.from({ length: BLOCKS_PER_TIER }, (_, i): SectorDraft => {
      const t0 = T_START + i * step + (i > 0 ? gapT / 2 : 0);
      const t1 = T_START + (i + 1) * step - (i < BLOCKS_PER_TIER - 1 ? gapT / 2 : 0);
      return {
        id: `${tier}-${i + 1}`,
        name: `${short} ${i + 1}`,
        tier,
        categoryId,
        shape: { kind: 'curved', tier, t0, t1 },
      };
    });
  });
}

function palcosSectors(): SectorDraft[] {
  const { zMin, zMax } = PALCOS_PLATEA;
  const step = (zMax - zMin) / PALCOS_BLOCKS;
  const gap = SECTOR_LAYOUT.aisleWidth / 2;
  return Array.from({ length: PALCOS_BLOCKS }, (_, i): SectorDraft => ({
    id: `palcos-${i + 1}`,
    name: `Palcos ${i + 1}`,
    tier: 'palcos',
    categoryId: 'palcos',
    shape: {
      kind: 'straight',
      z0: zMin + i * step + (i > 0 ? gap : 0),
      z1: zMin + (i + 1) * step - (i < PALCOS_BLOCKS - 1 ? gap : 0),
    },
  }));
}

/** Monta a lista final: calcula capacidade e sorteia (com semente) os lugares livres. */
function buildSectors(): Sector[] {
  const random = createRandom(AVAILABILITY_SEED);
  return [...curvedSectors(), ...palcosSectors()].map((draft) => {
    const capacity = estimateCapacity(draft.shape, DEFAULT_STANDS_MODEL, SECTOR_LAYOUT);
    // ~10% dos setores quase esgotados, o resto entre 15% e 75% livre.
    const roll = random();
    const freeShare = roll < 0.1 ? random() * 0.06 : 0.15 + random() * 0.6;
    return { ...draft, capacity, available: Math.round(capacity * freeShare) };
  });
}

export const SECTORS: readonly Sector[] = buildSectors();

const SECTOR_BY_ID = new Map(SECTORS.map((s) => [s.id, s]));

export function getSector(id: string): Sector | undefined {
  return SECTOR_BY_ID.get(id);
}
