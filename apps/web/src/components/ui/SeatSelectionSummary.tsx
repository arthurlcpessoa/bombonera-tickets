import { useEffect, useId, useMemo, useState } from 'react';
import {
  getCategory,
  getSector,
  isAwaySector,
  ORDER_RULES,
  parseSeatId,
  type Sector,
} from '@bombonera/shared';
import {
  cancelActiveHold,
  continueToHold,
  holdMatchesSelection,
} from '@/features/checkout/holdFlow';
import { formatCountdown, useCountdown } from '@/features/checkout/useCountdown';
import { formatCents, formatPrice } from '@/features/seating/lib/pricing';
import { useAvailabilityStore } from '@/store/useAvailabilityStore';
import { useHoldStore, type HoldNotice } from '@/store/useHoldStore';
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
 * Resumo das cadeiras escolhidas: agrupadas por setor, com remover, total e o "Continuar", que
 * reserva as cadeiras por 10 minutos (com cronômetro). No desktop fica abaixo do painel; no
 * celular, é uma barra compacta ("3 cadeiras · $ 195.000") que expande ao tocar.
 */
export function SeatSelectionSummary() {
  const selectedIds = useSeatStore((s) => s.selectedSeatIds);
  const limitWarningId = useSeatStore((s) => s.limitWarningId);
  const [expanded, setExpanded] = useState(false);
  // O aviso aparece enquanto houver um pedido de aviso mais novo que o último dispensado.
  const [dismissedWarningId, setDismissedWarningId] = useState(0);
  const showLimit = limitWarningId > dismissedWarningId;
  const listId = useId();
  const hold = useHoldStore((s) => s.hold);
  const busy = useHoldStore((s) => s.busy);
  const notice = useHoldStore((s) => s.notice);
  const online = useAvailabilityStore((s) => s.apiStatus === 'online');
  const remaining = useCountdown(hold?.expiresAt ?? null);
  // A reserva vale para a seleção atual? (Se a pessoa mexeu na seleção, é preciso reservar de novo.)
  const reserved = holdMatchesSelection(hold, selectedIds);

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

  // Sem cadeiras, o resumo some (mas um aviso como "a reserva venceu" ainda aparece).
  if (selectedIds.length === 0) {
    return notice ? (
      <section
        aria-label="Aviso da reserva"
        className="glass-card pointer-events-auto mx-3 shrink-0 rounded-3xl p-4 md:mx-0"
      >
        <HoldNoticeText notice={notice} />
      </section>
    ) : null;
  }

  const total = groups.reduce((sum, g) => sum + g.seats.reduce((s, seat) => s + seat.price, 0), 0);
  const count = selectedIds.length;
  const countLabel = `${count} ${count === 1 ? 'cadeira' : 'cadeiras'}`;
  const { removeSeat, clearSeats } = useSeatStore.getState();
  // Total: com a reserva feita, o do SERVIDOR; antes disso, uma prévia pelo catálogo.
  const totalLabel = reserved && hold ? formatCents(hold.totalCents) : formatPrice(total);
  const clearAll = () => (hold ? void cancelActiveHold({ keepSelection: false }) : clearSeats());
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
          {countLabel} · <span className="text-boca-gold">{totalLabel}</span>
          {reserved && (
            <span className="ml-2 text-xs font-medium text-emerald-300 tabular-nums">
              {formatCountdown(remaining)}
            </span>
          )}
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
          <span className="text-boca-gold text-lg font-bold tabular-nums">{totalLabel}</span>
        </div>

        {/* role="status": o leitor de tela lê o aviso quando ele aparece. */}
        <p role="status" className="mt-2 text-xs text-amber-300 empty:hidden">
          {showLimit &&
            `Você pode escolher até ${ORDER_RULES.maxSeats} cadeiras por compra. Remova uma para trocar.`}
        </p>

        {notice && (
          <div className="mt-2">
            <HoldNoticeText notice={notice} />
          </div>
        )}

        {reserved && hold && (
          // role="timer": o leitor de tela sabe que é um cronômetro (e não lê a cada segundo).
          <div className="mt-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-3.5 py-2.5">
            <p className="flex items-center justify-between gap-2 text-sm font-semibold text-emerald-200">
              Cadeiras reservadas para você
              <span role="timer" className="tabular-nums" aria-label="Tempo restante da reserva">
                {formatCountdown(remaining)}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-emerald-100/70">
              Ninguém mais consegue pegá-las enquanto o tempo não acabar.
            </p>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => lastSeatId && enterSeatView(lastSeatId)}
            className={`flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5 text-sm leading-tight font-bold ${
              reserved
                ? 'border border-white/15 bg-white/5 text-white hover:bg-white/10'
                : 'bg-boca-gold text-boca-navy hover:brightness-110'
            }`}
          >
            Ver visão do assento
          </button>
          {reserved ? (
            <DisabledAction label="Pagamento" badge="Em breve" />
          ) : (
            <button
              type="button"
              onClick={() => void continueToHold()}
              disabled={busy || !online}
              title={online ? undefined : 'Sem conexão com o servidor de ingressos'}
              className="bg-boca-gold text-boca-navy flex w-full cursor-pointer items-center justify-center rounded-2xl px-2 py-2.5 text-sm leading-tight font-bold hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
            >
              {busy ? 'Reservando…' : hold ? 'Atualizar reserva' : 'Continuar'}
            </button>
          )}
          {hold && (
            <button
              type="button"
              onClick={() => void cancelActiveHold()}
              className="col-span-2 cursor-pointer rounded-2xl px-4 py-1.5 text-sm text-white/80 hover:bg-white/10 hover:text-white"
            >
              Cancelar reserva
            </button>
          )}
          <button
            type="button"
            onClick={clearAll}
            className="col-span-2 cursor-pointer rounded-2xl px-4 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            Limpar seleção
          </button>
        </div>
      </div>
    </section>
  );
}

/** Texto do aviso da reserva (cadeiras perdidas, reserva vencida ou erro). */
function HoldNoticeText({ notice }: { notice: HoldNotice }) {
  const dismiss = () => useHoldStore.getState().setNotice(null);
  return (
    // role="alert": o leitor de tela lê na hora (a pessoa precisa saber que perdeu cadeiras).
    <p
      role="alert"
      className={`flex items-start gap-2 text-xs ${notice.kind === 'error' ? 'text-rose-300' : 'text-amber-300'}`}
    >
      <span className="flex-1">{noticeText(notice)}</span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar aviso"
        className="-mt-0.5 cursor-pointer rounded-full px-1.5 text-white/60 hover:bg-white/10 hover:text-white"
      >
        ×
      </button>
    </p>
  );
}

function noticeText(notice: HoldNotice): string {
  if (notice.kind === 'expired') {
    return 'Sua reserva expirou e as cadeiras foram liberadas. Se ainda estiverem livres, é só continuar de novo.';
  }
  if (notice.kind === 'error') return notice.message;
  const one = notice.seatIds.length === 1;
  return one
    ? `${describeSeats(notice.seatIds)} acabou de ser reservada por outra pessoa e saiu da sua seleção.`
    : `${describeSeats(notice.seatIds)} acabaram de ser reservadas por outra pessoa e saíram da sua seleção.`;
}

/** ["lower-4:F03-C17"] → "Fila 3, cadeira 17 (Inferior 4)"; várias são unidas com "e". */
function describeSeats(seatIds: readonly string[]): string {
  const parts = seatIds.map((id) => {
    const parsed = parseSeatId(id);
    const sector = parsed && getSector(parsed.sectorId);
    return parsed && sector ? `fila ${parsed.row}, cadeira ${parsed.number} (${sector.name})` : id;
  });
  const list =
    parts.length <= 1
      ? (parts[0] ?? 'uma cadeira')
      : `${parts.slice(0, -1).join('; ')} e ${parts.at(-1)}`;
  return list.charAt(0).toUpperCase() + list.slice(1);
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
