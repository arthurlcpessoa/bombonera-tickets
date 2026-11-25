/**
 * Sonda das arquibancadas: mede o modelo 3D para encaixar os setores sobre ele.
 *
 * Como funciona (analogia do agrimensor): soltamos "bolinhas" do céu (raios verticais, de cima
 * para baixo) e anotamos onde cada uma bate no modelo. Juntando os pontos, aparece o perfil
 * da arquibancada.
 *
 * Uso (na raiz do projeto):
 *   node scripts/probe-stands.mjs                 → perfis padrão (cabeceiras, lateral, cantos, palcos)
 *   node scripts/probe-stands.mjs materials       → lista os materiais e a caixa que cada um ocupa
 *   node scripts/probe-stands.mjs line x0 z0 x1 z1 [passo]
 *                                                  → perfil ao longo de uma linha qualquer
 *   node scripts/probe-stands.mjs check [passo]   → erro do modelo de bandejas (com a correção)
 *   node scripts/probe-stands.mjs calibrate       → mede e grava a tabela de correção
 *                                                    (= npm run stands:calibrate)
 *
 * Variável HITS=8 mostra mais impactos por raio (os de baixo ficam escondidos sob coberturas).
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
} from '../apps/web/src/features/seating/lib/stadiumPath.ts';
import { STAND_PATH, TIER_PROFILES } from '../apps/web/src/config/stadium.ts';

const MODEL = 'apps/web/public/models/bombonera.glb';
const CALIBRATION_FILE = 'apps/web/src/features/seating/data/standCalibration.ts';
/** Altura de onde os raios partem (acima de tudo no modelo). */
const SKY = 100;
const MAX_HITS = Number(process.env.HITS ?? 4);
const TIERS = ['lower', 'middle', 'upper'];

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

/** Todos os impactos de um raio vertical em (x, z), de cima para baixo. */
function probe(x, z) {
  raycaster.set(new Vector3(x, SKY, z), down);
  return raycaster
    .intersectObjects(meshes, false)
    .map((h) => ({ y: h.point.y, mat: h.object.name }));
}

/**
 * Classifica o primeiro impacto de um raio: em qual bandeja ele caiu?
 * Regras tiradas da listagem de materiais: as cadeiras das bandejas inferior e superior usam
 * "popu_29" (cabeceiras) ou "material_47" (lateral); a média usa "material_43"/"material_44".
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

/** Imprime um perfil: para cada ponto, as alturas atingidas (até MAX_HITS) e os materiais. */
function profile(label, x0, z0, x1, z1, step = 2) {
  console.log(`\n=== ${label}: (${x0}, ${z0}) → (${x1}, ${z1}), passo ${step} m`);
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / step));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const z = z0 + ((z1 - z0) * i) / n;
    const hits = probe(x, z).slice(0, MAX_HITS);
    const txt = hits.map((h) => `${f(h.y)} ${h.mat.slice(0, 14).padEnd(14)}`).join(' | ');
    console.log(`x${f(x)} z${f(z)} → ${txt || '(nada)'}`);
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
    const hit = probe(p.x + p.nx * d, p.z + p.nz * d)[0];
    if (classify(hit) !== tier) continue;
    if (prev && prev.y <= yRef && hit.y >= yRef) {
      return prev.d + ((yRef - prev.y) / (hit.y - prev.y || 1)) * (d - prev.d);
    }
    prev = { d, y: hit.y };
  }
  return null;
}

/** Preenche buracos (null) com o vizinho válido mais próximo e suaviza com mediana de 5. */
function cleanSeries(values) {
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
    const max = Math.max(...a.map(Math.abs), ...b.map(Math.abs));
    console.log(`${tier.padEnd(7)} correção máxima ${max.toFixed(2)} m`);
  }

  const body = TIERS.map(
    (tier) =>
      `  ${tier}: {\n    inner: [${result[tier].inner.join(', ')}],\n    outer: [${result[tier].outer.join(', ')}],\n  },`,
  ).join('\n');
  writeFileSync(
    CALIBRATION_FILE,
    `/**
 * ARQUIVO GERADO por \`npm run stands:calibrate\` (scripts/probe-stands.mjs). Não edite à mão.
 *
 * Correção, em metros, do offset de cada bandeja ao longo do U (${samples} amostras de t = 0 a 1),
 * medida no modelo 3D em relação a STAND_PATH e TIER_PROFILES (src/config/stadium.ts).
 */
import type { CurvedTier, TierCorrection } from '@/features/seating/lib/stadiumPath';

export const STAND_CALIBRATION: Record<CurvedTier, TierCorrection> = {
${body}
};
`,
  );
  console.log(`Gravado em ${CALIBRATION_FILE}. Rode "npm run format" e confira com "check".`);
}

/** Erro restante do modelo (com a tabela de correção), em três alturas de cada bandeja. */
async function check(step = 0.02) {
  let calibration = null;
  try {
    ({ STAND_CALIBRATION: calibration } = await import(`../${CALIBRATION_FILE}`));
  } catch {
    console.log('(sem tabela de correção: medindo só o modelo geométrico)');
  }
  const us = [0.15, 0.5, 0.85];
  console.log('   t   | erro (m) em u = 0,15 / 0,5 / 0,85, por bandeja: lower | middle | upper');
  const errors = Object.fromEntries(TIERS.map((tier) => [tier, []]));
  for (let t = 0; t <= 1 + 1e-9; t += step) {
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
}

// ---------------------------------------------------------------------------------------------

const [cmd, ...args] = process.argv.slice(2);

if (cmd === 'materials') {
  listMaterials();
} else if (cmd === 'line') {
  const [x0, z0, x1, z1, step] = args.map(Number);
  profile('linha', x0, z0, x1, z1, step || 1);
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
