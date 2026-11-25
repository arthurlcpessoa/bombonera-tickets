/**
 * Cadeiras de um setor, geradas por código (TypeScript puro, sem React).
 *
 * Nada de matemática nova de posição: toda cadeira é um ponto (a, b) da MESMA superfície do
 * setor usada na Fase 2 (sectorSurface). Assim as cadeiras herdam o caminho em U, os perfis
 * e a tabela de correção.
 *
 *   b (fila) ↑   fila 3  ○ ○ ○ ○ ○ ○ ○      ← filas de cima: mais compridas nas curvas
 *               fila 2   ○ ○ ○ ○ ○ ○
 *               fila 1   ○ ○ ○ ○ ○ ○        ← fila 1 = a da frente, perto do campo
 *                        ─────────────→ a (número da cadeira)
 *
 * SENTIDO DA NUMERAÇÃO: a cadeira 1 fica na ponta de a = 0 e os números crescem com `a`.
 * Os setores são definidos para que `a` crescente vá para a DIREITA de quem está sentado
 * olhando o campo (veja os palcos em data/sectors.ts). Ou seja: em toda a Bombonera, a cadeira 1
 * fica à esquerda do torcedor. Quem olha a partir do campo vê a cadeira 1 à direita.
 */
import { SEAT_LAYOUT, SECTOR_LAYOUT } from '@/config/stadium';
import type { Sector } from '@/features/seating/data/sectors';
import { createRandom } from './random';
import { sectorDepth, sectorSurface, type StandsModel, type Surface } from './sectorGeometry';
import type { Point3 } from './stadiumPath';

export type SeatStatus = 'available' | 'sold';

export interface Seat {
  /** Estável e legível, ex.: "upper-3:F12-C07" (setor : fila 12 - cadeira 7). */
  id: string;
  sectorId: string;
  /** 1 = fila mais perto do campo. */
  row: number;
  /** 1..n dentro da fila, no sentido de `a` crescente. */
  number: number;
  /** Coordenadas na superfície do setor: a ao longo, b subindo (ambos de 0 a 1). */
  a: number;
  b: number;
  /** Centro do assento, sobre a arquibancada. */
  position: Point3;
  /** Rotação em torno de Y (radianos). Com yaw = 0 a cadeira olha para +Z. */
  yaw: number;
  /** Ponto dos olhos de quem está sentado (para a visão do assento, na Fase 4). */
  eye: Point3;
  status: SeatStatus;
}

/** O que o gerador precisa saber do setor. */
export type SeatSource = Pick<Sector, 'id' | 'shape'>;

// ---------------------------------------------------------------------------------------------
// Identificadores
// ---------------------------------------------------------------------------------------------

const pad2 = (n: number) => String(n).padStart(2, '0');

export function seatId(sectorId: string, row: number, number: number): string {
  return `${sectorId}:F${pad2(row)}-C${pad2(number)}`;
}

/** Lê de volta setor, fila e número a partir do id (ex.: para o resumo da seleção). */
export function parseSeatId(id: string): { sectorId: string; row: number; number: number } | null {
  const match = /^(.+):F(\d+)-C(\d+)$/.exec(id);
  if (!match) return null;
  return { sectorId: match[1], row: Number(match[2]), number: Number(match[3]) };
}

// ---------------------------------------------------------------------------------------------
// Medidas da fila
// ---------------------------------------------------------------------------------------------

/**
 * "Fita métrica" de uma fila: anda pela superfície em pequenos passos ao longo de `a` (com b fixo)
 * e anota a distância acumulada. Serve para medir o comprimento real e para fazer o caminho
 * inverso: "a quantos metros do início fica a cadeira?" → qual `a`.
 */
function measureRow(surface: Surface, b: number, spacing: number) {
  // Primeiro uma medida grosseira (32 passos) só para saber quantos passos usar de verdade.
  const rough = Math.hypot(...sub(surface(1, b), surface(0, b))) + 1;
  let estimate = 0;
  for (let i = 1, prev = surface(0, b); i <= 32; i++) {
    const p = surface(i / 32, b);
    estimate += Math.hypot(...sub(p, prev));
    prev = p;
  }
  const samples = Math.max(32, Math.ceil(Math.max(rough, estimate) / spacing));

  const cumulative = [0];
  let prev = surface(0, b);
  for (let i = 1; i <= samples; i++) {
    const p = surface(i / samples, b);
    cumulative.push(cumulative[i - 1] + Math.hypot(...sub(p, prev)));
    prev = p;
  }
  return { cumulative, length: cumulative[samples], samples };
}

function sub(p: Point3, q: Point3): Point3 {
  return [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
}

/** Converte "metros desde o início da fila" em `a`, interpolando na tabela da fita métrica. */
function aAtDistance(row: ReturnType<typeof measureRow>, distance: number): number {
  const { cumulative, samples } = row;
  let i = 1;
  while (i < samples && cumulative[i] < distance) i++;
  const span = cumulative[i] - cumulative[i - 1] || 1;
  const k = (distance - cumulative[i - 1]) / span;
  return Math.min(Math.max((i - 1 + k) / samples, 0), 1);
}

/**
 * Para onde a cadeira olha, pela própria superfície (diferenças finitas): comparamos um ponto
 * um pouco acima e outro um pouco abaixo na arquibancada. Essa diferença aponta "morro acima",
 * para longe do campo; a cadeira olha no sentido contrário. Funciona igual para curvas e palcos.
 *
 * @returns direção horizontal (x, z) de tamanho 1 para onde a cadeira olha
 */
function facingAt(surface: Surface, a: number, b: number): [x: number, z: number] {
  const h = SEAT_LAYOUT.slopeStep;
  const up = surface(a, Math.min(b + h, 1));
  const down = surface(a, Math.max(b - h, 0));
  const dx = up[0] - down[0];
  const dz = up[2] - down[2];
  const len = Math.hypot(dx, dz) || 1;
  return [-dx / len, -dz / len];
}

// ---------------------------------------------------------------------------------------------
// Status simulado
// ---------------------------------------------------------------------------------------------

/** Semente geral da simulação (1905: ano de fundação do Boca). */
const AVAILABILITY_SEED = 1905;
/** Quanto as filas da frente vendem mais que as de trás (0 = igual; 0,6 = ±30%). */
const FRONT_ROW_BIAS = 0.6;
const GROUP_MIN = 2;
const GROUP_MAX = 6;

/** Transforma um texto num número (hash FNV-1a): cada setor ganha sua própria semente. */
function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function sectorSeed(sectorId: string): number {
  return (hashString(sectorId) ^ AVAILABILITY_SEED) >>> 0;
}

/** Fração vendida do setor: ~10% dos setores quase esgotados, o resto entre 25% e 85% vendido. */
function sectorSoldShare(random: () => number): number {
  const nearlySoldOut = random() < 0.1;
  const freeShare = nearlySoldOut ? random() * 0.06 : 0.15 + random() * 0.6;
  return 1 - freeShare;
}

/**
 * Status de uma fila, em grupos: como na vida real, ingressos são comprados por famílias e
 * amigos, então andamos pela fila em blocos de 2 a 6 cadeiras e "sorteamos" cada bloco inteiro.
 */
function rowStatuses(count: number, soldChance: number, random: () => number): SeatStatus[] {
  const statuses: SeatStatus[] = [];
  while (statuses.length < count) {
    const size = GROUP_MIN + Math.floor(random() * (GROUP_MAX - GROUP_MIN + 1));
    const status: SeatStatus = random() < soldChance ? 'sold' : 'available';
    for (let i = 0; i < size && statuses.length < count; i++) statuses.push(status);
  }
  return statuses;
}

// ---------------------------------------------------------------------------------------------
// Gerador
// ---------------------------------------------------------------------------------------------

/**
 * Gera todas as cadeiras de um setor, ordenadas por fila (da frente para trás) e número.
 * Função pura: mesmo setor + mesmo modelo → sempre o mesmo resultado.
 */
export function generateSeats(sector: SeatSource, model: StandsModel): Seat[] {
  const { rowDepth } = SECTOR_LAYOUT;
  const { rowSampleSpacing, eyeHeight, eyeBack } = SEAT_LAYOUT;
  const kind = sector.shape.kind;
  const pitch = SEAT_LAYOUT.pitch[kind];
  const rowEndMargin = SEAT_LAYOUT.rowEndMargin[kind];
  const surface = sectorSurface(sector.shape, model);
  const rows = Math.max(1, Math.floor(sectorDepth(sector.shape, model) / rowDepth));

  const random = createRandom(sectorSeed(sector.id));
  const soldShare = sectorSoldShare(random);

  const seats: Seat[] = [];
  for (let row = 1; row <= rows; row++) {
    const b = (row - 0.5) / rows; // meio da faixa da fila
    const measured = measureRow(surface, b, rowSampleSpacing);
    // Quantas cadeiras cabem (com ¼ de cadeira de tolerância para arredondamentos).
    const count = Math.max(0, Math.floor((measured.length - 2 * rowEndMargin) / pitch + 0.25));

    // Filas da frente vendem mais: chance entre (1 + bias/2) e (1 − bias/2) vezes a média.
    const depthShare = rows > 1 ? (row - 1) / (rows - 1) : 0.5;
    const soldChance = Math.min(1, soldShare * (1 + FRONT_ROW_BIAS * (0.5 - depthShare)));
    const statuses = rowStatuses(count, soldChance, random);

    for (let i = 0; i < count; i++) {
      // Cadeiras centralizadas na fila, uma a cada `pitch` metros.
      const distance = measured.length / 2 + (i - (count - 1) / 2) * pitch;
      const a = aAtDistance(measured, distance);
      const position = surface(a, b);
      const [fx, fz] = facingAt(surface, a, b);
      seats.push({
        id: seatId(sector.id, row, i + 1),
        sectorId: sector.id,
        row,
        number: i + 1,
        a,
        b,
        position,
        // Girar yaw em torno de Y leva o "para frente" da cadeira (+Z) até (sen yaw, cos yaw).
        yaw: Math.atan2(fx, fz),
        eye: [position[0] - fx * eyeBack, position[1] + eyeHeight, position[2] - fz * eyeBack],
        status: statuses[i],
      });
    }
  }
  return seats;
}

/**
 * Cache: gerar as cadeiras custa alguns milissegundos, então guardamos o resultado por setor.
 * WeakMap por modelo: se o modelo das arquibancadas mudar (modo ?debug), o cache antigo é
 * simplesmente esquecido e as cadeiras são geradas de novo.
 */
const cache = new WeakMap<StandsModel, Map<string, Seat[]>>();

export function getSectorSeats(sector: SeatSource, model: StandsModel): Seat[] {
  let bySector = cache.get(model);
  if (!bySector) {
    bySector = new Map();
    cache.set(model, bySector);
  }
  let seats = bySector.get(sector.id);
  if (!seats) {
    seats = generateSeats(sector, model);
    bySector.set(sector.id, seats);
  }
  return seats;
}

/** Capacidade e lugares livres, contados nas próprias cadeiras. */
export function countSeats(seats: readonly Seat[]): { capacity: number; available: number } {
  let available = 0;
  for (const seat of seats) if (seat.status === 'available') available++;
  return { capacity: seats.length, available };
}

/** Agrupa as cadeiras por fila (índice 0 = fila 1), mantendo a ordem por número. */
export function seatsByRow(seats: readonly Seat[]): Seat[][] {
  const rows: Seat[][] = [];
  for (const seat of seats) (rows[seat.row - 1] ??= []).push(seat);
  return rows;
}
