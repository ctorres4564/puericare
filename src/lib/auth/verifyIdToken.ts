/**
 * Verificação de ID token do Firebase Auth via REST (Identity Toolkit) —
 * SEM depender do Admin SDK.
 *
 * Por quê: firebase-admin (via jwks-rsa -> jose) não empacota corretamente
 * no ambiente de "serverless middleware" da Vercel para Next.js proxy/
 * middleware — erro real observado em produção: `ERR_REQUIRE_ESM: require()
 * of ES Module .../jose/dist/webapi/index.js ... not supported`. A REST API
 * evita o problema por completo (é só um fetch) e funciona identicamente em
 * qualquer runtime (local, middleware, API route).
 *
 * Usa a mesma API key pública já exposta ao cliente
 * (NEXT_PUBLIC_FIREBASE_API_KEY) — não é um segredo, é o identificador do
 * projeto Firebase usado por qualquer SDK client-side.
 */
export const SESSION_COOKIE_NAME = 'session';

export async function verifyIdToken(idToken: string): Promise<boolean> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
