import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Config dos testes unitários/integrados (mocks, sem dependências externas).
 * Testes de firestore.rules ficam em vitest.rules.config.ts, rodados via
 * Firebase Emulator — propositalmente fora do `include` abaixo, para que
 * `npm run test` nunca dependa do emulador estar rodando.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: false,
  },
});
