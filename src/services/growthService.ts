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
import type { GrowthMeasurement } from '@/lib/types';

const COLLECTION = 'growthMeasurements';

/** Converte Timestamp do Firestore para ISO string, se necessário. */
function normalizeDate(val: unknown): string {
  return val instanceof Timestamp ? val.toDate().toISOString() : ((val as string) ?? '');
}

function normalizeMeasurement(id: string, data: Record<string, unknown>): GrowthMeasurement {
  return {
    ...data,
    id,
    createdAt: normalizeDate(data.createdAt),
    updatedAt: normalizeDate(data.updatedAt),
  } as GrowthMeasurement;
}

/**
 * Registra uma nova medição de crescimento. Medições são imutáveis: não há
 * updateGrowthMeasurement — cada registro é permanente (ver
 * documentacao/sprint-4-crescimento.md). `ageInDays` e `bmi` são calculados
 * pelo chamador (src/lib/consultations/ageInDays.ts e src/lib/growth/bmi.ts).
 */
export async function createGrowthMeasurement(
  professionalId: string,
  payload: {
    childId: string;
    measurementDate: string;
    ageInDays: number;
    weightKg?: number;
    heightCm?: number;
    headCircumferenceCm?: number;
    bmi?: number;
  }
): Promise<GrowthMeasurement> {
  const db = getFirebaseDb();
  const ref = doc(collection(db, COLLECTION));
  const now = new Date().toISOString();

  const measurement: GrowthMeasurement = {
    id: ref.id,
    childId: payload.childId,
    professionalId,
    measurementDate: payload.measurementDate,
    ageInDays: payload.ageInDays,
    weightKg: payload.weightKg,
    heightCm: payload.heightCm,
    headCircumferenceCm: payload.headCircumferenceCm,
    bmi: payload.bmi,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ref, {
    ...stripUndefined(measurement as unknown as Record<string, unknown>),
    _serverCreatedAt: serverTimestamp(),
  });

  return measurement;
}

/** Busca uma medição pelo ID. Retorna null se não existir. */
export async function getGrowthMeasurement(id: string): Promise<GrowthMeasurement | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return normalizeMeasurement(snap.id, snap.data());
}

/**
 * Lista as medições de um profissional (todos os pacientes), da mais antiga
 * para a mais recente — ordem natural para histórico longitudinal e para o
 * gráfico de evolução. Mesmo raciocínio de listChildrenByProfessional /
 * listConsultationsByProfessional: volume pequeno por profissional, sem
 * necessidade de índice composto.
 */
export async function listGrowthMeasurementsByProfessional(professionalId: string): Promise<GrowthMeasurement[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, COLLECTION), where('professionalId', '==', professionalId));
  const snap = await getDocs(q);

  return snap.docs
    .map((d) => normalizeMeasurement(d.id, d.data()))
    .sort((a, b) => a.measurementDate.localeCompare(b.measurementDate) || a.createdAt.localeCompare(b.createdAt));
}
