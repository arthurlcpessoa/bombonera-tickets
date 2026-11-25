import type { CSSProperties } from 'react';
import { SECTOR_PANEL_LAYOUT } from '@/config/stadium';
import { SeatSelectionSummary } from './SeatSelectionSummary';
import { SectorPanel } from './SectorPanel';

/** Largura da coluna da direita: a do config menos a margem de 16 px de cada lado. */
const PANEL_WIDTH = SECTOR_PANEL_LAYOUT.sideWidth - 32;

/**
 * "Doca" que organiza o painel do setor e o resumo da seleção na tela.
 *
 * - Desktop: uma coluna à direita (painel em cima, resumo embaixo). O painel encolhe e rola
 *   se a tela for baixa.
 * - Celular: empilhados embaixo, logo ACIMA dos botões de visão e dos créditos (sem cobri-los):
 *   o resumo vira uma barra compacta e o painel fica logo abaixo dela.
 *
 * A doca em si não recebe cliques (pointer-events-none): o 3D continua clicável nos espaços
 * vazios; só os cartões dentro dela (pointer-events-auto) recebem.
 */
export function SelectionDock() {
  return (
    <div
      // A largura do painel vem do config (a câmera usa o mesmo número) via variável CSS.
      style={{ '--panel-w': `${PANEL_WIDTH}px` } as CSSProperties}
      className="hide-in-seat-view pointer-events-none absolute inset-x-0 bottom-[7.25rem] z-20 flex flex-col-reverse gap-2 md:inset-x-auto md:top-4 md:right-4 md:bottom-4 md:w-(--panel-w) md:flex-col md:justify-start md:gap-3"
    >
      <SectorPanel />
      <SeatSelectionSummary />
    </div>
  );
}
