import { describe, test, expect } from 'vitest';
import { buildTimeline } from './timeline';
import type {
  Consultation,
  GrowthMeasurement,
  DevelopmentAssessment,
  VaccinationRecord,
  FeedingRecord,
  SleepRecord,
  ClinicalAlert,
} from '@/lib/types';

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

function makeFeedingRecord(overrides: Partial<FeedingRecord>): FeedingRecord {
  return {
    id: 'f1',
    childId: 'child-1',
    professionalId: 'pro-1',
    recordDate: '2025-01-01',
    ageInDays: 30,
    requiresFollowUp: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSleepRecord(overrides: Partial<SleepRecord>): SleepRecord {
  return {
    id: 's1',
    childId: 'child-1',
    professionalId: 'pro-1',
    recordDate: '2025-01-01',
    ageInDays: 30,
    requiresFollowUp: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeAlert(overrides: Partial<ClinicalAlert>): ClinicalAlert {
  return {
    id: 'a1',
    childId: 'child-1',
    childName: 'Criança Teste',
    professionalId: 'pro-1',
    ruleId: 'R4_NO_GROWTH_90D',
    category: 'ATTENTION',
    title: 'Alerta de teste',
    description: 'Descrição de teste',
    clinicalSource: 'Fonte de teste',
    status: 'active',
    detectedAt: '2025-01-01T00:00:00.000Z',
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

  test('inclui alimentação, sono e alertas com os kinds corretos', () => {
    const timeline = buildTimeline(
      [],
      [],
      [],
      [],
      [makeFeedingRecord({ id: 'f1' })],
      [makeSleepRecord({ id: 's1' })],
      [makeAlert({ id: 'a1' })]
    );
    const kinds = Object.fromEntries(timeline.map((e) => [e.id, e.kind]));
    expect(kinds.f1).toBe('feedingRecord');
    expect(kinds.s1).toBe('sleepRecord');
    expect(kinds.a1).toBe('clinicalAlert');
  });

  test('alerta entra na linha do tempo pela data de detecção (detectedAt)', () => {
    const timeline = buildTimeline(
      [makeConsultation({ id: 'c1', consultationDate: '2025-01-10' })],
      [],
      [],
      [],
      [],
      [],
      [makeAlert({ id: 'a1', detectedAt: '2025-01-20T15:30:00.000Z' })]
    );
    expect(timeline.map((e) => e.id)).toEqual(['a1', 'c1']);
    expect(timeline[0].date).toBe('2025-01-20');
  });

  test('mescla os sete tipos de registro em ordem cronológica', () => {
    const timeline = buildTimeline(
      [makeConsultation({ id: 'c1', consultationDate: '2025-02-01' })],
      [makeMeasurement({ id: 'm1', measurementDate: '2025-04-01' })],
      [makeDevelopmentAssessment({ id: 'd1', assessmentDate: '2025-01-01' })],
      [makeVaccinationRecord({ id: 'v1', recordDate: '2025-03-01' })],
      [makeFeedingRecord({ id: 'f1', recordDate: '2025-05-01' })],
      [makeSleepRecord({ id: 's1', recordDate: '2025-06-01' })],
      [makeAlert({ id: 'a1', detectedAt: '2025-07-01T00:00:00.000Z' })]
    );
    expect(timeline.map((e) => e.id)).toEqual(['a1', 's1', 'f1', 'm1', 'v1', 'c1', 'd1']);
  });

  test('feedingRecords, sleepRecords e alerts são opcionais (compatibilidade)', () => {
    const timeline = buildTimeline([makeConsultation({ id: 'c1' })], [makeMeasurement({ id: 'm1' })]);
    expect(timeline).toHaveLength(2);
  });
});
