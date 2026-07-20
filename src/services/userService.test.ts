import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('firebase/firestore', () => import('../test/mocks/firestore'));
vi.mock('@/lib/firebase/firestore', () => ({ getFirebaseDb: () => ({}) }));

import { __reset, doc, setDoc } from '../test/mocks/firestore';
import {
  createUserProfile,
  getUserProfile,
  listUsers,
  setUserActive,
  setUserRole,
} from './userService';

beforeEach(() => {
  __reset();
});

describe('getUserProfile', () => {
  test('retorna null quando o documento não existe', async () => {
    expect(await getUserProfile('uid-inexistente')).toBeNull();
  });

  test('retorna o perfil criado por createUserProfile', async () => {
    await createUserProfile('uid-1', {
      email: 'pro@example.com',
      displayName: 'Dra. Teste',
      role: 'PROFESSIONAL',
      active: true,
    });

    const profile = await getUserProfile('uid-1');

    expect(profile?.uid).toBe('uid-1');
    expect(profile?.role).toBe('PROFESSIONAL');
    expect(profile?.active).toBe(true);
  });

  // Regressão: o campo `uid` dentro do documento é redundante e pode
  // divergir do ID do documento (ex.: doc criado/editado manualmente no
  // console). As regras do Firestore autorizam por request.auth.uid (== ID
  // do documento), então o service deve usar snap.id — nunca o campo.
  test('usa o ID do documento como uid mesmo quando o campo uid está divergente', async () => {
    await setDoc(doc({}, 'users', 'uid-real-do-auth'), {
      uid: 'uid-digitado-errado',
      email: 'pro@example.com',
      displayName: 'Dra. Teste',
      role: 'PROFESSIONAL',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const profile = await getUserProfile('uid-real-do-auth');

    expect(profile).not.toBeNull();
    expect(profile?.uid).toBe('uid-real-do-auth');
  });
});

describe('funções administrativas (Sprint A)', () => {
  async function seedUser(uid: string, displayName: string, role: 'PROFESSIONAL' | 'CAREGIVER' | 'ADMIN') {
    await setDoc(doc({}, 'users', uid), {
      uid,
      email: `${uid}@example.com`,
      displayName,
      role,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  test('listUsers retorna todos os usuários com uid = ID do documento, ordenados por nome', async () => {
    await seedUser('uid-1', 'Zuleica Souza', 'PROFESSIONAL');
    await seedUser('uid-2', 'Ana Lima', 'CAREGIVER');

    const users = await listUsers();

    expect(users.map((u) => u.displayName)).toEqual(['Ana Lima', 'Zuleica Souza']);
    expect(users.map((u) => u.uid)).toEqual(['uid-2', 'uid-1']);
  });

  test('setUserActive bloqueia e reativa a conta', async () => {
    await seedUser('uid-1', 'Profissional', 'PROFESSIONAL');

    await setUserActive('uid-1', false);
    expect((await getUserProfile('uid-1'))?.active).toBe(false);

    await setUserActive('uid-1', true);
    expect((await getUserProfile('uid-1'))?.active).toBe(true);
  });

  test('setUserRole altera o papel do usuário', async () => {
    await seedUser('uid-1', 'Profissional', 'PROFESSIONAL');

    await setUserRole('uid-1', 'CAREGIVER');

    expect((await getUserProfile('uid-1'))?.role).toBe('CAREGIVER');
  });
});
