/**
 * Regras de ponteiro compartilhadas pelos setores e pelas cadeiras.
 *
 * Clique × arrasto: arrastar para girar a câmera também termina num "clique" (aperta e solta).
 * O React Three Fiber informa em `e.delta` quantos pixels o ponteiro andou entre apertar e soltar;
 * acima de alguns pixels, foi arrasto, e o clique deve ser ignorado.
 */
export const CLICK_MAX_DRAG_PX = 6;

export function isDragGesture(event: { delta: number }): boolean {
  return event.delta > CLICK_MAX_DRAG_PX;
}

/** No toque não existe "passar o mouse": hover só para mouse e caneta. */
export function supportsHover(event: { pointerType: string }): boolean {
  return event.pointerType !== 'touch';
}
