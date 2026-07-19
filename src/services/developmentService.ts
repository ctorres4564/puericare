import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/firestore';
import { stripUndefined } from '@/lib/firebase/utils';
import type { DevelopmentAssessment, DevelopmentMilestoneEntry } from '@/lib/types';

const COLLECTION = 'developmentAssessments';

/** Converte Timestamp do Firestore para ISO string, se necessário. */
function normalizeDate(val: unknown): string {
  return val instanceof Timestamp ? val.toDate().toISOString() : ((val as string) ?? '');
}

function normalizeAssessment(id: string, data: Record<string, unknown>): DevelopmentAssessment {
  return {
    ...data,
    id,
    createdAt: normalizeDate(data.createdAt),
    updatedAt: normalizeDate(data.updatedAt),
  } as DevelopmentAssessment;
}

/**
 * Registra uma nova avaliação/observação de desenvolvimento. Imutável após
 * criada: não há updateDevelopmentAssessment (mesma política de
 * growthMeasurements, Sprint 4) — ver documentacao/sprint-5-desenvolvimento.md.
 * `ageInDays` é calculado pelo chamador (src/lib/consultations/ageInDays.ts).
 */
export async function createDevelopmentAssessment(
  professionalId: string,
  payload: {
    childId: string;
    assessmentDate: string;
    ageInDays: number;
    milestones: DevelopmentMilestoneEntry[];
    observations?: string;
    requiresFollowUp: boolean;
  }
): Promise<DevelopmentAssessment> {
  const db = getFirebaseDb();
  const ref = doc(collection(db, COLLECTION));
  const now = new Date().toISOString();

  const assessment: DevelopmentAssessment = {
    id: ref.id,
    childId: payload.childId,
    professionalId,
    assessmentDate: payload.assessmentDate,
    ageInDays: payload.ageInDays,
    milestones: payload.milestones,
    observations: payload.observations,
    requiresFollowUp: payload.requiresFollowUp,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ref, {
    ...stripUndefined(assessment as unknown as Record<string, unknown>),
    _serverCreatedAt: serverTimestamp(),
  });

  return assessment;
}

/** Busca uma avaliação pelo ID. Retorna null se não existir. */
export async function getDevelopmentAssessment(id: string): Promise<DevelopmentAssessment | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return normalizeAssessment(snap.id, snap.data());
}

/**
 * Lista as avaliações de desenvolvimento de um profissional (todos os
 * pacientes), da mais antiga para a mais recente — mesmo raciocínio de
 * listGrowthMeasurementsByProfessional: volume pequeno por profissional,
 * sem necessidade de índice composto.
 */
export async function listDevelopmentAssessmentsByProfessional(
  professionalId: string
): Promise<DevelopmentAssessment[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, COLLECTION), where('professionalId', '==', professionalId));
  const snap = await getDocs(q);

  return snap.docs
    .map((d) => normalizeAssessment(d.id, d.data()))
    .sort((a, b) => a.assessmentDate.localeCompare(b.assessmentDate) || a.createdAt.localeCompare(b.createdAt));
}
