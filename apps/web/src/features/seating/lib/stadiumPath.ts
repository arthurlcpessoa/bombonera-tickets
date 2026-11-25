/**
 * Caminho em "U" das bandejas curvas da Bombonera.
 *
 * Visto de cima, as arquibancadas contornam o campo como um "U" de cantos arredondados:
 * cabeceira −Z → canto → lateral −X → canto → cabeceira +Z. O lado +X (palcos) é reto e fica de fora.
 *
 *          +X (palcos)
 *   t=0 ●               ● t=1        ← pontas do U (x = tipX, encostadas no prédio dos palcos)
 *       │               │
 *       │     campo     │            cabeceiras: retas em z = ±endZ
 *       │               │
 *       ╰───────────────╯            cantos: arcos de raio cornerRadius
 *          lateral −X (x = sideX)
 *
 * Analogia: pense numa pista de atletismo cortada ao meio. Cada ponto da pista tem um número
 * t entre 0 e 1 ("quanto do caminho já andei"). Um setor é só um trecho [t0, t1] dessa pista.
 *
 * Para achar um ponto da arquibancada, andamos até t no caminho e depois "subimos a
 * arquibancada" na direção para fora do campo (a normal). A distância percorrida para fora é
 * o offset; a altura vem do perfil da bandeja (veja `tierPoint`).
 *
 * Modelo + correção: o retângulo arredondado é só uma aproximação da forma real do estádio
 * (que erra até ~3 m). Uma tabela medida no próprio modelo 3D (`TierCorrection`, gerada por
 * `npm run stands:calibrate`) corrige o offset ao longo do U, como a receita de um óculos.
 *
 * Este arquivo é TypeScript puro, sem React nem Three.js: o script de calibração
 * (scripts/probe-stands.mjs) importa exatamente esta mesma matemática pelo Node.
 */

/** As três bandejas que seguem o U. (Os palcos, no lado reto, são tratados à parte.) */
export type CurvedTier = 'lower' | 'middle' | 'upper';

/** Parâmetros do caminho-base (aproximadamente a borda interna da bandeja inferior). Em metros. */
export interface UPathParams {
  /** x da reta lateral (lado −X). Negativo. */
  sideX: number;
  /** |z| das retas das cabeceiras. */
  endZ: number;
  /** Raio dos cantos arredondados. */
  cornerRadius: number;
  /** x onde o U termina, nas duas pontas (encostado no prédio dos palcos). */
  tipX: number;
}

/**
 * Perfil de uma bandeja: como ela fica "em corte", olhando de lado.
 *
 *   altura
 *     ▲            ● borda externa (outerOffset, outerHeight)
 *     │          ╱
 *     │        ╱    ← a superfície das cadeiras é uma rampa entre as duas bordas
 *     │      ●  borda interna (innerOffset, innerHeight)
 *     └────────────────► distância para fora do caminho-base
 */
export interface TierProfile {
  /** Distância horizontal do caminho-base até a borda interna (a mais perto do campo). */
  innerOffset: number;
  /** Distância horizontal do caminho-base até a borda externa (a mais alta). */
  outerOffset: number;
  /** Altura (y) da borda interna. */
  innerHeight: number;
  /** Altura (y) da borda externa. */
  outerHeight: number;
}

/**
 * Tabela de correção medida no modelo: quantos metros somar ao offset, ao longo do U.
 * `inner[i]` vale para a borda interna e `outer[i]` para a externa, no t = i / (n − 1).
 * Entre dois pontos da tabela, e entre as duas bordas, interpolamos em linha reta.
 */
export interface TierCorrection {
  inner: readonly number[];
  outer: readonly number[];
}

/** Um ponto no chão (planta baixa) + a direção "para fora do campo" naquele ponto. */
export interface PathSample {
  x: number;
  z: number;
  /** Normal horizontal (vetor de tamanho 1) apontando para fora do campo. */
  nx: number;
  nz: number;
}

/** Ponto 3D. Tupla simples para não depender do Three.js aqui. */
export type Point3 = [x: number, y: number, z: number];

/** Comprimentos dos 5 trechos do U: reta, arco, reta lateral, arco, reta. */
function segments({ sideX, endZ, cornerRadius: r, tipX }: UPathParams) {
  const head = Math.max(0, tipX - (sideX + r)); // reta de cada cabeceira
  const arc = (Math.PI / 2) * r; // um quarto de círculo
  const side = Math.max(0, 2 * (endZ - r)); // reta lateral
  return { head, arc, side, total: 2 * head + 2 * arc + side };
}

/** Comprimento total do caminho-base, em metros (útil para converter metros ↔ t). */
export function pathLength(params: UPathParams): number {
  return segments(params).total;
}

/**
 * Ponto do caminho-base para um t ∈ [0, 1].
 * t é proporcional à distância percorrida: t = 0,5 é sempre o meio da lateral (z = 0).
 */
export function samplePath(t: number, params: UPathParams): PathSample {
  const { sideX, endZ, cornerRadius: r, tipX } = params;
  const seg = segments(params);
  let s = clamp01(t) * seg.total; // distância percorrida desde t = 0

  // 1) Cabeceira −Z: anda de x = tipX em direção a −X, com z = −endZ.
  if (s <= seg.head) return { x: tipX - s, z: -endZ, nx: 0, nz: -1 };
  s -= seg.head;

  // 2) Canto −Z: arco com centro em (sideX + r, −endZ + r); a normal gira de −Z para −X.
  if (s <= seg.arc) {
    const angle = -Math.PI / 2 - s / r;
    const nx = Math.cos(angle);
    const nz = Math.sin(angle);
    return { x: sideX + r + nx * r, z: -endZ + r + nz * r, nx, nz };
  }
  s -= seg.arc;

  // 3) Lateral −X: sobe de z = −endZ + r até z = endZ − r, com x = sideX.
  if (s <= seg.side) return { x: sideX, z: -endZ + r + s, nx: -1, nz: 0 };
  s -= seg.side;

  // 4) Canto +Z: arco com centro em (sideX + r, endZ − r); a normal gira de −X para +Z.
  if (s <= seg.arc) {
    const angle = Math.PI + s / r;
    const nx = Math.cos(angle);
    const nz = -Math.sin(angle);
    return { x: sideX + r + nx * r, z: endZ - r + nz * r, nx, nz };
  }
  s -= seg.arc;

  // 5) Cabeceira +Z: volta de x = sideX + r até x = tipX, com z = +endZ.
  return { x: sideX + r + s, z: endZ, nx: 0, nz: 1 };
}

/** Valor da tabela no ponto t, interpolando entre as duas amostras vizinhas. */
function sampleTable(table: readonly number[], t: number): number {
  if (table.length === 0) return 0;
  const pos = clamp01(t) * (table.length - 1);
  const i = Math.min(Math.floor(pos), table.length - 2);
  if (i < 0) return table[0];
  return lerp(table[i], table[i + 1], pos - i);
}

/**
 * Distância horizontal para fora do caminho-base, no ponto (t, u) da bandeja.
 * @param u 0 = borda interna, 1 = borda externa
 */
export function tierOffset(
  profile: TierProfile,
  t: number,
  u: number,
  correction?: TierCorrection,
): number {
  const base = lerp(profile.innerOffset, profile.outerOffset, u);
  if (!correction) return base;
  return base + lerp(sampleTable(correction.inner, t), sampleTable(correction.outer, t), u);
}

/** Altura (y) na posição `u` da bandeja: a rampa sobe em linha reta entre as duas bordas. */
export function tierHeight(profile: TierProfile, u: number): number {
  return lerp(profile.innerHeight, profile.outerHeight, u);
}

/**
 * Ponto 3D sobre a superfície de uma bandeja.
 *
 * @param t posição ao longo do U (0 = ponta em −Z, 0,5 = meio da lateral, 1 = ponta em +Z)
 * @param u posição "subindo a arquibancada" (0 = borda interna, 1 = borda externa)
 *
 * Na Fase 3, cada cadeira será um par (t, u): a fila define u e o número da cadeira define t.
 */
export function tierPoint(
  t: number,
  u: number,
  path: UPathParams,
  profile: TierProfile,
  correction?: TierCorrection,
): Point3 {
  const p = samplePath(t, path);
  const d = tierOffset(profile, t, u, correction);
  return [p.x + p.nx * d, tierHeight(profile, u), p.z + p.nz * d];
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}
