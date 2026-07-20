'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { User, onAuthStateChanged, onIdTokenChanged, signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { subscribeUserProfile } from '@/services/userService';
import { establishSessionCookie, clearSessionCookie } from '@/lib/auth/session';
import type { UserProfile } from '@/lib/types';

interface AuthContextProps {
  /** Usuário Firebase Auth (null = não autenticado) */
  user: User | null;
  /** Perfil completo do Firestore (null = não carregado, inexistente, bloqueado ou não autenticado) */
  userProfile: UserProfile | null;
  /** True enquanto o estado de autenticação está sendo verificado */
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

/**
 * Tela exibida quando a conta do usuário autenticado está desativada
 * (users/{uid}.active == false). Renderizada pelo próprio AuthProvider no
 * lugar de TODO o app — nenhuma rota fica acessível enquanto o bloqueio
 * estiver ativo. A mensagem não expõe detalhes internos.
 */
function BlockedAccountScreen({ onLogout }: { onLogout: () => Promise<void> }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ background: 'var(--color-bg)' }}
    >
      <div
        className="w-full max-w-md rounded-xl border p-8 text-center"
        style={{
          background: 'var(--color-bg-card)',
          borderColor: 'var(--color-border)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div className="mb-4 text-4xl">🚫</div>
        <h2 className="mb-2 text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
          Conta desativada
        </h2>
        <p className="mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Sua conta está desativada. Entre em contato com o administrador.
        </p>
        <button
          onClick={() => void onLogout()}
          className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors"
          style={{ background: 'var(--color-primary)' }}
        >
          Sair
        </button>
      </div>
    </div>
  );
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [blocked, setBlocked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    let unsubProfile: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;

    const unsub = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      unsubProfile?.();
      unsubProfile = null;
      if (retryTimer) clearTimeout(retryTimer);
      retries = 0;

      if (!usr) {
        setUserProfile(null);
        setBlocked(false);
        setLoading(false);
        return;
      }

      // Escuta o perfil em tempo real: se um ADMIN bloquear a conta
      // (active = false) ou alterar o papel durante a sessão, a mudança
      // tem efeito imediato — sem depender de novo login.
      const subscribe = () => {
        unsubProfile = subscribeUserProfile(
          usr.uid,
          (profile) => {
            if (!profile) {
              console.warn(
                '[AuthProvider] Perfil não encontrado no Firestore para UID:',
                usr.uid,
                '— O usuário precisa ter um documento em /users/{uid} com os campos: uid, email, displayName, role, active, createdAt, updatedAt.'
              );
              setUserProfile(null);
              setBlocked(false);
            } else {
              if (!profile.role || !profile.displayName || !profile.email) {
                console.warn(
                  '[AuthProvider] Perfil do Firestore incompleto para UID:',
                  usr.uid,
                  '— Campos faltantes:',
                  !profile.role ? 'role' : '',
                  !profile.displayName ? 'displayName' : '',
                  !profile.email ? 'email' : ''
                );
              }
              // Conta desativada: bloqueia o acesso independente do papel.
              const isBlocked = profile.active === false;
              setUserProfile(isBlocked ? null : profile);
              setBlocked(isBlocked);
            }
            setLoading(false);
          },
          (err: unknown) => {
            const code = (err as { code?: string }).code ?? '';
            if (code === 'permission-denied' && retries < 3) {
              // Token Firebase pode demorar para propagar após o cadastro — tenta de novo.
              retries += 1;
              retryTimer = setTimeout(subscribe, retries * 800);
            } else {
              console.error('[AuthProvider] Erro ao carregar perfil:', err);
              setUserProfile(null);
              setBlocked(false);
              setLoading(false);
            }
          }
        );
      };
      subscribe();
    });

    return () => {
      unsubProfile?.();
      if (retryTimer) clearTimeout(retryTimer);
      unsub();
    };
  }, []);

  // Mantém o cookie de sessão server-side (verificado por proxy.ts) sempre
  // atualizado: onIdTokenChanged dispara no login/cadastro, na sessão
  // restaurada ao carregar a página, E a cada renovação automática do
  // idToken pelo SDK (~1h) — sem isso o cookie expiraria em 1h mesmo com a
  // aba aberta e a sessão do Firebase continuando válida.
  useEffect(() => {
    const auth = getFirebaseAuth();
    return onIdTokenChanged(auth, (usr) => {
      if (usr) {
        void establishSessionCookie(usr);
      }
    });
  }, []);

  const logout = async () => {
    await clearSessionCookie();
    await signOut(getFirebaseAuth());
    setUserProfile(null);
    setBlocked(false);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, logout }}>
      {blocked ? <BlockedAccountScreen onLogout={logout} /> : children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextProps => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};
