/**
 * Tipos relacionados ao Registro de Desenvolvimento (DevelopmentAssessment) —
 * Sprint 5.
 *
 * IMPORTANTE — o que isto é e o que NÃO é (ver documentacao/sprint-5-desenvolvimento.md):
 *
 * Isto é VIGILÂNCIA/ACOMPANHAMENTO do desenvolvimento: um registro longitudinal
 * de habilidades observadas, por domínio, com data e idade. NÃO é triagem
 * (nenhum instrumento estruturado/validado como Denver II, ASQ-3 ou M-CHAT é
 * aplicado) nem avaliação diagnóstica. O sistema nunca emite diagnóstico nem
 * frases como "atraso do desenvolvimento" ou "suspeita de autismo" — no
 * máximo, reflete de volta um sinalizador que o próprio profissional marcou
 * (`requiresFollowUp`), nunca uma inferência automática.
 *
 * Os domínios (motor grosso, motor fino, comunicação, cognição, social e
 * adaptativo) vêm de documentacao/planejamento do mvp.txt (Módulo 5). O
 * conteúdo dos marcos (qual habilidade esperar em qual idade) NÃO é
 * pré-carregado: nem o PRD nem o planejamento citam uma fonte oficial
 * (SBP/OMS/CDC) com versão e população, então cada marco é descrito livremente
 * pelo profissional no momento do registro — "os marcos serão parametrizados"
 * (prd.txt). Um banco de marcos oficial fica registrado como pendência.
 */

export type DevelopmentDomain =
  | 'motor_grosso'
  | 'motor_fino'
  | 'comunicacao'
  | 'cognicao'
  | 'social_adaptativo';

/** Estados definidos em documentacao/planejamento do mvp.txt (Módulo 5). */
export type MilestoneStatus = 'ACHIEVED' | 'NOT_ACHIEVED' | 'NOT_EVALUATED' | 'UNCERTAIN';

export interface DevelopmentMilestoneEntry {
  domain: DevelopmentDomain;
  /** Descrição livre da habilidade observada (não vem de um banco pré-carregado — ver nota acima) */
  description: string;
  status: MilestoneStatus;
}

/**
 * Entidade principal: Registro de Desenvolvimento.
 * Armazenada na coleção `developmentAssessments` do Firestore.
 * Imutável após criada — mesma política de `growthMeasurements` (Sprint 4):
 * nunca sobrescrever um registro já feito. Retificação/adendo auditável é
 * requisito futuro, fora deste Sprint.
 */
export interface DevelopmentAssessment {
  id: string;
  /** ID da criança avaliada — imutável (a entidade inteira é imutável) */
  childId: string;
  /** ID do profissional responsável — imutável */
  professionalId: string;

  /** ISO 8601: YYYY-MM-DD */
  assessmentDate: string;
  /** Idade cronológica da criança na data da avaliação, em dias */
  ageInDays: number;

  milestones: DevelopmentMilestoneEntry[];
  /** Observação clínica livre */
  observations?: string;
  /**
   * Marcado explicitamente pelo profissional — nunca inferido automaticamente
   * a partir dos status dos marcos. Linguagem operacional ("necessita
   * acompanhamento"), nunca diagnóstica.
   */
  requiresFollowUp: boolean;

  createdAt: string;
  updatedAt: string;
}

export type CreateDevelopmentAssessmentPayload = Omit<
  DevelopmentAssessment,
  'id' | 'createdAt' | 'updatedAt'
>;
