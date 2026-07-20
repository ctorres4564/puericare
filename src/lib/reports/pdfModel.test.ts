import { describe, test, expect } from 'vitest';
import React from 'react';

import { buildReportPdfModel, buildReportFileName, formatPhoneBR } from './pdfModel';
import { buildClinicalReport, type ClinicalReportInput } from './clinicalReport';
import {
  createInitialComposition,
  setSectionIncluded,
  setNarrativeField,
  setInstitutionalField,
} from './composition';
import {
  ClinicalReportPdf,
  chunkRows,
  SAFE_GROUP_CHARS,
  GROWTH_TABLE_CHUNK_ROWS,
} from '@/components/reports/ClinicalReportPdf';
import { calculateAgeInDays } from '@/lib/consultations/ageInDays';
import { renderToBuffer } from '@react-pdf/renderer';
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
  fullName: 'Maria José da Conceição',
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

/**
 * Base de registro para a data 2024-06-01 (idade coerente: 2024-01-15 →
 * 2024-06-01 = 138 dias). Para outras datas, usar `ageAt(date)` — os
 * fixtures devem ser sempre temporalmente coerentes com o nascimento.
 */
const baseRecord = {
  childId: 'child-1',
  professionalId: 'pro-1',
  ageInDays: 138,
  createdAt: '2024-06-01T10:00:00.000Z',
  updatedAt: '2024-06-01T10:00:00.000Z',
};

/** Idade em dias da criança do fixture numa data (para registros coerentes). */
function ageAt(date: string): number {
  return calculateAgeInDays(child.birthDate, date);
}

const fullInput: ClinicalReportInput = {
  child: {
    ...child,
    perinatalData: {
      gestationalAgeWeeks: 39,
      deliveryType: 'cesarean',
      birthWeightGrams: 3200,
      apgar1: 8,
      apgar5: 9,
      premature: false,
      neonatalHospitalization: false,
    },
  },
  professional,
  consultations: [
    {
      ...baseRecord,
      id: 'c-1',
      consultationDate: '2024-06-01',
      reason: 'Acompanhamento de rotina',
      plan: 'Manter orientações',
      status: 'completed',
    } as Consultation,
  ],
  measurements: [
    {
      ...baseRecord,
      id: 'm-1',
      measurementDate: '2024-06-01',
      weightKg: 7.5,
      heightCm: 65,
      headCircumferenceCm: 42,
      bmi: 17.8,
    } as GrowthMeasurement,
  ],
  developmentAssessments: [
    {
      ...baseRecord,
      id: 'd-1',
      assessmentDate: '2024-06-01',
      milestones: [{ domain: 'motor_grosso', description: 'Sustenta a cabeça', status: 'ACHIEVED' }],
      observations: 'Sem intercorrências',
      requiresFollowUp: true,
    } as DevelopmentAssessment,
  ],
  vaccinationRecords: [
    {
      ...baseRecord,
      id: 'v-1',
      recordDate: '2024-06-01',
      status: 'em_dia',
      vaccineName: 'Pentavalente',
      doseDescription: '1ª dose',
    } as VaccinationRecord,
  ],
  feedingRecords: [
    {
      ...baseRecord,
      id: 'f-1',
      recordDate: '2024-06-01',
      feedingHistory: 'Aleitamento exclusivo',
      requiresFollowUp: false,
    } as FeedingRecord,
  ],
  sleepRecords: [
    {
      ...baseRecord,
      id: 's-1',
      recordDate: '2024-06-01',
      bedtime: '20:30',
      requiresFollowUp: false,
    } as SleepRecord,
  ],
  alerts: [
    {
      ...baseRecord,
      id: 'a-1',
      childName: 'Maria José da Conceição',
      ruleId: 'R6_DEVELOPMENT_FOLLOW_UP',
      category: 'ATTENTION',
      title: 'Acompanhamento de desenvolvimento sinalizado',
      description: 'Profissional marcou necessidade de acompanhamento.',
      clinicalSource: 'SBP — Caderno de Atenção Básica (2023)',
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

const fieldValue = (fields: { label: string; value: string }[], label: string) =>
  fields.find((f) => f.label === label)?.value;

/* ── Seleção de seções ── */

describe('buildReportPdfModel — seleção de seções', () => {
  const data = buildClinicalReport(fullInput);

  test('todas as seções selecionadas aparecem no modelo', () => {
    const model = buildReportPdfModel(data, createInitialComposition(data));
    expect(model.sections.map((s) => s.id)).toEqual([
      'perinatal',
      'growth',
      'development',
      'feeding',
      'sleep',
      'vaccination',
      'consultations',
      'alerts',
      'timeline',
    ]);
  });

  test('seções excluídas não aparecem no modelo', () => {
    let composition = createInitialComposition(data);
    composition = setSectionIncluded(composition, 'growth', false);
    composition = setSectionIncluded(composition, 'timeline', false);

    const model = buildReportPdfModel(data, composition);
    const ids = model.sections.map((s) => s.id);

    expect(ids).not.toContain('growth');
    expect(ids).not.toContain('timeline');
    expect(ids).toContain('perinatal');
  });

  test('identificação está sempre presente, mesmo com todas as seções excluídas', () => {
    let composition = createInitialComposition(data);
    for (const id of model_section_ids()) {
      composition = setSectionIncluded(composition, id, false);
    }
    const model = buildReportPdfModel(data, composition);

    expect(model.sections).toEqual([]);
    expect(model.patientFields.length).toBeGreaterThan(0);
    expect(fieldValue(model.patientFields, 'Nome')).toBe('Maria José da Conceição');
  });

  function model_section_ids() {
    return [
      'perinatal',
      'growth',
      'development',
      'feeding',
      'sleep',
      'vaccination',
      'consultations',
      'alerts',
      'timeline',
    ] as const;
  }
});

/* ── Identificação ── */

describe('buildReportPdfModel — identificação', () => {
  test('contém dados básicos formatados e não contém identificadores internos', () => {
    const data = buildClinicalReport(fullInput);
    const model = buildReportPdfModel(data, createInitialComposition(data));

    expect(fieldValue(model.patientFields, 'Nome')).toBe('Maria José da Conceição');
    expect(fieldValue(model.patientFields, 'Data de nascimento')).toBe('15/01/2024');
    expect(fieldValue(model.patientFields, 'Idade')).toBe('12 meses');
    expect(fieldValue(model.patientFields, 'Sexo')).toBe('Feminino');
    expect(fieldValue(model.patientFields, 'Responsável')).toBe('Joana Responsável');

    const json = JSON.stringify(model);
    expect(json).not.toContain('child-1');
    expect(json).not.toContain('pro-1');
  });

  test('sexo "não informado" é omitido da identificação', () => {
    const data = buildClinicalReport({ ...emptyInput, child: { ...child, sexAtBirth: 'not_informed' } });
    const model = buildReportPdfModel(data, createInitialComposition(data));

    expect(fieldValue(model.patientFields, 'Sexo')).toBeUndefined();
  });
});

/* ── Narrativa ── */

describe('buildReportPdfModel — narrativa', () => {
  const data = buildClinicalReport(fullInput);

  test('motivo/finalidade vai para o início (purpose); demais campos para o final (closingNarrative)', () => {
    let composition = createInitialComposition(data);
    composition = setNarrativeField(composition, 'purpose', 'Encaminhamento ao especialista.');
    composition = setNarrativeField(composition, 'conclusion', 'Criança em bom estado geral.');

    const model = buildReportPdfModel(data, composition);

    expect(model.purpose).toEqual({
      label: 'Motivo/finalidade do relatório',
      text: 'Encaminhamento ao especialista.',
    });
    expect(model.closingNarrative).toEqual([
      { label: 'Conclusão', text: 'Criança em bom estado geral.' },
    ]);
  });

  test('campos finais preservam a ordem clínica: síntese, evolução, orientações, conclusão', () => {
    let composition = createInitialComposition(data);
    composition = setNarrativeField(composition, 'conclusion', 'C.');
    composition = setNarrativeField(composition, 'clinicalSummary', 'S.');
    composition = setNarrativeField(composition, 'recommendations', 'R.');
    composition = setNarrativeField(composition, 'evolution', 'E.');

    const model = buildReportPdfModel(data, composition);

    expect(model.purpose).toBeNull();
    expect(model.closingNarrative.map((n) => n.label)).toEqual([
      'Síntese clínica',
      'Evolução',
      'Orientações/recomendações',
      'Conclusão',
    ]);
  });

  test('campos narrativos vazios são omitidos', () => {
    const model = buildReportPdfModel(data, createInitialComposition(data));
    expect(model.purpose).toBeNull();
    expect(model.closingNarrative).toEqual([]);
  });
});

/* ── Dados institucionais ── */

describe('buildReportPdfModel — dados institucionais', () => {
  const data = buildClinicalReport(fullInput);

  test('campos informados aparecem; clínica vazia vira null no cabeçalho', () => {
    const model = buildReportPdfModel(data, createInitialComposition(data));

    expect(model.clinicName).toBeNull();
    expect(model.reportDate).toBe('15/01/2025');
    expect(fieldValue(model.professionalFields, 'Profissional')).toBe('Dra. Ana');
    expect(fieldValue(model.professionalFields, 'CRM/registro')).toBe('12345-SP');
    expect(fieldValue(model.professionalFields, 'Especialidade')).toBe('Pediatria');
    expect(fieldValue(model.professionalFields, 'Clínica/serviço')).toBeUndefined();
    expect(fieldValue(model.professionalFields, 'Local')).toBeUndefined();
  });

  test('clínica e local preenchidos aparecem no cabeçalho e no bloco do profissional', () => {
    let composition = createInitialComposition(data);
    composition = setInstitutionalField(composition, 'clinicName', 'Clínica Bem Crescer');
    composition = setInstitutionalField(composition, 'location', 'São Paulo/SP');

    const model = buildReportPdfModel(data, composition);

    expect(model.clinicName).toBe('Clínica Bem Crescer');
    expect(fieldValue(model.professionalFields, 'Local')).toBe('São Paulo/SP');
  });

  test('professional=null: bloco do profissional usa apenas o que foi digitado na composição', () => {
    const data = buildClinicalReport({ ...fullInput, professional: null });
    let composition = createInitialComposition(data);
    composition = setInstitutionalField(composition, 'professionalName', 'Dr. Manual');

    const model = buildReportPdfModel(data, composition);

    expect(fieldValue(model.professionalFields, 'Profissional')).toBe('Dr. Manual');
    expect(fieldValue(model.professionalFields, 'CRM/registro')).toBeUndefined();

    const empty = buildReportPdfModel(data, createInitialComposition(data));
    expect(empty.professionalFields).toEqual([]);
  });
});

/* ── Seções clínicas ── */

describe('buildReportPdfModel — conteúdo das seções', () => {
  const data = buildClinicalReport(fullInput);
  const model = buildReportPdfModel(data, createInitialComposition(data));
  const byId = Object.fromEntries(model.sections.map((s) => [s.id, s]));

  test('crescimento vira tabela com colunas clínicas, sem percentil/escore-Z', () => {
    const growth = byId.growth;
    expect(growth.table?.columns).toEqual(['Data', 'Idade', 'Peso (kg)', 'Comprimento (cm)', 'PC (cm)', 'IMC']);
    expect(growth.table?.rows).toEqual([['01/06/2024', '4 meses', '7.5', '65', '42', '17.8']]);
    expect(JSON.stringify(growth)).not.toMatch(/percentil|escore/i);
  });

  test('desenvolvimento traz marcos com domínio/status e badge de acompanhamento', () => {
    const dev = byId.development;
    expect(dev.records).toHaveLength(1);
    expect(dev.records?.[0].badge).toBe('Necessita acompanhamento');
    expect(dev.records?.[0].fields[0].label).toBeTruthy();
    expect(dev.records?.[0].fields[0].value).toContain('Sustenta a cabeça');
  });

  test('vacinação traz status registrado e nota de escopo (sem inferência de esquema)', () => {
    const vac = byId.vaccination;
    expect(vac.records?.[0].badge).toBe('Em dia');
    expect(fieldValue(vac.records?.[0].fields ?? [], 'Vacina')).toBe('Pentavalente');
    expect(vac.note).toContain('sem inferência');
  });

  test('consultas preservam o status', () => {
    expect(byId.consultations.records?.[0].badge).toBe('Finalizada');
    expect(fieldValue(byId.consultations.records?.[0].fields ?? [], 'Motivo')).toBe('Acompanhamento de rotina');
  });

  test('alertas trazem fonte e nota de que não são diagnóstico', () => {
    const alerts = byId.alerts;
    expect(alerts.note).toContain('não constituem diagnóstico');
    expect(fieldValue(alerts.records?.[0].fields ?? [], 'Fonte')).toBe('SBP — Caderno de Atenção Básica (2023)');
  });

  test('timeline é compacta (data · tipo — detalhe)', () => {
    const timeline = byId.timeline;
    expect(timeline.timeline?.every((i) => i.date && i.label)).toBe(true);
  });

  test('seções selecionadas sem dados são OMITIDAS do PDF (B.3.1)', () => {
    const emptyData = buildClinicalReport(emptyInput);
    const emptyModel = buildReportPdfModel(emptyData, createInitialComposition(emptyData));

    expect(emptyModel.sections).toEqual([]);
  });

  test('dados parciais: só as seções com registros entram no modelo', () => {
    const partial = buildClinicalReport({
      ...emptyInput,
      measurements: fullInput.measurements,
    });
    const partialModel = buildReportPdfModel(partial, createInitialComposition(partial));
    const ids = partialModel.sections.map((s) => s.id);

    // Medição entra no crescimento e na timeline; as demais são omitidas.
    expect(ids).toEqual(['growth', 'timeline']);
  });
});

/* ── Nome do arquivo ── */

describe('buildReportFileName', () => {
  test('normaliza acentos, espaços e maiúsculas', () => {
    expect(buildReportFileName('Maria José da Conceição', '2025-01-15')).toBe(
      'relatorio-maria-jose-da-conceicao-2025-01-15.pdf'
    );
  });

  test('remove caracteres especiais e colapsa separadores', () => {
    expect(buildReportFileName("  João D'Ávila (Filho)!!  ", '2025-12-31')).toBe(
      'relatorio-joao-d-avila-filho-2025-12-31.pdf'
    );
  });

  test('nome vazio usa fallback "paciente"; data inválida usa "sem-data"', () => {
    expect(buildReportFileName('', '2025-01-15')).toBe('relatorio-paciente-2025-01-15.pdf');
    expect(buildReportFileName('!!!', '15/01/2025')).toBe('relatorio-paciente-sem-data.pdf');
  });
});

/* ── Grande volume ── */

describe('buildReportPdfModel — grande volume de registros', () => {
  test('300 consultas e 200 medições entram integralmente no modelo', () => {
    const manyConsultations = Array.from({ length: 300 }, (_, i) => ({
      ...baseRecord,
      id: `c-${i}`,
      consultationDate: '2024-06-01',
      status: 'completed',
    })) as Consultation[];
    const manyMeasurements = Array.from({ length: 200 }, (_, i) => ({
      ...baseRecord,
      id: `m-${i}`,
      measurementDate: '2024-06-01',
      weightKg: 7 + i / 100,
    })) as GrowthMeasurement[];

    const data = buildClinicalReport({
      ...emptyInput,
      consultations: manyConsultations,
      measurements: manyMeasurements,
    });
    const model = buildReportPdfModel(data, createInitialComposition(data));
    const byId = Object.fromEntries(model.sections.map((s) => [s.id, s]));

    expect(byId.consultations.records).toHaveLength(300);
    expect(byId.growth.table?.rows).toHaveLength(200);
  });
});

/* ── Smoke test de geração ── */

describe('ClinicalReportPdf — geração do documento', () => {
  test('gera um PDF válido a partir do modelo (buffer com cabeçalho %PDF)', async () => {
    const data = buildClinicalReport(fullInput);
    let composition = createInitialComposition(data);
    composition = setNarrativeField(composition, 'clinicalSummary', 'Síntese de teste com acentuação: çãõé.');
    const model = buildReportPdfModel(data, composition);

    const buffer = await renderToBuffer(React.createElement(ClinicalReportPdf, { model }) as unknown as Parameters<typeof renderToBuffer>[0]);

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  }, 30000);

  test('documento com grande volume quebra em múltiplas páginas', async () => {
    const manyConsultations = Array.from({ length: 120 }, (_, i) => ({
      ...baseRecord,
      id: `c-${i}`,
      consultationDate: '2024-06-01',
      reason: `Consulta de acompanhamento número ${i + 1} com observações clínicas detalhadas.`,
      plan: 'Orientações gerais de cuidado e retorno agendado.',
      status: 'completed',
    })) as Consultation[];

    const data = buildClinicalReport({ ...emptyInput, consultations: manyConsultations });
    const model = buildReportPdfModel(data, createInitialComposition(data));

    const buffer = await renderToBuffer(React.createElement(ClinicalReportPdf, { model }) as unknown as Parameters<typeof renderToBuffer>[0]);
    const content = buffer.toString('latin1');
    const pageCount = (content.match(/\/Type\s*\/Page[^s]/g) ?? []).length;

    expect(pageCount).toBeGreaterThan(1);
  }, 30000);
});

/* ── Telefone (B.3.1) ── */

describe('formatPhoneBR', () => {
  test('celular com 11 dígitos vira (XX) 9XXXX-XXXX', () => {
    expect(formatPhoneBR('11988887777')).toBe('(11) 98888-7777');
  });

  test('fixo com 10 dígitos vira (XX) XXXX-XXXX', () => {
    expect(formatPhoneBR('1138887777')).toBe('(11) 3888-7777');
  });

  test('código do país 55 é reconhecido e removido', () => {
    expect(formatPhoneBR('5511988887777')).toBe('(11) 98888-7777');
    expect(formatPhoneBR('+55 11 98888-7777')).toBe('(11) 98888-7777');
  });

  test('formatos desconhecidos/internacionais são preservados como vieram', () => {
    expect(formatPhoneBR('+1 555 123 4567')).toBe('+1 555 123 4567');
    expect(formatPhoneBR('1234')).toBe('1234');
  });

  test('telefone da identificação sai formatado no modelo', () => {
    const data = buildClinicalReport(fullInput);
    const model = buildReportPdfModel(data, createInitialComposition(data));
    expect(fieldValue(model.patientFields, 'Telefone')).toBe('(11) 98888-7777');
  });
});

/* ── Coerência temporal (B.3.1) ── */

describe('coerência temporal dos dados do relatório', () => {
  test('a idade de cada linha de crescimento deriva da data do registro, não de valor fixo', () => {
    const measurements = ['2024-02-15', '2024-04-15', '2024-06-01'].map((date, i) => ({
      ...baseRecord,
      id: `m-${i}`,
      measurementDate: date,
      ageInDays: ageAt(date),
      weightKg: 5 + i,
    })) as GrowthMeasurement[];

    const data = buildClinicalReport({ ...emptyInput, measurements });
    const model = buildReportPdfModel(data, createInitialComposition(data));
    const rows = model.sections.find((s) => s.id === 'growth')?.table?.rows ?? [];
    const ages = rows.map((r) => r[1]);

    // Ordenação cronológica crescente → idades distintas e coerentes.
    expect(rows.map((r) => r[0])).toEqual(['15/02/2024', '15/04/2024', '01/06/2024']);
    expect(ages).toEqual(['31 dias', '3 meses', '4 meses']);
    expect(new Set(ages).size).toBe(3);
  });

  test('detalhe longo de item da timeline é truncado (linha compacta)', () => {
    const longConsultation = {
      ...baseRecord,
      id: 'c-long',
      consultationDate: '2024-06-01',
      reason: 'R'.repeat(500),
      status: 'completed',
    } as Consultation;

    const data = buildClinicalReport({ ...emptyInput, consultations: [longConsultation] });
    const model = buildReportPdfModel(data, createInitialComposition(data));
    const item = model.sections.find((s) => s.id === 'timeline')?.timeline?.[0];

    expect(item?.detail?.length).toBeLessThanOrEqual(140);
    expect(item?.detail?.endsWith('…')).toBe(true);
  });
});

/* ── Fragmentação de tabela (B.3.1) ── */

describe('chunkRows', () => {
  test('divide as linhas em blocos de tamanho fixo', () => {
    const rows = Array.from({ length: 30 }, (_, i) => [String(i)]);
    const chunks = chunkRows(rows, GROWTH_TABLE_CHUNK_ROWS);

    expect(chunks.map((c) => c.length)).toEqual([25, 5]);
    expect(chunks[0][0]).toEqual(['0']);
    expect(chunks[1][0]).toEqual(['25']);
  });

  test('lista vazia não produz chunks', () => {
    expect(chunkRows([], GROWTH_TABLE_CHUNK_ROWS)).toEqual([]);
  });
});

/* ── Estrutura de paginação do documento (B.3.1) ── */

/**
 * Expande a árvore de elementos: os primitivos do react-pdf (Document, Page,
 * View, Text) têm `type` string ('DOCUMENT', 'PAGE', 'VIEW', 'TEXT'); os
 * componentes locais são funções puras, chamadas com as props. Nós
 * condicionais (false/null) são descartados.
 */
function expand(node: unknown): unknown {
  if (node === null || node === undefined || typeof node === 'boolean') return null;
  if (typeof node === 'string' || typeof node === 'number') return node;
  if (Array.isArray(node)) return node.map(expand).filter((n) => n !== null);
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<Record<string, unknown>>;
    if (typeof el.type === 'function') {
      return expand((el.type as (p: Record<string, unknown>) => unknown)(el.props));
    }
    return {
      type: el.type,
      props: { ...el.props, children: expand((el.props as { children?: unknown }).children) },
    };
  }
  return null;
}

/** Textos estáticos da árvore expandida, em ordem de documento. */
function collectTexts(node: unknown): string[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectTexts);
  if (typeof node === 'object') {
    const el = node as { props?: { children?: unknown; render?: unknown } };
    if (el.props?.render) return []; // número de página é render prop — sem texto estático
    return collectTexts(el.props?.children);
  }
  return [];
}

interface ExpandedView {
  type: unknown;
  props: Record<string, unknown>;
}

function findViews(node: unknown, pred: (props: Record<string, unknown>) => boolean): ExpandedView[] {
  const out: ExpandedView[] = [];
  const walk = (n: unknown): void => {
    if (n === null || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    const el = n as ExpandedView;
    if (el.type === 'VIEW' && el.props && pred(el.props)) out.push(el);
    walk((el.props as { children?: unknown }).children);
  };
  walk(node);
  return out;
}

describe('ClinicalReportPdf — estrutura de paginação', () => {
  test('título de seção fica no mesmo bloco wrap={false} que o primeiro conteúdo', () => {
    const data = buildClinicalReport(fullInput);
    const model = buildReportPdfModel(data, createInitialComposition(data));
    const tree = expand(React.createElement(ClinicalReportPdf, { model }));

    const growthGroup = findViews(tree, (p) => p.wrap === false).find((v) => {
      const texts = collectTexts(v);
      return texts.includes('Crescimento') && texts.includes('Peso (kg)');
    });

    expect(growthGroup).toBeDefined();
  });

  test('seção cujo primeiro bloco excede o limiar inicia em página nova (break)', () => {
    const longConsultation = {
      ...baseRecord,
      id: 'c-long',
      consultationDate: '2024-06-01',
      reason: 'Relato extenso. '.repeat(150), // ~2.550 chars > SAFE_GROUP_CHARS
      status: 'completed',
    } as Consultation;

    const data = buildClinicalReport({ ...emptyInput, consultations: [longConsultation] });
    const model = buildReportPdfModel(data, createInitialComposition(data));
    const tree = expand(React.createElement(ClinicalReportPdf, { model }));

    const breaking = findViews(tree, (p) => p.break === true);
    expect(SAFE_GROUP_CHARS).toBeLessThan(2550);
    expect(breaking.some((v) => collectTexts(v).includes('Consultas'))).toBe(true);
  });

  test('ordem documental: finalidade no início; parecer e profissional no final', () => {
    const data = buildClinicalReport(fullInput);
    let composition = createInitialComposition(data);
    composition = setNarrativeField(composition, 'purpose', 'Avaliação solicitada pela escola.');
    composition = setNarrativeField(composition, 'clinicalSummary', 'Síntese de teste.');

    const model = buildReportPdfModel(data, composition);
    const texts = collectTexts(expand(React.createElement(ClinicalReportPdf, { model })));
    const idx = (t: string) => texts.indexOf(t);

    expect(idx('Identificação')).toBeGreaterThanOrEqual(0);
    expect(idx('Motivo/finalidade do relatório')).toBeGreaterThan(idx('Identificação'));
    expect(idx('Motivo/finalidade do relatório')).toBeLessThan(idx('Dados perinatais'));
    expect(idx('Parecer do profissional')).toBeGreaterThan(idx('Linha do tempo'));
    expect(idx('Profissional responsável')).toBeGreaterThan(idx('Parecer do profissional'));
  });

  test('tabela com mais linhas que o chunk repete o cabeçalho e marca continuação', () => {
    const measurements = Array.from({ length: GROWTH_TABLE_CHUNK_ROWS + 5 }, (_, i) => ({
      ...baseRecord,
      id: `m-${i}`,
      measurementDate: '2024-06-01',
      weightKg: 7 + i / 10,
    })) as GrowthMeasurement[];

    const data = buildClinicalReport({ ...emptyInput, measurements });
    const model = buildReportPdfModel(data, createInitialComposition(data));
    const texts = collectTexts(expand(React.createElement(ClinicalReportPdf, { model })));

    expect(texts.filter((t) => t === 'Peso (kg)')).toHaveLength(2);
    // JSX produz o marcador como fragmentos adjacentes ('Crescimento', ' — continuação')
    expect(texts.join('').split('Crescimento — continuação')).toHaveLength(2);
  });
});
