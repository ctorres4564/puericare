/**
 * Firebase Client SDK — Lazy Initialization
 *
 * O Firebase é inicializado sob demanda para evitar erros durante o
 * pre-render/SSR do Next.js quando as variáveis de ambiente não estão disponíveis.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { Auth, getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '';
  if (!apiKey) {
    throw new Error(
      '[Firebase] NEXT_PUBLIC_FIREBASE_API_KEY não está configurado. ' +
      'Copie .env.local.example para .env.local e preencha as variáveis do Firebase.'
    );
  }

  _app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey,
        authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
        projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
        storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
        appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
      });

  return _app;
}

/**
 * Retorna a instância de Auth do Firebase.
 * Inicializa o app se necessário (lazy).
 */
export function getFirebaseAuth(): Auth {
  if (_auth) return _auth;
  _auth = getAuth(getFirebaseApp());

  // Configura persistência local apenas no browser
  if (typeof window !== 'undefined') {
    setPersistence(_auth, browserLocalPersistence).catch((err) => {
      console.error('[Firebase] Falha ao configurar persistência:', err);
    });
  }

  return _auth;
}

/**
 * Atalho para compatibilidade — use getFirebaseAuth() quando possível.
 * @deprecated Prefira importar getFirebaseAuth e chamar a função.
 */
export const auth = new Proxy({} as Auth, {
  get(_target, prop) {
    return getFirebaseAuth()[prop as keyof Auth];
  },
});
