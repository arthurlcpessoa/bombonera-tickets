/** Variáveis de ambiente do site (arquivo apps/web/.env). Só as com prefixo VITE_ chegam ao navegador. */
interface ImportMetaEnv {
  /** Endereço da API, ex.: http://localhost:3000 */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
