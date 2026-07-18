/** @type {import('next').NextConfig} */
const nextConfig = {
  // Necessário para apps que usam Firebase (evita pre-render estático sem env vars)
  output: 'standalone',
  turbopack: {
    // Define o diretório raiz para o Turbopack, evitando confusão com lockfiles
    root: import.meta.dirname,
  },
};

export default nextConfig;

