import { useEffect, useLayoutEffect, useRef } from 'react';
import { getCategory, getSector, TIER_LABELS } from '@/features/seating/data/sectors';
import { formatAvailability, formatPrice } from '@/features/seating/lib/pricing';
import { useSelectionStore } from '@/store/useSelectionStore';

/** Distância (px) entre a ponta do mouse e o tooltip. */
const OFFSET = 16;

/** Última posição conhecida do mouse (compartilhada entre renders, sem causar re-render). */
const pointer = { x: 0, y: 0 };

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

  // Move a caixinha direto no DOM a cada movimento do mouse, sem passar pelo React
  // (re-renderizar a cada pixel seria desperdício).
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      if (ref.current) place(ref.current);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // Ao aparecer, já nasce na posição certa (antes de o navegador pintar a tela).
  useLayoutEffect(() => {
    if (ref.current) place(ref.current);
  }, [hoveredId]);

  if (!sector) return null;
  const category = getCategory(sector.categoryId);

  return (
    <div
      ref={ref}
      role="tooltip"
      className="bg-boca-navy/95 pointer-events-none fixed top-0 left-0 z-30 min-w-44 rounded-xl border border-white/15 px-3 py-2 text-sm shadow-2xl backdrop-blur pointer-coarse:hidden"
    >
      <p className="flex items-center gap-2 font-bold">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: category.color }}
          aria-hidden
        />
        {sector.name}
      </p>
      <p className="text-xs text-white/60">{TIER_LABELS[sector.tier]}</p>
      <p className="text-boca-gold mt-1 font-semibold">{formatPrice(category.price)}</p>
      <p className="text-xs text-white/80">{formatAvailability(sector.available)}</p>
    </div>
  );
}

/** Posiciona ao lado do mouse; perto da borda direita/inferior, vira para o outro lado. */
function place(el: HTMLElement) {
  const { offsetWidth: w, offsetHeight: h } = el;
  let x = pointer.x + OFFSET;
  let y = pointer.y + OFFSET;
  if (x + w > window.innerWidth - 8) x = pointer.x - OFFSET - w;
  if (y + h > window.innerHeight - 8) y = pointer.y - OFFSET - h;
  el.style.transform = `translate(${x}px, ${y}px)`;
}
