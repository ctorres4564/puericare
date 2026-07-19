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
import type { SleepRecord } from '@/lib/types';

const COLLECTION = 'sleepRecords';

function normalizeDate(val: unknown): string {
  return val instanceof Timestamp ? val.toDate().toISOString() : ((val as string) ?? '');
}

function normalizeRecord(id: string, data: Record<string, unknown>): SleepRecord {
  return {
    ...data,
    id,
    createdAt: normalizeDate(data.createdAt),
    updatedAt: normalizeDate(data.updatedAt),
  } as SleepRecord;
}

/**
 * Registra uma nova observação de sono. Imutável após criada — mesma
 * política de growthMeasurements/developmentAssessments/feedingRecords:
 * sem updateSleepRecord.
 */
export async function createSleepRecord(
  professionalId: string,
  payload: {
    childId: string;
    recordDate: string;
    ageInDays: number;
    bedtime?: string;
    nightWakings?: number;
    sleepDurationHours?: number;
    naps?: string;
    routine?: string;
    observations?: string;
    difficulties?: string;
    requiresFollowUp: boolean;
  }
): Promise<SleepRecord> {
  const db = getFirebaseDb();
  const ref = doc(collection(db, COLLECTION));
  const now = new Date().toISOString();

  const record: SleepRecord = {
    id: ref.id,
    childId: payload.childId,
    professionalId,
    recordDate: payload.recordDate,
    ageInDays: payload.ageInDays,
    bedtime: payload.bedtime,
    nightWakings: payload.nightWakings,
    sleepDurationHours: payload.sleepDurationHours,
    naps: payload.naps,
    routine: payload.routine,
    observations: payload.observations,
    difficulties: payload.difficulties,
    requiresFollowUp: payload.requiresFollowUp,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ref, {
    ...stripUndefined(record as unknown as Record<string, unknown>),
    _serverCreatedAt: serverTimestamp(),
  });

  return record;
}

export async function getSleepRecord(id: string): Promise<SleepRecord | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return normalizeRecord(snap.id, snap.data());
}

/** Lista os registros de um profissional, do mais antigo para o mais recente. */
export async function listSleepRecordsByProfessional(professionalId: string): Promise<SleepRecord[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, COLLECTION), where('professionalId', '==', professionalId));
  const snap = await getDocs(q);

  return snap.docs
    .map((d) => normalizeRecord(d.id, d.data()))
    .sort((a, b) => a.recordDate.localeCompare(b.recordDate) || a.createdAt.localeCompare(b.createdAt));
}
