import { useEffect, useId, useMemo, useState } from 'react';
import {
  getCategory,
  getSector,
  isAwaySector,
  ORDER_RULES,
  parseSeatId,
  type Sector,
} from '@bombonera/shared';
import { formatPrice } from '@/features/seating/lib/pricing';
import { useSeatStore } from '@/store/useSeatStore';
import { useSeatViewStore } from '@/store/useSeatViewStore';
import { AwayBadge } from './AwayBadge';

/** Por quanto tempo (ms) o aviso de limite fica na tela. */
const LIMIT_NOTICE_MS = 4000;

interface ChosenSeat {
  id: string;
  row: number;
  number: number;
  price: number;
}

/**
 * Resumo das cadeiras escolhidas: agrupadas por setor, com remover, total e os próximos passos
 * (ainda desabilitados). No desktop fica abaixo do painel; no celular, é uma barra compacta
 * ("3 cadeiras · $ 195.000") que expande ao tocar.
 */
export function SeatSelectionSummary() {
  const selectedIds = useSeatStore((s) => s.selectedSeatIds);
  const limitWarningId = useSeatStore((s) => s.limitWarningId);
  const [expanded, setExpanded] = useState(false);
  // O aviso aparece enquanto houver um pedido de aviso mais novo que o último dispensado.
  const [dismissedWarningId, setDismissedWarningId] = useState(0);
  const showLimit = limitWarningId > dismissedWarningId;
  const listId = useId();

  // Aviso amigável ao tentar passar do limite: some sozinho depois de alguns segundos.
  useEffect(() => {
    if (!showLimit) return;
    const timeout = setTimeout(() => setDismissedWarningId(limitWarningId), LIMIT_NOTICE_MS);
    return () => clearTimeout(timeout);
  }, [showLimit, limitWarningId]);

  // Agrupa por setor, na ordem em que os setores apareceram na seleção.
  const groups = useMemo(() => {
    const map = new Map<string, { sector: Sector; seats: ChosenSeat[] }>();
    for (const id of selectedIds) {
      const parsed = parseSeatId(id);
      const sector = parsed && getSector(parsed.sectorId);
      if (!parsed || !sector) continue;
      const group = map.get(sector.id) ?? { sector, seats: [] };
      group.seats.push({ id, ...parsed, price: getCategory(sector.categoryId).price });
      map.set(sector.id, group);
    }
    return [...map.values()];
  }, [selectedIds]);

  if (selectedIds.length === 0) return null;

  const total = groups.reduce((sum, g) => sum + g.seats.reduce((s, seat) => s + seat.price, 0), 0);
  const count = selectedIds.length;
  const countLabel = `${count} ${count === 1 ? 'cadeira' : 'cadeiras'}`;
  const { removeSeat, clearSeats } = useSeatStore.getState();
  const { enterSeatView } = useSeatViewStore.getState();
  // O botão geral abre a última cadeira escolhida.
  const lastSeatId = selectedIds.at(-1);

  return (
    <section
      aria-label="Cadeiras escolhidas"
      className="glass-card pointer-events-auto mx-3 shrink-0 rounded-3xl md:mx-0"
    >
      {/* Celular: barra compacta que expande. */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-3xl px-5 py-3.5 font-semibold md:hidden"
      >
        <span>
          {countLabel} · <span className="text-boca-gold">{formatPrice(total)}</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`size-4 text-white/60 transition-transform ${expanded ? '' : 'rotate-180'}`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </button>

      <div id={listId} className={`px-5 pb-5 md:block md:pt-5 ${expanded ? '' : 'hidden'}`}>
        <h2 className="hidden text-sm font-bold md:block">Suas cadeiras ({countLabel})</h2>

        <div className="mt-2 max-h-36 space-y-3 overflow-y-auto md:max-h-28">
          {groups.map(({ sector, seats }) => (
            <div key={sector.id}>
              <p className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-wide text-white/60 uppercase">
                {sector.name}
                {isAwaySector(sector) && <AwayBadge />}
              </p>
              <ul className="mt-1 space-y-1">
                {seats.map((seat) => (
                  <li key={seat.id} className="flex items-center gap-2 text-sm">
                    <span>
                      Fila {seat.row} · Cadeira {seat.number}
                    </span>
                    <span className="ml-auto tabular-nums">{formatPrice(seat.price)}</span>
                    <button
                      type="button"
                      onClick={() => enterSeatView(seat.id)}
                      aria-label={`Ver a visão da fila ${seat.row}, cadeira ${seat.number} do setor ${sector.name}`}
                      title="Ver a visão desta cadeira"
                      className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden
                      >
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSeat(seat.id)}
                      aria-label={`Remover fila ${seat.row}, cadeira ${seat.number} do setor ${sector.name}${isAwaySector(sector) ? ' (torcida visitante)' : ''}`}
                      className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                        <path
                          d="M6 6l12 12M18 6L6 18"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
          <span className="text-sm text-white/70">Total</span>
          <span className="text-boca-gold text-lg font-bold tabular-nums">
            {formatPrice(total)}
          </span>
        </div>

        {/* role="status": o leitor de tela lê o aviso quando ele aparece. */}
        <p role="status" className="mt-2 text-xs text-amber-300 empty:hidden">
          {showLimit &&
            `Você pode escolher até ${ORDER_RULES.maxSeats} cadeiras por compra. Remova uma para trocar.`}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => lastSeatId && enterSeatView(lastSeatId)}
            className="bg-boca-gold text-boca-navy flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5 text-sm leading-tight font-bold hover:brightness-110"
          >
            Ver visão do assento
          </button>
          <DisabledAction label="Continuar" badge="Em breve" />
          <button
            type="button"
            onClick={clearSeats}
            className="col-span-2 cursor-pointer rounded-2xl px-4 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            Limpar seleção
          </button>
        </div>
      </div>
    </section>
  );
}

function DisabledAction({ label, badge }: { label: string; badge: string }) {
  return (
    <button
      type="button"
      disabled
      className="flex w-full cursor-not-allowed flex-col items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/5 px-2 py-2.5 text-sm leading-tight font-semibold text-white/50"
    >
      {label}
      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium">{badge}</span>
    </button>
  );
}
