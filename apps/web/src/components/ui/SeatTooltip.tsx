import { useEffect, useRef } from 'react';
import { findSeat } from '@/features/seating/data/seats';
import { getCategory, isAwaySector } from '@/features/seating/data/sectors';
import { formatPrice } from '@/features/seating/lib/pricing';
import { useSeatStore, type HoverSource } from '@/store/useSeatStore';
import { useStandsStore } from '@/store/useStandsStore';
import { AwayBadge } from './AwayBadge';
import { placeNearPointer, usePointerFollower } from './pointerFollower';

/**
 * Tooltip da cadeira sob o mouse no 3D: "Fila 12 · Cadeira 7" + preço (ou "Vendida").
 *
 * Sem re-render: o componente desenha a caixinha UMA vez. Depois, a cada troca de cadeira, o
 * subscribe() do store preenche os textos (textContent) e mostra/esconde direto no DOM.
 * O React nem fica sabendo; por isso passar o mouse por mil cadeiras não custa nada.
 */
export function SeatTooltip() {
  const box = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLParagraphElement>(null);
  const subtitle = useRef<HTMLParagraphElement>(null);
  const price = useRef<HTMLParagraphElement>(null);
  const away = useRef<HTMLParagraphElement>(null);

  usePointerFollower(box);

  useEffect(() => {
    const render = (state: {
      hoveredSeatId: string | null;
      hoverSource: HoverSource;
      selectedSeatIds: string[];
    }) => {
      const el = box.current;
      if (!el || !title.current || !subtitle.current || !price.current || !away.current) return;
      // Só o hover vindo do 3D: o do mini-mapa já mostra as informações no próprio painel.
      const found =
        state.hoveredSeatId && state.hoverSource === 'scene'
          ? findSeat(state.hoveredSeatId, useStandsStore.getState().model)
          : null;
      if (!found) {
        el.hidden = true;
        return;
      }
      const { seat, sector } = found;
      const sold = seat.status === 'sold';
      const selected = state.selectedSeatIds.includes(seat.id);
      title.current.textContent = `Fila ${seat.row} · Cadeira ${seat.number}`;
      subtitle.current.textContent = sector.name + (selected ? ' · escolhida' : '');
      away.current.hidden = !isAwaySector(sector);
      price.current.textContent = sold
        ? 'Vendida'
        : formatPrice(getCategory(sector.categoryId).price);
      price.current.className = sold
        ? 'mt-1 font-semibold text-white/50'
        : 'text-boca-gold mt-1 font-semibold';
      el.hidden = false;
      placeNearPointer(el);
    };
    render(useSeatStore.getState());
    return useSeatStore.subscribe(render);
  }, []);

  return (
    <div
      ref={box}
      hidden
      role="tooltip"
      className="glass-card pointer-events-none fixed top-0 left-0 z-30 min-w-40 rounded-2xl px-3.5 py-2.5 text-sm pointer-coarse:hidden"
    >
      <p ref={title} className="font-bold" />
      <p ref={subtitle} className="text-xs text-white/60" />
      {/* O selo já existe no DOM; o subscribe só mostra/esconde (hidden). */}
      <p ref={away} hidden className="mt-1">
        <AwayBadge />
      </p>
      <p ref={price} />
    </div>
  );
}
