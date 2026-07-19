import type { Consultation, GrowthMeasurement, DevelopmentAssessment, VaccinationRecord } from '@/lib/types';

/**
 * Linha do tempo do paciente (Módulo 10 do planejamento): mescla consultas,
 * medições de crescimento, registros de desenvolvimento e vacinação em
 * ordem cronológica. Alimentação e sono ficam de fora da linha do tempo
 * compartilhada nesta etapa — o Módulo 10 só lista "medidas" e "vacinas"
 * explicitamente, não alimentação/sono (ver
 * documentacao/sprint-6-alimentacao-sono-vacinacao.md). Não cria nenhuma
 * coleção nova no Firestore — combinação em memória das listas já
 * existentes (decisão do Sprint 3, mantida).
 */
export type TimelineEntry =
  | { kind: 'consultation'; date: string; id: string; data: Consultation }
  | { kind: 'growthMeasurement'; date: string; id: string; data: GrowthMeasurement }
  | { kind: 'developmentAssessment'; date: string; id: string; data: DevelopmentAssessment }
  | { kind: 'vaccinationRecord'; date: string; id: string; data: VaccinationRecord };

export function buildTimeline(
  consultations: Consultation[],
  measurements: GrowthMeasurement[],
  developmentAssessments: DevelopmentAssessment[] = [],
  vaccinationRecords: VaccinationRecord[] = []
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...consultations
      .filter((c) => c.status !== 'cancelled')
      .map((c): TimelineEntry => ({ kind: 'consultation', date: c.consultationDate, id: c.id, data: c })),
    ...measurements.map((m): TimelineEntry => ({ kind: 'growthMeasurement', date: m.measurementDate, id: m.id, data: m })),
    ...developmentAssessments.map(
      (a): TimelineEntry => ({ kind: 'developmentAssessment', date: a.assessmentDate, id: a.id, data: a })
    ),
    ...vaccinationRecords.map(
      (v): TimelineEntry => ({ kind: 'vaccinationRecord', date: v.recordDate, id: v.id, data: v })
    ),
  ];

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
