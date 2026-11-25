export function NavigationHint() {
  return (
    <p className="glass-subtle pointer-events-none absolute top-20 right-4 hidden max-w-56 rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed text-white/70 md:block">
      <strong className="text-white">Arrastar</strong> gira ·{' '}
      <strong className="text-white">Scroll</strong> aproxima ·{' '}
      <strong className="text-white">Botão direito</strong> move
    </p>
  );
}
