/**
 * Content-Security-Policy — permite exatamente o que o app usa:
 * - Firebase Auth/Firestore (identitytoolkit, securetoken, firestore, googleapis)
 * - iframe auxiliar do Firebase Auth (<project>.firebaseapp.com) e accounts.google.com
 * - fontes self-hosted via next/font (sem fonts.googleapis.com/fonts.gstatic.com)
 * - 'unsafe-inline' em style-src é necessário: o design system deste projeto usa
 *   style={{ ... }} extensivamente (var(--color-*) por componente) em vez de só
 *   classes Tailwind — sem isso a UI inteira perde estilo.
 * - 'unsafe-inline' em script-src cobre o script de hidratação do Next.js
 *   (sem infraestrutura de nonce por requisição nesta etapa).
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://apis.google.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://www.googleapis.com",
  "frame-src https://*.firebaseapp.com https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sem output: 'standalone' — essa opção é para self-host (Docker/Node server
  // "nu"), não para Vercel (o alvo de deploy deste projeto, sem Dockerfile) e
  // quebra `next start` localmente. O pre-render estático sem env vars do
  // Firebase já é evitado pelo `export const dynamic = 'force-dynamic'` de
  // cada página/layout — não tem relação com `output`.
  turbopack: {
    // Define o diretório raiz para o Turbopack, evitando confusão com lockfiles
    root: import.meta.dirname,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;

