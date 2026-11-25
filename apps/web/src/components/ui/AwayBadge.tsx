import { getCategory } from '@/features/seating/data/sectors';

/** Cor do selo = cor da faixa "Visitante", a mesma da legenda e do 3D. */
const AWAY_COLOR = getCategory('visitante').color;

/** Selo "Torcida visitante", usado no tooltip, no painel e no resumo da seleção. */
export function AwayBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-none font-semibold tracking-normal normal-case ${className}`}
      style={{ color: AWAY_COLOR, borderColor: AWAY_COLOR }}
    >
      Torcida visitante
    </span>
  );
}
