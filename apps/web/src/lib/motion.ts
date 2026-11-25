/**
 * prefers-reduced-motion: opção do sistema (Windows: "Efeitos de animação" desligado) para quem
 * sente enjoo ou desconforto com movimento na tela. Quando ligada, os voos de câmera viram
 * cortes instantâneos.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
