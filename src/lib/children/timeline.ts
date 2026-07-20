import type {
  Consultation,
  GrowthMeasurement,
  DevelopmentAssessment,
  VaccinationRecord,
  FeedingRecord,
  SleepRecord,
  ClinicalAlert,
} from '@/lib/types';

/**
 * Linha do tempo do paciente (Módulo 10 do planejamento): mescla consultas,
 * medições de crescimento, registros de desenvolvimento, vacinação,
 * alimentação, sono e alertas clínicos em ordem cronológica. Não cria
 * nenhuma coleção nova no Firestore — combinação em memória das listas já
 * existentes (decisão do Sprint 3, mantida).
 *
 * Alertas entram pela data de detecção (`detectedAt`) e só os ativos são
 * exibidos pela página — resolvidos/ignorados são histórico administrativo,
 * não evento clínico da linha do tempo.
 */
export type TimelineEntry =
  | { kind: 'consultation'; date: string; id: string; data: Consultation }
  | { kind: 'growthMeasurement'; date: string; id: string; data: GrowthMeasurement }
  | { kind: 'developmentAssessment'; date: string; id: string; data: DevelopmentAssessment }
  | { kind: 'vaccinationRecord'; date: string; id: string; data: VaccinationRecord }
  | { kind: 'feedingRecord'; date: string; id: string; data: FeedingRecord }
  | { kind: 'sleepRecord'; date: string; id: string; data: SleepRecord }
  | { kind: 'clinicalAlert'; date: string; id: string; data: ClinicalAlert };

export function buildTimeline(
  consultations: Consultation[],
  measurements: GrowthMeasurement[],
  developmentAssessments: DevelopmentAssessment[] = [],
  vaccinationRecords: VaccinationRecord[] = [],
  feedingRecords: FeedingRecord[] = [],
  sleepRecords: SleepRecord[] = [],
  alerts: ClinicalAlert[] = []
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
    ...feedingRecords.map(
      (r): TimelineEntry => ({ kind: 'feedingRecord', date: r.recordDate, id: r.id, data: r })
    ),
    ...sleepRecords.map(
      (r): TimelineEntry => ({ kind: 'sleepRecord', date: r.recordDate, id: r.id, data: r })
    ),
    ...alerts.map(
      (a): TimelineEntry => ({ kind: 'clinicalAlert', date: a.detectedAt.slice(0, 10), id: a.id, data: a })
    ),
  ];

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
