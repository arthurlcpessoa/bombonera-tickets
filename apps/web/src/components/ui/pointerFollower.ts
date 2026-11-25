import { useEffect, type RefObject } from 'react';

/** Distância (px) entre a ponta do mouse e o tooltip. */
const OFFSET = 16;

/** Última posição conhecida do mouse (compartilhada, sem causar re-render). */
const pointer = { x: 0, y: 0 };

/** Posiciona o elemento ao lado do mouse; perto da borda direita/inferior, vira para o outro lado. */
export function placeNearPointer(el: HTMLElement) {
  const { offsetWidth: w, offsetHeight: h } = el;
  let x = pointer.x + OFFSET;
  let y = pointer.y + OFFSET;
  if (x + w > window.innerWidth - 8) x = pointer.x - OFFSET - w;
  if (y + h > window.innerHeight - 8) y = pointer.y - OFFSET - h;
  el.style.transform = `translate(${x}px, ${y}px)`;
}

/**
 * Faz o elemento seguir o mouse, movendo-o direto no DOM a cada movimento, sem passar pelo
 * React (re-renderizar a cada pixel seria desperdício).
 */
export function usePointerFollower(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      if (ref.current && !ref.current.hidden) placeNearPointer(ref.current);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [ref]);
}
