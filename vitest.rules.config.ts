import { defineConfig } from 'vitest/config';

/**
 * Config dos testes de firestore.rules. Exige o Firestore Emulator rodando
 * (ver script "test:rules" em package.json, que sobe o emulador via
 * `firebase emulators:exec`). Nunca roda contra o projeto Firebase real.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
