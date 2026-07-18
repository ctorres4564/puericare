import { describe, test, expect } from 'vitest';
import { setupSchema } from './setup';

const base = {
  displayName: 'Dr. João Silva',
  email: 'joao@example.com',
  password: '123456',
};

describe('setupSchema — comportamento por papel', () => {
  test('aceita role PROFESSIONAL', () => {
    expect(setupSchema.safeParse({ ...base, role: 'PROFESSIONAL' }).success).toBe(true);
  });

  test('aceita role CAREGIVER', () => {
    expect(setupSchema.safeParse({ ...base, role: 'CAREGIVER' }).success).toBe(true);
  });

  test('rejeita role ADMIN — não é uma opção criável pelo /setup', () => {
    const result = setupSchema.safeParse({ ...base, role: 'ADMIN' });
    expect(result.success).toBe(false);
  });

  test('rejeita role desconhecida', () => {
    const result = setupSchema.safeParse({ ...base, role: 'SUPERADMIN' });
    expect(result.success).toBe(false);
  });
});
