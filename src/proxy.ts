import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * proxy.ts — Redirecionamentos básicos (Next.js 16+, roda no runtime Node.js
 * por padrão a partir desta versão — não é mais Edge).
 *
 * Não verifica sessão/token aqui. O guard de autenticação é feito client-side
 * em (dashboard)/layout.tsx, e a autorização real dos dados é feita pelas
 * Firestore Security Rules (firestore.rules) — essa é a camada que de fato
 * protege os dados, independentemente do que a UI faz.
 *
 * Por que não verificar o token aqui: o Firebase Auth (client SDK, com
 * browserLocalPersistence) guarda a sessão no IndexedDB do navegador, que não
 * é enviado nas requisições HTTP. Para o proxy verificar autenticação de
 * verdade seria necessário migrar para cookies de sessão (Admin SDK
 * mintando/validando um session cookie), o que muda o fluxo de login/logout
 * do Sprint 1 e exige uma nova credencial (service account) — decisão
 * deliberadamente fora do escopo desta etapa de estabilização. O runtime
 * Node.js do proxy (novidade do Next 16) torna essa migração tecnicamente
 * viável no futuro, caso vire prioridade.
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

