/**
 * Tipos relacionados ao Motor de Alertas Clínicos (ClinicalAlert) — Sprint 7.
 *
 * O motor é baseado em REGRAS DETERMINÍSTICAS e EXPLÍCITAS — não usa IA.
 * Cada alerta inclui obrigatoriamente a fonte clínica que embasa a regra,
 * garantindo rastreabilidade e auditabilidade.
 *
 * Categorias (conforme planejamento do mvp.txt, Módulo 9):
 *   INFO          — informativo, sem urgência
 *   ATTENTION     — requer atenção em breve
 *   HIGH_PRIORITY — requer atenção imediata
 *
 * Status:
 *   active    — alerta ativo, ainda não tratado
 *   resolved  — profissional registrou resolução com nota
 *   dismissed — profissional decidiu ignorar (com nota opcional)
 */

export type AlertCategory = 'INFO' | 'ATTENTION' | 'HIGH_PRIORITY';
export type AlertStatus = 'active' | 'resolved' | 'dismissed';

/**
 * Identificadores das regras implementadas no motor.
 * Cada ID mapeia 1:1 a uma função em lib/alerts/rules.ts.
 */
export type AlertRuleId =
  | 'R1_NO_CONSULT_UNDER_24M'
  | 'R2_NO_CONSULT_OVER_24M'
  | 'R3_LATE_VACCINATION'
  | 'R4_NO_GROWTH_90D'
  | 'R5_NO_WEIGHT_30D_UNDER_6M'
  | 'R6_DEVELOPMENT_FOLLOW_UP'
  | 'R7_CHOKING_RECURRENT'
  | 'R8_PRONE_SLEEP_UNDER_6M'
  | 'R9_DEVELOPMENT_DELAY_MULTIPLE'
  | 'R10_SAFETY_ALERT_CHOKING_APNEA';

export interface ClinicalAlert {
  id: string;

  /** ID da criança a que o alerta se refere */
  childId: string;
  /** Nome da criança — desnormalizado para exibição sem join */
  childName: string;
  /** ID do profissional responsável */
  professionalId: string;

  /** Código da regra que gerou este alerta */
  ruleId: AlertRuleId;
  /** Categoria de gravidade */
  category: AlertCategory;
  /** Título curto para exibição em lista */
  title: string;
  /** Descrição detalhada da situação */
  description: string;
  /**
   * Fonte clínica que embasa a regra.
   * Exemplos: 'SBP — Caderno de Atenção Básica (2023)',
   *           'PNI/Ministério da Saúde', 'OMS — Padrões de Crescimento'
   */
  clinicalSource: string;

  status: AlertStatus;
  /** ISO 8601 — preenchido quando status = 'resolved' ou 'dismissed' */
  resolvedAt?: string;
  /** Nota do profissional ao resolver ou ignorar */
  resolutionNote?: string;

  /** ISO 8601 — quando o motor detectou a condição */
  detectedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateAlertPayload = Omit<ClinicalAlert, 'id' | 'createdAt' | 'updatedAt'>;

/** Payload mínimo para resolver ou dismissar um alerta */
export interface ResolveAlertPayload {
  status: 'resolved' | 'dismissed';
  resolutionNote?: string;
}
