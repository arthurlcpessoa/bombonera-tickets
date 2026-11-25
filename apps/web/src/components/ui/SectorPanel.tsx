import { useEffect, useRef, type CSSProperties } from 'react';
import { getCategory, getSector, isAwaySector, TIER_LABELS } from '@/features/seating/data/sectors';
import {
  availabilityLevel,
  formatAvailability,
  formatPrice,
  type AvailabilityLevel,
} from '@/features/seating/lib/pricing';
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
  const closeButton = useRef<HTMLButtonElement>(null);

  const isOpen = sector !== undefined;

  // Esc fecha o painel. O "ouvinte" só existe enquanto o painel está aberto.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
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
  const level = availabilityLevel(sector.available, sector.capacity);
  const away = isAwaySector(sector);

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="sector-panel-title"
      className="bg-boca-navy/95 pointer-events-auto mx-3 max-h-[50dvh] min-h-0 overflow-y-auto rounded-2xl border border-white/10 p-4 shadow-2xl backdrop-blur md:mx-0 md:max-h-none md:p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-white/60 uppercase">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: category.color }}
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
          <dd className={`font-semibold ${AVAILABILITY_COLOR[level]}`}>
            {formatAvailability(sector.available)}
          </dd>
          <dd className="text-xs text-white/50">
            de {sector.capacity.toLocaleString('pt-BR')} cadeiras
          </dd>
        </div>
      </dl>

      {away && (
        <p className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
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
        <LegendItem label="Livre" style={{ backgroundColor: category.color }} />
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
