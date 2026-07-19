import type {
  Child,
  Consultation,
  DevelopmentAssessment,
  FeedingRecord,
  SleepRecord,
  VaccinationRecord,
  VaccinationStatus,
} from '@/lib/types';

/**
 * Estatísticas do dashboard — agregações simples e determinísticas sobre
 * dados já registrados pelo profissional. Nenhum cálculo clínico, alerta
 * automático ou inferência é feito aqui: tudo é contagem direta do que o
 * próprio profissional já registrou (ex.: `requiresFollowUp`, status de
 * vacinação já lançado). O motor de alertas "de verdade" (Sprint 7 do
 * planejamento) ainda não existe.
 */

export function countActiveChildren(children: Child[]): number {
  return children.filter((c) => c.active).length;
}

/** Consultas (não canceladas) com consultationDate igual à data informada (YYYY-MM-DD). */
export function countConsultationsOnDate(consultations: Consultation[], date: string): number {
  return consultations.filter((c) => c.status !== 'cancelled' && c.consultationDate === date).length;
}

/**
 * Soma de registros marcados manualmente pelo profissional como "necessita
 * acompanhamento" (desenvolvimento, alimentação, sono). Não é um alerta
 * automático — é a contagem do que já foi sinalizado por quem atende.
 */
export function countRequiringFollowUp(
  developmentAssessments: DevelopmentAssessment[],
  feedingRecords: FeedingRecord[],
  sleepRecords: SleepRecord[]
): number {
  return (
    developmentAssessments.filter((a) => a.requiresFollowUp).length +
    feedingRecords.filter((r) => r.requiresFollowUp).length +
    sleepRecords.filter((r) => r.requiresFollowUp).length
  );
}

/**
 * Quantas crianças têm, no registro de vacinação MAIS RECENTE, o status
 * informado — não é um cálculo de calendário (não existe calendário oficial
 * neste MVP, ver documentacao/sprint-6-alimentacao-sono-vacinacao.md), é
 * literalmente o último status que o profissional avaliou para cada criança.
 */
export function countChildrenWithLatestVaccinationStatus(
  vaccinationRecords: VaccinationRecord[],
  status: VaccinationStatus
): number {
  const latestByChild = new Map<string, VaccinationRecord>();

  for (const record of vaccinationRecords) {
    const current = latestByChild.get(record.childId);
    const isNewer =
      !current ||
      record.recordDate > current.recordDate ||
      (record.recordDate === current.recordDate && record.createdAt > current.createdAt);
    if (isNewer) latestByChild.set(record.childId, record);
  }

  return Array.from(latestByChild.values()).filter((r) => r.status === status).length;
}

/** As `limit` consultas (não canceladas) mais recentes, mais nova primeiro. */
export function recentConsultations(consultations: Consultation[], limit: number): Consultation[] {
  return [...consultations]
    .filter((c) => c.status !== 'cancelled')
    .sort((a, b) => b.consultationDate.localeCompare(a.consultationDate) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
