import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('firebase/firestore', () => import('../test/mocks/firestore'));
vi.mock('@/lib/firebase/firestore', () => ({ getFirebaseDb: () => ({}) }));

import { __reset, __getRaw } from '../test/mocks/firestore';
import { createSleepRecord, getSleepRecord, listSleepRecordsByProfessional } from './sleepService';

beforeEach(() => {
  __reset();
});

describe('createSleepRecord', () => {
  test('cria o registro vinculado ao paciente e ao profissional certos', async () => {
    const record = await createSleepRecord('pro-1', {
      childId: 'child-1',
      recordDate: '2025-06-01',
      ageInDays: 150,
      nightWakings: 2,
      sleepDurationHours: 8,
      requiresFollowUp: false,
    });
    expect(record.professionalId).toBe('pro-1');
    expect(record.nightWakings).toBe(2);
    expect(record.sleepDurationHours).toBe(8);
  });

  test('não grava campos ausentes como undefined', async () => {
    const record = await createSleepRecord('pro-1', {
      childId: 'child-1',
      recordDate: '2025-06-01',
      ageInDays: 150,
      bedtime: '20:30',
      requiresFollowUp: false,
    });
    const raw = __getRaw('sleepRecords', record.id) as Record<string, unknown>;
    expect('nightWakings' in raw).toBe(false);
    expect(raw.bedtime).toBe('20:30');
  });
});

describe('getSleepRecord', () => {
  test('retorna null quando o id não existe', async () => {
    expect(await getSleepRecord('inexistente')).toBeNull();
  });
});

describe('listSleepRecordsByProfessional', () => {
  test('isolamento: não retorna registros de outro profissional', async () => {
    await createSleepRecord('pro-2', {
      childId: 'child-2', recordDate: '2025-01-01', ageInDays: 10, bedtime: '19:00', requiresFollowUp: false,
    });
    const list = await listSleepRecordsByProfessional('pro-1');
    expect(list).toHaveLength(0);
  });

  test('ordena do mais antigo para o mais recente', async () => {
    await createSleepRecord('pro-1', { childId: 'child-1', recordDate: '2025-06-01', ageInDays: 150, bedtime: '20:00', requiresFollowUp: false });
    await createSleepRecord('pro-1', { childId: 'child-1', recordDate: '2025-01-01', ageInDays: 10, bedtime: '19:00', requiresFollowUp: false });
    const list = await listSleepRecordsByProfessional('pro-1');
    expect(list.map((r) => r.recordDate)).toEqual(['2025-01-01', '2025-06-01']);
  });
});
