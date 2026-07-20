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
    // Acima do default (5000ms): a suíte completa roda os 29 arquivos em
    // paralelo, e os testes de geração real de PDF (pdfModel.test.ts) fazem
    // renderização pesada de verdade — sob contenção de CPU (ex.: runner de
    // CI mais lento que a máquina local) o default ocasionalmente estourava.
    testTimeout: 15000,
  },
});
