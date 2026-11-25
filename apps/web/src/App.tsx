import { lazy, Suspense } from 'react';
import { Credits } from '@/components/ui/Credits';
import { Header } from '@/components/ui/Header';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { NavigationHint } from '@/components/ui/NavigationHint';
import { NoticeToast } from '@/components/ui/NoticeToast';
import { PriceLegend } from '@/components/ui/PriceLegend';
import { SeatTooltip } from '@/components/ui/SeatTooltip';
import { SeatViewHud } from '@/components/ui/SeatViewHud';
import { SectorTooltip } from '@/components/ui/SectorTooltip';
import { SelectionDock } from '@/components/ui/SelectionDock';
import { ViewSwitcher } from '@/components/ui/ViewSwitcher';
import { StadiumCanvas } from '@/features/stadium/components/StadiumCanvas';
import { useSeatViewStore } from '@/store/useSeatViewStore';

/**
 * Painel de calibração, só com ?debug na URL. lazy() + import() dinâmico: o código dele
 * (e o da biblioteca leva) fica num arquivo separado que só é baixado quando pedido.
 */
const DebugPanel = lazy(() => import('@/features/debug/DebugPanel'));
const isDebug = new URLSearchParams(window.location.search).has('debug');

/**
 * Layout em camadas: o canvas 3D ocupa a tela inteira e a interface (HTML comum)
 * flutua por cima dele com position: absolute.
 */
export function App() {
  // Na visão do assento, a interface normal sai de cena (classe hide-in-seat-view, em index.css).
  const viewingSeat = useSeatViewStore((s) => s.viewingSeatId !== null);

  return (
    <main className="relative h-full w-full" data-seat-view={viewingSeat ? '' : undefined}>
      <StadiumCanvas />

      <Header />
      <PriceLegend />
      <ViewSwitcher />
      <NavigationHint />
      <Credits />
      <SelectionDock />
      <SeatViewHud />
      <NoticeToast />
      <SectorTooltip />
      <SeatTooltip />
      <LoadingScreen />

      {isDebug && (
        <Suspense fallback={null}>
          <DebugPanel />
        </Suspense>
      )}
    </main>
  );
}
