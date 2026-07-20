import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyIdToken, SESSION_COOKIE_NAME } from '@/lib/auth/verifyIdToken';

/**
 * proxy.ts — Redirecionamentos e verificação de sessão (Next.js 16+, roda no
 * runtime Node.js por padrão a partir desta versão — não é mais Edge).
 *
 * Verifica o cookie de sessão (o próprio ID token do Firebase, validado via
 * REST — ver lib/auth/verifyIdToken.ts) antes de servir qualquer rota
 * protegida. Complementa, não substitui, as Firestore Security Rules
 * (firestore.rules), que continuam sendo a camada real de autorização dos
 * dados independentemente do que o proxy faz.
 *
 * NÃO usa o Admin SDK aqui: uma primeira versão usava
 * `verifySessionCookie` do firebase-admin e quebrou em produção com
 * `ERR_REQUIRE_ESM` — o pacote (via jwks-rsa -> jose) não empacota
 * corretamente no ambiente de "serverless middleware" da Vercel. A
 * verificação via REST evita o problema por completo.
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

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionCookie && (await verifyIdToken(sessionCookie))) {
    return NextResponse.next();
  }

  // Ausente ou inválido/expirado — nega e limpa.
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

