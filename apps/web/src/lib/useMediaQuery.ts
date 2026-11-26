import { useSyncExternalStore } from 'react';

/**
 * A tela atende a esta media query (ex.: "(max-width: 767px)")? Atualiza sozinho ao girar o
 * celular ou redimensionar a janela.
 *
 * useSyncExternalStore é o jeito do React de "assinar" algo de fora dele (aqui, o navegador):
 * `subscribe` avisa quando muda e `getSnapshot` lê o valor atual.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}
