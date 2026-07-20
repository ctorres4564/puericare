/**
 * Agregador puro do Relatório Clínico longitudinal — Sprint B.1.
 *
 * Recebe as listas já carregadas (escopadas por profissional pelos services)
 * e monta o `ClinicalReportData` de forma DETERMINÍSTICA: nenhuma leitura de
 * relógio, nenhum acesso a banco, nenhuma interpretação clínica. A mesma
 * entrada sempre produz a mesma saída.
 *
 * Isolamento de dados: além de confiar no escopo das consultas dos services
 * (where professionalId == ...), cada registro é refiltrado aqui por
 * childId E professionalId — defesa em profundidade contra mistura de dados
 * de outra criança ou de outro profissional.
 */

import type {
  Child,
  UserProfile,
  Consultation,
  GrowthMeasurement,
  DevelopmentAssessment,
  FeedingRecord,
  SleepRecord,
  VaccinationRecord,
  ClinicalAlert,
  ClinicalReportData,
} from '@/lib/types';
import { buildTimeline } from '@/lib/children/timeline';
import { latestMeasurementByChild } from '@/lib/growth/latestMeasurement';
import { calculateAgeInDays } from '@/lib/consultations/ageInDays';

/** Entrada do agregador: dados brutos já carregados pelos services. */
export interface ClinicalReportInput {
  child: Child;
  /** Perfil do profissional responsável; null se o documento não existir */
  professional: UserProfile | null;
  consultations: Consultation[];
  measurements: GrowthMeasurement[];
  developmentAssessments: DevelopmentAssessment[];
  vaccinationRecords: VaccinationRecord[];
  feedingRecords: FeedingRecord[];
  sleepRecords: SleepRecord[];
  alerts: ClinicalAlert[];
  /** Data de referência (YYYY-MM-DD) para cálculo de idade */
  referenceDate: string;
  /** ISO 8601 — momento lógico de geração do relatório */
  generatedAt: string;
}

/** Ordena cópia da lista por data crescente, com desempate por createdAt. */
function byDateAsc<T>(items: T[], dateOf: (item: T) => string, createdAtOf: (item: T) => string): T[] {
  return [...items].sort((a, b) => dateOf(a).localeCompare(dateOf(b)) || createdAtOf(a).localeCompare(createdAtOf(b)));
}

/**
 * Monta o relatório clínico consolidado de uma criança.
 *
 * Todas as seções funcionam com coleções vazias: listas ficam vazias e
 * campos sem dado ficam null/undefined — nada é preenchido artificialmente.
 */
export function buildClinicalReport(input: ClinicalReportInput): ClinicalReportData {
  const { child, referenceDate, generatedAt } = input;

  // Defesa em profundidade: só entram registros desta criança E deste
  // profissional, mesmo que o chamador tenha passado listas mais amplas.
  const owned = <T extends { childId: string; professionalId: string }>(items: T[]): T[] =>
    items.filter((item) => item.childId === child.id && item.professionalId === child.professionalId);

  const consultations = byDateAsc(owned(input.consultations), (c) => c.consultationDate, (c) => c.createdAt);
  const measurements = byDateAsc(owned(input.measurements), (m) => m.measurementDate, (m) => m.createdAt);
  const assessments = byDateAsc(owned(input.developmentAssessments), (a) => a.assessmentDate, (a) => a.createdAt);
  const vaccinationRecords = byDateAsc(owned(input.vaccinationRecords), (v) => v.recordDate, (v) => v.createdAt);
  const feedingRecords = byDateAsc(owned(input.feedingRecords), (r) => r.recordDate, (r) => r.createdAt);
  const sleepRecords = byDateAsc(owned(input.sleepRecords), (r) => r.recordDate, (r) => r.createdAt);

  // Alertas: todos os status, do mais recente para o mais antigo.
  const alerts = owned(input.alerts).sort(
    (a, b) => b.detectedAt.localeCompare(a.detectedAt) || b.createdAt.localeCompare(a.createdAt)
  );

  // Mesma regra da página do paciente: só alertas ativos entram na timeline
  // (resolvidos/ignorados são histórico administrativo).
  const timeline = buildTimeline(
    consultations,
    measurements,
    assessments,
    vaccinationRecords,
    feedingRecords,
    sleepRecords,
    alerts.filter((a) => a.status === 'active')
  );

  return {
    patient: {
      id: child.id,
      fullName: child.fullName,
      socialName: child.socialName,
      birthDate: child.birthDate,
      ageInDays: calculateAgeInDays(child.birthDate, referenceDate),
      sexAtBirth: child.sexAtBirth,
      caregiverName: child.caregiverName,
      contactPhone: child.contactPhone,
      contactEmail: child.contactEmail,
      active: child.active,
    },
    professional: input.professional
      ? {
          uid: input.professional.uid,
          displayName: input.professional.displayName,
          crm: input.professional.crm,
          specialty: input.professional.specialty,
        }
      : null,
    perinatal: child.perinatalData ?? null,
    growth: {
      measurements,
      latest: latestMeasurementByChild(measurements).get(child.id) ?? null,
    },
    development: { assessments },
    feeding: { records: feedingRecords },
    sleep: { records: sleepRecords },
    vaccination: { records: vaccinationRecords },
    consultations,
    alerts,
    timeline,
    referenceDate,
    generatedAt,
  };
}
