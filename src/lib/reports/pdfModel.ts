/**
 * Modelo documental do PDF do Relatório Clínico — Sprint B.3.
 *
 * Camada PURA entre (ClinicalReportData + ReportComposition) e o componente
 * @react-pdf/renderer: converte a composição revisada pelo profissional numa
 * estrutura serializável de blocos de documento, já com toda a formatação
 * resolvida (datas pt-BR, rótulos, unidades). O componente de PDF apenas
 * desenha este modelo — não busca dados, não recalcula lógica clínica, não
 * infere e não inventa nada.
 *
 * Regras documentais implementadas aqui (testáveis sem renderizar PDF):
 * - identificação da criança é SEMPRE incluída;
 * - apenas seções selecionadas na composição entram no documento;
 * - seção selecionada SEM dados é OMITIDA do PDF (Sprint B.3.1) — a
 *   indicação "Sem registros disponíveis" existe apenas na tela de
 *   composição, não no documento emitido;
 * - narrativa: "motivo/finalidade" vai para o INÍCIO (após a identificação);
 *   síntese/evolução/orientações/conclusão vão para o FINAL (antes do
 *   profissional responsável); campos vazios são OMITIDOS;
 * - campos institucionais vazios são OMITIDOS;
 * - telefone brasileiro reconhecível é formatado (ex.: (11) 98888-7777);
 * - nenhum identificador interno (UID, IDs do Firestore) entra no modelo;
 * - nenhuma interpretação/percentil/escore-Z/classificação é gerada.
 */

import type {
  ClinicalReportData,
  SexAtBirth,
  PerinatalData,
  ConsultationStatus,
  AlertCategory,
  AlertStatus,
} from '@/lib/types';
import {
  REPORT_NARRATIVE_FIELDS,
  REPORT_SECTION_ORDER,
  REPORT_SECTION_TITLES,
  isSectionIncluded,
  sectionHasData,
  type ReportComposition,
  type ReportSectionId,
} from './composition';
import { formatAgeInDays } from '@/lib/consultations/ageInDays';
import { domainLabels, milestoneStatusLabels } from '@/lib/development/labels';
import { vaccinationStatusLabels } from '@/lib/vaccination/labels';

/* ── Estrutura do documento ── */

export interface PdfField {
  label: string;
  value: string;
}

/** Bloco de um registro datado (consulta, avaliação, alerta etc.). */
export interface PdfRecordBlock {
  title: string;
  badge?: string;
  fields: PdfField[];
}

export interface PdfTableBlock {
  columns: string[];
  rows: string[][];
}

export interface PdfTimelineItem {
  date: string;
  label: string;
  detail?: string;
}

export interface PdfSection {
  id: ReportSectionId;
  title: string;
  /** Nota discreta sob o título (ex.: escopo da vacinação, natureza dos alertas) */
  note?: string;
  fields?: PdfField[];
  table?: PdfTableBlock;
  records?: PdfRecordBlock[];
  timeline?: PdfTimelineItem[];
}

export interface ReportPdfModel {
  /** Título fixo do documento */
  title: string;
  clinicName: string | null;
  /** Data do relatório formatada (pt-BR) */
  reportDate: string;
  /** Identificação da criança — sempre presente */
  patientFields: PdfField[];
  /** Nome da criança para o rodapé */
  footerChildName: string;
  /** Motivo/finalidade — renderizado no INÍCIO, após a identificação */
  purpose: { label: string; text: string } | null;
  /**
   * Síntese clínica, evolução, orientações e conclusão — renderizados no
   * FINAL do documento, antes do profissional responsável. Apenas preenchidos.
   */
  closingNarrative: { label: string; text: string }[];
  /** Apenas seções selecionadas E com dados */
  sections: PdfSection[];
  /** Apenas campos institucionais informados */
  professionalFields: PdfField[];
}

/* ── Rótulos do documento ── */

const sexLabels: Record<SexAtBirth, string> = {
  female: 'Feminino',
  male: 'Masculino',
  other: 'Outro',
  not_informed: 'Não informado',
};

const deliveryTypeLabels: Record<NonNullable<PerinatalData['deliveryType']>, string> = {
  vaginal: 'Vaginal',
  cesarean: 'Cesárea',
  forceps: 'Fórceps',
  other: 'Outro',
};

const consultationStatusLabels: Record<ConsultationStatus, string> = {
  draft: 'Rascunho',
  completed: 'Finalizada',
  cancelled: 'Cancelada',
};

const alertCategoryLabels: Record<AlertCategory, string> = {
  HIGH_PRIORITY: 'Alta prioridade',
  ATTENTION: 'Atenção',
  INFO: 'Informativo',
};

const alertStatusLabels: Record<AlertStatus, string> = {
  active: 'Ativo',
  resolved: 'Resolvido',
  dismissed: 'Ignorado',
};

const timelineKindLabels: Record<string, string> = {
  consultation: 'Consulta',
  growthMeasurement: 'Medição de crescimento',
  developmentAssessment: 'Desenvolvimento',
  vaccinationRecord: 'Vacinação',
  feedingRecord: 'Alimentação',
  sleepRecord: 'Sono',
  clinicalAlert: 'Alerta clínico',
};

/* ── Helpers ── */

function fmtDate(isoDate: string): string {
  return new Date(isoDate.slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR');
}

function withAge(date: string, ageInDays: number): string {
  return `${fmtDate(date)} · ${formatAgeInDays(ageInDays)}`;
}

/** Adiciona o campo à lista apenas se o valor existir e não for vazio. */
function pushField(fields: PdfField[], label: string, value: string | number | undefined | null): void {
  if (value === undefined || value === null || value === '') return;
  fields.push({ label, value: String(value) });
}

/* ── Construtores de seção ── */

function buildPerinatalSection(data: ClinicalReportData): PdfSection {
  const fields: PdfField[] = [];
  const p = data.perinatal;
  if (p) {
    pushField(fields, 'Idade gestacional', p.gestationalAgeWeeks !== undefined ? `${p.gestationalAgeWeeks} semanas` : undefined);
    pushField(fields, 'Tipo de parto', p.deliveryType ? deliveryTypeLabels[p.deliveryType] : undefined);
    pushField(fields, 'Peso ao nascer', p.birthWeightGrams !== undefined ? `${p.birthWeightGrams} g` : undefined);
    pushField(fields, 'Comprimento ao nascer', p.birthLengthCm !== undefined ? `${p.birthLengthCm} cm` : undefined);
    pushField(fields, 'Perímetro cefálico ao nascer', p.birthHeadCircumferenceCm !== undefined ? `${p.birthHeadCircumferenceCm} cm` : undefined);
    pushField(fields, 'Apgar 1º minuto', p.apgar1);
    pushField(fields, 'Apgar 5º minuto', p.apgar5);
    pushField(fields, 'Prematuridade', p.premature ? 'Sim' : 'Não');
    pushField(fields, 'Internação neonatal', p.neonatalHospitalization ? 'Sim' : 'Não');
    pushField(fields, 'Intercorrências neonatais', p.neonatalComplications);
  }
  return { id: 'perinatal', title: REPORT_SECTION_TITLES.perinatal, fields };
}

function buildGrowthSection(data: ClinicalReportData): PdfSection {
  const measurements = data.growth.measurements;
  return {
    id: 'growth',
    title: REPORT_SECTION_TITLES.growth,
    table: {
      columns: ['Data', 'Idade', 'Peso (kg)', 'Comprimento (cm)', 'PC (cm)', 'IMC'],
      rows: measurements.map((m) => [
        fmtDate(m.measurementDate),
        formatAgeInDays(m.ageInDays),
        m.weightKg !== undefined ? String(m.weightKg) : '—',
        m.heightCm !== undefined ? String(m.heightCm) : '—',
        m.headCircumferenceCm !== undefined ? String(m.headCircumferenceCm) : '—',
        m.bmi !== undefined ? String(m.bmi) : '—',
      ]),
    },
  };
}

function buildDevelopmentSection(data: ClinicalReportData): PdfSection {
  const assessments = data.development.assessments;
  return {
    id: 'development',
    title: REPORT_SECTION_TITLES.development,
    records: assessments.map((a) => {
      const fields: PdfField[] = a.milestones.map((ms) => ({
        label: domainLabels[ms.domain],
        value: `${ms.description} · ${milestoneStatusLabels[ms.status]}`,
      }));
      pushField(fields, 'Observações', a.observations);
      return {
        title: withAge(a.assessmentDate, a.ageInDays),
        badge: a.requiresFollowUp ? 'Necessita acompanhamento' : undefined,
        fields,
      };
    }),
  };
}

function buildFeedingSection(data: ClinicalReportData): PdfSection {
  const records = data.feeding.records;
  return {
    id: 'feeding',
    title: REPORT_SECTION_TITLES.feeding,
    records: records.map((r) => {
      const fields: PdfField[] = [];
      pushField(fields, 'Histórico alimentar', r.feedingHistory);
      pushField(fields, 'Rotina', r.routine);
      pushField(fields, 'Introdução alimentar', r.foodIntroduction);
      pushField(fields, 'Dificuldades', r.difficulties);
      pushField(fields, 'Observações', r.observations);
      return { title: withAge(r.recordDate, r.ageInDays), fields };
    }),
  };
}

function buildSleepSection(data: ClinicalReportData): PdfSection {
  const records = data.sleep.records;
  return {
    id: 'sleep',
    title: REPORT_SECTION_TITLES.sleep,
    records: records.map((r) => {
      const fields: PdfField[] = [];
      pushField(fields, 'Horário de dormir', r.bedtime);
      pushField(fields, 'Despertares noturnos', r.nightWakings);
      pushField(fields, 'Duração do sono', r.sleepDurationHours !== undefined ? `${r.sleepDurationHours} h` : undefined);
      pushField(fields, 'Cochilos', r.naps);
      pushField(fields, 'Rotina', r.routine);
      pushField(fields, 'Dificuldades', r.difficulties);
      pushField(fields, 'Observações', r.observations);
      return { title: withAge(r.recordDate, r.ageInDays), fields };
    }),
  };
}

function buildVaccinationSection(data: ClinicalReportData): PdfSection {
  const records = data.vaccination.records;
  return {
    id: 'vaccination',
    title: REPORT_SECTION_TITLES.vaccination,
    note: 'Somente doses e status registrados pelo profissional — sem inferência de esquema vacinal.',
    records: records.map((v) => {
      const fields: PdfField[] = [];
      pushField(fields, 'Vacina', v.vaccineName);
      pushField(fields, 'Dose', v.doseDescription);
      pushField(fields, 'Lote', v.lot);
      pushField(fields, 'Estabelecimento', v.facility);
      pushField(fields, 'Observações', v.observations);
      return {
        title: withAge(v.recordDate, v.ageInDays),
        badge: vaccinationStatusLabels[v.status],
        fields,
      };
    }),
  };
}

function buildConsultationsSection(data: ClinicalReportData): PdfSection {
  const consultations = data.consultations;
  return {
    id: 'consultations',
    title: REPORT_SECTION_TITLES.consultations,
    records: consultations.map((c) => {
      const fields: PdfField[] = [];
      pushField(fields, 'Motivo', c.reason);
      pushField(fields, 'Intercorrências', c.intervalHistory);
      pushField(fields, 'Observações clínicas', c.clinicalNotes);
      pushField(fields, 'Avaliação', c.assessment);
      pushField(fields, 'Conduta/orientações', c.plan);
      return {
        title: withAge(c.consultationDate, c.ageInDays),
        badge: consultationStatusLabels[c.status],
        fields,
      };
    }),
  };
}

function buildAlertsSection(data: ClinicalReportData): PdfSection {
  const alerts = data.alerts;
  return {
    id: 'alerts',
    title: REPORT_SECTION_TITLES.alerts,
    note: 'Alertas de acompanhamento gerados por regras com fonte clínica — não constituem diagnóstico.',
    records: alerts.map((a) => {
      const fields: PdfField[] = [];
      pushField(fields, 'Situação', a.description);
      pushField(fields, 'Status', alertStatusLabels[a.status]);
      pushField(fields, 'Detectado em', fmtDate(a.detectedAt));
      pushField(fields, 'Fonte', a.clinicalSource);
      pushField(fields, 'Nota de resolução', a.resolutionNote);
      return { title: a.title, badge: alertCategoryLabels[a.category], fields };
    }),
  };
}

function buildTimelineSection(data: ClinicalReportData): PdfSection {
  const entries = data.timeline;
  return {
    id: 'timeline',
    title: REPORT_SECTION_TITLES.timeline,
    note: 'Visão cronológica consolidada (mais recente primeiro).',
    timeline: entries.map((e) => ({
      date: fmtDate(e.date),
      label: timelineKindLabels[e.kind] ?? e.kind,
      // Linha única e compacta: detalhe truncado para caber com segurança
      // no agrupamento wrap={false} do título (ver ClinicalReportPdf).
      detail: truncate(
        (e.kind === 'consultation' && e.data.reason) ||
          (e.kind === 'vaccinationRecord' && e.data.vaccineName) ||
          (e.kind === 'clinicalAlert' && e.data.title) ||
          undefined
      ),
    })),
  };
}

/** Trunca texto longo para uma linha compacta de timeline. */
function truncate(text: string | undefined | false, max = 140): string | undefined {
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/* ── Modelo completo ── */

/**
 * Monta o modelo documental a partir da composição revisada. Determinístico:
 * mesma entrada → mesmo modelo.
 */
export function buildReportPdfModel(
  data: ClinicalReportData,
  composition: ReportComposition
): ReportPdfModel {
  const { patient, professional } = data;
  const { narrative, institutional } = composition;

  // Identificação — sempre presente, sem identificadores internos.
  const patientFields: PdfField[] = [];
  pushField(patientFields, 'Nome', patient.fullName);
  pushField(patientFields, 'Nome social', patient.socialName);
  pushField(patientFields, 'Data de nascimento', fmtDate(patient.birthDate));
  pushField(patientFields, 'Idade', formatAgeInDays(patient.ageInDays));
  if (patient.sexAtBirth !== 'not_informed') {
    pushField(patientFields, 'Sexo', sexLabels[patient.sexAtBirth]);
  }
  pushField(patientFields, 'Responsável', patient.caregiverName);
  pushField(patientFields, 'Telefone', patient.contactPhone ? formatPhoneBR(patient.contactPhone) : undefined);
  pushField(patientFields, 'E-mail', patient.contactEmail);

  const sectionBuilders: Record<ReportSectionId, (d: ClinicalReportData) => PdfSection> = {
    perinatal: buildPerinatalSection,
    growth: buildGrowthSection,
    development: buildDevelopmentSection,
    feeding: buildFeedingSection,
    sleep: buildSleepSection,
    vaccination: buildVaccinationSection,
    consultations: buildConsultationsSection,
    alerts: buildAlertsSection,
    timeline: buildTimelineSection,
  };

  // Apenas seções selecionadas E com dados — seção vazia é omitida do PDF
  // (a tela de composição continua mostrando "Sem registros disponíveis").
  const sections = REPORT_SECTION_ORDER.filter(
    (id) => isSectionIncluded(composition, id) && sectionHasData(data, id)
  ).map((id) => sectionBuilders[id](data));

  // Narrativa — apenas campos preenchidos pelo profissional.
  // "Motivo/finalidade" abre o documento (após a identificação); os demais
  // campos fecham o documento (antes do profissional responsável).
  const filled = REPORT_NARRATIVE_FIELDS.filter((f) => narrative[f.id].trim().length > 0).map((f) => ({
    label: f.label,
    text: narrative[f.id].trim(),
  }));
  const purpose = filled.find((f) => f.label === REPORT_NARRATIVE_FIELDS[0].label) ?? null;
  const closingNarrative = filled.filter((f) => f.label !== REPORT_NARRATIVE_FIELDS[0].label);

  // Profissional — apenas campos informados (institucional editado na tela;
  // fallback para o perfil agregado no nome).
  const professionalFields: PdfField[] = [];
  pushField(professionalFields, 'Profissional', institutional.professionalName.trim() || professional?.displayName);
  pushField(professionalFields, 'CRM/registro', institutional.professionalRegistry.trim());
  pushField(professionalFields, 'Especialidade', institutional.specialty.trim());
  pushField(professionalFields, 'Clínica/serviço', institutional.clinicName.trim());
  pushField(professionalFields, 'Local', institutional.location.trim());

  return {
    title: 'Relatório Clínico de Acompanhamento',
    clinicName: institutional.clinicName.trim() || null,
    reportDate: institutional.reportDate ? fmtDate(institutional.reportDate) : '',
    patientFields,
    footerChildName: patient.fullName,
    purpose,
    closingNarrative,
    sections,
    professionalFields,
  };
}

/**
 * Formata telefone brasileiro reconhecível: (11) 98888-7777 (celular, 11
 * dígitos) ou (11) 3888-7777 (fixo, 10 dígitos), com ou sem código do país
 * (55). Formatos desconhecidos/internacionais são retornados como vieram —
 * nunca quebrar um número que não entendemos.
 */
export function formatPhoneBR(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Número explicitamente internacional (+...) fora do Brasil: preservar.
  if (phone.trim().startsWith('+') && !digits.startsWith('55')) return phone;
  const national =
    digits.startsWith('55') && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;

  if (national.length === 11) {
    return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  }
  if (national.length === 10) {
    return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  }
  return phone;
}

/**
 * Nome do arquivo: relatorio-[nome-normalizado]-AAAA-MM-DD.pdf
 * Normalização: minúsculas, sem acentos, apenas [a-z0-9-].
 */
export function buildReportFileName(childName: string, reportDate: string): string {
  const normalized = childName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(reportDate) ? reportDate : 'sem-data';
  return `relatorio-${normalized || 'paciente'}-${date}.pdf`;
}
