import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ORDER_RULES } from '@/config/stadium';
import { findSeat } from '@/features/seating/data/seats';
import { getCategory, isAwaySector } from '@/features/seating/data/sectors';
import { getSectorSeats } from '@/features/seating/lib/seatLayout';
import { neighborSeat, type SeatDirection } from '@/features/seating/lib/seatNavigation';
import { formatPrice } from '@/features/seating/lib/pricing';
import { SEAT_VIEW } from '@/config/stadium';
import { useSeatStore } from '@/store/useSeatStore';
import { useSeatViewStore } from '@/store/useSeatViewStore';
import { useStandsStore } from '@/store/useStandsStore';
import { AwayBadge } from './AwayBadge';

/** Por quanto tempo (ms) o aviso de limite de cadeiras fica na tela. */
const LIMIT_NOTICE_MS = 4000;

/** Teclas → direção. As setas são as de quem está sentado olhando o campo. */
const KEY_DIRECTION: Record<string, SeatDirection> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'front',
  ArrowDown: 'back',
};

const zoomFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * HUD da visão do assento: os dados da cadeira, as ações e a navegação entre vizinhas.
 * Só conversa com a câmera pelo store (useSeatViewStore), como o resto da interface.
 */
export function SeatViewHud() {
  const viewingId = useSeatViewStore((s) => s.viewingSeatId);
  if (!viewingId) return null;
  return <Hud seatId={viewingId} />;
}

function Hud({ seatId }: { seatId: string }) {
  const model = useStandsStore((s) => s.model);
  const zoom = useSeatViewStore((s) => s.zoom);
  const showSeatsForSale = useSeatViewStore((s) => s.showSeatsForSale);
  const selectedIds = useSeatStore((s) => s.selectedSeatIds);
  const [limitHit, setLimitHit] = useState(false);
  const panel = useRef<HTMLElement>(null);

  const found = findSeat(seatId, model);

  // Ao entrar na visão, o foco do teclado vai para o HUD (leitores de tela anunciam a cadeira).
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, []);

  // O aviso de limite some sozinho.
  useEffect(() => {
    if (!limitHit) return;
    const timeout = setTimeout(() => setLimitHit(false), LIMIT_NOTICE_MS);
    return () => clearTimeout(timeout);
  }, [limitHit]);

  const toggle = () => {
    if (!toggleViewingSeat()) setLimitHit(true);
  };

  // Teclado: setas trocam de cadeira, Enter escolhe, Esc sai, +/− controlam o binóculo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      const { moveSeatView, exitSeatView, zoomBy } = useSeatViewStore.getState();
      const direction = KEY_DIRECTION[e.key];
      if (direction) {
        e.preventDefault();
        moveSeatView(direction);
      } else if (e.key === 'Enter') {
        // Num botão, o Enter já "clica" nele: não escolhemos a cadeira de novo.
        if (target?.closest('button, a')) return;
        e.preventDefault();
        if (!toggleViewingSeat()) setLimitHit(true);
      } else if (e.key === 'Escape') {
        exitSeatView();
      } else if (e.key === '+' || e.key === '=') {
        zoomBy(SEAT_VIEW.zoomStep);
      } else if (e.key === '-' || e.key === '_') {
        zoomBy(-SEAT_VIEW.zoomStep);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!found) return null;
  const { seat, sector } = found;
  const sectorSeats = getSectorSeats(sector, model);
  const category = getCategory(sector.categoryId);
  const sold = seat.status === 'sold';
  const selected = selectedIds.includes(seat.id);
  const away = isAwaySector(sector);
  const has = (d: SeatDirection) => neighborSeat(sectorSeats, seat, d) !== null;
  const { moveSeatView, exitSeatView, zoomBy, setShowSeatsForSale } = useSeatViewStore.getState();

  return (
    <section
      ref={panel}
      tabIndex={-1}
      aria-label="Visão do assento"
      className="glass-card animate-hud-in pointer-events-auto absolute inset-x-3 bottom-12 z-20 max-h-[55dvh] overflow-y-auto rounded-3xl p-4 outline-none sm:bottom-14 md:inset-x-auto md:left-4 md:w-88 md:p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-wide text-white/60 uppercase">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: category.color }}
              aria-hidden
            />
            {sector.name}
            {away && <AwayBadge />}
          </p>
          {/* aria-live: ao trocar de cadeira, o leitor de tela lê a nova. */}
          <h2 aria-live="polite" className="text-xl font-extrabold tracking-tight">
            Fila {seat.row} · Cadeira {seat.number}
          </h2>
        </div>
        <button
          type="button"
          onClick={exitSeatView}
          className="-mr-1 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Sair da visão
        </button>
      </header>

      <p className="mt-1 flex items-center gap-2 text-sm">
        <span className={sold ? 'text-white/50' : 'text-boca-gold font-bold'}>
          {formatPrice(category.price)}
        </span>
        <StatusChip sold={sold} selected={selected} />
      </p>

      <div className="mt-3 flex items-center gap-3">
        {/* Setas de navegação, em cruz, como as do teclado. */}
        <div
          role="group"
          aria-label="Cadeiras vizinhas"
          className="grid shrink-0 grid-cols-3 grid-rows-2 gap-1"
        >
          <span />
          <NavButton
            label="Fila da frente"
            disabled={!has('front')}
            onClick={() => moveSeatView('front')}
          >
            <path d="M6 15l6-6 6 6" />
          </NavButton>
          <span />
          <NavButton
            label="Cadeira à esquerda"
            disabled={!has('left')}
            onClick={() => moveSeatView('left')}
          >
            <path d="M15 6l-6 6 6 6" />
          </NavButton>
          <NavButton
            label="Fila de trás"
            disabled={!has('back')}
            onClick={() => moveSeatView('back')}
          >
            <path d="M6 9l6 6 6-6" />
          </NavButton>
          <NavButton
            label="Cadeira à direita"
            disabled={!has('right')}
            onClick={() => moveSeatView('right')}
          >
            <path d="M9 6l6 6-6 6" />
          </NavButton>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <button
            type="button"
            onClick={toggle}
            disabled={sold}
            className={`w-full cursor-pointer rounded-2xl px-3 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed ${
              sold
                ? 'bg-white/10 text-white/40'
                : selected
                  ? 'border border-white/20 bg-white/5 text-white hover:bg-white/10'
                  : 'bg-boca-gold text-boca-navy hover:brightness-110'
            }`}
          >
            {sold ? 'Cadeira vendida' : selected ? 'Remover da seleção' : 'Escolher esta cadeira'}
          </button>

          <div className="flex items-center justify-between gap-2 text-xs text-white/70">
            <span>Binóculo</span>
            <div className="flex items-center gap-1" role="group" aria-label="Binóculo">
              <ZoomButton
                label="Afastar"
                disabled={zoom <= 1.01}
                onClick={() => zoomBy(-SEAT_VIEW.zoomStep)}
              >
                −
              </ZoomButton>
              <span className="w-9 text-center font-semibold tabular-nums" aria-live="polite">
                {zoomFormat.format(zoom)}×
              </span>
              <ZoomButton
                label="Aproximar"
                disabled={zoom >= SEAT_VIEW.maxZoom - 0.01}
                onClick={() => zoomBy(SEAT_VIEW.zoomStep)}
              >
                +
              </ZoomButton>
            </div>
          </div>
        </div>
      </div>

      <label className="mt-3 flex cursor-pointer items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs text-white/75">
        Mostrar cadeiras à venda
        <button
          type="button"
          role="switch"
          aria-checked={showSeatsForSale}
          onClick={() => setShowSeatsForSale(!showSeatsForSale)}
          className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
            showSeatsForSale ? 'bg-boca-gold' : 'bg-white/20'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${
              showSeatsForSale ? 'translate-x-4' : ''
            }`}
          />
        </button>
      </label>

      {/* role="status": o leitor de tela lê o aviso quando ele aparece. */}
      <p role="status" className="mt-2 text-xs text-amber-300 empty:hidden">
        {limitHit &&
          `Você pode escolher até ${ORDER_RULES.maxSeats} cadeiras por compra. Remova uma para trocar.`}
      </p>

      <p className="mt-3 text-[11px] leading-relaxed text-white/45 pointer-coarse:hidden">
        Arraste para olhar em volta · <Kbd>←</Kbd>
        <Kbd>→</Kbd>
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd> trocar de cadeira · <Kbd>Enter</Kbd> escolher · <Kbd>+</Kbd>
        <Kbd>−</Kbd> binóculo · <Kbd>Esc</Kbd> sair
      </p>
      <p className="mt-3 hidden text-[11px] text-white/45 pointer-coarse:block">
        Arraste para olhar em volta · pinça para o binóculo
      </p>
    </section>
  );
}

/**
 * Escolhe ou desfaz a escolha da cadeira em exibição, lendo os stores na hora (serve tanto ao
 * botão quanto à tecla Enter). Vendida não faz nada. Devolve false só se bateu no limite.
 */
function toggleViewingSeat(): boolean {
  const id = useSeatViewStore.getState().viewingSeatId;
  const found = id ? findSeat(id, useStandsStore.getState().model) : null;
  if (!found || found.seat.status === 'sold') return true;
  return useSeatStore.getState().toggleSeat(found.seat.id);
}

function StatusChip({ sold, selected }: { sold: boolean; selected: boolean }) {
  const [label, className] = sold
    ? ['Vendida', 'bg-white/10 text-white/60']
    : selected
      ? ['Escolhida', 'bg-boca-gold/20 text-boca-gold']
      : ['Livre', 'bg-emerald-400/15 text-emerald-300'];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      {label}
    </span>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/5 text-white/85 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white/5"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
    </button>
  );
}

function ZoomButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 cursor-pointer place-items-center rounded-lg border border-white/10 bg-white/5 text-base leading-none hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="mx-px rounded border border-white/15 bg-white/5 px-1 font-sans text-[10px] text-white/70">
      {children}
    </kbd>
  );
}
