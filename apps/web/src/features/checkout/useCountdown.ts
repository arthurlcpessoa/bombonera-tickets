import { useEffect, useState } from 'react';

/**
 * Milissegundos que faltam até `deadline` (ISO 8601), atualizado a cada segundo.
 * Usa o relógio deste computador: se ele estiver alguns segundos errado, o cronômetro também
 * estará. Quem decide de verdade se a reserva venceu é a API.
 */
export function useCountdown(deadline: string | null): number {
  const target = deadline ? new Date(deadline).getTime() : 0;
  const [now, setNow] = useState(() => Date.now());
  // Um "tique" por segundo enquanto o componente existir (é barato: só um número muda).
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return deadline ? Math.max(0, target - now) : 0;
}

/** 542_000 ms → "09:02". */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
