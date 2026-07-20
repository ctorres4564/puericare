import { describe, test, expect } from 'vitest';

import {
  createInitialComposition,
  listReportSections,
  isSectionIncluded,
  sectionHasData,
  setSectionIncluded,
  setNarrativeField,
  setInstitutionalField,
  REPORT_SECTION_ORDER,
  REPORT_SECTION_TITLES,
} from './composition';
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

/* ── Fixtures (relatório montado pelo agregador do B.1 — sem duplicar lógica) ── */

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

const baseRecord = {
  childId: 'child-1',
  professionalId: 'pro-1',
  ageInDays: 138,
  createdAt: '2024-06-01T10:00:00.000Z',
  updatedAt: '2024-06-01T10:00:00.000Z',
};

const fullInput: ClinicalReportInput = {
  child: {
    ...child,
    perinatalData: { gestationalAgeWeeks: 39, premature: false, neonatalHospitalization: false },
  },
  professional,
  consultations: [
    { ...baseRecord, id: 'c-1', consultationDate: '2024-06-01', status: 'completed' } as Consultation,
  ],
  measurements: [
    { ...baseRecord, id: 'm-1', measurementDate: '2024-06-01', weightKg: 7.5 } as GrowthMeasurement,
  ],
  developmentAssessments: [
    { ...baseRecord, id: 'd-1', assessmentDate: '2024-06-01', milestones: [], requiresFollowUp: false } as DevelopmentAssessment,
  ],
  vaccinationRecords: [
    { ...baseRecord, id: 'v-1', recordDate: '2024-06-01', status: 'em_dia' } as VaccinationRecord,
  ],
  feedingRecords: [
    { ...baseRecord, id: 'f-1', recordDate: '2024-06-01', requiresFollowUp: false } as FeedingRecord,
  ],
  sleepRecords: [
    { ...baseRecord, id: 's-1', recordDate: '2024-06-01', requiresFollowUp: false } as SleepRecord,
  ],
  alerts: [
    {
      ...baseRecord,
      id: 'a-1',
      childName: 'Maria Teste',
      ruleId: 'R4_NO_GROWTH_90D',
      category: 'ATTENTION',
      title: 'Alerta',
      description: 'Desc',
      clinicalSource: 'OMS',
      status: 'active',
      detectedAt: '2024-06-01T10:00:00.000Z',
    } as ClinicalAlert,
  ],
  referenceDate: '2025-01-15',
  generatedAt: '2025-01-15T12:00:00.000Z',
};

const emptyInput: ClinicalReportInput = {
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
};

/* ── Testes ── */

describe('createInitialComposition — relatório completo', () => {
  const data = buildClinicalReport(fullInput);
  const composition = createInitialComposition(data);

  test('todas as seções começam incluídas e com dados', () => {
    const sections = listReportSections(data, composition);
    expect(sections.map((s) => s.id)).toEqual([...REPORT_SECTION_ORDER]);
    for (const s of sections) {
      expect(s.included).toBe(true);
      expect(s.hasData).toBe(true);
    }
  });

  test('campos narrativos começam vazios (nada é gerado automaticamente)', () => {
    expect(composition.narrative).toEqual({
      purpose: '',
      clinicalSummary: '',
      evolution: '',
      recommendations: '',
      conclusion: '',
    });
  });

  test('dados institucionais pré-preenchidos a partir do perfil e da data de referência', () => {
    expect(composition.institutional).toEqual({
      professionalName: 'Dra. Ana',
      professionalRegistry: '12345-SP',
      specialty: 'Pediatria',
      clinicName: '',
      location: '',
      reportDate: '2025-01-15',
    });
  });
});

describe('createInitialComposition — dados parciais e seções vazias', () => {
  test('relatório sem nenhum registro: todas as seções sem dados, mas ainda selecionáveis', () => {
    const data = buildClinicalReport(emptyInput);
    const sections = listReportSections(data, createInitialComposition(data));

    for (const s of sections) {
      expect(s.hasData).toBe(false);
      expect(s.included).toBe(true); // inclusão é decisão do profissional, não do dado
    }
  });

  test('relatório parcial: só as seções com registros têm hasData=true', () => {
    const data = buildClinicalReport({
      ...emptyInput,
      measurements: fullInput.measurements,
      consultations: fullInput.consultations,
    });
    const sections = listReportSections(data, createInitialComposition(data));
    const byId = Object.fromEntries(sections.map((s) => [s.id, s.hasData]));

    expect(byId.growth).toBe(true);
    expect(byId.consultations).toBe(true);
    expect(byId.timeline).toBe(true); // consulta + medição entram na timeline
    expect(byId.perinatal).toBe(false);
    expect(byId.development).toBe(false);
    expect(byId.feeding).toBe(false);
    expect(byId.sleep).toBe(false);
    expect(byId.vaccination).toBe(false);
    expect(byId.alerts).toBe(false);
  });

  test('sectionHasData espelha o conteúdo de cada seção', () => {
    const data = buildClinicalReport(fullInput);
    for (const id of REPORT_SECTION_ORDER) {
      expect(sectionHasData(data, id)).toBe(true);
    }
  });
});

describe('seleção de seções', () => {
  const data = buildClinicalReport(fullInput);

  test('excluir uma seção a remove da prévia (isSectionIncluded=false)', () => {
    const initial = createInitialComposition(data);
    const updated = setSectionIncluded(initial, 'growth', false);

    expect(isSectionIncluded(updated, 'growth')).toBe(false);
    expect(listReportSections(data, updated).find((s) => s.id === 'growth')?.included).toBe(false);
    // as demais continuam incluídas
    for (const id of REPORT_SECTION_ORDER.filter((i) => i !== 'growth')) {
      expect(isSectionIncluded(updated, id)).toBe(true);
    }
  });

  test('reincluir uma seção volta a exibi-la', () => {
    const initial = createInitialComposition(data);
    const excluded = setSectionIncluded(initial, 'alerts', false);
    const restored = setSectionIncluded(excluded, 'alerts', true);

    expect(isSectionIncluded(restored, 'alerts')).toBe(true);
  });

  test('atualização é imutável: a composição original não muda', () => {
    const initial = createInitialComposition(data);
    setSectionIncluded(initial, 'sleep', false);

    expect(isSectionIncluded(initial, 'sleep')).toBe(true);
  });
});

describe('campos narrativos', () => {
  const data = buildClinicalReport(fullInput);

  test('setNarrativeField preenche só o campo alvo, de forma imutável', () => {
    const initial = createInitialComposition(data);
    const updated = setNarrativeField(initial, 'clinicalSummary', 'Texto do profissional.');

    expect(updated.narrative.clinicalSummary).toBe('Texto do profissional.');
    expect(updated.narrative.purpose).toBe('');
    expect(initial.narrative.clinicalSummary).toBe('');
  });

  test('todos os campos narrativos são editáveis', () => {
    let composition = createInitialComposition(data);
    composition = setNarrativeField(composition, 'purpose', 'Finalidade');
    composition = setNarrativeField(composition, 'evolution', 'Evolução');
    composition = setNarrativeField(composition, 'recommendations', 'Recomendações');
    composition = setNarrativeField(composition, 'conclusion', 'Conclusão');

    expect(composition.narrative).toEqual({
      purpose: 'Finalidade',
      clinicalSummary: '',
      evolution: 'Evolução',
      recommendations: 'Recomendações',
      conclusion: 'Conclusão',
    });
  });
});

describe('dados institucionais', () => {
  const data = buildClinicalReport(fullInput);

  test('clínica e local começam vazios (opcionais, não existem no modelo)', () => {
    const composition = createInitialComposition(data);
    expect(composition.institutional.clinicName).toBe('');
    expect(composition.institutional.location).toBe('');
  });

  test('campos institucionais são editáveis de forma imutável', () => {
    const initial = createInitialComposition(data);
    const updated = setInstitutionalField(initial, 'clinicName', 'Clínica Exemplo');

    expect(updated.institutional.clinicName).toBe('Clínica Exemplo');
    expect(updated.institutional.professionalName).toBe('Dra. Ana');
    expect(initial.institutional.clinicName).toBe('');
  });

  test('professional=null: campos do profissional ficam vazios e editáveis, relatório continua utilizável', () => {
    const data = buildClinicalReport({ ...fullInput, professional: null });
    const composition = createInitialComposition(data);

    expect(composition.institutional.professionalName).toBe('');
    expect(composition.institutional.professionalRegistry).toBe('');
    expect(composition.institutional.specialty).toBe('');
    expect(composition.institutional.reportDate).toBe('2025-01-15');

    const filled = setInstitutionalField(composition, 'professionalName', 'Dr. Manual');
    expect(filled.institutional.professionalName).toBe('Dr. Manual');
  });

  test('perfil sem CRM/especialidade: campos correspondentes ficam vazios', () => {
    const data = buildClinicalReport({
      ...fullInput,
      professional: { ...professional, crm: undefined, specialty: undefined },
    });
    const composition = createInitialComposition(data);

    expect(composition.institutional.professionalRegistry).toBe('');
    expect(composition.institutional.specialty).toBe('');
  });
});

describe('metadados das seções', () => {
  test('títulos estáveis para todas as seções', () => {
    for (const id of REPORT_SECTION_ORDER) {
      expect(REPORT_SECTION_TITLES[id]).toBeTruthy();
    }
    expect(REPORT_SECTION_ORDER).toHaveLength(9); // identificação é fixa, não entra na lista
  });
});
