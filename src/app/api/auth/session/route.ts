import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, isAdminConfigured } from '@/lib/firebase/admin';

/**
 * Cookie de sessão server-side — complementa (não substitui) a proteção via
 * Firestore Security Rules, que continua sendo a camada real de autorização
 * de dados. Este endpoint só permite ao proxy.ts verificar autenticação
 * antes de servir uma rota protegida, sem depender do IndexedDB do
 * navegador (que não é enviado em requisições HTTP).
 */
export const SESSION_COOKIE_NAME = 'session';
const SESSION_EXPIRES_IN_MS = 1000 * 60 * 60 * 24 * 5; // 5 dias

export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    // Sem Admin SDK configurado (ex.: ambiente local sem a credencial) —
    // não há sessão server-side para mintar; o guard client-side continua
    // funcionando normalmente. Não é um erro do cliente.
    return NextResponse.json({ ok: false, reason: 'admin-not-configured' }, { status: 200 });
  }

  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }
  if (typeof idToken !== 'string' || !idToken) {
    return NextResponse.json({ error: 'idToken é obrigatório.' }, { status: 400 });
  }

  try {
    const adminAuth = getAdminAuth();
    // Verifica o ID token antes de mintar o cookie — recusa tokens
    // inválidos/expirados/de outro projeto.
    await adminAuth.verifyIdToken(idToken);
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES_IN_MS });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      maxAge: SESSION_EXPIRES_IN_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return response;
  } catch (err) {
    console.error('[api/auth/session] Falha ao criar sessão:', err);
    return NextResponse.json({ error: 'Não foi possível criar a sessão.' }, { status: 401 });
  }
}

/** Encerra a sessão server-side (chamado no logout). */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
