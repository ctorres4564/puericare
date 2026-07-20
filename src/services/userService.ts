import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/firestore';
import { stripUndefined } from '@/lib/firebase/utils';
import type { UserProfile, UserRole, CreateUserProfilePayload } from '@/lib/types';

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


/** Normaliza um documento da coleção users para UserProfile (uid = ID do doc). */
function normalizeUserProfile(id: string, data: Record<string, unknown>): UserProfile {
  const normalize = (val: unknown): string =>
    val instanceof Timestamp ? val.toDate().toISOString() : (val as string) ?? '';

  return {
    // O ID do documento é o UID autoritativo (== request.auth.uid nas regras).
    // O campo `uid` dentro do documento é redundante e pode divergir se o
    // documento for criado/editado manualmente — nunca usá-lo como chave.
    uid:               id,
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
 * Busca o perfil de um usuário pelo seu UID.
 * Retorna null se o documento não existir.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (!snap.exists()) return null;

  return normalizeUserProfile(snap.id, snap.data());
}

/**
 * Escuta o perfil de um usuário em tempo real.
 *
 * Usado pelo AuthProvider para que mudanças administrativas no documento
 * (ex.: bloqueio da conta com active=false, troca de papel) tenham efeito
 * imediato na sessão aberta, sem depender de novo login.
 *
 * Retorna a função de unsubscribe. `onError` é chamado se a leitura for
 * negada pelas regras ou falhar.
 */
export function subscribeUserProfile(
  uid: string,
  onProfile: (profile: UserProfile | null) => void,
  onError?: (err: unknown) => void
): () => void {
  const db = getFirebaseDb();
  return onSnapshot(
    doc(db, COLLECTION, uid),
    (snap) => {
      onProfile(snap.exists() ? normalizeUserProfile(snap.id, snap.data()) : null);
    },
    (err) => onError?.(err)
  );
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

/* ── Funções administrativas (Sprint A) ──
 *
 * As regras do Firestore só permitem estas operações para ADMIN — o cliente
 * nunca oferece promoção a ADMIN pela UI e as regras também bloqueiam
 * (ver firestore.rules, match /users/{userId}).
 */

/** Lista todos os usuários (somente ADMIN — ver firestore.rules). */
export async function listUsers(): Promise<UserProfile[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs
    .map((d) => normalizeUserProfile(d.id, d.data()))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
}

/** Ativa ou bloqueia a conta de um usuário (somente ADMIN). */
export async function setUserActive(uid: string, active: boolean): Promise<void> {
  await updateUserProfile(uid, { active });
}

/**
 * Altera o papel de um usuário (somente ADMIN). A UI nunca oferece 'ADMIN'
 * como opção — o primeiro ADMIN só é criado manualmente no console
 * (bootstrap documentado em firestore.rules).
 */
export async function setUserRole(uid: string, role: UserRole): Promise<void> {
  await updateUserProfile(uid, { role });
}
