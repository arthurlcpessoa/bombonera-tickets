/**
 * Sonda das arquibancadas: mede o modelo 3D para encaixar os setores sobre ele.
 *
 * Como funciona (analogia do agrimensor): soltamos "bolinhas" do céu (raios verticais, de cima
 * para baixo) e anotamos onde cada uma bate no modelo. Juntando os pontos, aparece o perfil
 * da arquibancada.
 *
 * PONTO CEGO (corrigido): as bandejas são empilhadas como degraus de uma estante inclinada. A de
 * cima avança por cima do fundo da de baixo, como uma marquise. Um raio vertical que olha só o
 * PRIMEIRO impacto bate na bandeja de cima e nunca "vê" as últimas filas da de baixo. Por isso
 * a sonda usa TODOS os impactos do raio e procura, entre eles, a superfície de cadeiras de cada
 * bandeja (veja `seatHit`).
 *
 * Uso (na raiz do projeto):
 *   node scripts/probe-stands.mjs                 → perfis padrão (cabeceiras, lateral, cantos, palcos)
 *   node scripts/probe-stands.mjs materials       → lista os materiais e a caixa que cada um ocupa
 *   node scripts/probe-stands.mjs line x0 z0 x1 z1 [passo]
 *                                                  → perfil ao longo de uma linha qualquer
 *   node scripts/probe-stands.mjs up x y z        → o que há acima de um ponto (altura livre)
 *   node scripts/probe-stands.mjs check [passo]   → erro do modelo de bandejas (com a correção),
 *                                                    borda externa real × modelo e altura livre
 *   node scripts/probe-stands.mjs calibrate       → mede e grava a tabela de correção
 *                                                    (= npm run stands:calibrate)
 *
 * Variável HITS=8 mostra também os primeiros impactos "crus" de cada raio, de cima para baixo.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { writeFileSync } from 'node:fs';
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from 'three';
import { acceleratedRaycast, computeBoundsTree } from 'three-mesh-bvh';

// Node 26 executa TypeScript "simples" direto: reaproveitamos a MESMA matemática do site.
import {
  samplePath,
  tierHeight,
  tierOffset,
  tierPoint,
} from '../apps/web/src/features/seating/lib/stadiumPath.ts';
import {
  SEAT_LAYOUT,
  SECTOR_LAYOUT,
  STAND_PATH,
  TIER_PROFILES,
} from '../apps/web/src/config/stadium.ts';

const MODEL = 'apps/web/public/models/bombonera.glb';
const CALIBRATION_FILE = 'apps/web/src/features/seating/data/standCalibration.ts';
/** Altura de onde os raios partem (acima de tudo no modelo). */
const SKY = 100;
/** Impactos "crus" impressos por raio nos perfis (0 = só o resumo por bandeja). */
const RAW_HITS = Number(process.env.HITS ?? 0);
const TIERS = ['lower', 'middle', 'upper'];
/**
 * Borda externa: a partir do meio da bandeja, andamos para fora em passos de EDGE_STEP até
 * EDGE_SEARCH metros. Um buraco de até EDGE_GAP metros sem cadeiras (escada, vomitório) não
 * encerra a bandeja; um buraco maior, sim.
 */
const EDGE_STEP = 0.25;
const EDGE_SEARCH = 25;
const EDGE_GAP = 4;
/** Folga mínima entre os olhos de quem está sentado e o que houver acima (m). */
const MIN_HEADROOM = SEAT_LAYOUT.minHeadroom;
/** Amostras ao longo do U na medida de folga (0,3 a 0,4 m entre elas: menos que uma cadeira). */
const HEADROOM_SAMPLES = 1001;

// BVH ("caixas dentro de caixas"): como o índice de um livro, o raio vai direto aos poucos
// triângulos que podem ser atingidos, em vez de testar os 721 mil um por um (~100× mais rápido).
BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
Mesh.prototype.raycast = acceleratedRaycast;

// ---------------------------------------------------------------------------------------------
// Carregamento
// ---------------------------------------------------------------------------------------------

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const document = await io.read(MODEL);

/**
 * Converte cada primitiva do glTF numa Mesh do Three.js já em coordenadas do mundo.
 * O glTF guarda posições "quantizadas" (inteiros) + uma matriz no nó; aqui aplicamos tudo
 * para ter metros de verdade.
 */
function buildMeshes() {
  const meshes = [];
  for (const node of document.getRoot().listNodes()) {
    const gltfMesh = node.getMesh();
    if (!gltfMesh) continue;
    const world = new Matrix4().fromArray(node.getWorldMatrix());
    for (const prim of gltfMesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue; // só triângulos
      const pos = prim.getAttribute('POSITION');
      const positions = new Float32Array(pos.getCount() * 3);
      const el = [];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, el); // getElement já desfaz a normalização
        positions.set(el, i * 3);
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(positions, 3));
      const indices = prim.getIndices();
      if (indices) geometry.setIndex(new BufferAttribute(Uint32Array.from(indices.getArray()), 1));
      geometry.applyMatrix4(world);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      geometry.computeBoundsTree();
      const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
      mesh.name = prim.getMaterial()?.getName() || '(sem material)';
      meshes.push(mesh);
    }
  }
  return meshes;
}

const meshes = buildMeshes();
const raycaster = new Raycaster();
const down = new Vector3(0, -1, 0);
const up = new Vector3(0, 1, 0);

/**
 * TODOS os impactos de um raio vertical em (x, z), de cima para baixo, sem limite.
 * O raio atravessa tudo (como um espeto): a bandeja de cima, a de baixo, o piso...
 */
function probe(x, z) {
  raycaster.set(new Vector3(x, SKY, z), down);
  return raycaster
    .intersectObjects(meshes, false)
    .map((h) => ({ y: h.point.y, mat: h.object.name }));
}

/**
 * A superfície de cadeiras de `tier` neste raio, em qualquer profundidade: o impacto mais alto
 * daquela bandeja, mesmo que esteja escondido embaixo de outra. `null` se o raio não a cruza.
 *
 * Antes a sonda olhava só `hits[0]`, o primeiro impacto. Embaixo da marquise da bandeja de cima,
 * o primeiro impacto é a de cima, e as últimas filas da de baixo ficavam invisíveis.
 */
function seatHit(hits, tier) {
  return hits.find((h) => classify(h) === tier) ?? null;
}

/**
 * Altura livre acima de (x, y, z): distância até o primeiro objeto, com um raio para CIMA.
 * `Infinity` = céu aberto.
 */
function headroom(x, y, z) {
  raycaster.set(new Vector3(x, y, z), up);
  const hit = raycaster.intersectObjects(meshes, false)[0];
  return hit ? hit.point.y - y : Infinity;
}

/**
 * Classifica um impacto: é a superfície de cadeiras de qual bandeja?
 * Regras tiradas da listagem de materiais: as cadeiras das bandejas inferior e superior usam
 * "popu_29" (cabeceiras) ou "material_47" (lateral); a média usa "material_43"/"material_44".
 * Inferior e superior usam o mesmo material, então a altura separa as duas.
 */
function classify(hit) {
  if (!hit) return null;
  const seats = hit.mat === 'popu_29' || hit.mat === 'material_47';
  if (seats && hit.y < 8) return 'lower';
  if (hit.mat === 'material_43' || hit.mat === 'material_44') return 'middle';
  if (seats && hit.y > 20) return 'upper';
  return null;
}

const f = (n) => n.toFixed(1).padStart(6);

// ---------------------------------------------------------------------------------------------
// Perfis ao longo de linhas
// ---------------------------------------------------------------------------------------------

/**
 * Imprime um perfil: para cada ponto, a altura das cadeiras de cada bandeja (mesmo escondidas
 * embaixo de outra) e o que o raio atinge primeiro. Um "*" marca a bandeja coberta: ali o
 * primeiro impacto é outra coisa. Com HITS=n, mostra também os n primeiros impactos crus.
 * No fim, a borda externa real de cada bandeja nesta linha (o último ponto com cadeiras dela).
 */
function profile(label, x0, z0, x1, z1, step = 2) {
  console.log(`\n=== ${label}: (${x0}, ${z0}) → (${x1}, ${z1}), passo ${step} m`);
  console.log(`                 inferior   média  superior | 1º impacto`);
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / step));
  const last = {};
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const z = z0 + ((z1 - z0) * i) / n;
    const hits = probe(x, z);
    const cols = TIERS.map((tier) => {
      const hit = seatHit(hits, tier);
      if (!hit) return '       —';
      last[tier] = { x, z, y: hit.y };
      return `${f(hit.y)}${hit === hits[0] ? ' ' : '*'} `;
    }).join('');
    const first = hits[0] ? `${f(hits[0].y)} ${hits[0].mat.slice(0, 14)}` : '(nada)';
    const raw = hits
      .slice(0, RAW_HITS)
      .map((h) => `${f(h.y)} ${h.mat.slice(0, 14).padEnd(14)}`)
      .join(' | ');
    console.log(`x${f(x)} z${f(z)} ${cols}| ${first}${raw ? `  ‖ ${raw}` : ''}`);
  }
  for (const tier of TIERS) {
    const e = last[tier];
    if (e) console.log(`  borda externa ${tier.padEnd(6)}: x${f(e.x)} z${f(e.z)} y${f(e.y)}`);
  }
}

function listMaterials() {
  const byMat = new Map();
  for (const m of meshes) {
    const box = byMat.get(m.name) ?? new Box3();
    box.union(m.geometry.boundingBox);
    byMat.set(m.name, box);
  }
  const p = (v) => `(${f(v.x)},${f(v.y)},${f(v.z)})`;
  for (const [name, b] of byMat) console.log(`${name.padEnd(32)} min${p(b.min)} max${p(b.max)}`);
}

// ---------------------------------------------------------------------------------------------
// Medida das bandejas ao longo do U
// ---------------------------------------------------------------------------------------------

/**
 * Medida robusta: em vez de procurar as bordas (que têm escadas e vomitórios no caminho),
 * acha a que distância do caminho-base a rampa da bandeja cruza a altura do ponto u.
 * Analogia: medir uma ladeira pelo ponto em que ela passa por uma certa cota.
 * Retorna null se não achou (ex.: nas pontas do U, onde a bandeja acaba).
 */
function measureOffset(tier, t, u) {
  const p = samplePath(t, STAND_PATH);
  const prof = TIER_PROFILES[tier];
  const yRef = tierHeight(prof, u);
  const guess = tierOffset(prof, t, u);
  let prev = null;
  for (let d = guess - 10; d <= guess + 10; d += 0.25) {
    const hit = seatHit(probe(p.x + p.nx * d, p.z + p.nz * d), tier);
    if (!hit) continue;
    if (prev && prev.y <= yRef && hit.y >= yRef) {
      return prev.d + ((yRef - prev.y) / (hit.y - prev.y || 1)) * (d - prev.d);
    }
    prev = { d, y: hit.y };
  }
  return null;
}

/**
 * Borda externa REAL da bandeja no ponto t: o último ponto, andando para fora pela normal, em
 * que o raio ainda cruza as cadeiras dela (mesmo embaixo de outra bandeja).
 * A altura é a MAIOR encontrada: a rampa só sobe, e o último raio às vezes pega a quina de trás
 * do degrau, uns 0,6 m abaixo do topo.
 * @returns { d, y } (distância do caminho-base e altura) ou null se não achou cadeiras
 */
function outerEdge(tier, t, calibration) {
  const p = samplePath(t, STAND_PATH);
  const start = tierOffset(TIER_PROFILES[tier], t, 0.5, calibration?.[tier]);
  let last = null;
  for (let d = start; d <= start + EDGE_SEARCH; d += EDGE_STEP) {
    const hit = seatHit(probe(p.x + p.nx * d, p.z + p.nz * d), tier);
    if (hit) last = { d, y: Math.max(hit.y, last?.y ?? -Infinity) };
    else if (last && d - last.d > EDGE_GAP) break;
  }
  return last;
}

/**
 * Altura livre de cada fila no ponto t, do jeito que o site gera as cadeiras (lib/seatLayout.ts):
 * N filas de SECTOR_LAYOUT.rowDepth, cada uma no meio da sua faixa, olhos SEAT_LAYOUT.eyeHeight
 * acima da superfície. Do ponto dos olhos, um raio para cima mede a folga até o que houver lá.
 * @returns folga (m) por fila, da fila 1 (frente) à última
 */
function rowHeadrooms(tier, t, calibration) {
  const prof = TIER_PROFILES[tier];
  const rows = Math.max(
    1,
    Math.floor(Math.abs(prof.outerOffset - prof.innerOffset) / SECTOR_LAYOUT.rowDepth),
  );
  return Array.from({ length: rows }, (_, i) => {
    const [x, y, z] = tierPoint(t, (i + 0.5) / rows, STAND_PATH, prof, calibration?.[tier]);
    return headroom(x, y + SEAT_LAYOUT.eyeHeight, z);
  });
}

/**
 * Trechos de fila sem folga acima da cabeça, ao longo de todo o U: [fila, t0, t1].
 * Amostras vizinhas sem folga viram um trecho só; cada trecho ganha meia amostra de cada lado,
 * para cobrir o espaço até a amostra seguinte (que tinha folga).
 */
function headroomGaps(tier, calibration) {
  const half = 0.5 / (HEADROOM_SAMPLES - 1);
  const round = (v) => Math.round(Math.min(Math.max(v, 0), 1) * 10000) / 10000;
  const open = new Map(); // fila → t onde o trecho atual começou
  const gaps = [];
  for (let i = 0; i < HEADROOM_SAMPLES; i++) {
    const t = i / (HEADROOM_SAMPLES - 1);
    const rows = rowHeadrooms(tier, t, calibration);
    rows.forEach((h, r) => {
      const row = r + 1;
      if (h < MIN_HEADROOM && !open.has(row)) open.set(row, t);
      if (h >= MIN_HEADROOM && open.has(row)) {
        gaps.push([row, round(open.get(row) - half), round(t - half)]);
        open.delete(row);
      }
    });
  }
  for (const [row, t0] of open) gaps.push([row, round(t0 - half), 1]);
  return gaps.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
}

/**
 * Preenche buracos (null) com o vizinho válido mais próximo, tira "picos" com uma mediana de 5
 * e alisa os degraus que sobram com uma média de 3 vizinhos. Sem essa última etapa, uma quina
 * do modelo vira um "zigue-zague" na fila de cadeiras (Fase 3).
 */
function cleanSeries(values) {
  const median = medianSeries(values);
  return median.map((_, i) => {
    const win = median.slice(Math.max(0, i - 1), i + 2);
    return win.reduce((sum, v) => sum + v, 0) / win.length;
  });
}

function medianSeries(values) {
  const filled = values.map((v, i) => {
    if (v !== null) return v;
    for (let k = 1; k < values.length; k++) {
      const a = values[i - k] ?? null;
      const b = values[i + k] ?? null;
      if (a !== null || b !== null) return a ?? b;
    }
    return 0;
  });
  return filled.map((_, i) => {
    const win = filled.slice(Math.max(0, i - 2), i + 3).sort((a, b) => a - b);
    return win[Math.floor(win.length / 2)];
  });
}

/**
 * Gera a tabela de correção. Mede o desvio (real − modelo) em u = 0,25 e u = 0,75 e extrapola
 * para as bordas (u = 0 e u = 1), porque a bandeja inferior, por exemplo, alarga nos cantos.
 */
function calibrate(samples = 201) {
  const result = {};
  for (const tier of TIERS) {
    const lowU = [];
    const highU = [];
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      const dLow = measureOffset(tier, t, 0.25);
      const dHigh = measureOffset(tier, t, 0.75);
      lowU.push(dLow === null ? null : dLow - tierOffset(TIER_PROFILES[tier], t, 0.25));
      highU.push(dHigh === null ? null : dHigh - tierOffset(TIER_PROFILES[tier], t, 0.75));
    }
    const a = cleanSeries(lowU);
    const b = cleanSeries(highU);
    // Reta que passa por (0,25; a) e (0,75; b), avaliada em u = 0 e u = 1.
    const round = (v) => Math.round(v * 100) / 100;
    result[tier] = {
      inner: a.map((v, i) => round(v - (b[i] - v) / 2)),
      outer: a.map((v, i) => round(b[i] + (b[i] - v) / 2)),
    };
    // A folga depende de onde as filas ficam: por isso é medida com a correção NOVA.
    result[tier].noHeadroom = headroomGaps(tier, result);
    const max = Math.max(...a.map(Math.abs), ...b.map(Math.abs));
    console.log(
      `${tier.padEnd(7)} correção máxima ${max.toFixed(2)} m · ` +
        `trechos de fila sem folga: ${result[tier].noHeadroom.length}`,
    );
  }

  const gapsText = (gaps) => gaps.map((g) => `[${g.join(', ')}]`).join(', ');
  const body = TIERS.map(
    (tier) =>
      `  ${tier}: {\n    inner: [${result[tier].inner.join(', ')}],\n    outer: [${result[tier].outer.join(', ')}],\n    noHeadroom: [${gapsText(result[tier].noHeadroom)}],\n  },`,
  ).join('\n');
  writeFileSync(
    CALIBRATION_FILE,
    `/**
 * ARQUIVO GERADO por \`npm run stands:calibrate\` (scripts/probe-stands.mjs). Não edite à mão.
 *
 * Correção, em metros, do offset de cada bandeja ao longo do U (${samples} amostras de t = 0 a 1),
 * medida no modelo 3D em relação a STAND_PATH e TIER_PROFILES (src/config/stadium.ts).
 * noHeadroom: trechos [fila, t0, t1] com menos de ${MIN_HEADROOM} m livres acima dos olhos
 * (${HEADROOM_SAMPLES} amostras ao longo do U). Cadeiras nesses trechos não são geradas.
 */
import type { CurvedTier, TierCorrection } from '@/features/seating/lib/stadiumPath';

export const STAND_CALIBRATION: Record<CurvedTier, TierCorrection> = {
${body}
};
`,
  );
  console.log(`Gravado em ${CALIBRATION_FILE}. Rode "npm run format" e confira com "check".`);
}

/**
 * Confere o modelo de bandejas contra o .glb, ao longo do U:
 *  1) erro do offset em três alturas de cada bandeja (com a tabela de correção);
 *  2) borda externa: onde as cadeiras REALMENTE acabam × onde a última fila do site acaba;
 *  3) altura livre acima dos olhos na última fila (e quantas filas ficam abaixo de MIN_HEADROOM).
 */
async function check(step = 0.02) {
  let calibration = null;
  try {
    ({ STAND_CALIBRATION: calibration } = await import(`../${CALIBRATION_FILE}`));
  } catch {
    console.log('(sem tabela de correção: medindo só o modelo geométrico)');
  }
  const ts = [];
  for (let t = 0; t <= 1 + 1e-9; t += step) ts.push(t);

  console.log('\n1) ERRO DO OFFSET');
  const us = [0.15, 0.5, 0.85];
  console.log('   t   | erro (m) em u = 0,15 / 0,5 / 0,85, por bandeja: lower | middle | upper');
  const errors = Object.fromEntries(TIERS.map((tier) => [tier, []]));
  for (const t of ts) {
    const cols = TIERS.map((tier) =>
      us
        .map((u) => {
          const measured = measureOffset(tier, t, u);
          if (measured === null) return '    —';
          const err = measured - tierOffset(TIER_PROFILES[tier], t, u, calibration?.[tier]);
          errors[tier].push(Math.abs(err));
          return f(err).slice(1);
        })
        .join(''),
    );
    console.log(` ${t.toFixed(2)}  |${cols.join('  |')}`);
  }
  for (const tier of TIERS) {
    const e = errors[tier];
    const mean = e.reduce((a, v) => a + v, 0) / e.length;
    console.log(
      `${tier.padEnd(7)} erro médio ${mean.toFixed(2)} m · máximo ${Math.max(...e).toFixed(2)} m`,
    );
  }

  console.log(
    '\n2) BORDA EXTERNA real × última fila do site. Δ positivo = faltam cadeiras no site',
  );
  console.log('   t   | lower: d    Δd    Δy | middle: d   Δd    Δy | upper: d    Δd    Δy');
  const gaps = Object.fromEntries(TIERS.map((tier) => [tier, []]));
  for (const t of ts) {
    const cols = TIERS.map((tier) => {
      const edge = outerEdge(tier, t, calibration);
      if (!edge) return '                  —';
      const prof = TIER_PROFILES[tier];
      const dd = edge.d - tierOffset(prof, t, 1, calibration?.[tier]);
      const dy = edge.y - prof.outerHeight;
      gaps[tier].push(dd);
      return `${f(edge.d)}${f(dd)}${f(dy)}`;
    });
    console.log(` ${t.toFixed(2)}  |${cols.join(' |')}`);
  }
  for (const tier of TIERS) {
    const g = gaps[tier].slice().sort((a, b) => a - b);
    const median = g[Math.floor(g.length / 2)];
    console.log(`${tier.padEnd(7)} borda externa: mediana ${median.toFixed(2)} m além do modelo`);
  }

  console.log(`\n3) ALTURA LIVRE acima dos olhos (mínimo aceito: ${MIN_HEADROOM} m)`);
  console.log('   t   | folga na última fila (m): lower | middle | upper   (filas sem folga)');
  const tight = Object.fromEntries(TIERS.map((tier) => [tier, 0]));
  for (const t of ts) {
    const cols = TIERS.map((tier) => {
      const rows = rowHeadrooms(tier, t, calibration);
      const bad = rows.filter((h) => h < MIN_HEADROOM).length;
      tight[tier] += bad;
      const lastRow = rows.at(-1);
      return `${lastRow === Infinity ? '  céu' : f(lastRow)}${bad ? ` (${bad})` : '    '}`;
    });
    console.log(` ${t.toFixed(2)}  |${cols.join('  |')}`);
  }
  for (const tier of TIERS) {
    console.log(`${tier.padEnd(7)} pontos de fila sem folga: ${tight[tier]}`);
  }
}

// ---------------------------------------------------------------------------------------------

const [cmd, ...args] = process.argv.slice(2);

if (cmd === 'materials') {
  listMaterials();
} else if (cmd === 'line') {
  const [x0, z0, x1, z1, step] = args.map(Number);
  profile('linha', x0, z0, x1, z1, step || 1);
} else if (cmd === 'up') {
  const [x, y, z] = args.map(Number);
  raycaster.set(new Vector3(x, y, z), up);
  const hits = raycaster.intersectObjects(meshes, false).slice(0, 6);
  console.log(`Raio para cima a partir de (${x}, ${y}, ${z}):`);
  for (const h of hits) console.log(`  +${(h.point.y - y).toFixed(2)} m  ${h.object.name}`);
  if (!hits.length) console.log('  céu aberto');
} else if (cmd === 'check') {
  await check(Number(args[0]) || 0.02);
} else if (cmd === 'calibrate') {
  calibrate();
} else {
  profile('Cabeceira −Z (x = 0)', 0, -50, 0, -125);
  profile('Cabeceira +Z (x = 0)', 0, 50, 0, 125);
  profile('Lateral −X (z = 0)', -30, 0, -115, 0);
  profile('Canto −X −Z (diagonal)', -30, -45, -95, -110);
  profile('Canto −X +Z (diagonal)', -30, 45, -95, 110);
  profile('Ponta do U em −Z (x = 25)', 25, -50, 25, -125);
  profile('Palcos +X (z = 0)', 30, 0, 65, 0, 1);
}
