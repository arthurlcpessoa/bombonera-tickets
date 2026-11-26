import { useId, useState } from 'react';
import { PRICE_CATEGORIES, type PriceCategory, SECTORS } from '@bombonera/shared';
import { CATEGORY_COLORS } from '@/config/colors';
import { SECTOR_PANEL_LAYOUT } from '@/config/stadium';
import { formatPrice } from '@/features/seating/lib/pricing';
import { useSelectionStore } from '@/store/useSelectionStore';

/**
 * Faixas com um único setor (hoje, só a "Visitante"): na legenda elas viram um atalho que leva
 * direto ao setor. Decidido pelos dados, não por id: se outra faixa tiver um setor só, ganha o atalho.
 */
const SINGLE_SECTOR_BY_CATEGORY = new Map(
  PRICE_CATEGORIES.flatMap((c) => {
    const sectors = SECTORS.filter((s) => s.categoryId === c.id);
    return sectors.length === 1 ? [[c.id, sectors[0]] as const] : [];
  }),
);

/** Legenda das faixas de preço + chave "Mostrar setores". No celular começa recolhida. */
export function PriceLegend() {
  const showSectors = useSelectionStore((s) => s.showSectors);
  const setShowSectors = useSelectionStore((s) => s.setShowSectors);
  const selectSector = useSelectionStore((s) => s.selectSector);
  const [open, setOpen] = useState(() => window.innerWidth >= SECTOR_PANEL_LAYOUT.desktopMinWidth);
  const contentId = useId();

  return (
    <aside
      aria-label="Legenda de preços"
      className="glass-card hide-in-seat-view absolute top-36 left-4 w-56 rounded-3xl text-sm sm:top-44"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-3xl px-4 py-3 font-semibold"
      >
        Preços por setor
        <svg
          viewBox="0 0 24 24"
          className={`size-4 text-white/60 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </button>

      <div id={contentId} hidden={!open} className="px-4 pb-4">
        <ul className="space-y-1.5">
          {PRICE_CATEGORIES.map((c) => {
            const sector = SINGLE_SECTOR_BY_CATEGORY.get(c.id);
            return (
              <li key={c.id}>
                {sector ? (
                  <button
                    type="button"
                    onClick={() => selectSector(sector.id)}
                    aria-label={`${c.label}, ${formatPrice(c.price)}. Ir para o setor`}
                    title="Ir para o setor"
                    className="group -mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center gap-2.5 rounded-xl px-2 py-0.5 text-left hover:bg-white/10"
                  >
                    <CategoryRow category={c} />
                    <svg
                      viewBox="0 0 24 24"
                      className="-mr-1 size-3.5 shrink-0 text-white/50 group-hover:text-white"
                      aria-hidden
                    >
                      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" fill="none" />
                    </svg>
                  </button>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <CategoryRow category={c} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <label className="mt-3 flex cursor-pointer items-center justify-between gap-2 border-t border-white/10 pt-3 text-white/85">
          Mostrar setores
          {/* role="switch": leitores de tela anunciam "ligado/desligado". */}
          <button
            type="button"
            role="switch"
            aria-checked={showSectors}
            onClick={() => setShowSectors(!showSectors)}
            className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
              showSectors ? 'bg-boca-gold' : 'bg-white/20'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                showSectors ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </label>
      </div>
    </aside>
  );
}

function CategoryRow({ category }: { category: PriceCategory }) {
  return (
    <>
      <span
        className="size-3 shrink-0 rounded-full ring-2 ring-white/10"
        style={{ backgroundColor: CATEGORY_COLORS[category.id] }}
        aria-hidden
      />
      <span className="text-white/85">{category.label}</span>
      <span className="ml-auto font-medium tabular-nums">{formatPrice(category.price)}</span>
    </>
  );
}
