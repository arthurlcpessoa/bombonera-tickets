import { Credits } from '@/components/ui/Credits';
import { Header } from '@/components/ui/Header';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { NavigationHint } from '@/components/ui/NavigationHint';
import { ViewSwitcher } from '@/components/ui/ViewSwitcher';
import { StadiumCanvas } from '@/features/stadium/components/StadiumCanvas';

/**
 * Layout em camadas: o canvas 3D ocupa a tela inteira e a interface (HTML comum)
 * flutua por cima dele com position: absolute.
 */
export function App() {
  return (
    <main className="relative h-full w-full">
      <StadiumCanvas />

      <Header />
      <ViewSwitcher />
      <NavigationHint />
      <Credits />
      <LoadingScreen />
    </main>
  );
}
