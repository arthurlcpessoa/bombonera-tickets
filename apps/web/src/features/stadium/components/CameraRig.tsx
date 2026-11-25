import { CameraControls } from '@react-three/drei';
import { useEffect, useRef, type ComponentRef } from 'react';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { CAMERA_LIMITS } from '@/config/stadium';
import { DEFAULT_PRESET, getPreset, type CameraPresetId } from '@/features/stadium/cameraPresets';
import { useViewStore } from '@/store/useViewStore';

/** Quanto afastar as visões "de fora" em telas verticais (celular em pé). */
const PORTRAIT_ZOOM_OUT = 1.8;

/** Caixa que limita o ponto para onde a câmera olha (não deixa "fugir" do estádio). */
const TARGET_BOUNDS = new Box3(new Vector3(-110, 0, -130), new Vector3(70, 40, 130));

/**
 * Controle de câmera: girar (arrastar), zoom (scroll/pinça) e mover (botão direito / dois dedos).
 * Também escuta o store e anima a câmera até o preset escolhido nos botões.
 */
export function CameraRig() {
  const controls = useRef<ComponentRef<typeof CameraControls>>(null);
  const clearPreset = useViewStore((s) => s.clearPreset);

  useEffect(() => {
    const cc = controls.current;
    if (!cc) return;

    const lookAt = (id: CameraPresetId, animate: boolean) => {
      const { position, target, wide } = getPreset(id);
      const portrait = cc.camera instanceof PerspectiveCamera && cc.camera.aspect < 1;
      const pos = new Vector3(...position);
      if (wide && portrait) {
        // Afasta a câmera na mesma direção, mantendo o ângulo: alvo + (posição − alvo) × fator
        const t = new Vector3(...target);
        pos.sub(t).multiplyScalar(PORTRAIT_ZOOM_OUT).add(t);
      }
      void cc.setLookAt(pos.x, pos.y, pos.z, ...target, animate);
    };

    cc.setBoundary(TARGET_BOUNDS);
    lookAt(useViewStore.getState().activePreset ?? DEFAULT_PRESET, false);

    // subscribe() avisa a cada mudança no store sem re-renderizar este componente.
    return useViewStore.subscribe((state, prev) => {
      if (state.requestId !== prev.requestId && state.activePreset) {
        lookAt(state.activePreset, true);
      }
    });
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
