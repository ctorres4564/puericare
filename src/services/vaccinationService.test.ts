import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('firebase/firestore', () => import('../test/mocks/firestore'));
vi.mock('@/lib/firebase/firestore', () => ({ getFirebaseDb: () => ({}) }));

import { __reset, __getRaw } from '../test/mocks/firestore';
import { createVaccinationRecord, getVaccinationRecord, listVaccinationRecordsByProfessional } from './vaccinationService';

beforeEach(() => {
  __reset();
});

describe('createVaccinationRecord', () => {
  test('cria o registro vinculado ao paciente e ao profissional certos', async () => {
    const record = await createVaccinationRecord('pro-1', {
      childId: 'child-1',
      recordDate: '2025-06-01',
      ageInDays: 150,
      status: 'em_dia',
      vaccineName: 'Pentavalente',
    });
    expect(record.professionalId).toBe('pro-1');
    expect(record.status).toBe('em_dia');
    expect(record.vaccineName).toBe('Pentavalente');
  });

  test('não grava campos ausentes como undefined', async () => {
    const record = await createVaccinationRecord('pro-1', {
      childId: 'child-1',
      recordDate: '2025-06-01',
      ageInDays: 150,
      status: 'nao_informado',
    });
    const raw = __getRaw('vaccinationRecords', record.id) as Record<string, unknown>;
    expect('vaccineName' in raw).toBe(false);
    expect(raw.status).toBe('nao_informado');
  });
});

describe('getVaccinationRecord', () => {
  test('retorna null quando o id não existe', async () => {
    expect(await getVaccinationRecord('inexistente')).toBeNull();
  });
});

describe('listVaccinationRecordsByProfessional', () => {
  test('isolamento: não retorna registros de outro profissional', async () => {
    await createVaccinationRecord('pro-2', { childId: 'child-2', recordDate: '2025-01-01', ageInDays: 10, status: 'em_dia' });
    const list = await listVaccinationRecordsByProfessional('pro-1');
    expect(list).toHaveLength(0);
  });

  test('ordena do mais antigo para o mais recente', async () => {
    await createVaccinationRecord('pro-1', { childId: 'child-1', recordDate: '2025-06-01', ageInDays: 150, status: 'em_dia' });
    await createVaccinationRecord('pro-1', { childId: 'child-1', recordDate: '2025-01-01', ageInDays: 10, status: 'atrasada' });
    const list = await listVaccinationRecordsByProfessional('pro-1');
    expect(list.map((r) => r.recordDate)).toEqual(['2025-01-01', '2025-06-01']);
  });
});
