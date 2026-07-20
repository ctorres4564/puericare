import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, SESSION_COOKIE_NAME } from '@/lib/auth/verifyIdToken';

/**
 * Cookie de sessão server-side — complementa (não substitui) a proteção via
 * Firestore Security Rules, que continua sendo a camada real de autorização
 * de dados. Guarda o próprio ID token do Firebase (não um "session cookie"
 * do Admin SDK — ver nota em lib/auth/verifyIdToken.ts sobre por quê).
 *
 * O ID token expira em ~1h; o cliente (Firebase SDK) o renova sozinho em
 * segundo plano, e o AuthProvider chama este endpoint de novo a cada
 * renovação (onIdTokenChanged), então o cookie se mantém atualizado
 * enquanto a aba estiver aberta.
 */
const COOKIE_MAX_AGE_SECONDS = 60 * 60; // 1h — mesma validade do idToken.

export async function POST(request: NextRequest) {
  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }
  if (typeof idToken !== 'string' || !idToken) {
    return NextResponse.json({ error: 'idToken é obrigatório.' }, { status: 400 });
  }

  const valid = await verifyIdToken(idToken);
  if (!valid) {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, idToken, {
    maxAge: COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return response;
}

/** Encerra a sessão server-side (chamado no logout). */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
