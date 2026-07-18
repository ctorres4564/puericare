/**
 * firestore.ts — Instância do Firestore com lazy initialization.
 *
 * Reutiliza o app Firebase já inicializado pelo client.ts.
 */

import { getFirestore, Firestore } from 'firebase/firestore';
import { getFirebaseAuth } from '@/lib/firebase/client';

let _db: Firestore | null = null;

/**
 * Retorna a instância do Firestore, inicializando se necessário.
 * Usa o mesmo Firebase App do client.ts (via getFirebaseAuth que chama getFirebaseApp).
 */
export function getFirebaseDb(): Firestore {
  if (_db) return _db;
  // getFirebaseAuth() garante que o app está inicializado
  const auth = getFirebaseAuth();
  _db = getFirestore(auth.app);
  return _db;
}

/**
 * Atalho para compatibilidade — use getFirebaseDb() quando possível.
 * @deprecated Prefira importar getFirebaseDb e chamar a função.
 */
export const db = new Proxy({} as Firestore, {
  get(_target, prop) {
    return getFirebaseDb()[prop as keyof Firestore];
  },
});
