import { useEffect } from 'react';
import { useSeatViewStore } from '@/store/useSeatViewStore';

/** Por quanto tempo (ms) o aviso fica na tela. */
const NOTICE_MS = 5000;

/** Aviso curto no topo da tela (ex.: link de assento inválido). Some sozinho. */
export function NoticeToast() {
  const notice = useSeatViewStore((s) => s.notice);
  const dismiss = useSeatViewStore((s) => s.dismissNotice);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(dismiss, NOTICE_MS);
    return () => clearTimeout(timeout);
  }, [notice, dismiss]);

  return (
    // role="status": o leitor de tela lê o aviso quando ele aparece.
    <div
      role="status"
      className="pointer-events-none absolute inset-x-0 top-4 z-40 flex justify-center px-4"
    >
      {notice && (
        <p className="glass-card animate-hud-in pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm">
          {notice}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fechar aviso"
            className="-mr-1 grid size-6 cursor-pointer place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        </p>
      )}
    </div>
  );
}
