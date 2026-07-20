import { describe, test, expect } from 'vitest';
import {
  latestMeasurementByChild,
  growthMonitoringStatus,
  daysSinceDate,
  GROWTH_MONITORING_THRESHOLD_DAYS,
} from './latestMeasurement';
import type { GrowthMeasurement } from '@/lib/types';

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

describe('daysSinceDate', () => {
  test('diferença em dias entre duas datas ISO', () => {
    expect(daysSinceDate('2025-01-01', '2025-01-31')).toBe(30);
  });

  test('mesma data retorna 0', () => {
    expect(daysSinceDate('2025-01-01', '2025-01-01')).toBe(0);
  });

  test('data futura não retorna negativo', () => {
    expect(daysSinceDate('2025-02-01', '2025-01-01')).toBe(0);
  });
});

describe('latestMeasurementByChild', () => {
  test('retorna a medição mais recente de cada criança', () => {
    const measurements = [
      makeMeasurement({ id: 'm1', childId: 'c1', measurementDate: '2025-01-01' }),
      makeMeasurement({ id: 'm2', childId: 'c1', measurementDate: '2025-03-01' }),
      makeMeasurement({ id: 'm3', childId: 'c2', measurementDate: '2025-02-01' }),
    ];

    const latest = latestMeasurementByChild(measurements);

    expect(latest.get('c1')?.id).toBe('m2');
    expect(latest.get('c2')?.id).toBe('m3');
  });

  test('desempata pela data de criação quando a data da medição é a mesma', () => {
    const measurements = [
      makeMeasurement({ id: 'm1', measurementDate: '2025-01-01', createdAt: '2025-01-01T00:00:00.000Z' }),
      makeMeasurement({ id: 'm2', measurementDate: '2025-01-01', createdAt: '2025-01-02T00:00:00.000Z' }),
    ];

    expect(latestMeasurementByChild(measurements).get('child-1')?.id).toBe('m2');
  });

  test('lista vazia retorna mapa vazio', () => {
    expect(latestMeasurementByChild([]).size).toBe(0);
  });
});

describe('growthMonitoringStatus', () => {
  test('sem medição → no_measurement', () => {
    expect(growthMonitoringStatus(undefined, '2025-06-01')).toBe('no_measurement');
  });

  test(`medição há mais de ${GROWTH_MONITORING_THRESHOLD_DAYS} dias → overdue`, () => {
    const latest = makeMeasurement({ measurementDate: '2025-01-01' });
    expect(growthMonitoringStatus(latest, '2025-06-01')).toBe('overdue');
  });

  test('medição dentro do limiar → up_to_date', () => {
    const latest = makeMeasurement({ measurementDate: '2025-05-15' });
    expect(growthMonitoringStatus(latest, '2025-06-01')).toBe('up_to_date');
  });

  test('exatamente no limiar ainda está em dia', () => {
    const latest = makeMeasurement({ measurementDate: '2025-03-03' });
    expect(growthMonitoringStatus(latest, '2025-06-01')).toBe('up_to_date');
  });
});
