import { useEffect, useRef, type CSSProperties } from 'react';
import { getCategory, getSector, isAwaySector, TIER_LABELS } from '@bombonera/shared';
import { CATEGORY_COLORS, COLORS } from '@/config/colors';
import {
  availabilityLevel,
  formatAvailability,
  formatPrice,
  type AvailabilityLevel,
} from '@/features/seating/lib/pricing';
import { useAvailabilityStore, useSectorAvailability } from '@/store/useAvailabilityStore';
import { useSeatViewStore } from '@/store/useSeatViewStore';
import { useSelectionStore } from '@/store/useSelectionStore';
import { useViewStore } from '@/store/useViewStore';
import { AwayBadge } from './AwayBadge';
import { SeatMap } from './SeatMap';

const AVAILABILITY_COLOR: Record<AvailabilityLevel, string> = {
  ok: 'text-emerald-300',
  low: 'text-amber-300',
  'sold-out': 'text-rose-300',
};

/**
 * Painel do setor escolhido: preço, disponibilidade e o mini-mapa de cadeiras.
 * Fecha pelo botão ou pela tecla Esc e volta à visão geral (a seleção de cadeiras continua).
 * A posição na tela (coluna à direita / gaveta no celular) é decidida pelo SelectionDock.
 */
export function SectorPanel() {
  const selectedId = useSelectionStore((s) => s.selectedSectorId);
  const sector = selectedId ? getSector(selectedId) : undefined;
  // Livres agora: vem da API (undefined enquanto carrega ou com a API fora do ar).
  const live = useSectorAvailability(selectedId ?? '');
  const offline = useAvailabilityStore((s) => s.apiStatus === 'offline');
  const closeButton = useRef<HTMLButtonElement>(null);

  const isOpen = sector !== undefined;

  // Esc fecha o painel. O "ouvinte" só existe enquanto o painel está aberto.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !useSeatViewStore.getState().viewingSeatId) closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // Ao abrir (ou trocar de setor), o foco do teclado vai para o painel.
  useEffect(() => {
    if (selectedId) closeButton.current?.focus({ preventScroll: true });
  }, [selectedId]);

  if (!sector) return null;
  const category = getCategory(sector.categoryId);
  const capacity = live?.capacity ?? sector.capacity;
  const level = live ? availabilityLevel(live.available, live.capacity) : null;
  const away = isAwaySector(sector);

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="sector-panel-title"
      className="glass-card pointer-events-auto mx-3 max-h-[50dvh] min-h-0 overflow-y-auto rounded-3xl p-5 md:mx-0 md:max-h-none md:p-6"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-white/60 uppercase">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[category.id] }}
              aria-hidden
            />
            {TIER_LABELS[sector.tier]}
          </p>
          <h2 id="sector-panel-title" className="text-xl font-extrabold tracking-tight md:text-2xl">
            {sector.name}
          </h2>
          {away && <AwayBadge className="mt-1" />}
        </div>
        <button
          ref={closeButton}
          type="button"
          onClick={closePanel}
          aria-label="Fechar painel do setor"
          className="-mr-1 grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      <dl className="mt-3 flex items-baseline justify-between gap-3 text-sm">
        <div>
          <dt className="sr-only">Preço por cadeira</dt>
          <dd className="text-boca-gold text-lg font-bold">{formatPrice(category.price)}</dd>
        </div>
        <div className="text-right">
          <dt className="sr-only">Disponibilidade</dt>
          <dd
            className={`font-semibold ${level ? AVAILABILITY_COLOR[level] : 'text-white/60'}`}
            aria-live="polite"
          >
            {live
              ? formatAvailability(live.available)
              : offline
                ? 'Disponibilidade indisponível'
                : 'Carregando…'}
          </dd>
          <dd className="text-xs text-white/50">de {capacity.toLocaleString('pt-BR')} cadeiras</dd>
        </div>
      </dl>

      {away && (
        <p className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white/80">
          Setor exclusivo para a torcida visitante. Acesso por entrada separada.
        </p>
      )}

      <div className="mt-3">
        {/* key: ao trocar de setor, o mapa começa do zero (foco, rolagem). */}
        <SeatMap key={sector.id} sector={sector} />
      </div>

      <ul
        className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/70"
        aria-label="Legenda"
      >
        <LegendItem label="Livre" style={{ backgroundColor: CATEGORY_COLORS[category.id] }} />
        <LegendItem label="Reservada" style={{ backgroundColor: COLORS.heldSeat }} />
        <LegendItem label="Vendida" className="bg-white/15" />
        <LegendItem label="Escolhida" className="bg-boca-gold" />
      </ul>
      <p className="mt-2 text-xs text-white/50">
        Clique nas cadeiras no 3D ou no mapa. Até 6 por compra.
      </p>
    </section>
  );
}

function LegendItem({
  label,
  className = '',
  style,
}: {
  label: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-[2px] ${className}`} style={style} aria-hidden />
      {label}
    </li>
  );
}

/** Fecha o painel e devolve a câmera à visão geral. */
function closePanel() {
  useSelectionStore.getState().clearSelection();
  useViewStore.getState().goToPreset('overview');
}
