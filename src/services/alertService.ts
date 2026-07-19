/**
 * services/alertService.ts — CRUD da coleção `clinicalAlerts` no Firestore.
 *
 * Os alertas são gerados pelo engine (lib/alerts/engine.ts) e persistidos
 * aqui. O service também permite listar, resolver e ignorar alertas.
 */

import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/firestore';
import type {
  ClinicalAlert,
  CreateAlertPayload,
  ResolveAlertPayload,
  AlertStatus,
} from '@/lib/types';

const COLLECTION = 'clinicalAlerts';

/** Gera um ID único para o alerta baseado na criança e na regra (idempotência). */
export function buildAlertId(childId: string, ruleId: string): string {
  return `${childId}_${ruleId}`;
}

/**
 * Cria ou atualiza um alerta no Firestore.
 * Usa ID determinístico (childId + ruleId) para garantir idempotência —
 * o mesmo alerta não é duplicado em execuções consecutivas do motor.
 */
export async function upsertAlert(payload: CreateAlertPayload): Promise<ClinicalAlert> {
  const db = getFirebaseDb();
  const id = buildAlertId(payload.childId, payload.ruleId);
  const now = new Date().toISOString();

  const alert: ClinicalAlert = {
    ...payload,
    id,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, COLLECTION, id), {
    ...alert,
    _serverUpdatedAt: serverTimestamp(),
  });

  return alert;
}

/**
 * Resolve ou ignora um alerta ativo.
 * Só altera status, resolvedAt e resolutionNote — não recria o documento.
 */
export async function resolveAlert(
  alertId: string,
  payload: ResolveAlertPayload
): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, COLLECTION, alertId), {
    status: payload.status,
    resolvedAt: new Date().toISOString(),
    resolutionNote: payload.resolutionNote ?? null,
    updatedAt: new Date().toISOString(),
    _serverUpdatedAt: serverTimestamp(),
  });
}

/**
 * Lista todos os alertas de um profissional, filtrando por status opcional.
 */
export async function listAlertsByProfessional(
  professionalId: string,
  status?: AlertStatus
): Promise<ClinicalAlert[]> {
  const db = getFirebaseDb();
  const col = collection(db, COLLECTION);

  const constraints = status
    ? [where('professionalId', '==', professionalId), where('status', '==', status)]
    : [where('professionalId', '==', professionalId)];

  const snap = await getDocs(query(col, ...constraints));
  return snap.docs.map((d) => d.data() as ClinicalAlert);
}

/**
 * Lista alertas ativos de uma criança específica.
 */
export async function listActiveAlertsByChild(childId: string): Promise<ClinicalAlert[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('childId', '==', childId),
      where('status', '==', 'active')
    )
  );
  return snap.docs.map((d) => d.data() as ClinicalAlert);
}

/**
 * Conta alertas ativos de um profissional (para badge na sidebar).
 */
export async function countActiveAlerts(professionalId: string): Promise<number> {
  const alerts = await listAlertsByProfessional(professionalId, 'active');
  return alerts.length;
}
