import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('firebase/firestore', () => import('../test/mocks/firestore'));
vi.mock('@/lib/firebase/firestore', () => ({ getFirebaseDb: () => ({}) }));

import { __reset, __getRaw } from '../test/mocks/firestore';
import {
  createChild,
  getChild,
  listChildrenByProfessional,
  updateChild,
  deactivateChild,
} from './childService';

const basePayload = {
  fullName: 'Maria Teste',
  birthDate: '2025-01-15',
  sexAtBirth: 'female' as const,
  caregiverName: 'Joana Responsável',
  contactPhone: '11988887777',
};

beforeEach(() => {
  __reset();
});

describe('createChild', () => {
  test('cria o cadastro com professionalId, caregiverIds=[] e active=true', async () => {
    const child = await createChild('pro-1', basePayload);

    expect(child.professionalId).toBe('pro-1');
    expect(child.caregiverIds).toEqual([]);
    expect(child.active).toBe(true);
    expect(child.id).toBeTruthy();
    expect(child.createdAt).toBeTruthy();
    expect(child.updatedAt).toBeTruthy();
  });

  test('persiste os campos obrigatórios da criança', async () => {
    const child = await createChild('pro-1', basePayload);
    const raw = __getRaw('children', child.id);

    expect(raw?.fullName).toBe('Maria Teste');
    expect(raw?.birthDate).toBe('2025-01-15');
    expect(raw?.sexAtBirth).toBe('female');
  });

  test('persiste os dados do responsável (nome, telefone, e-mail)', async () => {
    const child = await createChild('pro-1', {
      ...basePayload,
      contactEmail: 'joana@example.com',
    });
    const raw = __getRaw('children', child.id);

    expect(raw?.caregiverName).toBe('Joana Responsável');
    expect(raw?.contactPhone).toBe('11988887777');
    expect(raw?.contactEmail).toBe('joana@example.com');
  });

  test('persiste os dados perinatais com os tipos numéricos corretos', async () => {
    const child = await createChild('pro-1', {
      ...basePayload,
      perinatalData: {
        gestationalAgeWeeks: 38,
        deliveryType: 'cesarean',
        birthWeightGrams: 3200,
        birthLengthCm: 48.5,
        birthHeadCircumferenceCm: 34.2,
        apgar1: 8,
        apgar5: 9,
        premature: false,
        neonatalHospitalization: false,
      },
    });
    const raw = __getRaw('children', child.id) as { perinatalData: Record<string, unknown> };

    expect(raw.perinatalData.gestationalAgeWeeks).toBe(38);
    expect(typeof raw.perinatalData.gestationalAgeWeeks).toBe('number');
    expect(raw.perinatalData.birthWeightGrams).toBe(3200);
    expect(raw.perinatalData.birthLengthCm).toBe(48.5);
    expect(raw.perinatalData.apgar1).toBe(8);
    expect(raw.perinatalData.apgar5).toBe(9);
    expect(raw.perinatalData.premature).toBe(false);
    expect(raw.perinatalData.neonatalHospitalization).toBe(false);
  });

  test('não grava campos opcionais ausentes como undefined (stripUndefined)', async () => {
    const child = await createChild('pro-1', basePayload);
    const raw = __getRaw('children', child.id) as Record<string, unknown>;

    expect('socialName' in raw).toBe(false);
    expect('contactEmail' in raw).toBe(false);
  });
});

describe('getChild', () => {
  test('retorna null quando o id não existe', async () => {
    expect(await getChild('inexistente')).toBeNull();
  });

  test('retorna a criança cadastrada', async () => {
    const created = await createChild('pro-1', basePayload);
    const found = await getChild(created.id);

    expect(found?.fullName).toBe('Maria Teste');
    expect(found?.id).toBe(created.id);
  });
});

describe('listChildrenByProfessional', () => {
  test('retorna só as crianças do profissional, ordenadas por nome', async () => {
    await createChild('pro-1', { ...basePayload, fullName: 'Zeca' });
    await createChild('pro-1', { ...basePayload, fullName: 'Ana' });
    await createChild('pro-2', { ...basePayload, fullName: 'Bia' }); // outro profissional

    const list = await listChildrenByProfessional('pro-1');

    expect(list).toHaveLength(2);
    expect(list.map((c) => c.fullName)).toEqual(['Ana', 'Zeca']);
  });

  test('não retorna crianças de outro profissional (isolamento)', async () => {
    await createChild('pro-2', { ...basePayload, fullName: 'Bia' });
    const list = await listChildrenByProfessional('pro-1');
    expect(list).toHaveLength(0);
  });
});

describe('updateChild', () => {
  test('edita os campos informados e atualiza updatedAt', async () => {
    const created = await createChild('pro-1', basePayload);
    const beforeUpdatedAt = created.updatedAt;

    await new Promise((r) => setTimeout(r, 2));
    await updateChild(created.id, { fullName: 'Maria Editada' });

    const raw = __getRaw('children', created.id) as Record<string, unknown>;
    expect(raw.fullName).toBe('Maria Editada');
    expect(raw.updatedAt).not.toBe(beforeUpdatedAt);
    expect(raw.professionalId).toBe('pro-1'); // não muda
  });
});

describe('deactivateChild (soft delete)', () => {
  test('marca active=false sem apagar o documento', async () => {
    const created = await createChild('pro-1', basePayload);
    await deactivateChild(created.id);

    const raw = __getRaw('children', created.id) as Record<string, unknown>;
    expect(raw.active).toBe(false);
    expect(raw.fullName).toBe('Maria Teste'); // histórico preservado

    // continua existindo para getChild/getDoc — só não deveria aparecer na listagem ativa (ver childList.test.ts)
    const found = await getChild(created.id);
    expect(found).not.toBeNull();
  });
});
