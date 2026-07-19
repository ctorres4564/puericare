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
};

export default nextConfig;

