import { Line } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { memo, useEffect, useMemo } from 'react';
import { DoubleSide } from 'three';
import { SECTOR_LAYOUT } from '@/config/stadium';
import type { Sector } from '@/features/seating/data/sectors';
import {
  buildSectorGeometry,
  sectorOutline,
  type StandsModel,
} from '@/features/seating/lib/sectorGeometry';
import { useSelectionStore } from '@/store/useSelectionStore';

/** Estado visual de um setor. "dimmed" = outro setor está selecionado. */
export type SectorVisualState = 'idle' | 'hovered' | 'selected' | 'dimmed';

/** Opacidade da superfície colorida em cada estado (0 = invisível, 1 = sólida). */
const OPACITY: Record<SectorVisualState, number> = {
  dimmed: 0.2,
  idle: 0.55,
  hovered: 0.75,
  selected: 0.8,
};

/** Dourado do Boca (o mesmo --color-boca-gold do CSS), no contorno do setor selecionado. */
const SELECTED_OUTLINE_COLOR = '#f2b51c';
/** O contorno fica um pouco acima da superfície colorida. */
const OUTLINE_EXTRA_LIFT = 0.15;
/** Se o ponteiro andou mais que isso (px) entre apertar e soltar, foi arrasto, não clique. */
const CLICK_MAX_DRAG_PX = 6;

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
        lift: SECTOR_LAYOUT.lift,
        maxSegment: SECTOR_LAYOUT.segmentLength,
      }),
    [shape, model],
  );
  // Geometria criada "à mão" precisa ser liberada da memória da placa de vídeo ao ser trocada.
  useEffect(() => () => geometry.dispose(), [geometry]);

  const outline = useMemo(
    () =>
      state === 'selected'
        ? sectorOutline(shape, model, {
            lift: SECTOR_LAYOUT.lift + OUTLINE_EXTRA_LIFT,
            maxSegment: SECTOR_LAYOUT.segmentLength,
          })
        : null,
    [shape, model, state],
  );

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation(); // só o setor mais próximo da câmera reage
    if (e.pointerType === 'touch') return; // no toque não existe "passar o mouse"
    useSelectionStore.getState().setHovered(id);
  };

  const handleOut = () => {
    const store = useSelectionStore.getState();
    if (store.hoveredSectorId === id) store.setHovered(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_MAX_DRAG_PX) return; // foi arrasto da câmera
    useSelectionStore.getState().selectSector(id);
  };

  return (
    <group>
      {showSurface && (
        <mesh
          geometry={geometry}
          onPointerOver={handleOver}
          onPointerOut={handleOut}
          onClick={handleClick}
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
          color={SELECTED_OUTLINE_COLOR}
          lineWidth={3}
          // Desenhado por cima de tudo: o contorno do escolhido aparece mesmo atrás de algo.
          depthTest={false}
          renderOrder={2}
        />
      )}
    </group>
  );
});
