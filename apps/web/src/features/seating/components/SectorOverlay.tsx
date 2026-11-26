import { SECTORS } from '@bombonera/shared';
import { CATEGORY_COLORS } from '@/config/colors';
import { useSeatViewStore } from '@/store/useSeatViewStore';
import { useSelectionStore } from '@/store/useSelectionStore';
import { useStandsStore } from '@/store/useStandsStore';
import { SeatInstances } from './SeatInstances';
import { SectorMesh, type SectorVisualState } from './SectorMesh';
import { useSceneCursor } from './useSceneCursor';

/**
 * Camada de setores sobre o estádio: um SectorMesh por setor, colorido pela faixa de preço,
 * e as cadeiras do setor escolhido. Fica dentro do <Canvas>; conversa com a interface HTML só
 * pelos stores.
 *
 * Quem impede clicar "através" de telhados e marquises é o próprio estádio (StadiumModel),
 * que segura os eventos de ponteiro. Veja StadiumModel.tsx.
 */
export function SectorOverlay() {
  const model = useStandsStore((s) => s.model);
  const hoveredId = useSelectionStore((s) => s.hoveredSectorId);
  const selectedId = useSelectionStore((s) => s.selectedSectorId);
  const showSectors = useSelectionStore((s) => s.showSectors);
  const viewingSeat = useSeatViewStore((s) => s.viewingSeatId !== null);
  const showSeatsForSale = useSeatViewStore((s) => s.showSeatsForSale);

  // Cursor de "mãozinha" sobre setores e cadeiras livres.
  useSceneCursor();

  const stateOf = (id: string): SectorVisualState => {
    if (id === selectedId) return 'selected';
    if (id === hoveredId) return 'hovered';
    return selectedId ? 'dimmed' : 'idle';
  };

  // Visão do assento: a cena fica "limpa", como na vida real (sem setores nem marcadores).
  // A chave "Mostrar cadeiras à venda" do HUD reexibe só as cadeiras do setor atual.
  if (viewingSeat) return showSeatsForSale ? <SeatInstances /> : null;

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
            color={CATEGORY_COLORS[sector.categoryId]}
            state={stateOf(sector.id)}
            showSurface={showSectors}
          />
        );
      })}

      <SeatInstances />
    </group>
  );
}
