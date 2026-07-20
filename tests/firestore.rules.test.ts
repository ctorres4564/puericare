import { describe, test, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where } from 'firebase/firestore';

/**
 * Testes das regras reais de firestore.rules, rodando 100% contra o
 * Firestore Emulator (nunca contra o projeto Firebase de produção).
 *
 * Requer o emulador rodando — ver script "test:rules" em package.json,
 * que usa `firebase emulators:exec` para subir/derrubar o emulador
 * automaticamente ao redor deste arquivo.
 */

let testEnv: RulesTestEnvironment;

const PROJECT_ID = 'puericare-rules-test';

function userDoc(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString();
  return {
    uid: overrides.uid ?? 'uid-placeholder',
    email: 'user@example.com',
    displayName: 'Usuário Teste',
    role: 'PROFESSIONAL',
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function childDoc(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString();
  return {
    professionalId: 'pro-a',
    caregiverIds: [],
    fullName: 'Criança Teste',
    birthDate: '2024-01-01',
    sexAtBirth: 'female',
    caregiverName: 'Responsável Teste',
    contactPhone: '11999999999',
    active: true,
    perinatalData: { premature: false, neonatalHospitalization: false },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function consultationDoc(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString();
  return {
    childId: 'child-1',
    professionalId: 'pro-a',
    consultationDate: '2025-06-01',
    ageInDays: 150,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function growthMeasurementDoc(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString();
  return {
    childId: 'child-1',
    professionalId: 'pro-a',
    measurementDate: '2025-06-01',
    ageInDays: 150,
    weightKg: 10,
    heightCm: 75,
    bmi: 17.8,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function feedingRecordDoc(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString();
  return {
    childId: 'child-1',
    professionalId: 'pro-a',
    recordDate: '2025-06-01',
    ageInDays: 150,
    feedingHistory: 'Aleitamento materno exclusivo',
    requiresFollowUp: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function sleepRecordDoc(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString();
  return {
    childId: 'child-1',
    professionalId: 'pro-a',
    recordDate: '2025-06-01',
    ageInDays: 150,
    bedtime: '20:30',
    requiresFollowUp: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function vaccinationRecordDoc(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString();
  return {
    childId: 'child-1',
    professionalId: 'pro-a',
    recordDate: '2025-06-01',
    ageInDays: 150,
    status: 'em_dia',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Sprint 6: feedingRecords, sleepRecords e vaccinationRecords seguem
 * exatamente a mesma política de growthMeasurements/developmentAssessments
 * (Sprints 4/5) — gera a bateria padrão de testes uma vez por coleção, sem
 * duplicar o bloco inteiro três vezes.
 */
function testImmutableChildRecordRules(
  collectionName: string,
  makeDoc: (overrides?: Record<string, unknown>) => Record<string, unknown>,
  updatePatch: Record<string, unknown>
) {
  describe(`firestore.rules — ${collectionName}/{id} (Sprint 6)`, () => {
    test('profissional cria registro para seu próprio paciente ativo', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
        await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a', active: true }));
      });
      const db = testEnv.authenticatedContext('pro-a').firestore();
      const ref = doc(collection(db, collectionName));
      await assertSucceeds(setDoc(ref, makeDoc({ professionalId: 'pro-a', childId: 'child-1' })));
    });

    test('profissional NÃO cria registro com professionalId de outro', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
        await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a', active: true }));
      });
      const db = testEnv.authenticatedContext('pro-a').firestore();
      const ref = doc(collection(db, collectionName));
      await assertFails(setDoc(ref, makeDoc({ professionalId: 'pro-b', childId: 'child-1' })));
    });

    test('profissional NÃO cria registro para paciente de outro profissional', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
        await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-b', active: true }));
      });
      const db = testEnv.authenticatedContext('pro-a').firestore();
      const ref = doc(collection(db, collectionName));
      await assertFails(setDoc(ref, makeDoc({ professionalId: 'pro-a', childId: 'child-1' })));
    });

    test('profissional NÃO cria registro para paciente desativado (soft delete)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
        await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a', active: false }));
      });
      const db = testEnv.authenticatedContext('pro-a').firestore();
      const ref = doc(collection(db, collectionName));
      await assertFails(setDoc(ref, makeDoc({ professionalId: 'pro-a', childId: 'child-1' })));
    });

    test('CAREGIVER não pode criar registro', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', 'cg-a'), userDoc({ uid: 'cg-a', role: 'CAREGIVER' }));
        await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'cg-a', active: true }));
      });
      const db = testEnv.authenticatedContext('cg-a').firestore();
      const ref = doc(collection(db, collectionName));
      await assertFails(setDoc(ref, makeDoc({ professionalId: 'cg-a', childId: 'child-1' })));
    });

    test('profissional dono lê seu registro', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
        await setDoc(doc(ctx.firestore(), collectionName, 'rec-1'), makeDoc({ professionalId: 'pro-a' }));
      });
      const db = testEnv.authenticatedContext('pro-a').firestore();
      await assertSucceeds(getDoc(doc(db, collectionName, 'rec-1')));
    });

    test('profissional NÃO lê registro de outro profissional (isolamento)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', 'pro-b'), userDoc({ uid: 'pro-b', role: 'PROFESSIONAL' }));
        await setDoc(doc(ctx.firestore(), collectionName, 'rec-1'), makeDoc({ professionalId: 'pro-a' }));
      });
      const db = testEnv.authenticatedContext('pro-b').firestore();
      await assertFails(getDoc(doc(db, collectionName, 'rec-1')));
    });

    test('ADMIN lê qualquer registro', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), collectionName, 'rec-1'), makeDoc({ professionalId: 'pro-a' }));
        await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
      });
      const db = testEnv.authenticatedContext('admin-a').firestore();
      await assertSucceeds(getDoc(doc(db, collectionName, 'rec-1')));
    });

    test('profissional NÃO pode editar (atualizar) um registro — imutável', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
        await setDoc(doc(ctx.firestore(), collectionName, 'rec-1'), makeDoc({ professionalId: 'pro-a' }));
      });
      const db = testEnv.authenticatedContext('pro-a').firestore();
      await assertFails(updateDoc(doc(db, collectionName, 'rec-1'), updatePatch));
    });

    test('nem ADMIN edita (atualizar) um registro — sem allow update na regra', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), collectionName, 'rec-1'), makeDoc({ professionalId: 'pro-a' }));
        await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
      });
      const db = testEnv.authenticatedContext('admin-a').firestore();
      await assertFails(updateDoc(doc(db, collectionName, 'rec-1'), updatePatch));
    });

    test('profissional NÃO pode excluir (hard delete) — só ADMIN', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
        await setDoc(doc(ctx.firestore(), collectionName, 'rec-1'), makeDoc({ professionalId: 'pro-a' }));
      });
      const db = testEnv.authenticatedContext('pro-a').firestore();
      await assertFails(deleteDoc(doc(db, collectionName, 'rec-1')));
    });

    test('ADMIN pode excluir (hard delete) um registro', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), collectionName, 'rec-1'), makeDoc({ professionalId: 'pro-a' }));
        await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
      });
      const db = testEnv.authenticatedContext('admin-a').firestore();
      await assertSucceeds(deleteDoc(doc(db, collectionName, 'rec-1')));
    });
  });
}

testImmutableChildRecordRules('feedingRecords', feedingRecordDoc, { requiresFollowUp: true });
testImmutableChildRecordRules('sleepRecords', sleepRecordDoc, { requiresFollowUp: true });
testImmutableChildRecordRules('vaccinationRecords', vaccinationRecordDoc, { status: 'atrasada' });

function developmentAssessmentDoc(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString();
  return {
    childId: 'child-1',
    professionalId: 'pro-a',
    assessmentDate: '2025-06-01',
    ageInDays: 365,
    milestones: [{ domain: 'motor_grosso', description: 'Anda sem apoio', status: 'ACHIEVED' }],
    requiresFollowUp: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(path.resolve(__dirname, '..', 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('firestore.rules — users/{userId}', () => {
  test('usuário cria o próprio perfil como PROFESSIONAL', async () => {
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(setDoc(doc(db, 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' })));
  });

  test('usuário cria o próprio perfil como CAREGIVER', async () => {
    const db = testEnv.authenticatedContext('cg-a').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'users', 'cg-a'), userDoc({ uid: 'cg-a', role: 'CAREGIVER', linkedChildIds: [] }))
    );
  });

  test('usuário NÃO pode se autopromover a ADMIN', async () => {
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(setDoc(doc(db, 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'ADMIN' })));
  });

  test('usuário NÃO pode criar o perfil de outro uid', async () => {
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(setDoc(doc(db, 'users', 'outro-uid'), userDoc({ uid: 'outro-uid' })));
  });

  test('usuário lê o próprio perfil', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'users', 'pro-a')));
  });

  test('usuário NÃO lê o perfil de outro usuário', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-b'), userDoc({ uid: 'pro-b' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(getDoc(doc(db, 'users', 'pro-b')));
  });

  test('ADMIN lê o perfil de qualquer usuário', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
      await setDoc(doc(ctx.firestore(), 'users', 'pro-b'), userDoc({ uid: 'pro-b' }));
    });
    const db = testEnv.authenticatedContext('admin-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'users', 'pro-b')));
  });

  test('usuário NÃO pode alterar o próprio role via update', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(updateDoc(doc(db, 'users', 'pro-a'), { role: 'ADMIN' }));
  });

  test('usuário NÃO pode se reativar/desbloquear via update de "active"', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', active: false }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(updateDoc(doc(db, 'users', 'pro-a'), { active: true }));
  });

  test('ADMIN pode alterar o role de outro usuário (promover/bloquear)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
      await setDoc(doc(ctx.firestore(), 'users', 'pro-b'), userDoc({ uid: 'pro-b' }));
    });
    const db = testEnv.authenticatedContext('admin-a').firestore();
    await assertSucceeds(updateDoc(doc(db, 'users', 'pro-b'), { active: false }));
  });

  test('usuário não autenticado não lê nem escreve nada', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'users', 'pro-a')));
    await assertFails(setDoc(doc(db, 'users', 'pro-a'), userDoc({ uid: 'pro-a' })));
  });

  test('ADMIN lista todos os usuários (painel administrativo)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('admin-a').firestore();
    await assertSucceeds(getDocs(collection(db, 'users')));
  });

  test('PROFESSIONAL NÃO lista todos os usuários', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a' }));
      await setDoc(doc(ctx.firestore(), 'users', 'pro-b'), userDoc({ uid: 'pro-b' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(getDocs(collection(db, 'users')));
  });
});

describe('firestore.rules — children/{childId}', () => {
  test('profissional cria criança vinculada a si mesmo', async () => {
    const db = testEnv.authenticatedContext('pro-a', undefined).firestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
    });
    const ref = doc(collection(db, 'children'));
    await assertSucceeds(setDoc(ref, childDoc({ professionalId: 'pro-a' })));
  });

  test('profissional NÃO cria criança com professionalId de outro', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'children'));
    await assertFails(setDoc(ref, childDoc({ professionalId: 'pro-b' })));
  });

  test('CAREGIVER não pode criar criança (só PROFESSIONAL cria)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'cg-a'), userDoc({ uid: 'cg-a', role: 'CAREGIVER' }));
    });
    const db = testEnv.authenticatedContext('cg-a').firestore();
    const ref = doc(collection(db, 'children'));
    await assertFails(setDoc(ref, childDoc({ professionalId: 'cg-a' })));
  });

  test('profissional dono lê sua própria criança', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'children', 'child-1')));
  });

  test('profissional NÃO lê a criança de outro profissional (isolamento)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-b'), userDoc({ uid: 'pro-b', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-b').firestore();
    await assertFails(getDoc(doc(db, 'children', 'child-1')));
  });

  test('CAREGIVER vinculado (caregiverIds) lê a criança', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'cg-a'), userDoc({ uid: 'cg-a', role: 'CAREGIVER' }));
      await setDoc(
        doc(ctx.firestore(), 'children', 'child-1'),
        childDoc({ professionalId: 'pro-a', caregiverIds: ['cg-a'] })
      );
    });
    const db = testEnv.authenticatedContext('cg-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'children', 'child-1')));
  });

  test('CAREGIVER não vinculado NÃO lê a criança', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'cg-b'), userDoc({ uid: 'cg-b', role: 'CAREGIVER' }));
      await setDoc(
        doc(ctx.firestore(), 'children', 'child-1'),
        childDoc({ professionalId: 'pro-a', caregiverIds: ['cg-a'] })
      );
    });
    const db = testEnv.authenticatedContext('cg-b').firestore();
    await assertFails(getDoc(doc(db, 'children', 'child-1')));
  });

  test('ADMIN lê qualquer criança', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
      await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
    });
    const db = testEnv.authenticatedContext('admin-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'children', 'child-1')));
  });

  test('profissional dono edita sua criança (ex.: editar cadastro)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(updateDoc(doc(db, 'children', 'child-1'), { fullName: 'Nome Editado' }));
  });

  test('profissional dono pode desativar (soft delete) sua criança', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(updateDoc(doc(db, 'children', 'child-1'), { active: false }));
  });

  test('profissional NÃO pode reatribuir professionalId ao editar', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(updateDoc(doc(db, 'children', 'child-1'), { professionalId: 'pro-b' }));
  });

  test('profissional NÃO pode editar criança de outro profissional', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-b'), userDoc({ uid: 'pro-b', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-b').firestore();
    await assertFails(updateDoc(doc(db, 'children', 'child-1'), { fullName: 'Hackeado' }));
  });

  test('profissional NÃO pode excluir (hard delete) — só ADMIN', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(deleteDoc(doc(db, 'children', 'child-1')));
  });

  test('ADMIN pode excluir (hard delete) uma criança', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
      await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
    });
    const db = testEnv.authenticatedContext('admin-a').firestore();
    await assertSucceeds(deleteDoc(doc(db, 'children', 'child-1')));
  });
});

describe('firestore.rules — consultations/{consultationId} (Sprint 3)', () => {
  test('profissional cria consulta (rascunho) para seu próprio paciente ativo', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a', active: true }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'consultations'));
    await assertSucceeds(setDoc(ref, consultationDoc({ professionalId: 'pro-a', childId: 'child-1' })));
  });

  test('profissional NÃO cria consulta com professionalId de outro', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a', active: true }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'consultations'));
    await assertFails(setDoc(ref, consultationDoc({ professionalId: 'pro-b', childId: 'child-1' })));
  });

  test('profissional NÃO cria consulta para paciente de outro profissional', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-b', active: true }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'consultations'));
    await assertFails(setDoc(ref, consultationDoc({ professionalId: 'pro-a', childId: 'child-1' })));
  });

  test('profissional NÃO cria consulta para paciente desativado (soft delete)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a', active: false }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'consultations'));
    await assertFails(setDoc(ref, consultationDoc({ professionalId: 'pro-a', childId: 'child-1' })));
  });

  test('CAREGIVER não pode criar consulta', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'cg-a'), userDoc({ uid: 'cg-a', role: 'CAREGIVER' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'cg-a', active: true }));
    });
    const db = testEnv.authenticatedContext('cg-a').firestore();
    const ref = doc(collection(db, 'consultations'));
    await assertFails(setDoc(ref, consultationDoc({ professionalId: 'cg-a', childId: 'child-1' })));
  });

  test('profissional dono lê sua consulta', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'consultations', 'cons-1')));
  });

  test('profissional NÃO lê consulta de outro profissional (isolamento)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-b'), userDoc({ uid: 'pro-b', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-b').firestore();
    await assertFails(getDoc(doc(db, 'consultations', 'cons-1')));
  });

  test('ADMIN lê qualquer consulta', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
      await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
    });
    const db = testEnv.authenticatedContext('admin-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'consultations', 'cons-1')));
  });

  test('profissional dono salva rascunho (update de conteúdo)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(updateDoc(doc(db, 'consultations', 'cons-1'), { reason: 'Febre' }));
  });

  test('profissional dono finaliza a consulta (status completed)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(updateDoc(doc(db, 'consultations', 'cons-1'), { status: 'completed' }));
  });

  test('profissional dono cancela um rascunho (soft delete)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(updateDoc(doc(db, 'consultations', 'cons-1'), { status: 'cancelled' }));
  });

  test('profissional NÃO pode reatribuir childId ao editar', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(updateDoc(doc(db, 'consultations', 'cons-1'), { childId: 'child-2' }));
  });

  test('profissional NÃO pode reatribuir professionalId ao editar', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(updateDoc(doc(db, 'consultations', 'cons-1'), { professionalId: 'pro-b' }));
  });

  test('profissional NÃO pode editar consulta de outro profissional', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-b'), userDoc({ uid: 'pro-b', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-b').firestore();
    await assertFails(updateDoc(doc(db, 'consultations', 'cons-1'), { reason: 'Hackeado' }));
  });

  test('profissional NÃO pode excluir (hard delete) — só ADMIN', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(deleteDoc(doc(db, 'consultations', 'cons-1')));
  });

  test('ADMIN pode excluir (hard delete) uma consulta', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
      await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
    });
    const db = testEnv.authenticatedContext('admin-a').firestore();
    await assertSucceeds(deleteDoc(doc(db, 'consultations', 'cons-1')));
  });
});

describe('firestore.rules — growthMeasurements/{measurementId} (Sprint 4)', () => {
  test('profissional cria medição para seu próprio paciente ativo', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a', active: true }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'growthMeasurements'));
    await assertSucceeds(setDoc(ref, growthMeasurementDoc({ professionalId: 'pro-a', childId: 'child-1' })));
  });

  test('profissional NÃO cria medição com professionalId de outro', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a', active: true }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'growthMeasurements'));
    await assertFails(setDoc(ref, growthMeasurementDoc({ professionalId: 'pro-b', childId: 'child-1' })));
  });

  test('profissional NÃO cria medição para paciente de outro profissional', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-b', active: true }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'growthMeasurements'));
    await assertFails(setDoc(ref, growthMeasurementDoc({ professionalId: 'pro-a', childId: 'child-1' })));
  });

  test('profissional NÃO cria medição para paciente desativado (soft delete)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a', active: false }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'growthMeasurements'));
    await assertFails(setDoc(ref, growthMeasurementDoc({ professionalId: 'pro-a', childId: 'child-1' })));
  });

  test('CAREGIVER não pode criar medição', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'cg-a'), userDoc({ uid: 'cg-a', role: 'CAREGIVER' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'cg-a', active: true }));
    });
    const db = testEnv.authenticatedContext('cg-a').firestore();
    const ref = doc(collection(db, 'growthMeasurements'));
    await assertFails(setDoc(ref, growthMeasurementDoc({ professionalId: 'cg-a', childId: 'child-1' })));
  });

  test('profissional dono lê sua medição', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'growthMeasurements', 'meas-1'), growthMeasurementDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'growthMeasurements', 'meas-1')));
  });

  test('profissional NÃO lê medição de outro profissional (isolamento)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-b'), userDoc({ uid: 'pro-b', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'growthMeasurements', 'meas-1'), growthMeasurementDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-b').firestore();
    await assertFails(getDoc(doc(db, 'growthMeasurements', 'meas-1')));
  });

  test('ADMIN lê qualquer medição', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'growthMeasurements', 'meas-1'), growthMeasurementDoc({ professionalId: 'pro-a' }));
      await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
    });
    const db = testEnv.authenticatedContext('admin-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'growthMeasurements', 'meas-1')));
  });

  test('profissional NÃO pode editar (atualizar) uma medição — imutável', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'growthMeasurements', 'meas-1'), growthMeasurementDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(updateDoc(doc(db, 'growthMeasurements', 'meas-1'), { weightKg: 999 }));
  });

  test('nem ADMIN edita (atualizar) uma medição — sem allow update na regra', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'growthMeasurements', 'meas-1'), growthMeasurementDoc({ professionalId: 'pro-a' }));
      await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
    });
    const db = testEnv.authenticatedContext('admin-a').firestore();
    await assertFails(updateDoc(doc(db, 'growthMeasurements', 'meas-1'), { weightKg: 999 }));
  });

  test('profissional NÃO pode excluir (hard delete) — só ADMIN', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'growthMeasurements', 'meas-1'), growthMeasurementDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(deleteDoc(doc(db, 'growthMeasurements', 'meas-1')));
  });

  test('ADMIN pode excluir (hard delete) uma medição', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'growthMeasurements', 'meas-1'), growthMeasurementDoc({ professionalId: 'pro-a' }));
      await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
    });
    const db = testEnv.authenticatedContext('admin-a').firestore();
    await assertSucceeds(deleteDoc(doc(db, 'growthMeasurements', 'meas-1')));
  });
});

describe('firestore.rules — developmentAssessments/{assessmentId} (Sprint 5)', () => {
  test('profissional cria registro para seu próprio paciente ativo', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a', active: true }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'developmentAssessments'));
    await assertSucceeds(setDoc(ref, developmentAssessmentDoc({ professionalId: 'pro-a', childId: 'child-1' })));
  });

  test('profissional NÃO cria registro com professionalId de outro', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a', active: true }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'developmentAssessments'));
    await assertFails(setDoc(ref, developmentAssessmentDoc({ professionalId: 'pro-b', childId: 'child-1' })));
  });

  test('profissional NÃO cria registro para paciente de outro profissional', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-b', active: true }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'developmentAssessments'));
    await assertFails(setDoc(ref, developmentAssessmentDoc({ professionalId: 'pro-a', childId: 'child-1' })));
  });

  test('profissional NÃO cria registro para paciente desativado (soft delete)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a', active: false }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'developmentAssessments'));
    await assertFails(setDoc(ref, developmentAssessmentDoc({ professionalId: 'pro-a', childId: 'child-1' })));
  });

  test('CAREGIVER não pode criar registro', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'cg-a'), userDoc({ uid: 'cg-a', role: 'CAREGIVER' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'cg-a', active: true }));
    });
    const db = testEnv.authenticatedContext('cg-a').firestore();
    const ref = doc(collection(db, 'developmentAssessments'));
    await assertFails(setDoc(ref, developmentAssessmentDoc({ professionalId: 'cg-a', childId: 'child-1' })));
  });

  test('profissional dono lê seu registro', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'developmentAssessments', 'dev-1'), developmentAssessmentDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'developmentAssessments', 'dev-1')));
  });

  test('profissional NÃO lê registro de outro profissional (isolamento)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-b'), userDoc({ uid: 'pro-b', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'developmentAssessments', 'dev-1'), developmentAssessmentDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-b').firestore();
    await assertFails(getDoc(doc(db, 'developmentAssessments', 'dev-1')));
  });

  test('ADMIN lê qualquer registro', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'developmentAssessments', 'dev-1'), developmentAssessmentDoc({ professionalId: 'pro-a' }));
      await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
    });
    const db = testEnv.authenticatedContext('admin-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'developmentAssessments', 'dev-1')));
  });

  test('profissional NÃO pode editar (atualizar) um registro — imutável', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'developmentAssessments', 'dev-1'), developmentAssessmentDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(updateDoc(doc(db, 'developmentAssessments', 'dev-1'), { requiresFollowUp: true }));
  });

  test('nem ADMIN edita (atualizar) um registro — sem allow update na regra', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'developmentAssessments', 'dev-1'), developmentAssessmentDoc({ professionalId: 'pro-a' }));
      await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
    });
    const db = testEnv.authenticatedContext('admin-a').firestore();
    await assertFails(updateDoc(doc(db, 'developmentAssessments', 'dev-1'), { requiresFollowUp: true }));
  });

  test('profissional NÃO pode excluir (hard delete) — só ADMIN', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'developmentAssessments', 'dev-1'), developmentAssessmentDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(deleteDoc(doc(db, 'developmentAssessments', 'dev-1')));
  });

  test('ADMIN pode excluir (hard delete) um registro', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'developmentAssessments', 'dev-1'), developmentAssessmentDoc({ professionalId: 'pro-a' }));
      await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
    });
    const db = testEnv.authenticatedContext('admin-a').firestore();
    await assertSucceeds(deleteDoc(doc(db, 'developmentAssessments', 'dev-1')));
  });
});

function reportDoc(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString();
  return {
    childId: 'child-1',
    professionalId: 'pro-a',
    version: 0,
    status: 'DRAFT',
    title: 'Relatório Clínico de Acompanhamento',
    createdAt: now,
    createdBy: 'pro-a',
    updatedAt: now,
    updatedBy: 'pro-a',
    sourceReferenceDate: '2025-06-01',
    compositionSnapshot: { sections: {}, narrative: {}, institutional: {} },
    schemaVersion: 1,
    rendererVersion: '1',
    ...overrides,
  };
}

describe('firestore.rules — reports/{reportId} (Sprint B.4)', () => {
  test('profissional cria DRAFT para seu próprio paciente ativo', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a', active: true }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'reports'));
    await assertSucceeds(setDoc(ref, reportDoc({ professionalId: 'pro-a', childId: 'child-1' })));
  });

  test('profissional NÃO cria relatório com professionalId de outro', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a', active: true }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'reports'));
    await assertFails(setDoc(ref, reportDoc({ professionalId: 'pro-b', childId: 'child-1' })));
  });

  test('profissional NÃO cria relatório para paciente de outro profissional', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-b', active: true }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'reports'));
    await assertFails(setDoc(ref, reportDoc({ professionalId: 'pro-a', childId: 'child-1' })));
  });

  test('profissional NÃO cria relatório para paciente desativado', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a', active: false }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'reports'));
    await assertFails(setDoc(ref, reportDoc({ professionalId: 'pro-a', childId: 'child-1' })));
  });

  test('profissional NÃO cria relatório já como ISSUED (emissão só por update)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a', active: true }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'reports'));
    await assertFails(
      setDoc(ref, reportDoc({ professionalId: 'pro-a', childId: 'child-1', status: 'ISSUED', version: 1 }))
    );
  });

  test('CAREGIVER não pode criar relatório', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'cg-a'), userDoc({ uid: 'cg-a', role: 'CAREGIVER' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'cg-a', active: true }));
    });
    const db = testEnv.authenticatedContext('cg-a').firestore();
    const ref = doc(collection(db, 'reports'));
    await assertFails(setDoc(ref, reportDoc({ professionalId: 'cg-a', childId: 'child-1' })));
  });

  test('profissional dono lê seu relatório', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'reports', 'rep-1'), reportDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'reports', 'rep-1')));
  });

  test('profissional NÃO lê relatório de outro profissional (isolamento)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-b'), userDoc({ uid: 'pro-b', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'reports', 'rep-1'), reportDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-b').firestore();
    await assertFails(getDoc(doc(db, 'reports', 'rep-1')));
  });

  test('ADMIN lê qualquer relatório', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'reports', 'rep-1'), reportDoc({ professionalId: 'pro-a' }));
      await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
    });
    const db = testEnv.authenticatedContext('admin-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'reports', 'rep-1')));
  });

  test('profissional dono salva o próprio DRAFT (continua DRAFT, version não muda)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'reports', 'rep-1'), reportDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(updateDoc(doc(db, 'reports', 'rep-1'), { title: 'Novo título', updatedAt: new Date().toISOString() }));
  });

  test('profissional NÃO salva DRAFT de outro profissional', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-b'), userDoc({ uid: 'pro-b', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'reports', 'rep-1'), reportDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-b').firestore();
    await assertFails(updateDoc(doc(db, 'reports', 'rep-1'), { title: 'Invasão' }));
  });

  test('profissional NÃO altera childId nem professionalId ao salvar rascunho', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'reports', 'rep-1'), reportDoc({ professionalId: 'pro-a', childId: 'child-1' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(updateDoc(doc(db, 'reports', 'rep-1'), { childId: 'child-2' }));
  });

  test('profissional emite o próprio DRAFT (DRAFT -> ISSUED, version > 0, issuedBy = si mesmo)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'reports', 'rep-1'), reportDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'reports', 'rep-1'), {
        status: 'ISSUED',
        version: 1,
        issuedAt: new Date().toISOString(),
        issuedBy: 'pro-a',
        title: 'Relatório Clínico de Acompanhamento',
      })
    );
  });

  test('emissão com título vazio é negada', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'reports', 'rep-1'), reportDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(
      updateDoc(doc(db, 'reports', 'rep-1'), {
        status: 'ISSUED',
        version: 1,
        issuedAt: new Date().toISOString(),
        issuedBy: 'pro-a',
        title: '',
      })
    );
  });

  test('emissão com issuedBy diferente do autenticado é negada', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'reports', 'rep-1'), reportDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(
      updateDoc(doc(db, 'reports', 'rep-1'), {
        status: 'ISSUED',
        version: 1,
        issuedAt: new Date().toISOString(),
        issuedBy: 'outro-uid',
        title: 'Relatório Clínico de Acompanhamento',
      })
    );
  });

  test('relatório ISSUED nunca é atualizado pelo profissional — imutabilidade real', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(
        doc(ctx.firestore(), 'reports', 'rep-1'),
        reportDoc({ professionalId: 'pro-a', status: 'ISSUED', version: 1, issuedBy: 'pro-a', issuedAt: new Date().toISOString() })
      );
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(updateDoc(doc(db, 'reports', 'rep-1'), { title: 'Tentativa de edição' }));
  });

  test('relatório ISSUED nunca é atualizado nem por ADMIN', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'reports', 'rep-1'),
        reportDoc({ professionalId: 'pro-a', status: 'ISSUED', version: 1, issuedBy: 'pro-a', issuedAt: new Date().toISOString() })
      );
      await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
    });
    const db = testEnv.authenticatedContext('admin-a').firestore();
    await assertFails(updateDoc(doc(db, 'reports', 'rep-1'), { title: 'Tentativa de edição por admin' }));
  });

  test('profissional exclui o próprio DRAFT', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'reports', 'rep-1'), reportDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(deleteDoc(doc(db, 'reports', 'rep-1')));
  });

  test('profissional NÃO exclui relatório ISSUED — só ADMIN', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(
        doc(ctx.firestore(), 'reports', 'rep-1'),
        reportDoc({ professionalId: 'pro-a', status: 'ISSUED', version: 1, issuedBy: 'pro-a', issuedAt: new Date().toISOString() })
      );
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(deleteDoc(doc(db, 'reports', 'rep-1')));
  });

  test('ADMIN exclui relatório ISSUED', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'reports', 'rep-1'),
        reportDoc({ professionalId: 'pro-a', status: 'ISSUED', version: 1, issuedBy: 'pro-a', issuedAt: new Date().toISOString() })
      );
      await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN' }));
    });
    const db = testEnv.authenticatedContext('admin-a').firestore();
    await assertSucceeds(deleteDoc(doc(db, 'reports', 'rep-1')));
  });
});

describe('firestore.rules — reportCounters/{childId} (Sprint B.4)', () => {
  test('profissional dono da criança escreve o contador (usado na transaction de emissão)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(setDoc(doc(db, 'reportCounters', 'child-1'), { lastIssuedVersion: 1 }));
  });

  test('profissional NÃO escreve o contador de paciente de outro profissional', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-b' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(setDoc(doc(db, 'reportCounters', 'child-1'), { lastIssuedVersion: 1 }));
  });

  test('profissional dono lê o contador; outro profissional não', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'users', 'pro-b'), userDoc({ uid: 'pro-b', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
      await setDoc(doc(ctx.firestore(), 'reportCounters', 'child-1'), { lastIssuedVersion: 2 });
    });
    const dbA = testEnv.authenticatedContext('pro-a').firestore();
    const dbB = testEnv.authenticatedContext('pro-b').firestore();
    await assertSucceeds(getDoc(doc(dbA, 'reportCounters', 'child-1')));
    await assertFails(getDoc(doc(dbB, 'reportCounters', 'child-1')));
  });
});

describe('firestore.rules — list query em reports (histórico por criança)', () => {
  test('profissional lista os relatórios de um paciente seu (childId + professionalId)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'reports', 'rep-1'), reportDoc({ professionalId: 'pro-a', childId: 'child-1' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'reports'),
          where('childId', '==', 'child-1'),
          where('professionalId', '==', 'pro-a')
        )
      )
    );
  });

  test('profissional NÃO lista relatórios de paciente de outro profissional', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-b'), userDoc({ uid: 'pro-b', role: 'PROFESSIONAL' }));
      await setDoc(doc(ctx.firestore(), 'reports', 'rep-1'), reportDoc({ professionalId: 'pro-a', childId: 'child-1' }));
    });
    const db = testEnv.authenticatedContext('pro-b').firestore();
    await assertFails(
      getDocs(
        query(
          collection(db, 'reports'),
          where('childId', '==', 'child-1'),
          where('professionalId', '==', 'pro-a')
        )
      )
    );
  });
});

describe('firestore.rules — negação padrão', () => {
  test('coleção sem regra explícita é negada mesmo para usuário autenticado', async () => {
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(setDoc(doc(db, 'alguma_colecao_nao_declarada', 'x'), { a: 1 }));
  });
});

/* ── List queries do dashboard (getDocs com where) ──
 *
 * O dashboard executa 7 list queries filtrando `professionalId == uid`.
 * Regras de leitura são avaliadas de forma diferente para queries: o
 * Firestore precisa provar, a partir dos filtros da query, que TODO
 * documento retornado satisfaz a regra. Estes testes cobrem exatamente
 * esse caminho (a suíte acima cobre getDoc/update/delete).
 */
function clinicalAlertDoc(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString();
  return {
    childId: 'child-1',
    professionalId: 'pro-a',
    ruleId: 'regra-teste',
    status: 'active',
    message: 'Alerta de teste',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function testDashboardListQuery(
  collectionName: string,
  makeDoc: (overrides?: Record<string, unknown>) => Record<string, unknown>
) {
  describe(`firestore.rules — list query em ${collectionName} (dashboard)`, () => {
    test('profissional lista seus próprios documentos (professionalId == auth.uid)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
        await setDoc(doc(ctx.firestore(), collectionName, 'doc-1'), makeDoc({ professionalId: 'pro-a' }));
      });
      const db = testEnv.authenticatedContext('pro-a').firestore();
      await assertSucceeds(
        getDocs(query(collection(db, collectionName), where('professionalId', '==', 'pro-a')))
      );
    });

    // Reproduz o bug do dashboard: app filtrando por um uid que NÃO é o
    // auth.uid (campo `uid` do documento /users divergente) — a regra nega,
    // corretamente, como se o app pedisse dados de outro profissional.
    test('query com professionalId divergente do auth.uid é negada', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', role: 'PROFESSIONAL' }));
        await setDoc(doc(ctx.firestore(), collectionName, 'doc-1'), makeDoc({ professionalId: 'pro-a' }));
      });
      const db = testEnv.authenticatedContext('pro-a').firestore();
      await assertFails(
        getDocs(query(collection(db, collectionName), where('professionalId', '==', 'pro-a-DIVERGENTE')))
      );
    });

    test('profissional NÃO lista documentos de outro profissional (isolamento)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', 'pro-b'), userDoc({ uid: 'pro-b', role: 'PROFESSIONAL' }));
        await setDoc(doc(ctx.firestore(), collectionName, 'doc-1'), makeDoc({ professionalId: 'pro-a' }));
      });
      const db = testEnv.authenticatedContext('pro-b').firestore();
      await assertFails(
        getDocs(query(collection(db, collectionName), where('professionalId', '==', 'pro-a')))
      );
    });
  });
}

// As 7 coleções lidas pelo dashboard (app/(dashboard)/dashboard/page.tsx).
testDashboardListQuery('children', childDoc);
testDashboardListQuery('consultations', consultationDoc);
testDashboardListQuery('developmentAssessments', developmentAssessmentDoc);
testDashboardListQuery('feedingRecords', feedingRecordDoc);
testDashboardListQuery('sleepRecords', sleepRecordDoc);
testDashboardListQuery('vaccinationRecords', vaccinationRecordDoc);
testDashboardListQuery('clinicalAlerts', clinicalAlertDoc);

/* ── Bloqueio de contas (users/{uid}.active == false) ──
 *
 * Uma conta bloqueada por um ADMIN perde todo acesso aos dados clínicos,
 * inclusive via SDK/API direto — a verificação de `active` está nas regras
 * (isActiveUser), não só na interface. Exceção deliberada: o próprio usuário
 * continua podendo LER o seu documento em /users/{uid}, para que o app
 * consiga detectar o bloqueio e exibir a mensagem adequada.
 */
describe('firestore.rules — bloqueio de contas (active == false)', () => {
  test('PROFESSIONAL bloqueado NÃO lê sua própria criança', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', active: false }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(getDoc(doc(db, 'children', 'child-1')));
  });

  test('PROFESSIONAL bloqueado NÃO lista crianças (list query)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', active: false }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(getDocs(query(collection(db, 'children'), where('professionalId', '==', 'pro-a'))));
  });

  test('PROFESSIONAL bloqueado NÃO cria criança (isProfessional exige conta ativa)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', active: false }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'children'));
    await assertFails(setDoc(ref, childDoc({ professionalId: 'pro-a' })));
  });

  test('PROFESSIONAL bloqueado NÃO lê nem edita a própria consulta', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', active: false }));
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(getDoc(doc(db, 'consultations', 'cons-1')));
    await assertFails(updateDoc(doc(db, 'consultations', 'cons-1'), { reason: 'Tentativa' }));
  });

  test('PROFESSIONAL bloqueado NÃO escreve alerta clínico', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', active: false }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'clinicalAlerts'));
    await assertFails(setDoc(ref, clinicalAlertDoc({ professionalId: 'pro-a' })));
  });

  test('PROFESSIONAL bloqueado NÃO cria nem edita relatório clínico', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', active: false }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
      await setDoc(doc(ctx.firestore(), 'reports', 'rep-1'), reportDoc({ professionalId: 'pro-a', childId: 'child-1' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    const ref = doc(collection(db, 'reports'));
    await assertFails(setDoc(ref, reportDoc({ professionalId: 'pro-a', childId: 'child-1' })));
    await assertFails(updateDoc(doc(db, 'reports', 'rep-1'), { title: 'Tentativa' }));
    await assertFails(getDoc(doc(db, 'reports', 'rep-1')));
  });

  test('PROFESSIONAL bloqueado NÃO atualiza o próprio perfil', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', active: false }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(updateDoc(doc(db, 'users', 'pro-a'), { displayName: 'Nome Novo' }));
  });

  test('CAREGIVER bloqueado NÃO lê a criança vinculada', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'cg-a'), userDoc({ uid: 'cg-a', role: 'CAREGIVER', active: false }));
      await setDoc(
        doc(ctx.firestore(), 'children', 'child-1'),
        childDoc({ professionalId: 'pro-a', caregiverIds: ['cg-a'] })
      );
    });
    const db = testEnv.authenticatedContext('cg-a').firestore();
    await assertFails(getDoc(doc(db, 'children', 'child-1')));
  });

  test('ADMIN bloqueado NÃO lista usuários nem gerencia contas', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'admin-a'), userDoc({ uid: 'admin-a', role: 'ADMIN', active: false }));
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('admin-a').firestore();
    await assertFails(getDocs(collection(db, 'users')));
    await assertFails(updateDoc(doc(db, 'users', 'pro-a'), { active: false }));
  });

  test('usuário autenticado SEM perfil não acessa dados clínicos', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'sem-perfil' }));
    });
    const db = testEnv.authenticatedContext('sem-perfil').firestore();
    await assertFails(getDoc(doc(db, 'children', 'child-1')));
    const ref = doc(collection(db, 'children'));
    await assertFails(setDoc(ref, childDoc({ professionalId: 'sem-perfil' })));
  });

  test('conta bloqueada ainda LÊ o próprio perfil (necessário para detectar o bloqueio na UI)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', active: false }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'users', 'pro-a')));
  });

  test('bloqueio POSTERIOR à autenticação passa a negar acesso imediatamente', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pro-a'), userDoc({ uid: 'pro-a', active: true }));
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    // Antes do bloqueio: acesso normal.
    await assertSucceeds(getDoc(doc(db, 'children', 'child-1')));
    // ADMIN bloqueia a conta.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users', 'pro-a'), { active: false });
    });
    // Depois do bloqueio: o mesmo acesso é negado.
    await assertFails(getDoc(doc(db, 'children', 'child-1')));
    await assertFails(getDocs(query(collection(db, 'children'), where('professionalId', '==', 'pro-a'))));
  });
});
