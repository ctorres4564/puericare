import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/client';

/**
 * Autentica um usuário com e-mail e senha.
 * Retorna o Firebase User em caso de sucesso.
 */
export const signIn = async (email: string, password: string) => {
  const auth = getFirebaseAuth();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
};

/**
 * Cria um novo usuário com e-mail e senha.
 */
export const signUp = async (email: string, password: string) => {
  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  return credential.user;
};

/**
 * Encerra a sessão do usuário autenticado.
 */
export const signOut = async () => {
  const auth = getFirebaseAuth();
  await firebaseSignOut(auth);
};

/**
 * Envia um e-mail de redefinição de senha.
 */
export const resetPassword = async (email: string) => {
  const auth = getFirebaseAuth();
  await sendPasswordResetEmail(auth, email);
};
