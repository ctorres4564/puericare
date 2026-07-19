import { describe, test, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection } from 'firebase/firestore';

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
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'children', 'child-1')));
  });

  test('profissional NÃO lê a criança de outro profissional (isolamento)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-b').firestore();
    await assertFails(getDoc(doc(db, 'children', 'child-1')));
  });

  test('CAREGIVER vinculado (caregiverIds) lê a criança', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
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
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(updateDoc(doc(db, 'children', 'child-1'), { fullName: 'Nome Editado' }));
  });

  test('profissional dono pode desativar (soft delete) sua criança', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(updateDoc(doc(db, 'children', 'child-1'), { active: false }));
  });

  test('profissional NÃO pode reatribuir professionalId ao editar', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(updateDoc(doc(db, 'children', 'child-1'), { professionalId: 'pro-b' }));
  });

  test('profissional NÃO pode editar criança de outro profissional', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), childDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-b').firestore();
    await assertFails(updateDoc(doc(db, 'children', 'child-1'), { fullName: 'Hackeado' }));
  });

  test('profissional NÃO pode excluir (hard delete) — só ADMIN', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
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
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'consultations', 'cons-1')));
  });

  test('profissional NÃO lê consulta de outro profissional (isolamento)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
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
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(updateDoc(doc(db, 'consultations', 'cons-1'), { reason: 'Febre' }));
  });

  test('profissional dono finaliza a consulta (status completed)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(updateDoc(doc(db, 'consultations', 'cons-1'), { status: 'completed' }));
  });

  test('profissional dono cancela um rascunho (soft delete)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(updateDoc(doc(db, 'consultations', 'cons-1'), { status: 'cancelled' }));
  });

  test('profissional NÃO pode reatribuir childId ao editar', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(updateDoc(doc(db, 'consultations', 'cons-1'), { childId: 'child-2' }));
  });

  test('profissional NÃO pode reatribuir professionalId ao editar', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(updateDoc(doc(db, 'consultations', 'cons-1'), { professionalId: 'pro-b' }));
  });

  test('profissional NÃO pode editar consulta de outro profissional', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'consultations', 'cons-1'), consultationDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-b').firestore();
    await assertFails(updateDoc(doc(db, 'consultations', 'cons-1'), { reason: 'Hackeado' }));
  });

  test('profissional NÃO pode excluir (hard delete) — só ADMIN', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
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
      await setDoc(doc(ctx.firestore(), 'growthMeasurements', 'meas-1'), growthMeasurementDoc({ professionalId: 'pro-a' }));
    });
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'growthMeasurements', 'meas-1')));
  });

  test('profissional NÃO lê medição de outro profissional (isolamento)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
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

describe('firestore.rules — negação padrão', () => {
  test('coleção sem regra explícita é negada mesmo para usuário autenticado', async () => {
    const db = testEnv.authenticatedContext('pro-a').firestore();
    await assertFails(setDoc(doc(db, 'alguma_colecao_nao_declarada', 'x'), { a: 1 }));
  });
});
