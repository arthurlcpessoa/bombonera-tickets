import { useGLTF } from '@react-three/drei';
import { useEffect } from 'react';
import { Mesh, Raycaster, Vector3, type Material, type Object3D } from 'three';
import { SEAT_VIEW, STADIUM_MODEL_URL } from '@/config/stadium';
import { findSeat } from '@/features/seating/data/seats';
import { ceilingRay, fieldSamplePoints, findCeiling } from '@/features/seating/lib/seatView';
import { useSeatViewStore } from '@/store/useSeatViewStore';
import { useStandsStore } from '@/store/useStandsStore';

/** Pontos do gramado testados: calculados uma vez (não mudam). */
const SAMPLES = fieldSamplePoints().map((p) => new Vector3(...p));
/** Quantos quadros, no máximo, esperar o índice BVH ficar pronto antes de calcular mesmo assim. */
const MAX_WAIT_FRAMES = 300;

/**
 * Visibilidade do campo por raios (raycasting). Não desenha nada.
 *
 * Dos olhos do torcedor, "esticamos" uma linha reta até cada ponto de uma grade sobre o gramado
 * (SEAT_VIEW.visibilityGrid, 60 pontos). Se a linha bate em alguma parte do estádio ANTES de chegar
 * ao ponto (marquise, laje, coluna, mureta), aquele ponto está escondido para quem senta ali.
 * A fração de raios bloqueados é a fração do campo obstruída.
 *
 *     olhos ●───────────────────▶ ✓ ponto visível
 *            ╲   ▓▓ laje
 *             ╲──▓▓               ✗ bloqueado (bateu na laje antes do ponto)
 *
 * Teto da visão: com os mesmos raios, medimos se há estrutura ACIMA da cadeira (setor coberto) e
 * até que ângulo dá para olhar para cima, rumo ao meio-campo (veja findCeiling em lib/seatView.ts).
 * São no máximo 91 raios a mais (1 por grau), calculados no mesmo momento.
 *
 * O que NÃO bloqueia: materiais transparentes (alambrado, vidros, telas), porque através deles se
 * vê o jogo; e o que estiver a menos de SEAT_VIEW.visibilityNear dos olhos (seria a própria cabeça).
 *
 * Desempenho: cada raio testa só o estádio (não os setores), e o índice BVH já montado pelo
 * <Bvh> do StadiumModel faz cada teste levar microssegundos. Mesmo assim, o cálculo roda só ao
 * entrar na visão ou trocar de cadeira, nunca a cada quadro.
 */
export function SeatVisibilityProbe() {
  const { scene } = useGLTF(STADIUM_MODEL_URL, false, true);

  useEffect(() => {
    let frame = 0;
    const blockers = opaqueMeshes(scene);

    const measure = (seatId: string) => {
      const found = findSeat(seatId, useStandsStore.getState().model);
      if (!found) return;
      const eye = new Vector3(...found.seat.eye);
      const raycaster = new Raycaster();
      raycaster.firstHitOnly = true; // basta saber SE bateu (three-mesh-bvh)
      const direction = new Vector3();
      let blocked = 0;
      for (const point of SAMPLES) {
        const distance = direction.subVectors(point, eye).length();
        raycaster.set(eye, direction.normalize());
        // Só interessa o que está ENTRE os olhos e o ponto (com uma folga perto da grama).
        raycaster.near = SEAT_VIEW.visibilityNear;
        raycaster.far = distance - SEAT_VIEW.visibilityTolerance;
        if (raycaster.intersectObjects(blockers, false).length > 0) blocked++;
      }

      // Teto da visão: de 90° para baixo, rumo ao meio-campo, enquanto houver estrutura no caminho.
      const ceilingDeg = findCeiling((deg) => {
        const ray = ceilingRay(found.seat.eye, deg);
        raycaster.set(eye, direction.set(...ray.direction));
        raycaster.near = SEAT_VIEW.visibilityNear;
        raycaster.far = ray.far;
        return raycaster.intersectObjects(blockers, false).length > 0;
      });

      useSeatViewStore
        .getState()
        .setVisibility({ seatId, blocked, total: SAMPLES.length, ceilingDeg });
    };

    /** Espera o próximo quadro (o HUD aparece antes) e o índice BVH ficar pronto. */
    const schedule = (seatId: string, waited = 0) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!bvhReady(scene) && waited < MAX_WAIT_FRAMES) schedule(seatId, waited + 1);
        else measure(seatId);
      });
    };

    const initial = useSeatViewStore.getState().viewingSeatId;
    if (initial) schedule(initial);
    const unsubscribe = useSeatViewStore.subscribe((state, prev) => {
      if (state.viewingSeatId && state.viewingSeatId !== prev.viewingSeatId) {
        schedule(state.viewingSeatId);
      }
    });
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
    };
  }, [scene]);

  return null;
}

/**
 * Malhas que tapam a visão: as opacas. O alambrado, por exemplo, é uma placa com textura
 * vazada (material transparente, "BLEND" no glTF): para o raio seria uma parede, para o olho não.
 */
function opaqueMeshes(root: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  const isTransparent = (m: Material | Material[]) =>
    Array.isArray(m) ? m.some((x) => x.transparent) : m.transparent;
  root.traverse((obj) => {
    if (obj instanceof Mesh && obj.visible && !isTransparent(obj.material)) meshes.push(obj);
  });
  return meshes;
}

/**
 * O <Bvh> monta o índice de cada malha logo depois de montar. Sem ele, cada raio testaria os
 * 721 mil triângulos um a um (segundos de tela travada), então esperamos.
 */
function bvhReady(root: Object3D): boolean {
  let ready = true;
  root.traverse((obj) => {
    if (obj instanceof Mesh && !obj.geometry.boundsTree) ready = false;
  });
  return ready;
}
