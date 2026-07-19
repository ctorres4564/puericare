import type { Consultation, GrowthMeasurement } from '@/lib/types';

/**
 * Linha do tempo do paciente (Módulo 10 do planejamento): mescla consultas e
 * medições de crescimento em ordem cronológica. Não cria nenhuma coleção
 * nova no Firestore — é só uma combinação em memória das duas listas já
 * existentes (decisão do Sprint 3, mantida: sem `timelineEvents` genérico
 * com poucos produtores de eventos).
 */
export type TimelineEntry =
  | { kind: 'consultation'; date: string; id: string; data: Consultation }
  | { kind: 'growthMeasurement'; date: string; id: string; data: GrowthMeasurement };

export function buildTimeline(consultations: Consultation[], measurements: GrowthMeasurement[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...consultations
      .filter((c) => c.status !== 'cancelled')
      .map((c): TimelineEntry => ({ kind: 'consultation', date: c.consultationDate, id: c.id, data: c })),
    ...measurements.map((m): TimelineEntry => ({ kind: 'growthMeasurement', date: m.measurementDate, id: m.id, data: m })),
  ];

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
