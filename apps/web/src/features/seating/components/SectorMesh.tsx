import { Line } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { memo, useEffect, useMemo } from 'react';
import { DoubleSide } from 'three';
import { type Sector, sectorOutline, type StandsModel } from '@bombonera/shared';
import { COLORS } from '@/config/colors';
import { SECTOR_RENDER } from '@/config/stadium';
import { buildSectorGeometry } from '@/features/seating/lib/sectorGeometry';
import { useSelectionStore } from '@/store/useSelectionStore';
import { isDragGesture, supportsHover } from './pointerRules';

/** Estado visual de um setor. "dimmed" = outro setor está selecionado. */
export type SectorVisualState = 'idle' | 'hovered' | 'selected' | 'dimmed';

/** Opacidade da superfície colorida em cada estado (0 = invisível, 1 = sólida). */
const OPACITY: Record<SectorVisualState, number> = {
  dimmed: 0.2,
  idle: 0.55,
  hovered: 0.75,
  // Escolhido: a superfície quase some para as cadeiras aparecerem; fica o contorno dourado.
  selected: 0.06,
};

/** O contorno fica um pouco acima da superfície colorida. */
const OUTLINE_EXTRA_LIFT = 0.15;

interface SectorMeshProps {
  sector: Sector;
  model: StandsModel;
  color: string;
  state: SectorVisualState;
  /** false = só desenha o contorno (setores ocultos, mas este está selecionado). */
  showSurface: boolean;
}

/** Um setor: superfície translúcida colada na arquibancada + contorno dourado se selecionado. */
export const SectorMesh = memo(function SectorMesh({
  sector,
  model,
  color,
  state,
  showSurface,
}: SectorMeshProps) {
  const { id, shape } = sector;

  // A malha só é recalculada se a forma ou o modelo das arquibancadas mudar (ex.: no ?debug).
  const geometry = useMemo(
    () =>
      buildSectorGeometry(shape, model, {
        lift: SECTOR_RENDER.lift[shape.kind],
        maxSegment: SECTOR_RENDER.segmentLength,
      }),
    [shape, model],
  );
  // Geometria criada "à mão" precisa ser liberada da memória da placa de vídeo ao ser trocada.
  useEffect(() => () => geometry.dispose(), [geometry]);

  const outline = useMemo(
    () =>
      state === 'selected'
        ? sectorOutline(shape, model, {
            lift: SECTOR_RENDER.lift[shape.kind] + OUTLINE_EXTRA_LIFT,
            maxSegment: SECTOR_RENDER.segmentLength,
          })
        : null,
    [shape, model, state],
  );

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation(); // só o setor mais próximo da câmera reage
    if (!supportsHover(e)) return;
    useSelectionStore.getState().setHovered(id);
  };

  const handleOut = () => {
    const store = useSelectionStore.getState();
    if (store.hoveredSectorId === id) store.setHovered(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (isDragGesture(e)) return; // foi arrasto da câmera
    useSelectionStore.getState().selectSector(id);
  };

  return (
    <group>
      {showSurface && (
        <mesh
          geometry={geometry}
          // O setor escolhido não reage ao ponteiro: quem responde agora são as cadeiras dele.
          {...(state === 'selected'
            ? {}
            : { onPointerOver: handleOver, onPointerOut: handleOut, onClick: handleClick })}
          renderOrder={1}
        >
          <meshBasicMaterial
            color={color}
            transparent
            opacity={OPACITY[state]}
            // Não grava profundidade: superfícies translúcidas não se "apagam" umas às outras.
            depthWrite={false}
            side={DoubleSide}
            // Empurra a superfície um tiquinho para a frente no teste de profundidade,
            // evitando o "z-fighting" (piscar) contra a arquibancada.
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
            toneMapped={false}
          />
        </mesh>
      )}

      {outline && (
        <Line
          points={outline}
          color={COLORS.gold}
          lineWidth={3}
          // Desenhado por cima de tudo: o contorno do escolhido aparece mesmo atrás de algo.
          depthTest={false}
          renderOrder={2}
        />
      )}
    </group>
  );
});
