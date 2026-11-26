import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SEAT_HUD_LAYOUT } from '@/config/stadium';
import { neighborSeat, type SeatDirection } from '@/features/seating/lib/seatNavigation';
import { formatPrice } from '@/features/seating/lib/pricing';
import {
  findSeat,
  getCategory,
  getSectorSeats,
  isAwaySector,
  ORDER_RULES,
} from '@bombonera/shared';
import { CATEGORY_COLORS } from '@/config/colors';
import {
  classifyCover,
  classifyVisibility,
  seatMetrics,
  type Cover,
  type VisibilityLevel,
} from '@/features/seating/lib/seatView';
import { SEAT_VIEW } from '@/config/stadium';
import { useMediaQuery } from '@/lib/useMediaQuery';
import {
  seatAvailability,
  useSeatAvailability,
  type SeatAvailability,
} from '@/store/useAvailabilityStore';
import { useSeatStore } from '@/store/useSeatStore';
import { useSeatViewStore } from '@/store/useSeatViewStore';
import { useStandsStore } from '@/store/useStandsStore';
import { AwayBadge } from './AwayBadge';

/** Por quanto tempo (ms) o aviso de limite de cadeiras fica na tela. */
const LIMIT_NOTICE_MS = 4000;
/** Por quanto tempo (ms) a confirmação "Link copiado" fica no botão. */
const COPIED_MS = 2000;

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
 *
 * Três formatos, porque o que a pessoa quer ver é o CAMPO (veja SEAT_HUD_LAYOUT):
 *   - desktop: cartão completo à esquerda;
 *   - celular em pé: barra fina embaixo (recolhida); tocar nela abre o cartão completo;
 *   - celular deitado (tela baixa): cartão lateral compacto, com rolagem própria (`short:`).
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
  const visibilityResult = useSeatViewStore((s) => s.visibility);
  const availability = useSeatAvailability(seatId);
  const selectedIds = useSeatStore((s) => s.selectedSeatIds);
  const [limitHit, setLimitHit] = useState(false);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'error'>('idle');
  const panel = useRef<HTMLElement>(null);
  // Celular em pé: começa recolhido. O estado continua ao trocar de cadeira (o Hud não remonta).
  const barMode = useMediaQuery(SEAT_HUD_LAYOUT.barQuery);
  // Tela baixa (celular deitado): cartão lateral compacto, com o botão de sair só com o X.
  const short = useMediaQuery(SEAT_HUD_LAYOUT.shortQuery);
  const [expanded, setExpanded] = useState(false);
  const collapsed = barMode && !expanded;

  const found = findSeat(seatId, model);

  // Ao entrar na visão (e ao abrir ou recolher a barra), o foco do teclado vai para o HUD:
  // leitores de tela anunciam a cadeira, e as setas do teclado continuam funcionando.
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, [collapsed]);

  // O aviso de limite some sozinho.
  useEffect(() => {
    if (!limitHit) return;
    const timeout = setTimeout(() => setLimitHit(false), LIMIT_NOTICE_MS);
    return () => clearTimeout(timeout);
  }, [limitHit]);

  const toggle = () => {
    if (!toggleViewingSeat()) setLimitHit(true);
  };

  // A confirmação do "Copiar link" volta ao normal sozinha.
  useEffect(() => {
    if (copy === 'idle') return;
    const timeout = setTimeout(() => setCopy('idle'), COPIED_MS);
    return () => clearTimeout(timeout);
  }, [copy]);

  /** A URL já tem ?assento=... (veja store/seatViewUrl.ts): basta copiá-la. */
  const copyLink = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => setCopy('copied'))
      .catch(() => setCopy('error'));
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
  // Só cadeira livre pode ser escolhida (dá para espiar a visão de qualquer uma).
  const blocked = availability !== 'available';
  const selected = selectedIds.includes(seat.id);
  const away = isAwaySector(sector);
  const has = (d: SeatDirection) => neighborSeat(sectorSeats, seat, d) !== null;
  const metrics = seatMetrics(seat.eye);
  // Só vale o resultado desta cadeira (ao trocar, o anterior fica "velho" até o novo cálculo).
  const current = visibilityResult?.seatId === seat.id ? visibilityResult : null;
  const visibility = current ? classifyVisibility(current.blocked, current.total) : null;
  const cover = current ? classifyCover(seat.eye, current.ceilingDeg) : null;
  const { moveSeatView, exitSeatView, zoomBy, setShowSeatsForSale } = useSeatViewStore.getState();

  if (collapsed) {
    return (
      <section
        ref={panel}
        tabIndex={-1}
        aria-label="Visão do assento"
        // Tocar em qualquer lugar da barra abre o cartão (menos nos botões de seta e de sair).
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('button:not([data-expand])')) setExpanded(true);
        }}
        className="glass-card animate-hud-in pointer-events-auto absolute inset-x-3 bottom-14 z-20 cursor-pointer rounded-3xl p-3 outline-none"
      >
        <div className="flex items-start gap-2">
          <button
            type="button"
            data-expand
            aria-expanded={false}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-white/60 uppercase">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[category.id] }}
                  aria-hidden
                />
                <span className="truncate">{sector.name}</span>
                {away && <AwayBadge />}
              </span>
              <span
                aria-live="polite"
                className="block truncate text-base font-extrabold tracking-tight"
              >
                Fila {seat.row} · Cadeira {seat.number}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[11px] text-white/60">
              Detalhes
              <Chevron up />
            </span>
          </button>
          <ExitButton onClick={exitSeatView} compact />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <CoverBadge cover={cover} />
          <div role="group" aria-label="Cadeiras vizinhas" className="flex shrink-0 gap-1">
            <NavButton
              label="Cadeira à esquerda"
              disabled={!has('left')}
              onClick={() => moveSeatView('left')}
            >
              <path d="M15 6l-6 6 6 6" />
            </NavButton>
            <NavButton
              label="Fila da frente"
              disabled={!has('front')}
              onClick={() => moveSeatView('front')}
            >
              <path d="M6 15l6-6 6 6" />
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
        </div>
      </section>
    );
  }

  return (
    <section
      ref={panel}
      tabIndex={-1}
      aria-label="Visão do assento"
      className="glass-card animate-hud-in short:inset-x-auto short:top-3 short:bottom-14 short:left-3 short:max-h-none short:w-72 short:rounded-2xl short:p-3 pointer-events-auto absolute inset-x-3 bottom-14 z-20 max-h-[55dvh] overflow-y-auto rounded-3xl p-4 outline-none md:inset-x-auto md:left-4 md:w-88 md:p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-wide text-white/60 uppercase">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[category.id] }}
              aria-hidden
            />
            {sector.name}
            {away && <AwayBadge />}
          </p>
          {/* aria-live: ao trocar de cadeira, o leitor de tela lê a nova. */}
          <h2 aria-live="polite" className="short:text-lg text-xl font-extrabold tracking-tight">
            Fila {seat.row} · Cadeira {seat.number}
          </h2>
        </div>
        <div className="-mr-1 flex shrink-0 items-center gap-1">
          {barMode && (
            <button
              type="button"
              aria-expanded
              aria-label="Recolher detalhes"
              title="Recolher"
              onClick={() => setExpanded(false)}
              className="grid size-9 cursor-pointer place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
            >
              <Chevron />
            </button>
          )}
          <ExitButton onClick={exitSeatView} compact={barMode || short} />
        </div>
      </header>

      <p className="mt-1 flex items-center gap-2 text-sm">
        <span className={blocked ? 'text-white/50' : 'text-boca-gold font-bold'}>
          {formatPrice(category.price)}
        </span>
        <StatusChip availability={availability} selected={selected} />
      </p>

      <dl className="short:mt-2 mt-3 grid grid-cols-4 gap-1.5 text-center">
        <Metric label="Meio-campo" value={`${meters(metrics.centerDistance)} m`} />
        <Metric label="Gol mais perto" value={`${meters(metrics.goalDistance)} m`} />
        <Metric label="Altura" value={`${meters(metrics.height)} m`} />
        <Metric label="Ângulo do campo" value={`${Math.round(metrics.fieldAngleDeg)}°`} />
      </dl>
      <p className="mt-2 flex items-center gap-2 text-xs" aria-live="polite">
        <span
          className={`size-2 shrink-0 rounded-full ${visibility ? VISIBILITY_DOT[visibility.level] : 'animate-pulse bg-white/40'}`}
          aria-hidden
        />
        <span className={visibility ? 'text-white/85' : 'text-white/50'}>
          {visibility ? visibility.label : 'Calculando visibilidade do campo…'}
        </span>
      </p>
      {cover && (
        <p className="mt-1.5 flex items-start gap-2 text-xs" aria-live="polite">
          <CoverIcon covered={cover.covered} />
          <span className="text-white/85">
            <span className="font-semibold">{cover.label}</span>
            <span className="block text-[11px] leading-snug text-white/55">{cover.detail}</span>
          </span>
        </p>
      )}

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
            disabled={blocked && !selected}
            className={`w-full cursor-pointer rounded-2xl px-3 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed ${
              blocked && !selected
                ? 'bg-white/10 text-white/40'
                : selected
                  ? 'border border-white/20 bg-white/5 text-white hover:bg-white/10'
                  : 'bg-boca-gold text-boca-navy hover:brightness-110'
            }`}
          >
            {selected ? 'Remover da seleção' : BLOCKED_LABEL[availability]}
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

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={copyLink}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
            <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
          </svg>
          Copiar link
        </button>
        {/* role="status": o leitor de tela anuncia "Link copiado". */}
        <span role="status" className="text-xs text-emerald-300 empty:hidden">
          {copy === 'copied' && 'Link copiado'}
          {copy === 'error' && <span className="text-amber-300">Não foi possível copiar</span>}
        </span>
      </div>

      <label className="mt-3 flex cursor-pointer items-center justify-between gap-2 text-xs text-white/75">
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

      <p className="short:hidden mt-3 text-[11px] leading-relaxed text-white/45 pointer-coarse:hidden">
        Arraste para olhar em volta · <Kbd>←</Kbd>
        <Kbd>→</Kbd>
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd> trocar de cadeira · <Kbd>Enter</Kbd> escolher · <Kbd>+</Kbd>
        <Kbd>−</Kbd> binóculo · <Kbd>Esc</Kbd> sair
      </p>
      <p className="pointer-coarse:not-short:block mt-3 hidden text-[11px] text-white/45">
        Arraste para olhar em volta · pinça para o binóculo
      </p>
    </section>
  );
}

/**
 * Escolhe ou desfaz a escolha da cadeira em exibição, lendo os stores na hora (serve tanto ao
 * botão quanto à tecla Enter). Vendida ou reservada não faz nada. Devolve false só se bateu no limite.
 */
function toggleViewingSeat(): boolean {
  const id = useSeatViewStore.getState().viewingSeatId;
  const found = id ? findSeat(id, useStandsStore.getState().model) : null;
  if (!found) return true;
  const { selectedSeatIds, toggleSeat } = useSeatStore.getState();
  // Desfazer a escolha sempre pode; escolher, só se estiver livre.
  if (!selectedSeatIds.includes(found.seat.id) && seatAvailability(found.seat.id) !== 'available')
    return true;
  return toggleSeat(found.seat.id);
}

const VISIBILITY_DOT: Record<VisibilityLevel, string> = {
  clear: 'bg-emerald-400',
  minor: 'bg-lime-300',
  partial: 'bg-amber-300',
  heavy: 'bg-rose-400',
};

const meterFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const meters = (m: number) => meterFormat.format(m);

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-1 py-1.5">
      <dd className="text-sm font-bold tabular-nums">{value}</dd>
      <dt className="text-[10px] leading-tight text-white/55">{label}</dt>
    </div>
  );
}

/** Botão de sair da visão. Compacto (só o X) no celular em pé, onde falta espaço. */
function ExitButton({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={compact ? 'Sair da visão' : undefined}
      title={compact ? 'Sair da visão' : undefined}
      className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full text-sm text-white/80 hover:bg-white/10 hover:text-white ${
        compact ? 'size-9 justify-center' : 'px-3 py-1.5'
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {!compact && 'Sair da visão'}
    </button>
  );
}

/** Seta "v" (para baixo) ou "^" (para cima). */
function Chevron({ up = false }: { up?: boolean }) {
  return (
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
      <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  );
}

/** Selo curto do teto da visão, para a barra recolhida. Pulsa enquanto calcula. */
function CoverBadge({ cover }: { cover: Cover | null }) {
  if (!cover) {
    return <span className="h-6 w-24 animate-pulse rounded-full bg-white/10" aria-hidden />;
  }
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        cover.covered ? 'bg-sky-400/15 text-sky-100' : 'bg-amber-300/15 text-amber-100'
      }`}
      title={cover.detail}
    >
      <CoverIcon covered={cover.covered} />
      {cover.covered ? 'Coberto' : 'Descoberto'}
    </span>
  );
}

/** Telhado (setor coberto) ou sol (descoberto). */
function CoverIcon({ covered }: { covered: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`mt-px size-3.5 shrink-0 ${covered ? 'text-sky-300' : 'text-amber-200'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {covered ? (
        <path d="M3 11l9-6 9 6M6 9.5V19h12V9.5" />
      ) : (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      )}
    </svg>
  );
}

/** Texto do botão principal quando a cadeira não está escolhida. */
const BLOCKED_LABEL: Record<SeatAvailability, string> = {
  available: 'Escolher esta cadeira',
  held: 'Cadeira reservada',
  sold: 'Cadeira vendida',
  unknown: 'Disponibilidade indisponível',
};

function StatusChip({
  availability,
  selected,
}: {
  availability: SeatAvailability;
  selected: boolean;
}) {
  const [label, className] =
    availability === 'sold'
      ? ['Vendida', 'bg-white/10 text-white/60']
      : availability === 'held'
        ? ['Reservada', 'bg-slate-300/15 text-slate-200']
        : availability === 'unknown'
          ? ['Carregando…', 'bg-white/10 text-white/60']
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
