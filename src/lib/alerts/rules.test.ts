/**
 * lib/alerts/rules.test.ts — Testes unitários das 9 regras do motor de alertas.
 *
 * As regras são funções puras — sem I/O, sem Firebase. Testadas diretamente.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateRules,
  r1NoConsultUnder24m,
  r2NoConsultOver24m,
  r3LateVaccination,
  r4NoGrowth90d,
  r5NoWeight30dUnder6m,
  r6DevelopmentFollowUp,
  r7FeedingFollowUpRecurrent,
  r8SleepFollowUpRecurrent,
  r9DevelopmentDelayMultiple,
  r10SafetyAlertChokingApnea,
  ageInDaysAt,
  type RuleInput,
} from './rules';
import type {
  Child,
  Consultation,
  GrowthMeasurement,
  DevelopmentAssessment,
  DevelopmentMilestoneEntry,
  FeedingRecord,
  SleepRecord,
  VaccinationRecord,
} from '@/lib/types';

// ─── Factories ────────────────────────────────────────────────────────────────

const REF = '2026-07-19';

function makeChild(overrides: Partial<Child> = {}): Child {
  return {
    id: 'child-1',
    professionalId: 'prof-1',
    caregiverIds: [],
    fullName: 'Maria Silva',
    birthDate: '2025-01-19', // 6 meses na REF
    sexAtBirth: 'female',
    caregiverName: 'Ana Silva',
    contactPhone: '11999999999',
    active: true,
    createdAt: '2025-01-19T00:00:00Z',
    updatedAt: '2025-01-19T00:00:00Z',
    ...overrides,
  };
}

function makeConsultation(date: string, status: 'completed' | 'draft' | 'cancelled' = 'completed'): Consultation {
  return {
    id: `consult-${date}`,
    childId: 'child-1',
    professionalId: 'prof-1',
    consultationDate: date,
    ageInDays: 0,
    status,
    createdAt: date + 'T00:00:00Z',
    updatedAt: date + 'T00:00:00Z',
  };
}

function makeGrowth(date: string, weightKg?: number): GrowthMeasurement {
  return {
    id: `growth-${date}`,
    childId: 'child-1',
    professionalId: 'prof-1',
    measurementDate: date,
    ageInDays: 0,
    weightKg,
    createdAt: date + 'T00:00:00Z',
    updatedAt: date + 'T00:00:00Z',
  };
}

function makeDevelopment(date: string, milestones: DevelopmentMilestoneEntry[] = []): DevelopmentAssessment {
  return {
    id: `dev-${date}`,
    childId: 'child-1',
    professionalId: 'prof-1',
    assessmentDate: date,
    ageInDays: 0,
    milestones,
    requiresFollowUp: false,
    createdAt: date + 'T00:00:00Z',
    updatedAt: date + 'T00:00:00Z',
  };
}

function makeFeeding(date: string, requiresFollowUp: boolean): FeedingRecord {
  return {
    id: `feeding-${date}`,
    childId: 'child-1',
    professionalId: 'prof-1',
    recordDate: date,
    ageInDays: 0,
    requiresFollowUp,
    createdAt: date + 'T00:00:00Z',
    updatedAt: date + 'T00:00:00Z',
  };
}

function makeSleep(date: string, requiresFollowUp: boolean): SleepRecord {
  return {
    id: `sleep-${date}`,
    childId: 'child-1',
    professionalId: 'prof-1',
    recordDate: date,
    ageInDays: 0,
    requiresFollowUp,
    createdAt: date + 'T00:00:00Z',
    updatedAt: date + 'T00:00:00Z',
  };
}

function makeVaccination(date: string, status: 'em_dia' | 'atrasada' | 'nao_informado'): VaccinationRecord {
  return {
    id: `vacc-${date}`,
    childId: 'child-1',
    professionalId: 'prof-1',
    recordDate: date,
    ageInDays: 0,
    status,
    createdAt: date + 'T00:00:00Z',
    updatedAt: date + 'T00:00:00Z',
  };
}

function emptyInput(childOverrides: Partial<Child> = {}): RuleInput {
  return {
    child: makeChild(childOverrides),
    consultations: [],
    growthMeasurements: [],
    developmentAssessments: [],
    feedingRecords: [],
    sleepRecords: [],
    vaccinationRecords: [],
    referenceDate: REF,
  };
}

// ─── ageInDaysAt ─────────────────────────────────────────────────────────────

describe('ageInDaysAt', () => {
  it('retorna 0 para nascido na própria data', () => {
    expect(ageInDaysAt('2026-07-19', '2026-07-19')).toBe(0);
  });
  it('retorna 546 para criança nascida em 2025-01-19 na data 2026-07-19', () => {
    expect(ageInDaysAt('2025-01-19', '2026-07-19')).toBe(546);
  });
  it('retorna 730 para criança de exatamente 2 anos', () => {
    expect(ageInDaysAt('2024-07-19', '2026-07-19')).toBe(730);
  });
});

// ─── R1 ───────────────────────────────────────────────────────────────────────

describe('r1NoConsultUnder24m', () => {
  const child = makeChild({ birthDate: '2025-01-19' }); // ~6 meses na REF

  it('não gera alerta se tem consulta recente (< 90 dias)', () => {
    const input: RuleInput = { ...emptyInput(), child, consultations: [makeConsultation('2026-06-01')] };
    expect(r1NoConsultUnder24m(input)).toBeNull();
  });

  it('gera alerta se última consulta há mais de 90 dias', () => {
    const input: RuleInput = { ...emptyInput(), child, consultations: [makeConsultation('2026-03-01')] };
    const alert = r1NoConsultUnder24m(input);
    expect(alert).not.toBeNull();
    expect(alert?.ruleId).toBe('R1_NO_CONSULT_UNDER_24M');
    expect(alert?.category).toBe('ATTENTION');
  });

  it('gera alerta se não há consultas', () => {
    const input: RuleInput = { ...emptyInput(), child };
    expect(r1NoConsultUnder24m(input)).not.toBeNull();
  });

  it('ignora consultas em rascunho', () => {
    const input: RuleInput = { ...emptyInput(), child, consultations: [makeConsultation('2026-07-01', 'draft')] };
    expect(r1NoConsultUnder24m(input)).not.toBeNull();
  });

  it('não se aplica a criança > 24 meses', () => {
    const childOld = makeChild({ birthDate: '2024-01-01' }); // > 2 anos
    const input: RuleInput = { ...emptyInput(), child: childOld };
    expect(r1NoConsultUnder24m(input)).toBeNull();
  });
});

// ─── R2 ───────────────────────────────────────────────────────────────────────

describe('r2NoConsultOver24m', () => {
  const child = makeChild({ birthDate: '2023-07-01' }); // > 3 anos na REF

  it('não gera alerta se tem consulta recente (< 180 dias)', () => {
    const input: RuleInput = { ...emptyInput(), child, consultations: [makeConsultation('2026-04-01')] };
    expect(r2NoConsultOver24m(input)).toBeNull();
  });

  it('gera alerta se última consulta há mais de 180 dias', () => {
    const input: RuleInput = { ...emptyInput(), child, consultations: [makeConsultation('2025-12-01')] };
    const alert = r2NoConsultOver24m(input);
    expect(alert).not.toBeNull();
    expect(alert?.ruleId).toBe('R2_NO_CONSULT_OVER_24M');
  });

  it('não se aplica a criança ≤ 24 meses', () => {
    const childYoung = makeChild({ birthDate: '2025-01-19' });
    const input: RuleInput = { ...emptyInput(), child: childYoung };
    expect(r2NoConsultOver24m(input)).toBeNull();
  });
});

// ─── R3 ───────────────────────────────────────────────────────────────────────

describe('r3LateVaccination', () => {
  it('gera alerta HIGH_PRIORITY se último registro é "atrasada"', () => {
    const input: RuleInput = { ...emptyInput(), vaccinationRecords: [makeVaccination('2026-07-01', 'atrasada')] };
    const alert = r3LateVaccination(input);
    expect(alert?.ruleId).toBe('R3_LATE_VACCINATION');
    expect(alert?.category).toBe('HIGH_PRIORITY');
  });

  it('não gera alerta se último registro é "em_dia"', () => {
    const input: RuleInput = {
      ...emptyInput(),
      vaccinationRecords: [
        makeVaccination('2026-06-01', 'atrasada'),
        makeVaccination('2026-07-01', 'em_dia'), // mais recente
      ],
    };
    expect(r3LateVaccination(input)).toBeNull();
  });

  it('não gera alerta sem registros', () => {
    expect(r3LateVaccination(emptyInput())).toBeNull();
  });
});

//// ─── R5 ───────────────────────────────────────────────────────────────────────
 
describe('r5NoWeight30dUnder6m', () => {
  const child = makeChild({ birthDate: '2026-06-19' }); // ~1 mês na REF

  it('gera alerta HIGH_PRIORITY se sem peso há mais de 30 dias', () => {
    const input: RuleInput = { ...emptyInput(), child, growthMeasurements: [makeGrowth('2026-05-18', 3.5)] };
    const alert = r5NoWeight30dUnder6m(input);
    expect(alert?.ruleId).toBe('R5_NO_WEIGHT_30D_UNDER_6M');
    expect(alert?.category).toBe('HIGH_PRIORITY');
  });

  it('não gera alerta se tem peso recente (< 30 dias)', () => {
    const input: RuleInput = { ...emptyInput(), child, growthMeasurements: [makeGrowth('2026-07-01', 5.0)] };
    expect(r5NoWeight30dUnder6m(input)).toBeNull();
  });

  it('não se aplica a criança > 6 meses', () => {
    const childOld = makeChild({ birthDate: '2025-01-01' }); // > 6 meses
    const input: RuleInput = { ...emptyInput(), child: childOld };
    expect(r5NoWeight30dUnder6m(input)).toBeNull();
  });

  it('ignora medições sem peso (só altura)', () => {
    const child2m = makeChild({ birthDate: '2026-06-19' });
    const input: RuleInput = {
      ...emptyInput(),
      child: child2m,
      growthMeasurements: [makeGrowth('2026-05-18')], // sem weightKg
    };
    expect(r5NoWeight30dUnder6m(input)).not.toBeNull();
  });
});

// ─── R4 ───────────────────────────────────────────────────────────────────────

describe('r4NoGrowth90d', () => {
  it('gera alerta se última medição há mais de 90 dias', () => {
    const input: RuleInput = { ...emptyInput(), growthMeasurements: [makeGrowth('2026-03-01')] };
    const alert = r4NoGrowth90d(input);
    expect(alert?.ruleId).toBe('R4_NO_GROWTH_90D');
    expect(alert?.category).toBe('ATTENTION');
  });

  it('não gera alerta se medição recente', () => {
    const input: RuleInput = { ...emptyInput(), growthMeasurements: [makeGrowth('2026-06-01')] };
    expect(r4NoGrowth90d(input)).toBeNull();
  });

  it('gera alerta se sem medições', () => {
    expect(r4NoGrowth90d(emptyInput())).not.toBeNull();
  });
});

// ─── R6 ───────────────────────────────────────────────────────────────────────

describe('r6DevelopmentFollowUp', () => {
  it('gera alerta se último assessment tem o sinalizador (Requires Follow Up via R6)', () => {
    const dev = makeDevelopment('2026-07-01');
    dev.requiresFollowUp = true;
    const input: RuleInput = { ...emptyInput(), developmentAssessments: [dev] };
    const alert = r6DevelopmentFollowUp(input);
    expect(alert?.ruleId).toBe('R6_DEVELOPMENT_FOLLOW_UP');
  });

  it('não gera alerta se último assessment não necessita follow up', () => {
    const dev1 = makeDevelopment('2026-06-01');
    dev1.requiresFollowUp = true;
    const dev2 = makeDevelopment('2026-07-01'); // mais recente
    dev2.requiresFollowUp = false;
    const input: RuleInput = {
      ...emptyInput(),
      developmentAssessments: [dev1, dev2],
    };
    expect(r6DevelopmentFollowUp(input)).toBeNull();
  });

  it('não gera alerta sem assessments', () => {
    expect(r6DevelopmentFollowUp(emptyInput())).toBeNull();
  });
});

// ─── R7 ───────────────────────────────────────────────────────────────────────

describe('r7FeedingFollowUpRecurrent', () => {
  it('gera alerta HIGH_PRIORITY com ≥ 2 registros com requiresFollowUp', () => {
    const input: RuleInput = {
      ...emptyInput(),
      feedingRecords: [makeFeeding('2026-05-01', true), makeFeeding('2026-06-01', true)],
    };
    const alert = r7FeedingFollowUpRecurrent(input);
    expect(alert?.ruleId).toBe('R7_CHOKING_RECURRENT');
    expect(alert?.category).toBe('HIGH_PRIORITY');
  });

  it('não gera alerta com apenas 1 registro', () => {
    const input: RuleInput = { ...emptyInput(), feedingRecords: [makeFeeding('2026-07-01', true)] };
    expect(r7FeedingFollowUpRecurrent(input)).toBeNull();
  });

  it('não gera alerta sem requiresFollowUp', () => {
    const input: RuleInput = {
      ...emptyInput(),
      feedingRecords: [makeFeeding('2026-05-01', false), makeFeeding('2026-06-01', false)],
    };
    expect(r7FeedingFollowUpRecurrent(input)).toBeNull();
  });
});

// ─── R8 ───────────────────────────────────────────────────────────────────────

describe('r8SleepFollowUpRecurrent', () => {
  it('gera alerta HIGH_PRIORITY com ≥ 2 registros de sono com requiresFollowUp', () => {
    const input: RuleInput = {
      ...emptyInput(),
      sleepRecords: [makeSleep('2026-05-01', true), makeSleep('2026-06-01', true)],
    };
    const alert = r8SleepFollowUpRecurrent(input);
    expect(alert?.ruleId).toBe('R8_PRONE_SLEEP_UNDER_6M');
    expect(alert?.category).toBe('HIGH_PRIORITY');
  });

  it('não gera alerta com apenas 1 registro', () => {
    const input: RuleInput = { ...emptyInput(), sleepRecords: [makeSleep('2026-07-01', true)] };
    expect(r8SleepFollowUpRecurrent(input)).toBeNull();
  });
});

// ─── R9 ───────────────────────────────────────────────────────────────────────

describe('r9DevelopmentDelayMultiple', () => {
  const child = makeChild();

  it('não gera alerta se todos os marcos foram alcançados', () => {
    const input: RuleInput = {
      ...emptyInput(),
      child,
      developmentAssessments: [
        makeDevelopment('2026-07-01', [
          { domain: 'motor_grosso', description: 'Anda com apoio', status: 'ACHIEVED' },
        ]),
      ],
    };
    expect(r9DevelopmentDelayMultiple(input)).toBeNull();
  });

  it('gera alerta ATTENTION se tem exatamente 1 marco atrasado', () => {
    const input: RuleInput = {
      ...emptyInput(),
      child,
      developmentAssessments: [
        makeDevelopment('2026-07-01', [
          { domain: 'motor_grosso', description: 'Anda com apoio', status: 'NOT_ACHIEVED' },
        ]),
      ],
    };
    const alert = r9DevelopmentDelayMultiple(input);
    expect(alert?.ruleId).toBe('R9_DEVELOPMENT_DELAY_MULTIPLE');
    expect(alert?.category).toBe('ATTENTION');
    expect(alert?.title).toBe('Atraso no desenvolvimento (Denver II)');
  });

  it('gera alerta HIGH_PRIORITY se tem 2 ou mais marcos atrasados', () => {
    const input: RuleInput = {
      ...emptyInput(),
      child,
      developmentAssessments: [
        makeDevelopment('2026-07-01', [
          { domain: 'motor_grosso', description: 'Anda com apoio', status: 'NOT_ACHIEVED' },
          { domain: 'comunicacao', description: 'Fala mama/papa', status: 'NOT_ACHIEVED' },
        ]),
      ],
    };
    const alert = r9DevelopmentDelayMultiple(input);
    expect(alert?.ruleId).toBe('R9_DEVELOPMENT_DELAY_MULTIPLE');
    expect(alert?.category).toBe('HIGH_PRIORITY');
    expect(alert?.title).toContain('Atrasos múltiplos');
    expect(alert?.description).toContain('Neuropediatra');
  });
});

// ─── R10 ──────────────────────────────────────────────────────────────────────

describe('r10SafetyAlertChokingApnea', () => {
  it('gera alerta HIGH_PRIORITY se houver engasgo no histórico da consulta recente', () => {
    const child = makeChild();
    const consult: Consultation = {
      id: 'c1',
      childId: child.id,
      professionalId: 'prof-1',
      consultationDate: '2026-07-15',
      ageInDays: 30,
      status: 'completed',
      intervalHistory: 'Bebê engasgou ontem mamando.',
      createdAt: '2026-07-15T00:00:00Z',
      updatedAt: '2026-07-15T00:00:00Z',
    };
    const input: RuleInput = { ...emptyInput(), child, consultations: [consult] };
    const alert = r10SafetyAlertChokingApnea(input);
    expect(alert?.ruleId).toBe('R10_SAFETY_ALERT_CHOKING_APNEA');
    expect(alert?.category).toBe('HIGH_PRIORITY');
    expect(alert?.title).toContain('Engasgo');
  });

  it('gera alerta HIGH_PRIORITY se houver apneia', () => {
    const child = makeChild();
    const consult: Consultation = {
      id: 'c1',
      childId: child.id,
      professionalId: 'prof-1',
      consultationDate: '2026-07-15',
      ageInDays: 30,
      status: 'completed',
      clinicalNotes: 'Mãe relata episódios de apneia durante o sono.',
      createdAt: '2026-07-15T00:00:00Z',
      updatedAt: '2026-07-15T00:00:00Z',
    };
    const input: RuleInput = { ...emptyInput(), child, consultations: [consult] };
    const alert = r10SafetyAlertChokingApnea(input);
    expect(alert?.ruleId).toBe('R10_SAFETY_ALERT_CHOKING_APNEA');
    expect(alert?.category).toBe('HIGH_PRIORITY');
    expect(alert?.title).toContain('Apneia');
  });
});

// ─── evaluateRules ────────────────────────────────────────────────────────────

describe('evaluateRules', () => {
  it('retorna array vazio para criança com tudo em dia', () => {
    const child = makeChild({ birthDate: '2025-07-19' }); // ~1 ano
    const input: RuleInput = {
      child,
      referenceDate: REF,
      consultations: [makeConsultation('2026-06-01')],
      growthMeasurements: [makeGrowth('2026-06-01', 8.0)],
      developmentAssessments: [makeDevelopment('2026-06-01', [])],
      feedingRecords: [makeFeeding('2026-06-01', false)],
      sleepRecords: [makeSleep('2026-06-01', false)],
      vaccinationRecords: [makeVaccination('2026-06-01', 'em_dia')],
    };
    expect(evaluateRules(input)).toHaveLength(0);
  });

  it('retorna múltiplos alertas para criança com várias pendências', () => {
    const child = makeChild({ birthDate: '2025-07-19' }); // ~1 ano
    const input: RuleInput = {
      child,
      referenceDate: REF,
      consultations: [], // sem consulta → R1
      growthMeasurements: [], // sem crescimento → R4
      developmentAssessments: [],
      feedingRecords: [],
      sleepRecords: [],
      vaccinationRecords: [makeVaccination('2026-07-01', 'atrasada')], // → R3
    };
    const alerts = evaluateRules(input);
    const ruleIds = alerts.map((a) => a.ruleId);
    expect(ruleIds).toContain('R1_NO_CONSULT_UNDER_24M');
    expect(ruleIds).toContain('R3_LATE_VACCINATION');
    expect(ruleIds).toContain('R4_NO_GROWTH_90D');
  });
});
