import { useProgress } from '@react-three/drei';
import { useEffect, useState } from 'react';

/**
 * Tela de carregamento. useProgress acompanha os downloads do Three.js
 * (o .glb e as texturas) e devolve a porcentagem.
 */
export function LoadingScreen() {
  const { progress, active } = useProgress();
  const [visible, setVisible] = useState(true);
  const done = !active && progress === 100;

  // Espera o fade-out terminar antes de remover a tela do DOM.
  useEffect(() => {
    if (!done) return;
    const timeout = setTimeout(() => setVisible(false), 600);
    return () => clearTimeout(timeout);
  }, [done]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`bg-boca-navy absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 transition-opacity duration-500 ${
        done ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <p className="text-lg font-bold">
        Bombonera <span className="text-boca-gold">Tickets</span>
      </p>
      <div className="h-1.5 w-56 overflow-hidden rounded-full bg-white/15">
        <div
          className="bg-boca-gold h-full transition-[width] duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-white/60">Carregando o estádio… {Math.round(progress)}%</p>
    </div>
  );
}
