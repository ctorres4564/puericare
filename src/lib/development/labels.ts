import type { DevelopmentDomain, MilestoneStatus } from '@/lib/types';

export const domainLabels: Record<DevelopmentDomain, string> = {
  motor_grosso: 'Motor grosso',
  motor_fino: 'Motor fino',
  comunicacao: 'Comunicação',
  cognicao: 'Cognição',
  social_adaptativo: 'Social e adaptativo',
};

/**
 * Linguagem operacional, nunca diagnóstica: "presente/ausente/não avaliado/
 * incerto" descrevem o que o profissional observou, não uma conclusão
 * clínica sobre a criança.
 */
export const milestoneStatusLabels: Record<MilestoneStatus, string> = {
  ACHIEVED: 'Presente',
  NOT_ACHIEVED: 'Ausente',
  NOT_EVALUATED: 'Não avaliado',
  UNCERTAIN: 'Incerto',
};
