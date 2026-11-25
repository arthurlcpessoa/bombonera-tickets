import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { getCategory, type Sector } from '@/features/seating/data/sectors';
import { getSectorSeats, seatsByRow, type Seat } from '@/features/seating/lib/seatLayout';
import { formatPrice } from '@/features/seating/lib/pricing';
import { useSeatStore } from '@/store/useSeatStore';
import { useStandsStore } from '@/store/useStandsStore';

interface SeatMapProps {
  sector: Sector;
}

/** Largura útil da grade (px) no painel: usada para escolher o tamanho das cadeirinhas. */
const GRID_WIDTH = 296;
/** Tamanho das cadeirinhas (px): o maior que caiba, entre estes limites. Acima disso, rola de lado. */
const CELL_MIN = 5;
const CELL_MAX = 9;
const GAP = 2;

/**
 * Mini-mapa 2D do setor: uma grade de filas × cadeiras feita com <button>s.
 *
 * É a alternativa acessível à escolha em 3D: setas navegam, Enter/Espaço escolhem, e cada botão
 * se apresenta ao leitor de tela ("Fila 12, cadeira 7, livre").
 *
 * Desenhado como visto DO CAMPO, igual à câmera: fila 1 embaixo e cadeira 1 à direita
 * (a numeração cresce para a direita de quem está sentado, ou seja, para a esquerda de quem olha).
 *
 * Sincronia com o 3D: a seleção vem do store pelo hook (re-render só quando ela muda). O hover
 * não: um subscribe() acende o botão direto no DOM, sem re-renderizar as ~2 mil cadeiras.
 */
export function SeatMap({ sector }: SeatMapProps) {
  const model = useStandsStore((s) => s.model);
  const seats = useMemo(() => getSectorSeats(sector, model), [sector, model]);
  const rows = useMemo(() => seatsByRow(seats), [seats]);
  const byId = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);
  const selectedIds = useSeatStore((s) => s.selectedSeatIds);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const color = getCategory(sector.categoryId).color;

  // "Tabindex itinerante": só UMA cadeira entra na ordem do Tab (as outras têm tabIndex −1).
  // Quem usa teclado entra no mapa com um Tab e anda com as setas, em vez de apertar Tab 2 mil vezes.
  const [focusId, setFocusId] = useState(
    () => seats.find((s) => s.status === 'available')?.id ?? seats[0]?.id,
  );
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const caption = useRef<HTMLParagraphElement>(null);
  const viewport = useRef<HTMLDivElement>(null);

  // Cadeirinhas do maior tamanho que caiba na largura (setores grandes rolam de lado).
  const longestRow = Math.max(...rows.map((r) => r.length));
  const cell = Math.max(CELL_MIN, Math.min(CELL_MAX, Math.floor(GRID_WIDTH / longestRow) - GAP));

  // O mapa abre mostrando a fila 1 (perto do campo, embaixo) e centralizado.
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  // Hover vindo do 3D (ou do próprio mapa): acende o botão e atualiza a legenda, direto no DOM.
  useEffect(() => {
    let lit: HTMLButtonElement | undefined;
    const apply = ({ hoveredSeatId }: { hoveredSeatId: string | null }) => {
      const seat = hoveredSeatId ? byId.get(hoveredSeatId) : undefined;
      const button = seat ? buttons.current.get(seat.id) : undefined;
      if (button === lit) return;
      lit?.removeAttribute('data-hovered');
      lit = button;
      lit?.setAttribute('data-hovered', '');
      if (lit && viewport.current) scrollWithin(viewport.current, lit);
      if (caption.current) caption.current.textContent = seat ? describeSeat(seat, sector) : HINT;
    };
    apply(useSeatStore.getState());
    return useSeatStore.subscribe(apply);
  }, [byId, sector]);

  const focusSeat = (seat: Seat | undefined) => {
    if (!seat) return;
    setFocusId(seat.id);
    buttons.current.get(seat.id)?.focus();
  };

  /** Setas: na tela, a cadeira 1 fica à direita, então ← aumenta o número e → diminui. */
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = focusId ? byId.get(focusId) : undefined;
    if (!current) return;
    const row = rows[current.row - 1];
    const i = current.number - 1;
    let next: Seat | undefined;
    switch (e.key) {
      case 'ArrowLeft':
        next = row[i + 1];
        break;
      case 'ArrowRight':
        next = row[i - 1];
        break;
      case 'ArrowUp': // fila de trás (desenhada acima)
        next = nearestInRow(rows[current.row], current);
        break;
      case 'ArrowDown': // fila da frente
        next = nearestInRow(rows[current.row - 2], current);
        break;
      case 'Home':
        next = row[0];
        break;
      case 'End':
        next = row.at(-1);
        break;
      default:
        return; // Enter e Espaço já "clicam" no botão sozinhos
    }
    e.preventDefault(); // as setas não rolam a página
    focusSeat(next);
  };

  const toggle = (seat: Seat) => {
    if (seat.status === 'sold') return;
    useSeatStore.getState().toggleSeat(seat.id);
  };

  const hover = (seat: Seat | null) => {
    const store = useSeatStore.getState();
    if (seat) store.setHoveredSeat(seat.id, 'map');
    else if (store.hoverSource === 'map') store.setHoveredSeat(null, 'map');
  };

  return (
    <div>
      <div
        role="group"
        aria-label={`Mapa de cadeiras do setor ${sector.name}. Use as setas para andar e Enter para escolher.`}
        ref={viewport}
        onKeyDown={handleKeyDown}
        className="max-h-44 overflow-auto rounded-2xl bg-black/25 p-2 ring-1 ring-white/5 ring-inset md:max-h-64"
      >
        {/* w-max + mx-auto: a grade centraliza quando cabe e rola de lado quando é larga. */}
        <div className="mx-auto flex w-max min-w-full flex-col-reverse" style={{ gap: GAP + 1 }}>
          {rows.map((row, r) => (
            <div key={r} className="flex flex-row-reverse justify-center" style={{ gap: GAP }}>
              {row.map((seat) => {
                const isSelected = selected.has(seat.id);
                const sold = seat.status === 'sold';
                return (
                  <button
                    key={seat.id}
                    ref={(el) => {
                      if (el) buttons.current.set(seat.id, el);
                      else buttons.current.delete(seat.id);
                    }}
                    type="button"
                    tabIndex={seat.id === focusId ? 0 : -1}
                    aria-label={`Fila ${seat.row}, cadeira ${seat.number}, ${
                      sold ? 'vendida' : isSelected ? 'escolhida' : 'livre'
                    }`}
                    aria-pressed={sold ? undefined : isSelected}
                    aria-disabled={sold || undefined}
                    onClick={() => toggle(seat)}
                    onFocus={() => {
                      setFocusId(seat.id);
                      hover(seat);
                    }}
                    onBlur={() => hover(null)}
                    onMouseEnter={() => hover(seat)}
                    onMouseLeave={() => hover(null)}
                    className={`shrink-0 rounded-[2px] data-hovered:ring-2 data-hovered:ring-white ${
                      sold
                        ? 'cursor-not-allowed bg-white/15'
                        : isSelected
                          ? 'bg-boca-gold cursor-pointer'
                          : 'cursor-pointer'
                    }`}
                    style={{
                      width: cell,
                      height: cell,
                      backgroundColor: !sold && !isSelected ? color : undefined,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-white/50">
        <p ref={caption} className="truncate text-white/80">
          {HINT}
        </p>
        <span className="shrink-0">▼ campo</span>
      </div>
    </div>
  );
}

const HINT = 'Passe o mouse ou use as setas';

function describeSeat(seat: Seat, sector: Sector): string {
  const status =
    seat.status === 'sold' ? 'Vendida' : formatPrice(getCategory(sector.categoryId).price);
  return `Fila ${seat.row} · Cadeira ${seat.number} · ${status}`;
}

/**
 * Rola SÓ a caixa do mapa até o botão aparecer. (scrollIntoView também rolaria o painel e a
 * página inteira, escondendo o cabeçalho.)
 */
function scrollWithin(container: HTMLElement, el: HTMLElement) {
  const box = container.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const margin = 8;
  if (r.top < box.top + margin) container.scrollTop -= box.top + margin - r.top;
  else if (r.bottom > box.bottom - margin) container.scrollTop += r.bottom - (box.bottom - margin);
  if (r.left < box.left + margin) container.scrollLeft -= box.left + margin - r.left;
  else if (r.right > box.right - margin) container.scrollLeft += r.right - (box.right - margin);
}

/** Na fila vizinha, a cadeira mais alinhada com a atual (as filas têm tamanhos diferentes). */
function nearestInRow(row: Seat[] | undefined, from: Seat): Seat | undefined {
  if (!row?.length) return undefined;
  return row.reduce((best, seat) =>
    Math.abs(seat.a - from.a) < Math.abs(best.a - from.a) ? seat : best,
  );
}
