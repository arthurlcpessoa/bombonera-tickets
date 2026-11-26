import { useAvailabilityStore } from '@/store/useAvailabilityStore';

/**
 * Aviso quando a API não responde. O estádio 3D continua navegável (a geometria vem do próprio
 * site), mas a disponibilidade pode estar desatualizada e não dá para reservar.
 * O TanStack Query continua tentando sozinho; quando a API volta, o aviso some.
 */
export function ApiStatusBanner() {
  const offline = useAvailabilityStore((s) => s.apiStatus === 'offline');
  if (!offline) return null;
  return (
    <p
      role="status"
      className="glass-card pointer-events-auto absolute top-3 left-1/2 z-30 w-[min(92vw,30rem)] -translate-x-1/2 rounded-2xl px-4 py-2.5 text-center text-xs leading-snug text-amber-200"
    >
      <span className="font-semibold">Sem conexão com o servidor de ingressos.</span> O estádio
      continua navegável, mas a disponibilidade pode estar desatualizada e não dá para reservar
      agora. Tentando de novo…
    </p>
  );
}
