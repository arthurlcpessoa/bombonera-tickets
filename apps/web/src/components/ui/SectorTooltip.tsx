import { useLayoutEffect, useRef } from 'react';
import { getCategory, getSector, isAwaySector, TIER_LABELS } from '@bombonera/shared';
import { CATEGORY_COLORS } from '@/config/colors';
import { formatAvailability, formatPrice } from '@/features/seating/lib/pricing';
import { useSelectionStore } from '@/store/useSelectionStore';
import { AwayBadge } from './AwayBadge';
import { placeNearPointer, usePointerFollower } from './pointerFollower';

/**
 * Caixinha que segue o mouse sobre um setor: nome, bandeja, preço e disponibilidade.
 * Não aparece em telas de toque (lá não existe "passar o mouse").
 */
export function SectorTooltip() {
  const hoveredId = useSelectionStore((s) => s.hoveredSectorId);
  const selectedId = useSelectionStore((s) => s.selectedSectorId);
  // O setor já aberto no painel não precisa de tooltip: as informações já estão lá.
  const sector = hoveredId && hoveredId !== selectedId ? getSector(hoveredId) : undefined;
  const ref = useRef<HTMLDivElement>(null);

  usePointerFollower(ref);

  // Ao aparecer, já nasce na posição certa (antes de o navegador pintar a tela).
  useLayoutEffect(() => {
    if (ref.current) placeNearPointer(ref.current);
  }, [hoveredId]);

  if (!sector) return null;
  const category = getCategory(sector.categoryId);

  return (
    <div
      ref={ref}
      role="tooltip"
      className="glass-card pointer-events-none fixed top-0 left-0 z-30 min-w-44 rounded-2xl px-3.5 py-2.5 text-sm pointer-coarse:hidden"
    >
      <p className="flex items-center gap-2 font-bold">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: CATEGORY_COLORS[category.id] }}
          aria-hidden
        />
        {sector.name}
      </p>
      <p className="text-xs text-white/60">{TIER_LABELS[sector.tier]}</p>
      {isAwaySector(sector) && <AwayBadge className="mt-1" />}
      <p className="text-boca-gold mt-1 font-semibold">{formatPrice(category.price)}</p>
      <p className="text-xs text-white/80">{formatAvailability(sector.available)}</p>
    </div>
  );
}
