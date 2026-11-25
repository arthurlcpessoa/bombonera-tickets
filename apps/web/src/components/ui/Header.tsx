export function Header() {
  return (
    <header className="from-boca-navy/90 pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 bg-linear-to-b to-transparent p-4 sm:p-6">
      <div className="pointer-events-auto">
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
          Bombonera <span className="text-boca-gold">Tickets</span>
        </h1>
        <p className="text-xs text-white/70 sm:text-sm">Escolha seu lugar em 3D na La Bombonera</p>
      </div>

      <span className="border-boca-gold/40 bg-boca-navy/60 text-boca-gold pointer-events-auto hidden rounded-full border px-3 py-1 text-xs backdrop-blur sm:inline">
        Projeto de portfólio
      </span>
    </header>
  );
}
