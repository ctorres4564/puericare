import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/firestore';
import { stripUndefined } from '@/lib/firebase/utils';
import type { Child, CreateChildPayload } from '@/lib/types';

const COLLECTION = 'children';

/** Converte Timestamp do Firestore para ISO string, se necessário. */
function normalizeDate(val: unknown): string {
  return val instanceof Timestamp ? val.toDate().toISOString() : ((val as string) ?? '');
}

function normalizeChild(id: string, data: Record<string, unknown>): Child {
  return {
    ...data,
    id,
    createdAt: normalizeDate(data.createdAt),
    updatedAt: normalizeDate(data.updatedAt),
  } as Child;
}

/**
 * Cria o cadastro de uma criança para o profissional autenticado.
 * `caregiverIds` começa vazio — vínculo de contas de responsáveis é recurso futuro (v2.0).
 */
export async function createChild(
  professionalId: string,
  payload: Omit<CreateChildPayload, 'professionalId' | 'caregiverIds' | 'active'>
): Promise<Child> {
  const db = getFirebaseDb();
  const ref = doc(collection(db, COLLECTION));
  const now = new Date().toISOString();

  const child: Child = {
    ...payload,
    id: ref.id,
    professionalId,
    caregiverIds: [],
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ref, {
    ...stripUndefined(child as unknown as Record<string, unknown>),
    _serverCreatedAt: serverTimestamp(),
  });

  return child;
}

/** Busca uma criança pelo ID. Retorna null se não existir. */
export async function getChild(id: string): Promise<Child | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return normalizeChild(snap.id, snap.data());
}

/**
 * Lista as crianças de um profissional.
 * A ordenação e a busca por nome são feitas no cliente: o volume esperado
 * por profissional (dezenas de pacientes) não justifica índice composto.
 */
export async function listChildrenByProfessional(professionalId: string): Promise<Child[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, COLLECTION), where('professionalId', '==', professionalId));
  const snap = await getDocs(q);

  return snap.docs
    .map((d) => normalizeChild(d.id, d.data()))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'));
}

/** Atualiza os dados cadastrais de uma criança. `professionalId` não é alterável aqui. */
export async function updateChild(
  id: string,
  updates: Partial<Omit<Child, 'id' | 'professionalId' | 'createdAt'>>
): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, COLLECTION, id), {
    ...stripUndefined(updates as Record<string, unknown>),
    updatedAt: new Date().toISOString(),
    _serverUpdatedAt: serverTimestamp(),
  });
}

/**
 * "Exclui" o cadastro sem apagar o histórico clínico: marca como inativo.
 * A remoção definitiva fica restrita a administradores (ver firestore.rules).
 */
export async function deactivateChild(id: string): Promise<void> {
  await updateChild(id, { active: false });
}
