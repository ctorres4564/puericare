import { describe, test, expect } from 'vitest';
import {
  countActiveChildren,
  countConsultationsOnDate,
  countRequiringFollowUp,
  countChildrenWithLatestVaccinationStatus,
  recentConsultations,
} from './stats';
import type { Child, Consultation, DevelopmentAssessment, FeedingRecord, SleepRecord, VaccinationRecord } from '@/lib/types';

function makeChild(overrides: Partial<Child>): Child {
  return {
    id: 'c1', professionalId: 'pro-1', caregiverIds: [], fullName: 'Criança',
    birthDate: '2024-01-01', sexAtBirth: 'not_informed', caregiverName: 'Resp',
    contactPhone: '11999999999', active: true,
    createdAt: '', updatedAt: '', ...overrides,
  };
}

function makeConsultation(overrides: Partial<Consultation>): Consultation {
  return {
    id: 'x', childId: 'c1', professionalId: 'pro-1', consultationDate: '2025-01-01',
    ageInDays: 30, status: 'completed', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '',
    ...overrides,
  };
}

function makeDevelopment(overrides: Partial<DevelopmentAssessment>): DevelopmentAssessment {
  return {
    id: 'd1', childId: 'c1', professionalId: 'pro-1', assessmentDate: '2025-01-01',
    ageInDays: 30, milestones: [], requiresFollowUp: false, createdAt: '', updatedAt: '',
    ...overrides,
  };
}

function makeFeeding(overrides: Partial<FeedingRecord>): FeedingRecord {
  return {
    id: 'f1', childId: 'c1', professionalId: 'pro-1', recordDate: '2025-01-01',
    ageInDays: 30, requiresFollowUp: false, createdAt: '', updatedAt: '',
    ...overrides,
  };
}

function makeSleep(overrides: Partial<SleepRecord>): SleepRecord {
  return {
    id: 's1', childId: 'c1', professionalId: 'pro-1', recordDate: '2025-01-01',
    ageInDays: 30, requiresFollowUp: false, createdAt: '', updatedAt: '',
    ...overrides,
  };
}

function makeVaccination(overrides: Partial<VaccinationRecord>): VaccinationRecord {
  return {
    id: 'v1', childId: 'c1', professionalId: 'pro-1', recordDate: '2025-01-01',
    ageInDays: 30, status: 'em_dia', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '',
    ...overrides,
  };
}

describe('countActiveChildren', () => {
  test('conta só os pacientes ativos', () => {
    const children = [makeChild({ id: '1', active: true }), makeChild({ id: '2', active: false }), makeChild({ id: '3', active: true })];
    expect(countActiveChildren(children)).toBe(2);
  });
});

describe('countConsultationsOnDate', () => {
  test('conta consultas na data, excluindo canceladas', () => {
    const consultations = [
      makeConsultation({ id: '1', consultationDate: '2025-06-01', status: 'completed' }),
      makeConsultation({ id: '2', consultationDate: '2025-06-01', status: 'cancelled' }),
      makeConsultation({ id: '3', consultationDate: '2025-06-01', status: 'draft' }),
      makeConsultation({ id: '4', consultationDate: '2025-06-02', status: 'completed' }),
    ];
    expect(countConsultationsOnDate(consultations, '2025-06-01')).toBe(2);
  });
});

describe('countRequiringFollowUp', () => {
  test('soma requiresFollowUp dos três domínios', () => {
    const development = [makeDevelopment({ requiresFollowUp: true }), makeDevelopment({ requiresFollowUp: false })];
    const feeding = [makeFeeding({ requiresFollowUp: true })];
    const sleep = [makeSleep({ requiresFollowUp: true }), makeSleep({ requiresFollowUp: true })];
    expect(countRequiringFollowUp(development, feeding, sleep)).toBe(4);
  });

  test('zero quando nada foi sinalizado', () => {
    expect(countRequiringFollowUp([], [], [])).toBe(0);
  });
});

describe('countChildrenWithLatestVaccinationStatus', () => {
  test('considera só o registro mais recente por criança', () => {
    const records = [
      makeVaccination({ childId: 'a', recordDate: '2025-01-01', status: 'atrasada' }),
      makeVaccination({ childId: 'a', recordDate: '2025-03-01', status: 'em_dia' }), // mais recente: em_dia
      makeVaccination({ childId: 'b', recordDate: '2025-02-01', status: 'atrasada' }),
    ];
    expect(countChildrenWithLatestVaccinationStatus(records, 'atrasada')).toBe(1); // só 'b'
    expect(countChildrenWithLatestVaccinationStatus(records, 'em_dia')).toBe(1); // só 'a'
  });

  test('empate de data usa createdAt como desempate', () => {
    const records = [
      makeVaccination({ childId: 'a', recordDate: '2025-01-01', createdAt: '2025-01-01T10:00:00.000Z', status: 'atrasada' }),
      makeVaccination({ childId: 'a', recordDate: '2025-01-01', createdAt: '2025-01-01T12:00:00.000Z', status: 'em_dia' }),
    ];
    expect(countChildrenWithLatestVaccinationStatus(records, 'em_dia')).toBe(1);
  });

  test('lista vazia retorna zero', () => {
    expect(countChildrenWithLatestVaccinationStatus([], 'atrasada')).toBe(0);
  });
});

describe('recentConsultations', () => {
  test('retorna as mais recentes primeiro, respeitando o limite', () => {
    const consultations = [
      makeConsultation({ id: '1', consultationDate: '2025-01-01' }),
      makeConsultation({ id: '2', consultationDate: '2025-03-01' }),
      makeConsultation({ id: '3', consultationDate: '2025-02-01' }),
    ];
    expect(recentConsultations(consultations, 2).map((c) => c.id)).toEqual(['2', '3']);
  });

  test('exclui canceladas', () => {
    const consultations = [
      makeConsultation({ id: '1', consultationDate: '2025-03-01', status: 'cancelled' }),
      makeConsultation({ id: '2', consultationDate: '2025-01-01', status: 'completed' }),
    ];
    expect(recentConsultations(consultations, 5).map((c) => c.id)).toEqual(['2']);
  });
});
