import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

/**
 * Firebase Admin SDK — server-only (nunca importar deste arquivo em código
 * 'use client'). Usado exclusivamente para mintar/verificar o cookie de
 * sessão (proxy.ts, src/app/api/auth/session/route.ts).
 *
 * Credencial: `FIREBASE_ADMIN_CREDENTIALS` (JSON da service account
 * `puericare-session-verifier`, papel mínimo `roles/firebaseauth.admin` —
 * só verifica/emite tokens de Auth, sem acesso a Firestore/Storage).
 * Configurada como env var server-side na Vercel (Production e Preview),
 * nunca commitada no repo.
 *
 * Se a env var não estiver configurada (ex.: `next dev` local sem ela),
 * `isAdminConfigured()` retorna false — o chamador (proxy.ts) deve degradar
 * graciosamente para o comportamento anterior (guard só client-side) em vez
 * de travar o app inteiro. Uma sessão inválida/expirada, por outro lado, é
 * sempre rejeitada de verdade — a distinção é "não dá para checar" vs.
 * "checamos e é inválida".
 */

let _app: App | null | undefined;

function getAdminApp(): App | null {
  if (_app !== undefined) return _app;

  if (getApps().length > 0) {
    _app = getApps()[0];
    return _app;
  }

  const raw = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!raw) {
    _app = null;
    return null;
  }

  try {
    const serviceAccount = JSON.parse(raw);
    _app = initializeApp({ credential: cert(serviceAccount) });
    return _app;
  } catch (err) {
    console.error('[firebase/admin] FIREBASE_ADMIN_CREDENTIALS inválida — verificação de sessão server-side desabilitada:', err);
    _app = null;
    return null;
  }
}

export function isAdminConfigured(): boolean {
  return getAdminApp() !== null;
}

export function getAdminAuth(): Auth {
  const app = getAdminApp();
  if (!app) {
    throw new Error('Firebase Admin SDK não configurado (FIREBASE_ADMIN_CREDENTIALS ausente ou inválida).');
  }
  return getAuth(app);
}
