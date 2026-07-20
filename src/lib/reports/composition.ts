/**
 * Composição do Relatório Clínico — Sprint B.2.
 *
 * Lógica PURA e testável da tela /pacientes/[id]/relatorio: seleção de
 * seções, campos narrativos escritos pelo profissional e dados
 * institucionais. Nenhum acesso a banco, nenhuma geração automática de
 * texto — os textos narrativos começam vazios e só o profissional os
 * preenche (IA fica fora deste sprint por decisão explícita).
 *
 * Persistência: NENHUMA neste sprint. A composição vive apenas em memória
 * na página (estado React). Versionamento/persistência de relatórios é
 * requisito do Sprint B.4 — decisão registrada aqui para não criar
 * arquitetura prematura.
 *
 * Identificação NÃO é uma seção selecionável: é obrigatória em qualquer
 * relatório e sempre aparece na prévia.
 */

import type { ClinicalReportData } from '@/lib/types';

/** Seções selecionáveis do relatório (identificação é sempre incluída). */
export type ReportSectionId =
  | 'perinatal'
  | 'growth'
  | 'development'
  | 'feeding'
  | 'sleep'
  | 'vaccination'
  | 'consultations'
  | 'alerts'
  | 'timeline';

export const REPORT_SECTION_TITLES: Record<ReportSectionId, string> = {
  perinatal: 'Dados perinatais',
  growth: 'Crescimento',
  development: 'Desenvolvimento',
  feeding: 'Alimentação',
  sleep: 'Sono',
  vaccination: 'Vacinação',
  consultations: 'Consultas',
  alerts: 'Alertas clínicos',
  timeline: 'Linha do tempo',
};

/** Ordem estável de exibição das seções (tela e prévia). */
export const REPORT_SECTION_ORDER: readonly ReportSectionId[] = [
  'perinatal',
  'growth',
  'development',
  'feeding',
  'sleep',
  'vaccination',
  'consultations',
  'alerts',
  'timeline',
];

/**
 * Textos narrativos — escritos EXCLUSIVAMENTE pelo profissional.
 * Nenhum destes campos é gerado, completado ou interpretado por IA.
 */
export interface ReportNarrative {
  /** Motivo/finalidade do relatório */
  purpose: string;
  /** Síntese clínica */
  clinicalSummary: string;
  /** Evolução */
  evolution: string;
  /** Orientações/recomendações */
  recommendations: string;
  /** Conclusão */
  conclusion: string;
}

export const REPORT_NARRATIVE_FIELDS: readonly { id: keyof ReportNarrative; label: string }[] = [
  { id: 'purpose', label: 'Motivo/finalidade do relatório' },
  { id: 'clinicalSummary', label: 'Síntese clínica' },
  { id: 'evolution', label: 'Evolução' },
  { id: 'recommendations', label: 'Orientações/recomendações' },
  { id: 'conclusion', label: 'Conclusão' },
];

/**
 * Dados institucionais para o futuro PDF (Sprint B.3). Não existem hoje no
 * modelo Firestore — representação mínima: campos editáveis apenas na
 * composição, pré-preenchidos a partir do perfil do profissional quando
 * disponível. Não há assinatura digital criptográfica.
 */
export interface InstitutionalData {
  professionalName: string;
  /** CRM/registro profissional */
  professionalRegistry: string;
  specialty: string;
  /** Nome da clínica/serviço — não existe no modelo; campo livre, opcional */
  clinicName: string;
  /** Local (cidade/consultório) — não existe no modelo; campo livre, opcional */
  location: string;
  /** Data do relatório (YYYY-MM-DD) — pré-preenchida com referenceDate */
  reportDate: string;
}

/** Estado completo da composição (seleção + narrativa + institucional). */
export interface ReportComposition {
  sections: Record<ReportSectionId, boolean>;
  narrative: ReportNarrative;
  institutional: InstitutionalData;
}

export interface ReportSectionMeta {
  id: ReportSectionId;
  title: string;
  included: boolean;
  /** false quando a seção não tem nenhum registro — a prévia mostra "Sem registros disponíveis" */
  hasData: boolean;
}

/** Se a seção tem dados no relatório agregado. */
export function sectionHasData(data: ClinicalReportData, id: ReportSectionId): boolean {
  switch (id) {
    case 'perinatal':
      return data.perinatal !== null;
    case 'growth':
      return data.growth.measurements.length > 0;
    case 'development':
      return data.development.assessments.length > 0;
    case 'feeding':
      return data.feeding.records.length > 0;
    case 'sleep':
      return data.sleep.records.length > 0;
    case 'vaccination':
      return data.vaccination.records.length > 0;
    case 'consultations':
      return data.consultations.length > 0;
    case 'alerts':
      return data.alerts.length > 0;
    case 'timeline':
      return data.timeline.length > 0;
  }
}

/**
 * Composição inicial: todas as seções incluídas (o profissional exclui o
 * que não quiser), narrativa vazia e dados institucionais pré-preenchidos
 * com o que existe no relatório agregado (perfil do profissional + data de
 * referência). professional=null → campos do profissional ficam vazios,
 * editáveis manualmente.
 */
export function createInitialComposition(data: ClinicalReportData): ReportComposition {
  return {
    sections: {
      perinatal: true,
      growth: true,
      development: true,
      feeding: true,
      sleep: true,
      vaccination: true,
      consultations: true,
      alerts: true,
      timeline: true,
    },
    narrative: {
      purpose: '',
      clinicalSummary: '',
      evolution: '',
      recommendations: '',
      conclusion: '',
    },
    institutional: {
      professionalName: data.professional?.displayName ?? '',
      professionalRegistry: data.professional?.crm ?? '',
      specialty: data.professional?.specialty ?? '',
      clinicName: '',
      location: '',
      reportDate: data.referenceDate,
    },
  };
}

/** Lista as seções na ordem estável, com título, inclusão e disponibilidade de dados. */
export function listReportSections(
  data: ClinicalReportData,
  composition: ReportComposition
): ReportSectionMeta[] {
  return REPORT_SECTION_ORDER.map((id) => ({
    id,
    title: REPORT_SECTION_TITLES[id],
    included: composition.sections[id],
    hasData: sectionHasData(data, id),
  }));
}

export function isSectionIncluded(composition: ReportComposition, id: ReportSectionId): boolean {
  return composition.sections[id];
}

/** Inclui/exclui uma seção (atualização imutável, para uso com useState). */
export function setSectionIncluded(
  composition: ReportComposition,
  id: ReportSectionId,
  included: boolean
): ReportComposition {
  return { ...composition, sections: { ...composition.sections, [id]: included } };
}

/** Atualiza um campo narrativo (atualização imutável). */
export function setNarrativeField(
  composition: ReportComposition,
  field: keyof ReportNarrative,
  value: string
): ReportComposition {
  return { ...composition, narrative: { ...composition.narrative, [field]: value } };
}

/** Atualiza um campo institucional (atualização imutável). */
export function setInstitutionalField(
  composition: ReportComposition,
  field: keyof InstitutionalData,
  value: string
): ReportComposition {
  return { ...composition, institutional: { ...composition.institutional, [field]: value } };
}
