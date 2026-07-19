import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('firebase/firestore', () => import('../test/mocks/firestore'));
vi.mock('@/lib/firebase/firestore', () => ({ getFirebaseDb: () => ({}) }));

import { __reset, __getRaw } from '../test/mocks/firestore';
import {
  createDevelopmentAssessment,
  getDevelopmentAssessment,
  listDevelopmentAssessmentsByProfessional,
} from './developmentService';

beforeEach(() => {
  __reset();
});

describe('createDevelopmentAssessment', () => {
  test('cria o registro vinculado ao paciente e ao profissional certos', async () => {
    const assessment = await createDevelopmentAssessment('pro-1', {
      childId: 'child-1',
      assessmentDate: '2025-06-01',
      ageInDays: 365,
      milestones: [{ domain: 'motor_grosso', description: 'Anda sem apoio', status: 'ACHIEVED' }],
      requiresFollowUp: false,
    });

    expect(assessment.professionalId).toBe('pro-1');
    expect(assessment.childId).toBe('child-1');
    expect(assessment.milestones).toHaveLength(1);
    expect(assessment.requiresFollowUp).toBe(false);
    expect(assessment.id).toBeTruthy();
  });

  test('preserva o requiresFollowUp definido pelo profissional (nunca inferido)', async () => {
    const assessment = await createDevelopmentAssessment('pro-1', {
      childId: 'child-1',
      assessmentDate: '2025-06-01',
      ageInDays: 365,
      milestones: [{ domain: 'comunicacao', description: 'Ainda não fala palavras', status: 'NOT_ACHIEVED' }],
      requiresFollowUp: true,
    });
    const raw = __getRaw('developmentAssessments', assessment.id) as Record<string, unknown>;
    expect(raw.requiresFollowUp).toBe(true);
  });

  test('não grava observations quando ausente', async () => {
    const assessment = await createDevelopmentAssessment('pro-1', {
      childId: 'child-1',
      assessmentDate: '2025-06-01',
      ageInDays: 365,
      milestones: [{ domain: 'cognicao', description: 'Empilha blocos', status: 'ACHIEVED' }],
      requiresFollowUp: false,
    });
    const raw = __getRaw('developmentAssessments', assessment.id) as Record<string, unknown>;
    expect('observations' in raw).toBe(false);
  });
});

describe('getDevelopmentAssessment', () => {
  test('retorna null quando o id não existe', async () => {
    expect(await getDevelopmentAssessment('inexistente')).toBeNull();
  });

  test('retorna o registro cadastrado', async () => {
    const created = await createDevelopmentAssessment('pro-1', {
      childId: 'child-1',
      assessmentDate: '2025-06-01',
      ageInDays: 365,
      milestones: [],
      observations: 'Criança interativa',
      requiresFollowUp: false,
    });
    const found = await getDevelopmentAssessment(created.id);
    expect(found?.observations).toBe('Criança interativa');
  });
});

describe('listDevelopmentAssessmentsByProfessional', () => {
  test('retorna só os registros do profissional, do mais antigo para o mais recente', async () => {
    await createDevelopmentAssessment('pro-1', {
      childId: 'child-1', assessmentDate: '2025-06-01', ageInDays: 365, milestones: [], requiresFollowUp: false,
    });
    await createDevelopmentAssessment('pro-1', {
      childId: 'child-1', assessmentDate: '2025-01-01', ageInDays: 200, milestones: [], requiresFollowUp: false,
    });
    await createDevelopmentAssessment('pro-2', {
      childId: 'child-2', assessmentDate: '2025-03-01', ageInDays: 90, milestones: [], requiresFollowUp: false,
    });

    const list = await listDevelopmentAssessmentsByProfessional('pro-1');

    expect(list).toHaveLength(2);
    expect(list.map((a) => a.assessmentDate)).toEqual(['2025-01-01', '2025-06-01']);
  });

  test('não retorna registros de outro profissional (isolamento)', async () => {
    await createDevelopmentAssessment('pro-2', {
      childId: 'child-2', assessmentDate: '2025-03-01', ageInDays: 90, milestones: [], requiresFollowUp: false,
    });
    const list = await listDevelopmentAssessmentsByProfessional('pro-1');
    expect(list).toHaveLength(0);
  });
});
