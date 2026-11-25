/**
 * Pipeline do modelo 3D: transforma o glTF bruto baixado do Sketchfab (~58 MB)
 * num único .glb otimizado para a web (~6 MB).
 *
 * Uso:  npm run model:optimize
 *
 * Entrada: assets-src/bombonera/scene.gltf (não versionado — veja docs/MODELO-3D.md)
 * Saída:   apps/web/public/models/bombonera.glb
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup,
  flatten,
  join,
  meshopt,
  prune,
  resample,
  simplify,
  sparse,
  textureCompress,
  weld,
} from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { statSync } from 'node:fs';

const INPUT = 'assets-src/bombonera/scene.gltf';
const OUTPUT = 'apps/web/public/models/bombonera.glb';

/**
 * Centro do gramado nas coordenadas originais do modelo (já em Y para cima).
 * Medido a partir da malha com a textura "cancha". Movemos o estádio inteiro
 * para que o centro do campo fique na origem (0, 0, 0): assim todas as contas
 * de setores e cadeiras partem do meio-campo.
 */
const PITCH_CENTER = [129.836, -0.011, 50.294];

const mb = (path) => `${(statSync(path).size / 1024 / 1024).toFixed(2)} MB`;

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

console.log(`Lendo ${INPUT}...`);
const document = await io.read(INPUT);
const root = document.getRoot();
const scene = root.getDefaultScene() ?? root.listScenes()[0];

// 1) Recentraliza: cria um nó pai deslocado e pendura o modelo original nele.
const origin = document.createNode('Bombonera').setTranslation(PITCH_CENTER.map((v) => -v));
for (const child of scene.listChildren()) {
  scene.removeChild(child);
  origin.addChild(child);
}
scene.addChild(origin);

// 2) Otimizações (cada etapa é explicada em docs/MODELO-3D.md).
await document.transform(
  dedup(), // remove dados duplicados (malhas, texturas, materiais iguais)
  flatten(), // achata a hierarquia de nós
  join(), // junta malhas que usam o mesmo material → menos "draw calls"
  weld(), // funde vértices idênticos
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.75, error: 0.0001 }), // simplificação quase imperceptível
  resample(),
  prune(), // apaga o que ficou sem uso
  sparse(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048] }),
  meshopt({ encoder: MeshoptEncoder, level: 'high' }), // compressão da geometria
);

await io.write(OUTPUT, document);
console.log(`Pronto: ${OUTPUT} (${mb(OUTPUT)})`);
