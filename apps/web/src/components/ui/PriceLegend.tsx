import { useId, useState } from 'react';
import { SECTOR_PANEL_LAYOUT } from '@/config/stadium';
import { PRICE_CATEGORIES } from '@/features/seating/data/sectors';
import { formatPrice } from '@/features/seating/lib/pricing';
import { useSelectionStore } from '@/store/useSelectionStore';

/** Legenda das faixas de preço + chave "Mostrar setores". No celular começa recolhida. */
export function PriceLegend() {
  const showSectors = useSelectionStore((s) => s.showSectors);
  const setShowSectors = useSelectionStore((s) => s.setShowSectors);
  const [open, setOpen] = useState(() => window.innerWidth >= SECTOR_PANEL_LAYOUT.desktopMinWidth);
  const contentId = useId();

  return (
    <aside
      aria-label="Legenda de preços"
      className="glass-card absolute top-36 left-4 w-56 rounded-3xl text-sm sm:top-44"
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
          {PRICE_CATEGORIES.map((c) => (
            <li key={c.id} className="flex items-center gap-2.5">
              <span
                className="size-3 shrink-0 rounded-full ring-2 ring-white/10"
                style={{ backgroundColor: c.color }}
                aria-hidden
              />
              <span className="text-white/85">{c.label}</span>
              <span className="ml-auto font-medium tabular-nums">{formatPrice(c.price)}</span>
            </li>
          ))}
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
