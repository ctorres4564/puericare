/**
 * Service do Relatório Clínico longitudinal — Sprint B.1.
 *
 * ÚNICA porta de entrada para obter o `ClinicalReportData` de uma criança:
 * carrega as coleções existentes pelos services já validados (todos com
 * escopo `where professionalId == ...`, protegidos pelas regras do
 * Firestore) e delega a consolidação ao agregador puro
 * `buildClinicalReport` (lib/reports/clinicalReport.ts).
 *
 * Não cria coleção nova, não altera regras do Firestore e não adiciona
 * dependências — apenas leitura + composição em memória.
 */

import { getChild } from '@/services/childService';
import { getUserProfile } from '@/services/userService';
import { listConsultationsByProfessional } from '@/services/consultationService';
import { listGrowthMeasurementsByProfessional } from '@/services/growthService';
import { listDevelopmentAssessmentsByProfessional } from '@/services/developmentService';
import { listVaccinationRecordsByProfessional } from '@/services/vaccinationService';
import { listFeedingRecordsByProfessional } from '@/services/feedingService';
import { listSleepRecordsByProfessional } from '@/services/sleepService';
import { listAlertsByProfessional } from '@/services/alertService';
import { buildClinicalReport } from '@/lib/reports/clinicalReport';
import type { ClinicalReportData } from '@/lib/types';

/**
 * Monta o relatório clínico de uma criança.
 *
 * Retorna null quando a criança não existe ou não pertence ao profissional
 * informado — mesma política de acesso da página do paciente ("não expor
 * se o cadastro existe para quem não é dono"). O isolamento entre
 * profissionais é garantido pelas regras do Firestore e reforçado pelo
 * filtro do agregador.
 */
export async function getClinicalReportData(
  childId: string,
  professionalId: string
): Promise<ClinicalReportData | null> {
  const child = await getChild(childId);
  if (!child || child.professionalId !== professionalId) return null;

  const [
    professional,
    consultations,
    measurements,
    developmentAssessments,
    vaccinationRecords,
    feedingRecords,
    sleepRecords,
    alerts,
  ] = await Promise.all([
    getUserProfile(professionalId),
    listConsultationsByProfessional(professionalId),
    listGrowthMeasurementsByProfessional(professionalId),
    listDevelopmentAssessmentsByProfessional(professionalId),
    listVaccinationRecordsByProfessional(professionalId),
    listFeedingRecordsByProfessional(professionalId),
    listSleepRecordsByProfessional(professionalId),
    listAlertsByProfessional(professionalId),
  ]);

  const now = new Date();
  return buildClinicalReport({
    child,
    professional,
    consultations,
    measurements,
    developmentAssessments,
    vaccinationRecords,
    feedingRecords,
    sleepRecords,
    alerts,
    referenceDate: now.toISOString().slice(0, 10),
    generatedAt: now.toISOString(),
  });
}
