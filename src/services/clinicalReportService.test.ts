import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('firebase/firestore', () => import('../test/mocks/firestore'));
vi.mock('@/lib/firebase/firestore', () => ({ getFirebaseDb: () => ({}) }));

import { __reset } from '../test/mocks/firestore';
import { getClinicalReportData } from './clinicalReportService';
import { createChild } from './childService';
import { createUserProfile } from './userService';
import { createConsultation } from './consultationService';
import { createGrowthMeasurement } from './growthService';

const childPayload = {
  fullName: 'Maria Teste',
  birthDate: '2024-01-15',
  sexAtBirth: 'female' as const,
  caregiverName: 'Joana Responsável',
  contactPhone: '11988887777',
};

beforeEach(() => {
  __reset();
});

describe('getClinicalReportData — acesso', () => {
  test('retorna null para paciente inexistente', async () => {
    const report = await getClinicalReportData('nao-existe', 'pro-1');
    expect(report).toBeNull();
  });

  test('retorna null quando a criança pertence a outro profissional (inacessível)', async () => {
    const child = await createChild('pro-1', childPayload);

    const report = await getClinicalReportData(child.id, 'pro-2');

    expect(report).toBeNull();
  });
});

describe('getClinicalReportData — consolidação', () => {
  test('monta o relatório com dados da criança e do profissional', async () => {
    await createUserProfile('pro-1', {
      email: 'dra@example.com',
      displayName: 'Dra. Ana',
      role: 'PROFESSIONAL',
      crm: '12345-SP',
      specialty: 'Pediatria',
      active: true,
    });
    const child = await createChild('pro-1', childPayload);
    await createConsultation('pro-1', {
      childId: child.id,
      consultationDate: '2024-06-01',
      ageInDays: 138,
    });
    await createGrowthMeasurement('pro-1', {
      childId: child.id,
      measurementDate: '2024-06-01',
      ageInDays: 138,
      weightKg: 7.5,
    });

    const report = await getClinicalReportData(child.id, 'pro-1');

    expect(report).not.toBeNull();
    expect(report!.patient.id).toBe(child.id);
    expect(report!.patient.fullName).toBe('Maria Teste');
    expect(report!.professional?.displayName).toBe('Dra. Ana');
    expect(report!.consultations).toHaveLength(1);
    expect(report!.growth.measurements).toHaveLength(1);
    expect(report!.growth.latest?.weightKg).toBe(7.5);
    // Seções sem registros funcionam vazias
    expect(report!.development.assessments).toEqual([]);
    expect(report!.vaccination.records).toEqual([]);
    expect(report!.alerts).toEqual([]);
    expect(report!.referenceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(report!.generatedAt).toBeTruthy();
  });

  test('não mistura registros de outra criança do mesmo profissional', async () => {
    const childA = await createChild('pro-1', childPayload);
    const childB = await createChild('pro-1', { ...childPayload, fullName: 'Outra Criança' });
    await createGrowthMeasurement('pro-1', {
      childId: childB.id,
      measurementDate: '2024-06-01',
      ageInDays: 138,
      weightKg: 9.9,
    });

    const report = await getClinicalReportData(childA.id, 'pro-1');

    expect(report!.growth.measurements).toEqual([]);
    expect(report!.growth.latest).toBeNull();
  });

  test('monta o relatório mesmo sem perfil de profissional (professional null)', async () => {
    const child = await createChild('pro-sem-perfil', childPayload);

    const report = await getClinicalReportData(child.id, 'pro-sem-perfil');

    expect(report).not.toBeNull();
    expect(report!.professional).toBeNull();
  });
});
