import { CameraControls } from '@react-three/drei';
import { useEffect, useRef, type ComponentRef } from 'react';
import { Box3, MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { CAMERA_LIMITS, SECTOR_CAMERA, SECTOR_PANEL_LAYOUT } from '@/config/stadium';
import { getSector } from '@/features/seating/data/sectors';
import { sectorFrame } from '@/features/seating/lib/sectorGeometry';
import { DEFAULT_PRESET, getPreset, type CameraPresetId } from '@/features/stadium/cameraPresets';
import { useSelectionStore } from '@/store/useSelectionStore';
import { useStandsStore } from '@/store/useStandsStore';
import { useViewStore } from '@/store/useViewStore';

/** Quanto afastar as visões "de fora" em telas verticais (celular em pé). */
const PORTRAIT_ZOOM_OUT = 1.8;

/** Caixa que limita o ponto para onde a câmera olha (não deixa "fugir" do estádio). */
const TARGET_BOUNDS = new Box3(new Vector3(-110, 0, -130), new Vector3(70, 40, 130));

type Controls = ComponentRef<typeof CameraControls>;

/**
 * Controle de câmera: girar (arrastar), zoom (scroll/pinça) e mover (botão direito / dois dedos).
 * Também escuta os stores e anima a câmera até o preset escolhido ou até o setor clicado.
 */
export function CameraRig() {
  const controls = useRef<Controls>(null);
  const clearPreset = useViewStore((s) => s.clearPreset);

  useEffect(() => {
    const cc = controls.current;
    if (!cc) return;

    const isPortrait = () => cc.camera instanceof PerspectiveCamera && cc.camera.aspect < 1;

    const lookAtPreset = (id: CameraPresetId, animate: boolean) => {
      const { position, target, wide } = getPreset(id);
      const pos = new Vector3(...position);
      if (wide && isPortrait()) {
        // Afasta a câmera na mesma direção, mantendo o ângulo: alvo + (posição − alvo) × fator
        const t = new Vector3(...target);
        pos.sub(t).multiplyScalar(PORTRAIT_ZOOM_OUT).add(t);
      }
      void cc.setFocalOffset(0, 0, 0, animate); // desfaz o deslocamento usado nos setores
      void cc.setLookAt(pos.x, pos.y, pos.z, ...target, animate);
    };

    cc.setBoundary(TARGET_BOUNDS);
    lookAtPreset(useViewStore.getState().activePreset ?? DEFAULT_PRESET, false);

    // subscribe() avisa a cada mudança no store sem re-renderizar este componente.
    const unsubscribeView = useViewStore.subscribe((state, prev) => {
      if (state.requestId !== prev.requestId && state.activePreset) {
        lookAtPreset(state.activePreset, true);
      }
    });

    const unsubscribeSelection = useSelectionStore.subscribe((state, prev) => {
      if (state.selectRequestId !== prev.selectRequestId && state.selectedSectorId) {
        flyToSector(cc, state.selectedSectorId, isPortrait());
      }
    });

    return () => {
      unsubscribeView();
      unsubscribeSelection();
    };
  }, []);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={CAMERA_LIMITS.minDistance}
      maxDistance={CAMERA_LIMITS.maxDistance}
      maxPolarAngle={CAMERA_LIMITS.maxPolarAngle}
      smoothTime={0.6}
      onStart={clearPreset} // usuário mexeu na câmera → nenhum preset ativo
    />
  );
}

/**
 * Voa até um setor. A câmera fica entre o setor e o campo, mais alta, olhando para ele:
 *
 *          câmera ●
 *                  ╲  ← distância (proporcional ao tamanho do setor)
 *     campo   ⟵     ╲ elevação
 *              ───────● centro do setor
 */
function flyToSector(cc: Controls, sectorId: string, portrait: boolean) {
  const sector = getSector(sectorId);
  if (!sector) return;
  const { center, toField, size } = sectorFrame(sector.shape, useStandsStore.getState().model);

  const elevation = MathUtils.degToRad(SECTOR_CAMERA.elevationDeg[sector.shape.kind]);
  let distance = MathUtils.clamp(
    size * SECTOR_CAMERA.distanceFactor,
    SECTOR_CAMERA.minDistance,
    SECTOR_CAMERA.maxDistance,
  );
  if (portrait) distance *= SECTOR_CAMERA.portraitZoomOut;

  // Posição = centro + direção do campo (na horizontal) × cos(elevação) + para cima × sen(elevação)
  const horizontal = Math.cos(elevation) * distance;
  const [cx, cy, cz] = center;
  const position = [
    cx + toField[0] * horizontal,
    cy + Math.sin(elevation) * distance,
    cz + toField[1] * horizontal,
  ] as const;

  const [ox, oy] = panelFocalOffset(cc, distance);
  void cc.setFocalOffset(ox, oy, 0, true);
  void cc.setLookAt(...position, cx, cy, cz, true);
}

/**
 * Desloca a imagem (sem mudar o ponto em volta do qual a câmera gira) para o setor aparecer
 * no meio da área livre da tela, e não atrás do painel: para a esquerda no desktop
 * (painel à direita) ou para cima no celular (gaveta embaixo).
 */
function panelFocalOffset(cc: Controls, distance: number): [x: number, y: number] {
  const camera = cc.camera;
  if (!(camera instanceof PerspectiveCamera)) return [0, 0];
  // Tamanho, em metros, do que cabe na tela à distância do setor.
  const visibleHeight = 2 * distance * Math.tan(MathUtils.degToRad(camera.fov / 2));
  const visibleWidth = visibleHeight * camera.aspect;
  const { innerWidth: w, innerHeight: h } = window;
  const { desktopMinWidth, sideWidth, sheetHeight } = SECTOR_PANEL_LAYOUT;
  // No camera-controls, x > 0 move a câmera para a direita (a cena "vai" para a esquerda)
  // e y > 0 move a câmera para baixo (a cena "sobe" na tela).
  if (w >= desktopMinWidth) return [(sideWidth / 2 / w) * visibleWidth, 0];
  return [0, (Math.min(sheetHeight, h / 2) / 2 / h) * visibleHeight];
}
