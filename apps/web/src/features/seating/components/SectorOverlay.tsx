import { useCursor } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { PALCOS_OCCLUDER } from '@/config/stadium';
import { getCategory, SECTORS } from '@/features/seating/data/sectors';
import { useSelectionStore } from '@/store/useSelectionStore';
import { useStandsStore } from '@/store/useStandsStore';
import { SectorMesh, type SectorVisualState } from './SectorMesh';

const [min, max] = [PALCOS_OCCLUDER.min, PALCOS_OCCLUDER.max];
const OCCLUDER_SIZE = [max[0] - min[0], max[1] - min[1], max[2] - min[2]] as const;
const OCCLUDER_CENTER = [
  (min[0] + max[0]) / 2,
  (min[1] + max[1]) / 2,
  (min[2] + max[2]) / 2,
] as const;

/** "Segura" o evento: quem está atrás deste objeto não recebe hover nem clique. */
const block = (e: ThreeEvent<PointerEvent | MouseEvent>) => e.stopPropagation();

/**
 * Camada de setores sobre o estádio: um SectorMesh por setor, colorido pela faixa de preço.
 * Fica dentro do <Canvas>; conversa com a interface HTML só pelo useSelectionStore.
 */
export function SectorOverlay() {
  const model = useStandsStore((s) => s.model);
  const hoveredId = useSelectionStore((s) => s.hoveredSectorId);
  const selectedId = useSelectionStore((s) => s.selectedSectorId);
  const showSectors = useSelectionStore((s) => s.showSectors);

  // Cursor de "mãozinha" enquanto o mouse está sobre um setor.
  useCursor(showSectors && hoveredId !== null);

  const stateOf = (id: string): SectorVisualState => {
    if (id === selectedId) return 'selected';
    if (id === hoveredId) return 'hovered';
    return selectedId ? 'dimmed' : 'idle';
  };

  return (
    <group name="sectors">
      {SECTORS.map((sector) => {
        const visible = showSectors || sector.id === selectedId;
        if (!visible) return null;
        return (
          <SectorMesh
            key={sector.id}
            sector={sector}
            model={model}
            color={getCategory(sector.categoryId).color}
            state={stateOf(sector.id)}
            showSurface={showSectors}
          />
        );
      })}

      {/*
        Bloqueador invisível sobre o prédio dos palcos. O React Three Fiber só "enxerga" objetos
        com eventos, então sem ele daria para clicar na platea através do telhado.
        visible={false} no material: não é desenhado, mas ainda é atingido pelo raio do ponteiro.
      */}
      {showSectors && (
        <mesh position={OCCLUDER_CENTER} onPointerOver={block} onClick={block}>
          <boxGeometry args={OCCLUDER_SIZE} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
    </group>
  );
}
