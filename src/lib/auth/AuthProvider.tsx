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
        try {
          const profile = await getUserProfile(usr.uid);
          setUserProfile(profile);
        } catch (err) {
          console.error('[AuthProvider] Erro ao carregar perfil:', err);
          setUserProfile(null);
        }
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
