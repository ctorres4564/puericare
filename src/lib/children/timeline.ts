import type { Consultation, GrowthMeasurement, DevelopmentAssessment } from '@/lib/types';

/**
 * Linha do tempo do paciente (Módulo 10 do planejamento): mescla consultas,
 * medições de crescimento e registros de desenvolvimento em ordem
 * cronológica. Não cria nenhuma coleção nova no Firestore — é só uma
 * combinação em memória das listas já existentes (decisão do Sprint 3,
 * mantida: sem `timelineEvents` genérico enquanto poucos produtores de
 * eventos existirem).
 */
export type TimelineEntry =
  | { kind: 'consultation'; date: string; id: string; data: Consultation }
  | { kind: 'growthMeasurement'; date: string; id: string; data: GrowthMeasurement }
  | { kind: 'developmentAssessment'; date: string; id: string; data: DevelopmentAssessment };

export function buildTimeline(
  consultations: Consultation[],
  measurements: GrowthMeasurement[],
  developmentAssessments: DevelopmentAssessment[] = []
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...consultations
      .filter((c) => c.status !== 'cancelled')
      .map((c): TimelineEntry => ({ kind: 'consultation', date: c.consultationDate, id: c.id, data: c })),
    ...measurements.map((m): TimelineEntry => ({ kind: 'growthMeasurement', date: m.measurementDate, id: m.id, data: m })),
    ...developmentAssessments.map(
      (a): TimelineEntry => ({ kind: 'developmentAssessment', date: a.assessmentDate, id: a.id, data: a })
    ),
  ];

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
