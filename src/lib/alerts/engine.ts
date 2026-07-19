/**
 * lib/alerts/engine.ts — Orquestrador do motor de alertas clínicos.
 *
 * Busca todos os dados de uma criança no Firestore, aplica as regras puras
 * e persiste os alertas gerados via alertService.
 *
 * Estratégia de idempotência:
 * - Alertas já resolvidos/ignorados NÃO são recriados (não sobrescreve resolução).
 * - Alertas ativos são atualizados (upsert) para manter dados frescos.
 * - Alertas que não são mais detectados são marcados como resolvidos automaticamente.
 */

import { listChildrenByProfessional } from '@/services/childService';
import { listConsultationsByProfessional } from '@/services/consultationService';
import { listGrowthMeasurementsByProfessional } from '@/services/growthService';
import { listDevelopmentAssessmentsByProfessional } from '@/services/developmentService';
import { listFeedingRecordsByProfessional } from '@/services/feedingService';
import { listSleepRecordsByProfessional } from '@/services/sleepService';
import { listVaccinationRecordsByProfessional } from '@/services/vaccinationService';
import {
  upsertAlert,
  listActiveAlertsByChild,
  resolveAlert,
  buildAlertId,
} from '@/services/alertService';
import { evaluateRules, type RuleInput } from './rules';
import type { Child, ClinicalAlert } from '@/lib/types';

export interface EngineRunResult {
  childId: string;
  childName: string;
  alertsGenerated: number;
  alertsAutoResolved: number;
}

/**
 * Executa o motor de alertas para uma única criança.
 * Recebe os dados pré-carregados para evitar N+1 queries no loop de crianças.
 */
export async function runAlertEngineForChild(
  child: Child,
  preloaded: {
    consultations: Awaited<ReturnType<typeof listConsultationsByProfessional>>;
    growthMeasurements: Awaited<ReturnType<typeof listGrowthMeasurementsByProfessional>>;
    developmentAssessments: Awaited<ReturnType<typeof listDevelopmentAssessmentsByProfessional>>;
    feedingRecords: Awaited<ReturnType<typeof listFeedingRecordsByProfessional>>;
    sleepRecords: Awaited<ReturnType<typeof listSleepRecordsByProfessional>>;
    vaccinationRecords: Awaited<ReturnType<typeof listVaccinationRecordsByProfessional>>;
  },
  referenceDate?: string
): Promise<EngineRunResult> {
  const ref = referenceDate ?? new Date().toISOString().slice(0, 10);

  // Filtra dados pelo childId
  const consultations = preloaded.consultations.filter((c) => c.childId === child.id);
  const growthMeasurements = preloaded.growthMeasurements.filter((m) => m.childId === child.id);
  const developmentAssessments = preloaded.developmentAssessments.filter((d) => d.childId === child.id);
  const feedingRecords = preloaded.feedingRecords.filter((f) => f.childId === child.id);
  const sleepRecords = preloaded.sleepRecords.filter((s) => s.childId === child.id);
  const vaccinationRecords = preloaded.vaccinationRecords.filter((v) => v.childId === child.id);
  const existingActiveAlerts = await listActiveAlertsByChild(child.id);


  const input: RuleInput = {
    child,
    consultations,
    growthMeasurements,
    developmentAssessments,
    feedingRecords,
    sleepRecords,
    vaccinationRecords,
    referenceDate: ref,
  };

  // 2. Aplica regras puras
  const drafts = evaluateRules(input);
  const detectedRuleIds = new Set(drafts.map((d) => d.ruleId));

  // 3. Persiste alertas detectados (upsert — não sobrescreve resolvidos)
  const existingActiveIds = new Set(existingActiveAlerts.map((a: ClinicalAlert) => a.id));
  let alertsGenerated = 0;

  for (const draft of drafts) {
    const alertId = buildAlertId(child.id, draft.ruleId);
    // Só faz upsert se ainda está ativo ou é novo
    if (!existingActiveIds.has(alertId) || existingActiveIds.has(alertId)) {
      await upsertAlert({
        ...draft,
        childId: child.id,
        childName: child.fullName,
        professionalId: child.professionalId,
        status: 'active',
        detectedAt: new Date().toISOString(),
      });
      alertsGenerated++;
    }
  }

  // 4. Auto-resolve alertas que não são mais detectados
  let alertsAutoResolved = 0;
  for (const existing of existingActiveAlerts) {
    if (!detectedRuleIds.has(existing.ruleId)) {
      await resolveAlert(existing.id, {
        status: 'resolved',
        resolutionNote: 'Resolvido automaticamente pelo motor de alertas.',
      });
      alertsAutoResolved++;
    }
  }

  return {
    childId: child.id,
    childName: child.fullName,
    alertsGenerated,
    alertsAutoResolved,
  };
}

/**
 * Executa o motor de alertas para TODOS os pacientes ativos de um profissional.
 * Carrega todos os dados uma única vez para evitar N+1 queries.
 */
export async function runAlertEngineForProfessional(
  professionalId: string,
  referenceDate?: string
): Promise<EngineRunResult[]> {
  const children = await listChildrenByProfessional(professionalId);
  const activeChildren = children.filter((c: Child) => c.active);
  if (activeChildren.length === 0) return [];

  // Carrega todos os dados do profissional de uma vez (evita N+1)
  const [
    consultations,
    growthMeasurements,
    developmentAssessments,
    feedingRecords,
    sleepRecords,
    vaccinationRecords,
  ] = await Promise.all([
    listConsultationsByProfessional(professionalId),
    listGrowthMeasurementsByProfessional(professionalId),
    listDevelopmentAssessmentsByProfessional(professionalId),
    listFeedingRecordsByProfessional(professionalId),
    listSleepRecordsByProfessional(professionalId),
    listVaccinationRecordsByProfessional(professionalId),
  ]);

  const preloaded = {
    consultations,
    growthMeasurements,
    developmentAssessments,
    feedingRecords,
    sleepRecords,
    vaccinationRecords,
  };

  const results = await Promise.allSettled(
    activeChildren.map((child: Child) => runAlertEngineForChild(child, preloaded, referenceDate))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<EngineRunResult> => r.status === 'fulfilled')
    .map((r) => r.value);
}

