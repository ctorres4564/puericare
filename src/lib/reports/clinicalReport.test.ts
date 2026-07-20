import { describe, test, expect } from 'vitest';

import { buildClinicalReport, type ClinicalReportInput } from './clinicalReport';
import type {
  Child,
  UserProfile,
  Consultation,
  GrowthMeasurement,
  DevelopmentAssessment,
  FeedingRecord,
  SleepRecord,
  VaccinationRecord,
  ClinicalAlert,
} from '@/lib/types';

/* ── Fixtures ── */

const child: Child = {
  id: 'child-1',
  professionalId: 'pro-1',
  caregiverIds: [],
  fullName: 'Maria Teste',
  birthDate: '2024-01-15',
  sexAtBirth: 'female',
  caregiverName: 'Joana Responsável',
  contactPhone: '11988887777',
  active: true,
  createdAt: '2024-01-20T10:00:00.000Z',
  updatedAt: '2024-01-20T10:00:00.000Z',
};

const professional: UserProfile = {
  uid: 'pro-1',
  email: 'dra@example.com',
  displayName: 'Dra. Ana',
  role: 'PROFESSIONAL',
  crm: '12345-SP',
  specialty: 'Pediatria',
  active: true,
  createdAt: '2024-01-01T10:00:00.000Z',
  updatedAt: '2024-01-01T10:00:00.000Z',
};

const consultation = (over: Partial<Consultation> = {}): Consultation => ({
  id: 'c-1',
  childId: 'child-1',
  professionalId: 'pro-1',
  consultationDate: '2024-06-01',
  ageInDays: 138,
  reason: 'Acompanhamento',
  plan: 'Manter rotina',
  status: 'completed',
  createdAt: '2024-06-01T10:00:00.000Z',
  updatedAt: '2024-06-01T10:00:00.000Z',
  ...over,
});

const measurement = (over: Partial<GrowthMeasurement> = {}): GrowthMeasurement => ({
  id: 'm-1',
  childId: 'child-1',
  professionalId: 'pro-1',
  measurementDate: '2024-06-01',
  ageInDays: 138,
  weightKg: 7.5,
  heightCm: 65,
  headCircumferenceCm: 42,
  bmi: 17.8,
  createdAt: '2024-06-01T10:00:00.000Z',
  updatedAt: '2024-06-01T10:00:00.000Z',
  ...over,
});

const assessment = (over: Partial<DevelopmentAssessment> = {}): DevelopmentAssessment => ({
  id: 'd-1',
  childId: 'child-1',
  professionalId: 'pro-1',
  assessmentDate: '2024-06-01',
  ageInDays: 138,
  milestones: [{ domain: 'motor_grosso', description: 'Sustenta a cabeça', status: 'ACHIEVED' }],
  observations: 'Sem intercorrências',
  requiresFollowUp: false,
  createdAt: '2024-06-01T10:00:00.000Z',
  updatedAt: '2024-06-01T10:00:00.000Z',
  ...over,
});

const feeding = (over: Partial<FeedingRecord> = {}): FeedingRecord => ({
  id: 'f-1',
  childId: 'child-1',
  professionalId: 'pro-1',
  recordDate: '2024-06-01',
  ageInDays: 138,
  feedingHistory: 'Aleitamento exclusivo',
  difficulties: 'Pega fraca',
  requiresFollowUp: false,
  createdAt: '2024-06-01T10:00:00.000Z',
  updatedAt: '2024-06-01T10:00:00.000Z',
  ...over,
});

const sleep = (over: Partial<SleepRecord> = {}): SleepRecord => ({
  id: 's-1',
  childId: 'child-1',
  professionalId: 'pro-1',
  recordDate: '2024-06-01',
  ageInDays: 138,
  bedtime: '20:30',
  nightWakings: 2,
  requiresFollowUp: false,
  createdAt: '2024-06-01T10:00:00.000Z',
  updatedAt: '2024-06-01T10:00:00.000Z',
  ...over,
});

const vaccination = (over: Partial<VaccinationRecord> = {}): VaccinationRecord => ({
  id: 'v-1',
  childId: 'child-1',
  professionalId: 'pro-1',
  recordDate: '2024-06-01',
  ageInDays: 138,
  status: 'em_dia',
  vaccineName: 'Pentavalente',
  doseDescription: '1ª dose',
  createdAt: '2024-06-01T10:00:00.000Z',
  updatedAt: '2024-06-01T10:00:00.000Z',
  ...over,
});

const alert = (over: Partial<ClinicalAlert> = {}): ClinicalAlert => ({
  id: 'child-1_R4_NO_GROWTH_90D',
  childId: 'child-1',
  childName: 'Maria Teste',
  professionalId: 'pro-1',
  ruleId: 'R4_NO_GROWTH_90D',
  category: 'ATTENTION',
  title: 'Sem registro de crescimento há mais de 90 dias',
  description: 'Descrição da regra',
  clinicalSource: 'OMS — Padrões de Crescimento',
  status: 'active',
  detectedAt: '2024-09-01T10:00:00.000Z',
  createdAt: '2024-09-01T10:00:00.000Z',
  updatedAt: '2024-09-01T10:00:00.000Z',
  ...over,
});

/** Entrada mínima (todas as coleções vazias) com overrides. */
function input(over: Partial<ClinicalReportInput> = {}): ClinicalReportInput {
  return {
    child,
    professional,
    consultations: [],
    measurements: [],
    developmentAssessments: [],
    vaccinationRecords: [],
    feedingRecords: [],
    sleepRecords: [],
    alerts: [],
    referenceDate: '2025-01-15',
    generatedAt: '2025-01-15T12:00:00.000Z',
    ...over,
  };
}

/* ── Testes ── */

describe('buildClinicalReport — paciente com dados completos', () => {
  const report = buildClinicalReport(
    input({
      child: {
        ...child,
        socialName: undefined,
        contactEmail: 'joana@example.com',
        perinatalData: {
          gestationalAgeWeeks: 39,
          deliveryType: 'cesarean',
          birthWeightGrams: 3200,
          birthLengthCm: 49,
          birthHeadCircumferenceCm: 35,
          apgar1: 8,
          apgar5: 9,
          premature: false,
          neonatalHospitalization: false,
        },
      },
      consultations: [consultation()],
      measurements: [measurement()],
      developmentAssessments: [assessment()],
      vaccinationRecords: [vaccination()],
      feedingRecords: [feeding()],
      sleepRecords: [sleep()],
      alerts: [alert()],
    })
  );

  test('mapeia a identificação da criança, com idade calculada na data de referência', () => {
    expect(report.patient).toEqual({
      id: 'child-1',
      fullName: 'Maria Teste',
      socialName: undefined,
      birthDate: '2024-01-15',
      ageInDays: 366, // 2024-01-15 → 2025-01-15 (ano bissexto)
      sexAtBirth: 'female',
      caregiverName: 'Joana Responsável',
      contactPhone: '11988887777',
      contactEmail: 'joana@example.com',
      active: true,
    });
  });

  test('mapeia o profissional responsável', () => {
    expect(report.professional).toEqual({
      uid: 'pro-1',
      displayName: 'Dra. Ana',
      crm: '12345-SP',
      specialty: 'Pediatria',
    });
  });

  test('expõe os dados perinatais existentes', () => {
    expect(report.perinatal?.gestationalAgeWeeks).toBe(39);
    expect(report.perinatal?.apgar1).toBe(8);
    expect(report.perinatal?.premature).toBe(false);
  });

  test('preenche todas as seções clínicas', () => {
    expect(report.growth.measurements).toHaveLength(1);
    expect(report.growth.latest?.id).toBe('m-1');
    expect(report.development.assessments).toHaveLength(1);
    expect(report.feeding.records).toHaveLength(1);
    expect(report.sleep.records).toHaveLength(1);
    expect(report.vaccination.records).toHaveLength(1);
    expect(report.consultations).toHaveLength(1);
    expect(report.alerts).toHaveLength(1);
    // 7 registros → 7 entradas na timeline (consulta, medição, desenvolvimento,
    // vacina, alimentação, sono e alerta ativo)
    expect(report.timeline).toHaveLength(7);
  });

  test('carrega referenceDate e generatedAt informados (determinístico)', () => {
    expect(report.referenceDate).toBe('2025-01-15');
    expect(report.generatedAt).toBe('2025-01-15T12:00:00.000Z');
  });
});

describe('buildClinicalReport — dados parciais e ausentes', () => {
  test('funciona com todas as coleções vazias', () => {
    const report = buildClinicalReport(input());

    expect(report.growth).toEqual({ measurements: [], latest: null });
    expect(report.development.assessments).toEqual([]);
    expect(report.feeding.records).toEqual([]);
    expect(report.sleep.records).toEqual([]);
    expect(report.vaccination.records).toEqual([]);
    expect(report.consultations).toEqual([]);
    expect(report.alerts).toEqual([]);
    expect(report.timeline).toEqual([]);
  });

  test('paciente sem medições: growth.latest é null', () => {
    const report = buildClinicalReport(input({ consultations: [consultation()] }));
    expect(report.growth.measurements).toEqual([]);
    expect(report.growth.latest).toBeNull();
  });

  test('paciente sem desenvolvimento, vacinação ou consultas: seções vazias', () => {
    const report = buildClinicalReport(input({ measurements: [measurement()] }));
    expect(report.development.assessments).toEqual([]);
    expect(report.vaccination.records).toEqual([]);
    expect(report.consultations).toEqual([]);
    expect(report.growth.measurements).toHaveLength(1);
  });

  test('campos opcionais ausentes: perinatal null, socialName/contactEmail undefined', () => {
    const report = buildClinicalReport(input());
    expect(report.perinatal).toBeNull();
    expect(report.patient.socialName).toBeUndefined();
    expect(report.patient.contactEmail).toBeUndefined();
  });

  test('perfil do profissional inexistente: professional é null e o relatório é montado', () => {
    const report = buildClinicalReport(input({ professional: null, consultations: [consultation()] }));
    expect(report.professional).toBeNull();
    expect(report.consultations).toHaveLength(1);
  });

  test('não inventa dados: campos opcionais de um registro permanecem undefined', () => {
    const report = buildClinicalReport(
      input({ measurements: [measurement({ heightCm: undefined, headCircumferenceCm: undefined, bmi: undefined })] })
    );
    const m = report.growth.measurements[0];
    expect(m.weightKg).toBe(7.5);
    expect(m.heightCm).toBeUndefined();
    expect(m.headCircumferenceCm).toBeUndefined();
    expect(m.bmi).toBeUndefined();
  });
});

describe('buildClinicalReport — ordenação cronológica', () => {
  test('ordena múltiplos registros por data crescente em cada seção', () => {
    const report = buildClinicalReport(
      input({
        consultations: [
          consultation({ id: 'c-new', consultationDate: '2024-09-01', createdAt: '2024-09-01T10:00:00.000Z' }),
          consultation({ id: 'c-old', consultationDate: '2024-03-01', createdAt: '2024-03-01T10:00:00.000Z' }),
        ],
        measurements: [
          measurement({ id: 'm-new', measurementDate: '2024-09-01', createdAt: '2024-09-01T10:00:00.000Z' }),
          measurement({ id: 'm-old', measurementDate: '2024-03-01', createdAt: '2024-03-01T10:00:00.000Z' }),
        ],
        vaccinationRecords: [
          vaccination({ id: 'v-new', recordDate: '2024-08-01', createdAt: '2024-08-01T10:00:00.000Z' }),
          vaccination({ id: 'v-old', recordDate: '2024-02-01', createdAt: '2024-02-01T10:00:00.000Z' }),
        ],
      })
    );

    expect(report.consultations.map((c) => c.id)).toEqual(['c-old', 'c-new']);
    expect(report.growth.measurements.map((m) => m.id)).toEqual(['m-old', 'm-new']);
    expect(report.vaccination.records.map((v) => v.id)).toEqual(['v-old', 'v-new']);
  });

  test('timeline fica em ordem decrescente (reuso de buildTimeline)', () => {
    const report = buildClinicalReport(
      input({
        consultations: [consultation({ consultationDate: '2024-03-01' })],
        measurements: [measurement({ measurementDate: '2024-09-01' })],
      })
    );
    expect(report.timeline.map((e) => e.date)).toEqual(['2024-09-01', '2024-03-01']);
  });

  test('alertas ficam do mais recente para o mais antigo, todos os status', () => {
    const report = buildClinicalReport(
      input({
        alerts: [
          alert({ id: 'a-old', status: 'resolved', detectedAt: '2024-05-01T10:00:00.000Z', createdAt: '2024-05-01T10:00:00.000Z' }),
          alert({ id: 'a-new', detectedAt: '2024-10-01T10:00:00.000Z', createdAt: '2024-10-01T10:00:00.000Z' }),
        ],
      })
    );
    expect(report.alerts.map((a) => a.id)).toEqual(['a-new', 'a-old']);
  });
});

describe('buildClinicalReport — última medição', () => {
  test('última medição é a de measurementDate mais recente', () => {
    const report = buildClinicalReport(
      input({
        measurements: [
          measurement({ id: 'm-1', measurementDate: '2024-06-01' }),
          measurement({ id: 'm-2', measurementDate: '2024-09-01', weightKg: 8.9, createdAt: '2024-09-01T10:00:00.000Z' }),
        ],
      })
    );
    expect(report.growth.latest?.id).toBe('m-2');
  });

  test('desempate na mesma data: createdAt mais recente', () => {
    const report = buildClinicalReport(
      input({
        measurements: [
          measurement({ id: 'm-first', measurementDate: '2024-06-01', createdAt: '2024-06-01T08:00:00.000Z' }),
          measurement({ id: 'm-second', measurementDate: '2024-06-01', createdAt: '2024-06-01T18:00:00.000Z' }),
        ],
      })
    );
    expect(report.growth.latest?.id).toBe('m-second');
  });
});

describe('buildClinicalReport — isolamento de dados', () => {
  test('ignora registros de outra criança e de outro profissional', () => {
    const report = buildClinicalReport(
      input({
        consultations: [
          consultation({ id: 'c-own' }),
          consultation({ id: 'c-other-child', childId: 'child-2' }),
          consultation({ id: 'c-other-pro', professionalId: 'pro-2' }),
        ],
        measurements: [
          measurement({ id: 'm-own' }),
          measurement({ id: 'm-other-child', childId: 'child-2' }),
          measurement({ id: 'm-other-pro', professionalId: 'pro-2' }),
        ],
        alerts: [
          alert({ id: 'a-own' }),
          alert({ id: 'a-other', childId: 'child-2', professionalId: 'pro-2' }),
        ],
      })
    );

    expect(report.consultations.map((c) => c.id)).toEqual(['c-own']);
    expect(report.growth.measurements.map((m) => m.id)).toEqual(['m-own']);
    expect(report.alerts.map((a) => a.id)).toEqual(['a-own']);
    // A timeline também não pode conter nada de outra criança/profissional
    expect(report.timeline.map((e) => e.id).sort()).toEqual(['a-own', 'c-own', 'm-own']);
  });
});

describe('buildClinicalReport — semântica da timeline', () => {
  test('consultas canceladas entram no histórico, mas não na timeline', () => {
    const report = buildClinicalReport(
      input({ consultations: [consultation({ id: 'c-cancelled', status: 'cancelled' })] })
    );
    expect(report.consultations).toHaveLength(1);
    expect(report.timeline).toHaveLength(0);
  });

  test('só alertas ativos entram na timeline; resolvidos ficam só na seção de alertas', () => {
    const report = buildClinicalReport(
      input({
        alerts: [
          alert({ id: 'a-active', status: 'active' }),
          alert({ id: 'a-resolved', status: 'resolved' }),
          alert({ id: 'a-dismissed', status: 'dismissed' }),
        ],
      })
    );
    expect(report.alerts).toHaveLength(3);
    expect(report.timeline.map((e) => e.id)).toEqual(['a-active']);
  });
});
