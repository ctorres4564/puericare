import { describe, test, expect } from 'vitest';
import { buildTimeline } from './timeline';
import type { Consultation, GrowthMeasurement } from '@/lib/types';

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
    const timeline = buildTimeline([makeConsultation({ id: 'c1' })], [makeMeasurement({ id: 'm1' })]);
    const kinds = Object.fromEntries(timeline.map((e) => [e.id, e.kind]));
    expect(kinds.c1).toBe('consultation');
    expect(kinds.m1).toBe('growthMeasurement');
  });

  test('listas vazias retornam linha do tempo vazia', () => {
    expect(buildTimeline([], [])).toEqual([]);
  });
});
