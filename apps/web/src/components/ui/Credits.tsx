/** Crédito exigido pela licença CC BY 4.0 do modelo 3D + aviso de projeto não oficial. */
export function Credits() {
  return (
    <footer className="absolute inset-x-0 bottom-0 px-4 py-2 text-center text-[10px] leading-snug text-white/60 sm:text-left sm:text-xs">
      Modelo 3D{' '}
      <a
        className="underline hover:text-white"
        href="https://sketchfab.com/3d-models/la-bombonera-boca-juniors-82204c5963b84ac593c26127ac36fbfa"
        target="_blank"
        rel="noreferrer"
      >
        “La Bombonera (Boca Juniors)”
      </a>{' '}
      por{' '}
      <a
        className="underline hover:text-white"
        href="https://sketchfab.com/al1905"
        target="_blank"
        rel="noreferrer"
      >
        A1905
      </a>
      ,{' '}
      <a
        className="underline hover:text-white"
        href="http://creativecommons.org/licenses/by/4.0/"
        target="_blank"
        rel="noreferrer"
      >
        CC BY 4.0
      </a>
      . Projeto de estudo, sem vínculo com o Club Atlético Boca Juniors nem com o Club Atlético
      River Plate.
    </footer>
  );
}
