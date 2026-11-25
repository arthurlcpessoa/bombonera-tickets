import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { SeatVisibilityProbe } from '@/features/seating/components/SeatVisibilityProbe';
import { SectorOverlay } from '@/features/seating/components/SectorOverlay';
import { getPreset, DEFAULT_PRESET } from '@/features/stadium/cameraPresets';
import { CameraRig } from './CameraRig';
import { Environment } from './Environment';
import { StadiumModel } from './StadiumModel';

const initial = getPreset(DEFAULT_PRESET);

/**
 * <Canvas> é a ponte entre React e Three.js: cria o renderer WebGL, a cena e a câmera.
 * Tudo dentro dele é "JSX 3D" (React Three Fiber).
 */
export function StadiumCanvas() {
  return (
    <Canvas
      className="absolute! inset-0"
      dpr={[1, 2]} // nitidez em telas retina, limitada a 2x por desempenho
      camera={{ fov: 45, near: 0.5, far: 4000, position: initial.position }}
      gl={{ antialias: true }}
    >
      <Environment />

      {/* Suspense: enquanto o .glb carrega, nada é desenhado (a tela de loading HTML aparece por cima). */}
      <Suspense fallback={null}>
        <StadiumModel />
        {/* Setores dentro do mesmo Suspense: só aparecem junto com o estádio. */}
        <SectorOverlay />
        {/* Testa, com raios, quanto do campo se vê da cadeira da visão do assento. */}
        <SeatVisibilityProbe />
      </Suspense>

      <CameraRig />
    </Canvas>
  );
}
