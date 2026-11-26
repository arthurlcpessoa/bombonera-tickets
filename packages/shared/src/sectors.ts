/**
 * Setores à venda: dados + forma de cada um. Nomes e preços são fictícios.
 *
 * As bandejas curvas são divididas em 8 blocos iguais ao longo do U (numerados de 1, na ponta
 * −Z, até 8, na ponta +Z), com um corredor entre blocos vizinhos. A divisão é simétrica:
 * o meio da lateral (t = 0,5) é sempre a fronteira entre os blocos 4 e 5.
 *
 * A capacidade NÃO é estimada: vem da contagem das cadeiras geradas (seatLayout.ts). Quantas estão
 * livres, reservadas ou vendidas é a API que diz (Fase 5).
 */
import { PALCOS_BLOCKS_Z, SECTOR_LAYOUT } from './stadium';
import { getSectorSeats } from './seatLayout';
import type { SectorShape } from './sectorGeometry';
import { pathLength, tierOffset, type CurvedTier } from './stadiumPath';
import { DEFAULT_STANDS_MODEL } from './standsModel';

/** Os quatro "andares" à venda: as três bandejas do U + a platea dos palcos. */
export type Tier = CurvedTier | 'palcos';

export type PriceCategoryId = 'superior' | 'visitante' | 'media' | 'inferior' | 'palcos';

/** De quem é o setor: da torcida da casa (o padrão) ou da torcida visitante. */
export type Audience = 'home' | 'away';

/** Faixa de preço. A cor de cada faixa é visual e fica no site (config/colors.ts). */
export interface PriceCategory {
  id: PriceCategoryId;
  label: string;
  /** Preço em pesos argentinos (ARS). */
  price: number;
}

export interface Sector {
  /** Identificador estável, ex.: "upper-3". */
  id: string;
  /** Nome exibido, ex.: "Superior 3". */
  name: string;
  tier: Tier;
  categoryId: PriceCategoryId;
  /** Torcida do setor. Ausente = 'home' (casa). Use isAwaySector() para ler. */
  audience?: Audience;
  shape: SectorShape;
  /**
   * Capacidade = número de cadeiras geradas para o setor (geometria: não muda). Quantas estão
   * livres agora é a API que diz (GET /api/matches/:id/sectors).
   */
  capacity: number;
}

/** Faixas de preço, da mais barata para a mais cara. */
export const PRICE_CATEGORIES: readonly PriceCategory[] = [
  { id: 'superior', label: 'Superior', price: 35_000 },
  { id: 'visitante', label: 'Visitante', price: 35_000 },
  { id: 'media', label: 'Média', price: 50_000 },
  { id: 'inferior', label: 'Inferior', price: 65_000 },
  { id: 'palcos', label: 'Palcos', price: 90_000 },
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
/** Trecho do U usado pelos setores (as pontas encostam no prédio dos palcos). */
const T_START = 0.008;
const T_END = 0.992;

type SectorDraft = Omit<Sector, 'capacity'>;

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

/** Palcos: um setor por bloco entre os corredores reais do modelo (stadium.ts). */
function palcosSectors(): SectorDraft[] {
  return PALCOS_BLOCKS_Z.map(([zFrom, zTo], i): SectorDraft => ({
    id: `palcos-${i + 1}`,
    name: `Palcos ${i + 1}`,
    tier: 'palcos',
    categoryId: 'palcos',
    // a vai de z0 a z1. Aqui z0 é a ponta +Z: assim `a` crescente vai para a DIREITA de quem
    // está sentado olhando o campo (para −X), como nas bandejas curvas. A cadeira 1 fica à esquerda.
    shape: { kind: 'straight', z0: Math.max(zFrom, zTo), z1: Math.min(zFrom, zTo) },
  }));
}

/**
 * Ajustes pontuais por setor, aplicados por cima do que foi gerado. O id NÃO muda: os ids das
 * cadeiras ("upper-8:F12-C07") dependem dele.
 */
const SECTOR_OVERRIDES: Record<string, Partial<SectorDraft>> = {
  // Ponta +Z da bandeja superior: setor da torcida visitante.
  'upper-8': { name: 'Visitante', categoryId: 'visitante', audience: 'away' },
};

/** Monta a lista final: a capacidade vem da contagem real das cadeiras. */
function buildSectors(): Sector[] {
  return [...curvedSectors(), ...palcosSectors()].map((generated) => {
    const draft = { ...generated, ...SECTOR_OVERRIDES[generated.id] };
    return { ...draft, capacity: getSectorSeats(draft, DEFAULT_STANDS_MODEL).length };
  });
}

export const SECTORS: readonly Sector[] = buildSectors();

const SECTOR_BY_ID = new Map(SECTORS.map((s) => [s.id, s]));

export function getSector(id: string): Sector | undefined {
  return SECTOR_BY_ID.get(id);
}

/** O setor é da torcida visitante? A interface pergunta isto, nunca o id. */
export function isAwaySector(sector: Pick<Sector, 'audience'>): boolean {
  return sector.audience === 'away';
}
