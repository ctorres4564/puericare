import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * proxy.ts — Proteção de rotas no edge (Next.js 16+).
 *
 * O guard principal de autenticação é feito client-side no layout do dashboard.
 * Este proxy adiciona uma camada extra e garante redirecionamentos básicos.
 *
 * NOTA: A verificação completa de token Firebase no edge requer firebase-admin,
 * incompatível com o Edge Runtime. Para produção de alta segurança, use
 * Server Components com Firebase Admin SDK.
 */

const PUBLIC_PATHS = ['/login', '/esqueci-senha', '/api'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permite recursos estáticos e APIs
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

