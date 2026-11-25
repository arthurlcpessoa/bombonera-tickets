/**
 * Setores à venda: dados + forma de cada um. Nomes e preços são fictícios.
 *
 * As bandejas curvas são divididas em 8 blocos iguais ao longo do U (numerados de 1, na ponta
 * −Z, até 8, na ponta +Z), com um corredor entre blocos vizinhos. A divisão é simétrica:
 * o meio da lateral (t = 0,5) é sempre a fronteira entre os blocos 4 e 5.
 *
 * Capacidade e lugares livres NÃO são estimados: vêm da contagem das cadeiras geradas
 * (lib/seatLayout.ts). Assim o tooltip, o painel e o 3D mostram sempre o mesmo número.
 */
import { PALCOS_BLOCKS_Z, SECTOR_LAYOUT } from '@/config/stadium';
import { countSeats, getSectorSeats } from '@/features/seating/lib/seatLayout';
import type { SectorShape } from '@/features/seating/lib/sectorGeometry';
import { pathLength, tierOffset, type CurvedTier } from '@/features/seating/lib/stadiumPath';
import { DEFAULT_STANDS_MODEL } from './standsModel';

/** Os quatro "andares" à venda: as três bandejas do U + a platea dos palcos. */
export type Tier = CurvedTier | 'palcos';

export type PriceCategoryId = 'superior' | 'visitante' | 'media' | 'inferior' | 'palcos';

/** De quem é o setor: da torcida da casa (o padrão) ou da torcida visitante. */
export type Audience = 'home' | 'away';

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
  /** Torcida do setor. Ausente = 'home' (casa). Use isAwaySector() para ler. */
  audience?: Audience;
  shape: SectorShape;
  /** Capacidade = número de cadeiras geradas para o setor. */
  capacity: number;
  /** Cadeiras livres (status simulado, veja lib/seatLayout.ts). */
  available: number;
}

/** Faixas de preço, da mais barata para a mais cara. */
export const PRICE_CATEGORIES: readonly PriceCategory[] = [
  // Cores escolhidas pelo que fica EMBAIXO delas: as cadeiras do modelo são azuis (inferior e
  // superior), amarelas (média) e bordô (palcos). Evitamos azul e amarelo (sumiriam) e usamos
  // tons que continuam parecidos com a legenda depois de "misturados" com a cor de baixo.
  { id: 'superior', label: 'Superior', price: 35_000, color: '#2dd4bf' },
  // Verde-limão: a cor mais distante das outras quatro, pura e misturada ao azul das cadeiras.
  { id: 'visitante', label: 'Visitante', price: 35_000, color: '#a3e635' },
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
/** Trecho do U usado pelos setores (as pontas encostam no prédio dos palcos). */
const T_START = 0.008;
const T_END = 0.992;

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

/** Palcos: um setor por bloco entre os corredores reais do modelo (config/stadium.ts). */
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

/** Monta a lista final: capacidade e lugares livres vêm da contagem real das cadeiras. */
function buildSectors(): Sector[] {
  return [...curvedSectors(), ...palcosSectors()].map((generated) => {
    const draft = { ...generated, ...SECTOR_OVERRIDES[generated.id] };
    return { ...draft, ...countSeats(getSectorSeats(draft, DEFAULT_STANDS_MODEL)) };
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
