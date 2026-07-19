import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('firebase/firestore', () => import('../test/mocks/firestore'));
vi.mock('@/lib/firebase/firestore', () => ({ getFirebaseDb: () => ({}) }));

import { __reset, __getRaw } from '../test/mocks/firestore';
import {
  createGrowthMeasurement,
  getGrowthMeasurement,
  listGrowthMeasurementsByProfessional,
} from './growthService';

beforeEach(() => {
  __reset();
});

describe('createGrowthMeasurement', () => {
  test('cria a medição vinculada ao paciente e ao profissional certos', async () => {
    const measurement = await createGrowthMeasurement('pro-1', {
      childId: 'child-1',
      measurementDate: '2025-06-01',
      ageInDays: 150,
      weightKg: 10,
      heightCm: 75,
      bmi: 17.8,
    });

    expect(measurement.professionalId).toBe('pro-1');
    expect(measurement.childId).toBe('child-1');
    expect(measurement.weightKg).toBe(10);
    expect(measurement.heightCm).toBe(75);
    expect(measurement.bmi).toBe(17.8);
    expect(measurement.id).toBeTruthy();
  });

  test('persiste só as medidas informadas (demais ausentes, não undefined explícito)', async () => {
    const measurement = await createGrowthMeasurement('pro-1', {
      childId: 'child-1',
      measurementDate: '2025-06-01',
      ageInDays: 150,
      weightKg: 10,
    });
    const raw = __getRaw('growthMeasurements', measurement.id) as Record<string, unknown>;
    expect(raw.weightKg).toBe(10);
    expect('heightCm' in raw).toBe(false);
    expect('bmi' in raw).toBe(false);
  });
});

describe('getGrowthMeasurement', () => {
  test('retorna null quando o id não existe', async () => {
    expect(await getGrowthMeasurement('inexistente')).toBeNull();
  });

  test('retorna a medição cadastrada', async () => {
    const created = await createGrowthMeasurement('pro-1', {
      childId: 'child-1',
      measurementDate: '2025-06-01',
      ageInDays: 150,
      weightKg: 10,
    });
    const found = await getGrowthMeasurement(created.id);
    expect(found?.id).toBe(created.id);
    expect(found?.weightKg).toBe(10);
  });
});

describe('listGrowthMeasurementsByProfessional', () => {
  test('retorna só as medições do profissional, da mais antiga para a mais recente', async () => {
    await createGrowthMeasurement('pro-1', { childId: 'child-1', measurementDate: '2025-06-01', ageInDays: 150, weightKg: 12 });
    await createGrowthMeasurement('pro-1', { childId: 'child-1', measurementDate: '2025-01-01', ageInDays: 30, weightKg: 4 });
    await createGrowthMeasurement('pro-2', { childId: 'child-2', measurementDate: '2025-03-01', ageInDays: 60, weightKg: 6 }); // outro profissional

    const list = await listGrowthMeasurementsByProfessional('pro-1');

    expect(list).toHaveLength(2);
    expect(list.map((m) => m.measurementDate)).toEqual(['2025-01-01', '2025-06-01']);
  });

  test('não retorna medições de outro profissional (isolamento)', async () => {
    await createGrowthMeasurement('pro-2', { childId: 'child-2', measurementDate: '2025-03-01', ageInDays: 60, weightKg: 6 });
    const list = await listGrowthMeasurementsByProfessional('pro-1');
    expect(list).toHaveLength(0);
  });
});
