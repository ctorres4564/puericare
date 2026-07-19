import { describe, test, expect } from 'vitest';
import { buildTimeline } from './timeline';
import type { Consultation, GrowthMeasurement, DevelopmentAssessment, VaccinationRecord } from '@/lib/types';

function makeConsultation(overrides: Partial<Consultation>): Consultation {
  return {
    id: 'c1',
    childId: 'child-1',
    professionalId: 'pro-1',
    consultationDate: '2025-01-01',
    ageInDays: 30,
    status: 'completed',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeMeasurement(overrides: Partial<GrowthMeasurement>): GrowthMeasurement {
  return {
    id: 'm1',
    childId: 'child-1',
    professionalId: 'pro-1',
    measurementDate: '2025-01-01',
    ageInDays: 30,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeDevelopmentAssessment(overrides: Partial<DevelopmentAssessment>): DevelopmentAssessment {
  return {
    id: 'd1',
    childId: 'child-1',
    professionalId: 'pro-1',
    assessmentDate: '2025-01-01',
    ageInDays: 30,
    milestones: [],
    requiresFollowUp: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeVaccinationRecord(overrides: Partial<VaccinationRecord>): VaccinationRecord {
  return {
    id: 'v1',
    childId: 'child-1',
    professionalId: 'pro-1',
    recordDate: '2025-01-01',
    ageInDays: 30,
    status: 'em_dia',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildTimeline', () => {
  test('mescla consultas e medições em ordem cronológica (mais recente primeiro)', () => {
    const consultations = [makeConsultation({ id: 'c1', consultationDate: '2025-01-01' })];
    const measurements = [
      makeMeasurement({ id: 'm1', measurementDate: '2025-03-01' }),
      makeMeasurement({ id: 'm2', measurementDate: '2024-12-01' }),
    ];

    const timeline = buildTimeline(consultations, measurements);

    expect(timeline.map((e) => e.id)).toEqual(['m1', 'c1', 'm2']);
  });

  test('exclui consultas canceladas da linha do tempo', () => {
    const consultations = [
      makeConsultation({ id: 'c1', status: 'completed', consultationDate: '2025-01-01' }),
      makeConsultation({ id: 'c2', status: 'cancelled', consultationDate: '2025-02-01' }),
    ];

    const timeline = buildTimeline(consultations, []);

    expect(timeline.map((e) => e.id)).toEqual(['c1']);
  });

  test('inclui rascunhos (não cancelados) na linha do tempo', () => {
    const consultations = [makeConsultation({ id: 'c1', status: 'draft' })];
    const timeline = buildTimeline(consultations, []);
    expect(timeline).toHaveLength(1);
  });

  test('identifica corretamente o tipo de cada entrada (kind)', () => {
    const timeline = buildTimeline(
      [makeConsultation({ id: 'c1' })],
      [makeMeasurement({ id: 'm1' })],
      [makeDevelopmentAssessment({ id: 'd1' })],
      [makeVaccinationRecord({ id: 'v1' })]
    );
    const kinds = Object.fromEntries(timeline.map((e) => [e.id, e.kind]));
    expect(kinds.c1).toBe('consultation');
    expect(kinds.m1).toBe('growthMeasurement');
    expect(kinds.d1).toBe('developmentAssessment');
    expect(kinds.v1).toBe('vaccinationRecord');
  });

  test('mescla os quatro tipos de registro em ordem cronológica', () => {
    const timeline = buildTimeline(
      [makeConsultation({ id: 'c1', consultationDate: '2025-02-01' })],
      [makeMeasurement({ id: 'm1', measurementDate: '2025-04-01' })],
      [makeDevelopmentAssessment({ id: 'd1', assessmentDate: '2025-01-01' })],
      [makeVaccinationRecord({ id: 'v1', recordDate: '2025-03-01' })]
    );
    expect(timeline.map((e) => e.id)).toEqual(['m1', 'v1', 'c1', 'd1']);
  });

  test('developmentAssessments e vaccinationRecords são opcionais (compatibilidade com chamadas antigas)', () => {
    const timeline = buildTimeline([makeConsultation({ id: 'c1' })], [makeMeasurement({ id: 'm1' })]);
    expect(timeline).toHaveLength(2);
  });

  test('listas vazias retornam linha do tempo vazia', () => {
    expect(buildTimeline([], [], [], [])).toEqual([]);
  });
});
