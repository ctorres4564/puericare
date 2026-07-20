/**
 * services/reportService.ts — Persistência, versionamento e histórico do
 * Relatório Clínico (coleção `reports`) — Sprint B.4.
 *
 * Única porta de entrada para o ciclo de vida DRAFT → ISSUED. A UI nunca
 * escreve diretamente no Firestore (ver `documentacao/sprint-b4-...md`).
 *
 * Regras de negócio aplicadas aqui (reforçadas por firestore.rules):
 * - DRAFT pode ser atualizado pelo profissional dono; ISSUED é imutável.
 * - Versão é atribuída atomicamente na emissão via `runTransaction` + um
 *   contador por criança (`reportCounters/{childId}`) — duas emissões
 *   concorrentes nunca recebem a mesma versão.
 * - Concorrência em rascunhos: `updateDraftReport` exige `expectedUpdatedAt`
 *   e lança `ReportConflictError` se o documento mudou entre a leitura e a
 *   gravação (optimistic concurrency).
 * - Dados clínicos NUNCA são congelados em DRAFT — são sempre recarregados
 *   do prontuário atual via `getClinicalReportData` (Sprint B.1). Só na
 *   emissão o snapshot (`clinicalDataSnapshot` + `pdfModelSnapshot`) é
 *   congelado definitivamente.
 */

import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/firestore';
import { stripUndefined } from '@/lib/firebase/utils';
import { getClinicalReportData } from '@/services/clinicalReportService';
import { createInitialComposition, type ReportComposition } from '@/lib/reports/composition';
import { buildReportPdfModel } from '@/lib/reports/pdfModel';
import {
  CLINICAL_REPORT_SCHEMA_VERSION,
  CLINICAL_REPORT_RENDERER_VERSION,
  DEFAULT_REPORT_TITLE,
  type ClinicalReportRecord,
  type CreateReportDraftPayload,
  type UpdateReportDraftPayload,
  type IssueReportPayload,
} from '@/lib/types';

const COLLECTION = 'reports';
const COUNTERS_COLLECTION = 'reportCounters';

/** Lançado quando um rascunho foi alterado em outra sessão desde o último carregamento. */
export class ReportConflictError extends Error {
  constructor() {
    super('Este rascunho foi alterado em outra sessão. Recarregue antes de salvar.');
    this.name = 'ReportConflictError';
  }
}

function normalizeRecord(id: string, data: Record<string, unknown>): ClinicalReportRecord {
  // Remove os campos sidecar `_server*` (só existem para auditoria server-side).
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith('_server')) clean[key] = value;
  }
  return { ...clean, id } as ClinicalReportRecord;
}

/**
 * Cria um novo relatório em DRAFT. Se `composition` não for informado, monta
 * a composição inicial a partir dos dados clínicos atuais (Sprint B.1/B.2).
 */
export async function createDraftReport(
  professionalId: string,
  payload: CreateReportDraftPayload
): Promise<ClinicalReportRecord> {
  const clinicalData = await getClinicalReportData(payload.childId, professionalId);
  if (!clinicalData) {
    throw new Error('Paciente não encontrado ou não pertence a este profissional.');
  }

  const db = getFirebaseDb();
  const composition = payload.composition ?? createInitialComposition(clinicalData);
  const ref = doc(collection(db, COLLECTION));
  const now = new Date().toISOString();

  const record: ClinicalReportRecord = {
    id: ref.id,
    childId: payload.childId,
    professionalId,
    version: 0,
    status: 'DRAFT',
    title: payload.title?.trim() || DEFAULT_REPORT_TITLE,
    createdAt: now,
    createdBy: professionalId,
    updatedAt: now,
    updatedBy: professionalId,
    sourceReferenceDate: now.slice(0, 10),
    compositionSnapshot: composition,
    previousVersionId: payload.previousVersionId,
    schemaVersion: CLINICAL_REPORT_SCHEMA_VERSION,
    rendererVersion: CLINICAL_REPORT_RENDERER_VERSION,
  };

  await setDoc(ref, {
    ...stripUndefined(record as unknown as Record<string, unknown>),
    _serverCreatedAt: serverTimestamp(),
    _serverUpdatedAt: serverTimestamp(),
  });

  return record;
}

export async function getReport(reportId: string): Promise<ClinicalReportRecord | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, COLLECTION, reportId));
  if (!snap.exists()) return null;
  return normalizeRecord(snap.id, snap.data()!);
}

/**
 * Lista os relatórios de uma criança (rascunhos e emitidos), mais recente
 * primeiro: rascunho(s) primeiro (é o documento "em andamento"), depois
 * emitidos em ordem decrescente de versão.
 */
export async function listReportsByChild(
  childId: string,
  professionalId: string
): Promise<ClinicalReportRecord[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(
    query(collection(db, COLLECTION), where('childId', '==', childId), where('professionalId', '==', professionalId))
  );
  const records = snap.docs.map((d) => normalizeRecord(d.id, d.data()));

  return records.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'DRAFT' ? -1 : 1;
    if (a.status === 'ISSUED') return b.version - a.version;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

/** Retorna o rascunho existente da criança (se houver) ou cria um novo — usado pela tela de composição. */
export async function getOrCreateDraftReport(
  professionalId: string,
  childId: string
): Promise<ClinicalReportRecord> {
  const existing = (await listReportsByChild(childId, professionalId)).find((r) => r.status === 'DRAFT');
  if (existing) return existing;
  return createDraftReport(professionalId, { childId });
}

/**
 * Salva um rascunho existente. Exige `expectedUpdatedAt` igual ao valor
 * atualmente persistido — caso contrário, lança `ReportConflictError`
 * (alguém salvou em outra sessão/aba desde o último carregamento).
 */
export async function updateDraftReport(
  reportId: string,
  professionalId: string,
  payload: UpdateReportDraftPayload
): Promise<ClinicalReportRecord> {
  const db = getFirebaseDb();

  return runTransaction(db, async (tx) => {
    const ref = doc(db, COLLECTION, reportId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Relatório não encontrado.');
    const current = normalizeRecord(snap.id, snap.data()!);

    if (current.professionalId !== professionalId) {
      throw new Error('Este relatório não pertence a este profissional.');
    }
    if (current.status !== 'DRAFT') {
      throw new Error('Relatório emitido não pode ser editado.');
    }
    if (current.updatedAt !== payload.expectedUpdatedAt) {
      throw new ReportConflictError();
    }

    const now = new Date().toISOString();
    const updates = {
      compositionSnapshot: payload.composition,
      title: payload.title.trim() || current.title,
      sourceReferenceDate: now.slice(0, 10),
      updatedAt: now,
      updatedBy: professionalId,
      _serverUpdatedAt: serverTimestamp(),
    };
    tx.update(ref, updates);
    return normalizeRecord(reportId, { ...current, ...updates });
  });
}

/**
 * Emite o relatório: recarrega os dados clínicos atuais (última chance de
 * revisão antes do congelamento), monta o modelo de PDF, atribui a próxima
 * versão de forma atômica (contador por criança) e persiste o snapshot
 * completo como ISSUED — irreversível a partir daqui.
 */
export async function issueReport(
  reportId: string,
  professionalId: string,
  payload: IssueReportPayload
): Promise<ClinicalReportRecord> {
  const title = payload.title.trim();
  if (!title) {
    throw new Error('O título do relatório não pode ficar vazio.');
  }

  const db = getFirebaseDb();
  const draftSnap = await getDoc(doc(db, COLLECTION, reportId));
  if (!draftSnap.exists()) throw new Error('Relatório não encontrado.');
  const draft = normalizeRecord(draftSnap.id, draftSnap.data()!);

  if (draft.professionalId !== professionalId) {
    throw new Error('Este relatório não pertence a este profissional.');
  }
  if (draft.status !== 'DRAFT') {
    throw new Error('Este relatório já foi emitido.');
  }

  // Última leitura do prontuário antes do congelamento definitivo.
  const clinicalData = await getClinicalReportData(draft.childId, professionalId);
  if (!clinicalData) {
    throw new Error('Paciente não encontrado ou não pertence a este profissional.');
  }

  const finalComposition: ReportComposition = {
    ...draft.compositionSnapshot,
    institutional: { ...draft.compositionSnapshot.institutional, reportDate: clinicalData.referenceDate },
  };
  const pdfModel = buildReportPdfModel(clinicalData, finalComposition);

  return runTransaction(db, async (tx) => {
    const reportRef = doc(db, COLLECTION, reportId);
    const counterRef = doc(db, COUNTERS_COLLECTION, draft.childId);

    const reportSnap = await tx.get(reportRef);
    const counterSnap = await tx.get(counterRef);
    if (!reportSnap.exists()) throw new Error('Relatório não encontrado.');
    const current = normalizeRecord(reportSnap.id, reportSnap.data()!);
    if (current.status !== 'DRAFT') {
      throw new Error('Este relatório já foi emitido.');
    }

    const counterData = counterSnap.exists() ? (counterSnap.data() as { lastIssuedVersion?: number }) : undefined;
    const nextVersion = (counterData?.lastIssuedVersion ?? 0) + 1;
    const now = new Date().toISOString();

    const updates = {
      status: 'ISSUED' as const,
      version: nextVersion,
      title,
      issuedAt: now,
      issuedBy: professionalId,
      sourceReferenceDate: clinicalData.referenceDate,
      compositionSnapshot: finalComposition,
      clinicalDataSnapshot: clinicalData,
      pdfModelSnapshot: pdfModel,
      updatedAt: now,
      updatedBy: professionalId,
      schemaVersion: CLINICAL_REPORT_SCHEMA_VERSION,
      rendererVersion: CLINICAL_REPORT_RENDERER_VERSION,
    };

    tx.set(counterRef, { lastIssuedVersion: nextVersion, updatedAt: now });
    tx.update(reportRef, { ...stripUndefined(updates), _serverIssuedAt: serverTimestamp(), _serverUpdatedAt: serverTimestamp() });

    return normalizeRecord(reportId, { ...current, ...updates });
  });
}

/**
 * Cria uma nova versão (novo DRAFT) a partir de um relatório emitido:
 * seções e textos anteriores são copiados (editáveis); dados clínicos serão
 * recarregados do prontuário atual quando este novo rascunho for emitido.
 * O relatório anterior permanece exatamente como foi emitido.
 */
export async function createNewVersion(
  previousReportId: string,
  professionalId: string
): Promise<ClinicalReportRecord> {
  const previous = await getReport(previousReportId);
  if (!previous || previous.professionalId !== professionalId) {
    throw new Error('Relatório anterior não encontrado ou não pertence a este profissional.');
  }
  if (previous.status !== 'ISSUED') {
    throw new Error('Só é possível criar uma nova versão a partir de um relatório emitido.');
  }

  return createDraftReport(professionalId, {
    childId: previous.childId,
    title: previous.title,
    composition: previous.compositionSnapshot,
    previousVersionId: previous.id,
  });
}

/** Exclui um rascunho próprio. Relatórios emitidos nunca são excluídos por aqui. */
export async function deleteDraftReport(reportId: string, professionalId: string): Promise<void> {
  const record = await getReport(reportId);
  if (!record) return;
  if (record.professionalId !== professionalId) {
    throw new Error('Este relatório não pertence a este profissional.');
  }
  if (record.status !== 'DRAFT') {
    throw new Error('Relatório emitido não pode ser excluído.');
  }
  const db = getFirebaseDb();
  await deleteDoc(doc(db, COLLECTION, reportId));
}
