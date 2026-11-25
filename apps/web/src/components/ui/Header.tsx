import { MatchInfo } from './MatchInfo';

/** Topo da tela: o jogo à venda (à esquerda) e o selo de portfólio (à direita). */
export function Header() {
  return (
    <header className="hide-in-seat-view from-boca-navy/90 pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 bg-linear-to-b to-transparent p-4 sm:p-6">
      <MatchInfo />

      <span className="border-boca-gold/40 glass-subtle text-boca-gold pointer-events-auto hidden rounded-full border px-3 py-1 text-xs font-medium sm:inline">
        Projeto de portfólio
      </span>
    </header>
  );
}
