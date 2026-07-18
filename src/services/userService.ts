import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/firestore';
import { stripUndefined } from '@/lib/firebase/utils';
import type { UserProfile, CreateUserProfilePayload } from '@/lib/types';

const COLLECTION = 'users';

/**
 * Cria o documento de perfil de um usuário recém-registrado.
 * Deve ser chamado logo após a criação da conta no Firebase Auth.
 */
export async function createUserProfile(
  uid: string,
  payload: Omit<CreateUserProfilePayload, 'uid'>
): Promise<UserProfile> {
  const now = new Date().toISOString();
  const profile: UserProfile = {
    ...payload,
    uid,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  const db = getFirebaseDb();
  await setDoc(doc(db, COLLECTION, uid), {
    // Remove campos undefined antes de salvar
    ...stripUndefined(profile as unknown as Record<string, unknown>),
    _serverCreatedAt: serverTimestamp(),
  });

  return profile;
}


/**
 * Busca o perfil de um usuário pelo seu UID.
 * Retorna null se o documento não existir.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (!snap.exists()) return null;

  const data = snap.data();
  // Converte Timestamp do Firestore para ISO string se necessário
  const normalize = (val: unknown): string =>
    val instanceof Timestamp ? val.toDate().toISOString() : (val as string) ?? '';

  return {
    uid:               data.uid,
    email:             data.email,
    displayName:       data.displayName,
    role:              data.role,
    crm:               data.crm,
    specialty:         data.specialty,
    linkedChildIds:    data.linkedChildIds,
    active:            data.active,
    createdAt:         normalize(data.createdAt),
    updatedAt:         normalize(data.updatedAt),
  } as UserProfile;
}

/**
 * Atualiza campos específicos do perfil de um usuário.
 */
export async function updateUserProfile(
  uid: string,
  updates: Partial<Omit<UserProfile, 'uid' | 'createdAt'>>
): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, COLLECTION, uid), {
    ...updates,
    updatedAt: new Date().toISOString(),
    _serverUpdatedAt: serverTimestamp(),
  });
}
