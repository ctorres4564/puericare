'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { getUserProfile } from '@/services/userService';
import type { UserProfile } from '@/lib/types';

interface AuthContextProps {
  /** Usuário Firebase Auth (null = não autenticado) */
  user: User | null;
  /** Perfil completo do Firestore (null = não carregado ou não autenticado) */
  userProfile: UserProfile | null;
  /** True enquanto o estado de autenticação está sendo verificado */
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (usr) => {
      setUser(usr);
      if (usr) {
        // Tenta carregar o perfil com até 3 tentativas (token Firebase pode demorar para propagar)
        let profile = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            profile = await getUserProfile(usr.uid);
            break;
          } catch (err: unknown) {
            const code = (err as { code?: string }).code ?? '';
            if (code === 'permission-denied' && attempt < 3) {
              // Aguarda antes de tentar novamente (exponential backoff)
              await new Promise((r) => setTimeout(r, attempt * 800));
            } else {
              console.error('[AuthProvider] Erro ao carregar perfil:', err);
              break;
            }
          }
        }

        // Valida que o perfil tem os campos mínimos obrigatórios
        if (profile && (!profile.role || !profile.displayName || !profile.email)) {
          console.warn(
            '[AuthProvider] Perfil do Firestore incompleto para UID:',
            usr.uid,
            '— Campos faltantes:',
            !profile.role ? 'role' : '',
            !profile.displayName ? 'displayName' : '',
            !profile.email ? 'email' : '',
          );
        }

        if (!profile) {
          console.warn(
            '[AuthProvider] Perfil não encontrado no Firestore para UID:',
            usr.uid,
            '— O usuário precisa ter um documento em /users/{uid} com os campos: uid, email, displayName, role, active, createdAt, updatedAt.',
          );
        }

        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const logout = async () => {
    await signOut(getFirebaseAuth());
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextProps => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};
