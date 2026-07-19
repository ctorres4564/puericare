import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('firebase/firestore', () => import('../test/mocks/firestore'));
vi.mock('@/lib/firebase/firestore', () => ({ getFirebaseDb: () => ({}) }));

import { __reset, __getRaw } from '../test/mocks/firestore';
import { createFeedingRecord, getFeedingRecord, listFeedingRecordsByProfessional } from './feedingService';

beforeEach(() => {
  __reset();
});

describe('createFeedingRecord', () => {
  test('cria o registro vinculado ao paciente e ao profissional certos', async () => {
    const record = await createFeedingRecord('pro-1', {
      childId: 'child-1',
      recordDate: '2025-06-01',
      ageInDays: 150,
      feedingHistory: 'Aleitamento materno exclusivo',
      requiresFollowUp: false,
    });
    expect(record.professionalId).toBe('pro-1');
    expect(record.childId).toBe('child-1');
    expect(record.feedingHistory).toBe('Aleitamento materno exclusivo');
  });

  test('não grava campos ausentes como undefined', async () => {
    const record = await createFeedingRecord('pro-1', {
      childId: 'child-1',
      recordDate: '2025-06-01',
      ageInDays: 150,
      difficulties: 'Recusa alimentar',
      requiresFollowUp: false,
    });
    const raw = __getRaw('feedingRecords', record.id) as Record<string, unknown>;
    expect('feedingHistory' in raw).toBe(false);
    expect(raw.difficulties).toBe('Recusa alimentar');
  });
});

describe('getFeedingRecord', () => {
  test('retorna null quando o id não existe', async () => {
    expect(await getFeedingRecord('inexistente')).toBeNull();
  });
});

describe('listFeedingRecordsByProfessional', () => {
  test('isolamento: não retorna registros de outro profissional', async () => {
    await createFeedingRecord('pro-2', {
      childId: 'child-2', recordDate: '2025-01-01', ageInDays: 10, observations: 'x', requiresFollowUp: false,
    });
    const list = await listFeedingRecordsByProfessional('pro-1');
    expect(list).toHaveLength(0);
  });

  test('ordena do mais antigo para o mais recente', async () => {
    await createFeedingRecord('pro-1', { childId: 'child-1', recordDate: '2025-06-01', ageInDays: 150, observations: 'b', requiresFollowUp: false });
    await createFeedingRecord('pro-1', { childId: 'child-1', recordDate: '2025-01-01', ageInDays: 10, observations: 'a', requiresFollowUp: false });
    const list = await listFeedingRecordsByProfessional('pro-1');
    expect(list.map((r) => r.recordDate)).toEqual(['2025-01-01', '2025-06-01']);
  });
});
