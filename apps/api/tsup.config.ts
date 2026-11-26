import { defineConfig } from 'tsup';

/**
 * Build de produção: um único arquivo dist/server.js. O @bombonera/shared é TypeScript sem build
 * próprio, então ele entra DENTRO do arquivo (noExternal); as outras dependências ficam de fora e
 * são lidas de node_modules ao rodar.
 */
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  noExternal: ['@bombonera/shared'],
  clean: true,
});
