import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('firebase/firestore', () => import('../test/mocks/firestore'));
vi.mock('@/lib/firebase/firestore', () => ({ getFirebaseDb: () => ({}) }));

import { __reset, __getRaw } from '../test/mocks/firestore';
import {
  createConsultation,
  getConsultation,
  listConsultationsByProfessional,
  updateConsultation,
  cancelConsultation,
  completeConsultation,
} from './consultationService';

beforeEach(() => {
  __reset();
});

describe('createConsultation', () => {
  test('cria como rascunho, vinculada ao paciente e ao profissional certos', async () => {
    const consultation = await createConsultation('pro-1', {
      childId: 'child-1',
      consultationDate: '2025-06-01',
      ageInDays: 150,
    });

    expect(consultation.professionalId).toBe('pro-1');
    expect(consultation.childId).toBe('child-1');
    expect(consultation.status).toBe('draft');
    expect(consultation.ageInDays).toBe(150);
    expect(consultation.id).toBeTruthy();
  });

  test('persiste a associação correta ao paciente', async () => {
    const consultation = await createConsultation('pro-1', {
      childId: 'child-1',
      consultationDate: '2025-06-01',
      ageInDays: 150,
    });
    const raw = __getRaw('consultations', consultation.id);
    expect(raw?.childId).toBe('child-1');
    expect(raw?.professionalId).toBe('pro-1');
  });
});

describe('getConsultation', () => {
  test('retorna null quando o id não existe', async () => {
    expect(await getConsultation('inexistente')).toBeNull();
  });

  test('retorna a consulta cadastrada', async () => {
    const created = await createConsultation('pro-1', {
      childId: 'child-1',
      consultationDate: '2025-06-01',
      ageInDays: 10,
    });
    const found = await getConsultation(created.id);
    expect(found?.id).toBe(created.id);
    expect(found?.status).toBe('draft');
  });
});

describe('listConsultationsByProfessional', () => {
  test('retorna só as consultas do profissional, mais recente primeiro', async () => {
    await createConsultation('pro-1', { childId: 'child-1', consultationDate: '2025-01-01', ageInDays: 1 });
    await createConsultation('pro-1', { childId: 'child-1', consultationDate: '2025-06-01', ageInDays: 150 });
    await createConsultation('pro-2', { childId: 'child-2', consultationDate: '2025-03-01', ageInDays: 60 }); // outro profissional

    const list = await listConsultationsByProfessional('pro-1');

    expect(list).toHaveLength(2);
    expect(list.map((c) => c.consultationDate)).toEqual(['2025-06-01', '2025-01-01']);
  });

  test('não retorna consultas de outro profissional (isolamento)', async () => {
    await createConsultation('pro-2', { childId: 'child-2', consultationDate: '2025-03-01', ageInDays: 60 });
    const list = await listConsultationsByProfessional('pro-1');
    expect(list).toHaveLength(0);
  });
});

describe('updateConsultation — salvar/retomar rascunho', () => {
  test('salva alterações de conteúdo mantendo o rascunho', async () => {
    const created = await createConsultation('pro-1', {
      childId: 'child-1',
      consultationDate: '2025-06-01',
      ageInDays: 150,
    });

    await updateConsultation(created.id, { reason: 'Febre', status: 'draft' });
    const raw = __getRaw('consultations', created.id) as Record<string, unknown>;

    expect(raw.reason).toBe('Febre');
    expect(raw.status).toBe('draft');
    expect(raw.childId).toBe('child-1'); // não muda
  });

  test('retomar e editar: uma segunda atualização preserva e sobrescreve campos', async () => {
    const created = await createConsultation('pro-1', {
      childId: 'child-1',
      consultationDate: '2025-06-01',
      ageInDays: 150,
    });

    await updateConsultation(created.id, { reason: 'Febre' });
    await updateConsultation(created.id, { reason: 'Febre há 2 dias', plan: 'Observar' });

    const raw = __getRaw('consultations', created.id) as Record<string, unknown>;
    expect(raw.reason).toBe('Febre há 2 dias');
    expect(raw.plan).toBe('Observar');
  });
});

describe('completeConsultation — finalização / evolução clínica', () => {
  test('marca a consulta como completed', async () => {
    const created = await createConsultation('pro-1', {
      childId: 'child-1',
      consultationDate: '2025-06-01',
      ageInDays: 150,
    });
    await completeConsultation(created.id);
    const raw = __getRaw('consultations', created.id) as Record<string, unknown>;
    expect(raw.status).toBe('completed');
  });
});

describe('cancelConsultation — soft delete de rascunho', () => {
  test('marca como cancelled sem apagar o documento', async () => {
    const created = await createConsultation('pro-1', {
      childId: 'child-1',
      consultationDate: '2025-06-01',
      ageInDays: 150,
    });
    await cancelConsultation(created.id);

    const raw = __getRaw('consultations', created.id) as Record<string, unknown>;
    expect(raw.status).toBe('cancelled');

    const found = await getConsultation(created.id);
    expect(found).not.toBeNull(); // continua existindo
  });
});
