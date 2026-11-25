import { useEffect, useRef, type CSSProperties } from 'react';
import { SECTOR_PANEL_LAYOUT } from '@/config/stadium';
import { getCategory, getSector, TIER_LABELS } from '@/features/seating/data/sectors';
import {
  availabilityLevel,
  formatAvailability,
  formatPrice,
  type AvailabilityLevel,
} from '@/features/seating/lib/pricing';
import { useSelectionStore } from '@/store/useSelectionStore';
import { useViewStore } from '@/store/useViewStore';

/** Largura do painel lateral: a do config menos a margem de 16 px de cada lado. */
const PANEL_WIDTH = SECTOR_PANEL_LAYOUT.sideWidth - 32;

const AVAILABILITY_COLOR: Record<AvailabilityLevel, string> = {
  ok: 'text-emerald-300',
  low: 'text-amber-300',
  'sold-out': 'text-rose-300',
};

/**
 * Painel do setor escolhido. No desktop é uma coluna à direita; no celular, uma "gaveta"
 * (bottom sheet) que sobe de baixo. Fecha pelo botão ou pela tecla Esc e volta à visão geral.
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
  const soldShare = 1 - sector.available / sector.capacity;

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="sector-panel-title"
      // A largura do painel lateral vem do config (a câmera usa o mesmo número) via variável CSS.
      style={{ '--panel-w': `${PANEL_WIDTH}px` } as CSSProperties}
      className="bg-boca-navy/95 absolute inset-x-0 bottom-0 z-20 rounded-t-3xl border border-white/10 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur md:inset-x-auto md:top-4 md:right-4 md:bottom-auto md:w-(--panel-w) md:rounded-2xl"
    >
      {/* Alça visual da gaveta (só no celular). */}
      <div className="mx-auto -mt-2 mb-3 h-1 w-10 rounded-full bg-white/25 md:hidden" aria-hidden />

      <div>
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
            <h2 id="sector-panel-title" className="text-2xl font-extrabold tracking-tight">
              {sector.name}
            </h2>
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

        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 p-3">
            <dt className="text-xs text-white/60">Preço</dt>
            <dd className="text-boca-gold text-lg font-bold">{formatPrice(category.price)}</dd>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <dt className="text-xs text-white/60">Disponibilidade</dt>
            <dd className={`text-sm font-semibold ${AVAILABILITY_COLOR[level]}`}>
              {formatAvailability(sector.available)}
            </dd>
          </div>
        </dl>

        {/* Barra de ocupação: quanto do setor já foi vendido. */}
        <div className="mt-3">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-white/10"
            role="meter"
            aria-label="Ocupação do setor"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(soldShare * 100)}
          >
            <div className="bg-boca-gold h-full" style={{ width: `${soldShare * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-white/50">
            {Math.round(soldShare * 100)}% vendido · capacidade estimada de{' '}
            {sector.capacity.toLocaleString('pt-BR')} lugares
          </p>
        </div>

        <button
          type="button"
          disabled
          className="mt-5 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 font-semibold text-white/50"
        >
          Escolher cadeira
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium">Em breve</span>
        </button>
      </div>
    </section>
  );
}

/** Fecha o painel e devolve a câmera à visão geral. */
function closePanel() {
  useSelectionStore.getState().clearSelection();
  useViewStore.getState().goToPreset('overview');
}
