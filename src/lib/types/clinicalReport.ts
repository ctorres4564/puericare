/**
 * Tipo central do Relatório Clínico longitudinal (ClinicalReportData) —
 * Sprint B.1.
 *
 * Camada de AGREGAÇÃO tipada: consolida, numa única estrutura, todos os
 * dados clínicos de uma criança que já existem no modelo (identificação,
 * perinatal, crescimento, desenvolvimento, alimentação, sono, vacinação,
 * consultas, alertas e timeline). Não cria coleção nova no Firestore —
 * é montada em memória a partir das coleções existentes (mesma decisão da
 * timeline, ver lib/children/timeline.ts).
 *
 * Limites deliberados desta camada (não violar):
 * - NENHUM texto clínico interpretativo é gerado aqui;
 * - NENHUM dado ausente é inventado — campos sem registro ficam null/
 *   undefined e a camada de apresentação decide como exibi-los;
 * - NENHUM percentil, escore-Z, classificação de crescimento, inferência de
 *   vacina ausente ou diagnóstico é calculado (mesmas restrições já
 *   registradas nos tipos de domínio);
 * - Determinística: mesma entrada → mesma saída (datas de referência e de
 *   geração são parâmetros explícitos, nunca lidas do relógio dentro do
 *   agregador).
 */

import type { SexAtBirth, PerinatalData } from './child';
import type {
  Consultation,
  GrowthMeasurement,
  DevelopmentAssessment,
  FeedingRecord,
  SleepRecord,
  VaccinationRecord,
  ClinicalAlert,
} from '@/lib/types';
import type { TimelineEntry } from '@/lib/children/timeline';
// Import type-only — não cria dependência em tempo de execução (evita ciclo
// com lib/reports/*, que importam ClinicalReportData deste mesmo arquivo).
import type { ReportComposition } from '@/lib/reports/composition';
import type { ReportPdfModel } from '@/lib/reports/pdfModel';

/** Identificação da criança no relatório (subconjunto de `Child`). */
export interface ClinicalReportPatient {
  id: string;
  fullName: string;
  socialName?: string;
  /** ISO 8601: YYYY-MM-DD */
  birthDate: string;
  /** Idade em dias na data de referência do relatório (`referenceDate`) */
  ageInDays: number;
  sexAtBirth: SexAtBirth;
  /** Nome do responsável principal */
  caregiverName: string;
  contactPhone: string;
  contactEmail?: string;
  /** Cadastro ativo ou inativo (histórico preservado) */
  active: boolean;
}

/** Identificação do profissional responsável (subconjunto de `UserProfile`). */
export interface ClinicalReportProfessional {
  uid: string;
  displayName: string;
  crm?: string;
  specialty?: string;
}

/** Seção de crescimento: histórico + última medição. */
export interface ClinicalReportGrowth {
  /** Medições em ordem cronológica crescente (desempate: createdAt) */
  measurements: GrowthMeasurement[];
  /**
   * Última medição registrada, pelo mesmo critério de
   * `latestMeasurementByChild` (lib/growth/latestMeasurement.ts).
   * null quando não há nenhuma medição.
   */
  latest: GrowthMeasurement | null;
}

/** Seção de desenvolvimento: avaliações/marcos registrados. */
export interface ClinicalReportDevelopment {
  /** Avaliações em ordem cronológica crescente */
  assessments: DevelopmentAssessment[];
}

/** Seção de alimentação. */
export interface ClinicalReportFeeding {
  /** Registros em ordem cronológica crescente */
  records: FeedingRecord[];
}

/** Seção de sono. */
export interface ClinicalReportSleep {
  /** Registros em ordem cronológica crescente */
  records: SleepRecord[];
}

/** Seção de vacinação — somente o que foi registrado, sem inferências. */
export interface ClinicalReportVaccination {
  /** Registros em ordem cronológica crescente */
  records: VaccinationRecord[];
}

/**
 * Estrutura consolidada do relatório clínico longitudinal de uma criança.
 */
export interface ClinicalReportData {
  patient: ClinicalReportPatient;
  /**
   * Profissional responsável. null quando o documento de perfil não existe
   * (o relatório ainda é montado — a identificação do profissional é
   * complementar, não pré-requisito dos dados clínicos).
   */
  professional: ClinicalReportProfessional | null;
  /** Dados perinatais; null quando a criança não os tem registrados */
  perinatal: PerinatalData | null;
  growth: ClinicalReportGrowth;
  development: ClinicalReportDevelopment;
  feeding: ClinicalReportFeeding;
  sleep: ClinicalReportSleep;
  vaccination: ClinicalReportVaccination;
  /**
   * Histórico de consultas em ordem cronológica crescente, incluindo
   * rascunhos e canceladas (o relatório é um prontuário completo — a
   * timeline, ao contrário, omite canceladas por decisão já registrada em
   * lib/children/timeline.ts).
   */
  consultations: Consultation[];
  /**
   * Todos os alertas da criança (ativos, resolvidos e ignorados), do mais
   * recente para o mais antigo, com status, categoria e fonte da regra.
   */
  alerts: ClinicalAlert[];
  /**
   * Linha do tempo longitudinal — construída por `buildTimeline`
   * (lib/children/timeline.ts), mesma lógica de ordenação da página do
   * paciente (apenas alertas ativos; consultas canceladas excluídas).
   */
  timeline: TimelineEntry[];
  /** Data de referência (YYYY-MM-DD) usada nos cálculos de idade */
  referenceDate: string;
  /** ISO 8601 — momento lógico de geração do relatório (parâmetro, não relógio) */
  generatedAt: string;
}

/**
 * Persistência, versionamento e histórico do Relatório Clínico — Sprint B.4.
 *
 * Ciclo de vida: DRAFT → ISSUED. Uma vez ISSUED, o registro é imutável (na
 * interface E nas Firestore Rules — ver firestore.rules). Alterações
 * posteriores no prontuário nunca recalculam ou modificam um relatório já
 * emitido; exigem "Criar nova versão" (um novo documento DRAFT).
 *
 * Estratégia de snapshot (decisão registrada — ver documentacao):
 * - DRAFT: só `compositionSnapshot` é persistido. Os dados clínicos NÃO são
 *   congelados nesta fase — a tela sempre busca o prontuário atual via
 *   `getClinicalReportData` ao editar um rascunho (comportamento já existente
 *   desde o Sprint B.1), deixando isso explícito para o profissional.
 * - ISSUED: `clinicalDataSnapshot`, `compositionSnapshot` e `pdfModelSnapshot`
 *   são congelados juntos, no momento exato da emissão. Abrir um relatório
 *   emitido nunca consulta o prontuário novamente — usa só o snapshot salvo.
 */
export type ClinicalReportStatus = 'DRAFT' | 'ISSUED';

/** Título padrão, sugerido e editável (nunca vazio na emissão — ver reportService). */
export const DEFAULT_REPORT_TITLE = 'Relatório Clínico de Acompanhamento';

/** Versão atual do schema de `ClinicalReportRecord` — incremente ao migrar. */
export const CLINICAL_REPORT_SCHEMA_VERSION = 1;
/**
 * Versão interna do layout documental usado para montar `pdfModelSnapshot`
 * (lib/reports/pdfModel.ts). NÃO é a versão do pacote @react-pdf/renderer —
 * é incrementada manualmente quando a estrutura do modelo documental muda de
 * um jeito que afetaria a reprodução de um PDF histórico.
 */
export const CLINICAL_REPORT_RENDERER_VERSION = '1';

export interface ClinicalReportRecord {
  id: string;
  childId: string;
  professionalId: string;

  /** 0 enquanto DRAFT; inteiro positivo (1, 2, 3...) atribuído atomicamente na emissão. */
  version: number;
  status: ClinicalReportStatus;
  /** Nunca vazio no momento da emissão (validado no service e nas rules). */
  title: string;

  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  /** Presentes somente após a emissão — nunca definidos enquanto DRAFT. */
  issuedAt?: string;
  issuedBy?: string;

  /**
   * Data de referência (YYYY-MM-DD) usada para calcular idade. Enquanto
   * DRAFT, reflete a data do último salvamento (informativa); na emissão, é
   * sobrescrita pela referenceDate real do `clinicalDataSnapshot` congelado.
   */
  sourceReferenceDate: string;

  /** Composição revisada (seções, textos, dados institucionais) — ver regra de congelamento acima. */
  compositionSnapshot: ReportComposition;
  /** Congelado somente na emissão. Ausente enquanto DRAFT. */
  clinicalDataSnapshot?: ClinicalReportData;
  /** Congelado somente na emissão. Ausente enquanto DRAFT. */
  pdfModelSnapshot?: ReportPdfModel;

  /** ID do relatório emitido do qual esta versão partiu (via "Criar nova versão"). */
  previousVersionId?: string;

  schemaVersion: number;
  rendererVersion: string;
}

export interface CreateReportDraftPayload {
  childId: string;
  title?: string;
  /** Composição inicial; se ausente, é montada a partir dos dados clínicos atuais. */
  composition?: ReportComposition;
  previousVersionId?: string;
}

export interface UpdateReportDraftPayload {
  composition: ReportComposition;
  title: string;
  /** `updatedAt` que o cliente carregou — usado para detectar conflito de concorrência. */
  expectedUpdatedAt: string;
}

export interface IssueReportPayload {
  title: string;
}
