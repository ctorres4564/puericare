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
import type { FeedingRecord } from '@/lib/types';

const COLLECTION = 'feedingRecords';

function normalizeDate(val: unknown): string {
  return val instanceof Timestamp ? val.toDate().toISOString() : ((val as string) ?? '');
}

function normalizeRecord(id: string, data: Record<string, unknown>): FeedingRecord {
  return {
    ...data,
    id,
    createdAt: normalizeDate(data.createdAt),
    updatedAt: normalizeDate(data.updatedAt),
  } as FeedingRecord;
}

/**
 * Registra uma nova observação de alimentação. Imutável após criada — mesma
 * política de growthMeasurements/developmentAssessments (Sprints 4/5): sem
 * updateFeedingRecord.
 */
export async function createFeedingRecord(
  professionalId: string,
  payload: {
    childId: string;
    recordDate: string;
    ageInDays: number;
    feedingHistory?: string;
    routine?: string;
    foodIntroduction?: string;
    difficulties?: string;
    observations?: string;
    requiresFollowUp: boolean;
  }
): Promise<FeedingRecord> {
  const db = getFirebaseDb();
  const ref = doc(collection(db, COLLECTION));
  const now = new Date().toISOString();

  const record: FeedingRecord = {
    id: ref.id,
    childId: payload.childId,
    professionalId,
    recordDate: payload.recordDate,
    ageInDays: payload.ageInDays,
    feedingHistory: payload.feedingHistory,
    routine: payload.routine,
    foodIntroduction: payload.foodIntroduction,
    difficulties: payload.difficulties,
    observations: payload.observations,
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

export async function getFeedingRecord(id: string): Promise<FeedingRecord | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return normalizeRecord(snap.id, snap.data());
}

/** Lista os registros de um profissional, do mais antigo para o mais recente. */
export async function listFeedingRecordsByProfessional(professionalId: string): Promise<FeedingRecord[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, COLLECTION), where('professionalId', '==', professionalId));
  const snap = await getDocs(q);

  return snap.docs
    .map((d) => normalizeRecord(d.id, d.data()))
    .sort((a, b) => a.recordDate.localeCompare(b.recordDate) || a.createdAt.localeCompare(b.createdAt));
}
