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
import type { Consultation } from '@/lib/types';

const COLLECTION = 'consultations';

/** Converte Timestamp do Firestore para ISO string, se necessário. */
function normalizeDate(val: unknown): string {
  return val instanceof Timestamp ? val.toDate().toISOString() : ((val as string) ?? '');
}

function normalizeConsultation(id: string, data: Record<string, unknown>): Consultation {
  return {
    ...data,
    id,
    createdAt: normalizeDate(data.createdAt),
    updatedAt: normalizeDate(data.updatedAt),
  } as Consultation;
}

/**
 * Cria uma consulta como rascunho (status "draft"), vinculada à criança e ao
 * profissional. `ageInDays` é calculado pelo chamador (ver
 * src/lib/consultations/ageInDays.ts) a partir da data de nascimento da
 * criança — este service não conhece o cadastro da criança.
 */
export async function createConsultation(
  professionalId: string,
  payload: { childId: string; consultationDate: string; ageInDays: number }
): Promise<Consultation> {
  const db = getFirebaseDb();
  const ref = doc(collection(db, COLLECTION));
  const now = new Date().toISOString();

  const consultation: Consultation = {
    id: ref.id,
    childId: payload.childId,
    professionalId,
    consultationDate: payload.consultationDate,
    ageInDays: payload.ageInDays,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ref, {
    ...stripUndefined(consultation as unknown as Record<string, unknown>),
    _serverCreatedAt: serverTimestamp(),
  });

  return consultation;
}

/** Busca uma consulta pelo ID. Retorna null se não existir. */
export async function getConsultation(id: string): Promise<Consultation | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return normalizeConsultation(snap.id, snap.data());
}

/**
 * Lista as consultas de um profissional (todos os pacientes), da mais
 * recente para a mais antiga. A filtragem por paciente (linha do tempo de
 * uma criança específica) é feita no cliente sobre este mesmo resultado —
 * mesmo raciocínio de listChildrenByProfessional: volume pequeno por
 * profissional, sem necessidade de índice composto.
 */
export async function listConsultationsByProfessional(professionalId: string): Promise<Consultation[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, COLLECTION), where('professionalId', '==', professionalId));
  const snap = await getDocs(q);

  return snap.docs
    .map((d) => normalizeConsultation(d.id, d.data()))
    .sort((a, b) => b.consultationDate.localeCompare(a.consultationDate) || b.createdAt.localeCompare(a.createdAt));
}

/**
 * Atualiza o conteúdo e/ou o status de uma consulta (salvar rascunho,
 * finalizar, cancelar). `childId` e `professionalId` não são alteráveis aqui.
 */
export async function updateConsultation(
  id: string,
  updates: Partial<Omit<Consultation, 'id' | 'childId' | 'professionalId' | 'createdAt'>>
): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, COLLECTION, id), {
    ...stripUndefined(updates as Record<string, unknown>),
    updatedAt: new Date().toISOString(),
    _serverUpdatedAt: serverTimestamp(),
  });
}

/** "Exclui" um rascunho sem apagar o documento: marca como cancelado. */
export async function cancelConsultation(id: string): Promise<void> {
  await updateConsultation(id, { status: 'cancelled' });
}

/** Finaliza a consulta, registrando a evolução clínica. */
export async function completeConsultation(id: string): Promise<void> {
  await updateConsultation(id, { status: 'completed' });
}
