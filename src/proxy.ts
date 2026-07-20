import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminAuth, isAdminConfigured } from '@/lib/firebase/admin';
import { SESSION_COOKIE_NAME } from '@/app/api/auth/session/route';

/**
 * proxy.ts — Redirecionamentos e verificação de sessão (Next.js 16+, roda no
 * runtime Node.js por padrão a partir desta versão — não é mais Edge).
 *
 * Verifica o cookie de sessão (Admin SDK) antes de servir qualquer rota
 * protegida — complementa, não substitui, as Firestore Security Rules
 * (firestore.rules), que continuam sendo a camada real de autorização dos
 * dados independentemente do que o proxy faz.
 *
 * Degradação graciosa deliberada: se `FIREBASE_ADMIN_CREDENTIALS` não
 * estiver configurada (ex.: `next dev` local), o proxy NÃO bloqueia — volta
 * ao comportamento anterior (guard só client-side em (dashboard)/layout.tsx)
 * em vez de travar o app inteiro por falta de uma credencial opcional. Já
 * uma sessão presente e INVÁLIDA (expirada, revogada, adulterada) é sempre
 * rejeitada de verdade — a distinção é "não dá para checar" vs. "checamos e
 * é inválida".
 */

const PUBLIC_PATHS = ['/login', '/cadastro', '/esqueci-senha', '/setup', '/api'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permite recursos estáticos, APIs e páginas públicas
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // Redireciona / para /login
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Admin SDK não configurado: mantém o comportamento anterior (client-side only).
  if (!isAdminConfigured()) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    await getAdminAuth().verifySessionCookie(sessionCookie);
    return NextResponse.next();
  } catch {
    // Cookie presente mas inválido/expirado/revogado — nega e limpa.
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

