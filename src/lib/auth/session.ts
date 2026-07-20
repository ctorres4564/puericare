import type { User } from 'firebase/auth';

/**
 * Ponte entre o Firebase Auth client-side (IndexedDB, não visível ao
 * servidor) e o cookie de sessão server-side verificado por proxy.ts.
 *
 * Chamado pelo AuthProvider sempre que o estado de autenticação muda —
 * cobre login, cadastro e restauração de sessão persistida ao carregar a
 * página, sem precisar instrumentar cada tela individualmente.
 *
 * Falhas aqui NUNCA bloqueiam o fluxo do usuário: se o endpoint responder
 * `admin-not-configured` (Admin SDK ausente, ex.: `next dev` local) ou a
 * chamada falhar por qualquer motivo (rede, etc.), o app continua
 * funcionando com o guard client-side de sempre — o cookie é só uma camada
 * adicional, não uma dependência rígida.
 */

export async function establishSessionCookie(user: User): Promise<void> {
  try {
    const idToken = await user.getIdToken();
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  } catch (err) {
    console.warn('[session] Não foi possível estabelecer o cookie de sessão server-side:', err);
  }
}

export async function clearSessionCookie(): Promise<void> {
  try {
    await fetch('/api/auth/session', { method: 'DELETE' });
  } catch (err) {
    console.warn('[session] Não foi possível limpar o cookie de sessão server-side:', err);
  }
}
