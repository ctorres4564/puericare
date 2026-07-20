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
import type { VaccinationRecord, VaccinationStatus } from '@/lib/types';

const COLLECTION = 'vaccinationRecords';

function normalizeDate(val: unknown): string {
  return val instanceof Timestamp ? val.toDate().toISOString() : ((val as string) ?? '');
}

function normalizeRecord(id: string, data: Record<string, unknown>): VaccinationRecord {
  return {
    ...data,
    id,
    createdAt: normalizeDate(data.createdAt),
    updatedAt: normalizeDate(data.updatedAt),
  } as VaccinationRecord;
}

/**
 * Registra uma nova observação/dose de vacinação. Imutável após criada —
 * mesma política das demais entidades clínicas do Sprint 4-6. Quando
 * `scheduleKey` é informado, a dose é casada com o calendário PNI
 * (lib/vaccination/schedule.ts); registros sem ela são casados por nome.
 */
export async function createVaccinationRecord(
  professionalId: string,
  payload: {
    childId: string;
    recordDate: string;
    ageInDays: number;
    status: VaccinationStatus;
    scheduleKey?: string;
    vaccineName?: string;
    doseDescription?: string;
    lot?: string;
    facility?: string;
    observations?: string;
  }
): Promise<VaccinationRecord> {
  const db = getFirebaseDb();
  const ref = doc(collection(db, COLLECTION));
  const now = new Date().toISOString();

  const record: VaccinationRecord = {
    id: ref.id,
    childId: payload.childId,
    professionalId,
    recordDate: payload.recordDate,
    ageInDays: payload.ageInDays,
    status: payload.status,
    scheduleKey: payload.scheduleKey,
    vaccineName: payload.vaccineName,
    doseDescription: payload.doseDescription,
    lot: payload.lot,
    facility: payload.facility,
    observations: payload.observations,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ref, {
    ...stripUndefined(record as unknown as Record<string, unknown>),
    _serverCreatedAt: serverTimestamp(),
  });

  return record;
}

export async function getVaccinationRecord(id: string): Promise<VaccinationRecord | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return normalizeRecord(snap.id, snap.data());
}

/** Lista os registros de um profissional, do mais antigo para o mais recente. */
export async function listVaccinationRecordsByProfessional(professionalId: string): Promise<VaccinationRecord[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, COLLECTION), where('professionalId', '==', professionalId));
  const snap = await getDocs(q);

  return snap.docs
    .map((d) => normalizeRecord(d.id, d.data()))
    .sort((a, b) => a.recordDate.localeCompare(b.recordDate) || a.createdAt.localeCompare(b.createdAt));
}
