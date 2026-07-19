/**
 * lib/alerts/rules.ts — Regras determinísticas do motor de alertas clínicos.
 *
 * DESIGN:
 * - Cada função é PURA: recebe dados, retorna alertas — sem I/O, sem estado.
 * - Nenhuma regra usa IA ou inferência — apenas lógica explícita com limiares
 *   definidos por fontes clínicas citadas.
 * - O motor não emite diagnóstico. Reflete condições de acompanhamento.
 *
 * FONTES:
 * - SBP: Sociedade Brasileira de Pediatria — Manual de Puericultura (2023)
 * - OMS: Padrões de Crescimento Infantil (2006)
 * - MS/PNI: Ministério da Saúde — Programa Nacional de Imunizações
 */

import type {
  Child,
  Consultation,
  GrowthMeasurement,
  DevelopmentAssessment,
  FeedingRecord,
  SleepRecord,
  VaccinationRecord,
  AlertCategory,
  AlertRuleId,
} from '@/lib/types';

// ─── Tipos internos ───────────────────────────────────────────────────────────

export interface RuleInput {
  child: Child;
  consultations: Consultation[];
  growthMeasurements: GrowthMeasurement[];
  developmentAssessments: DevelopmentAssessment[];
  feedingRecords: FeedingRecord[];
  sleepRecords: SleepRecord[];
  vaccinationRecords: VaccinationRecord[];
  /** Data de referência para os cálculos — normalmente hoje (ISO YYYY-MM-DD) */
  referenceDate: string;
}

export interface AlertDraft {
  ruleId: AlertRuleId;
  category: AlertCategory;
  title: string;
  description: string;
  clinicalSource: string;
}

// ─── Utilitários internos ─────────────────────────────────────────────────────

/** Retorna a idade da criança em dias completos na referenceDate */
export function ageInDaysAt(birthDate: string, referenceDate: string): number {
  const birth = new Date(birthDate + 'T00:00:00Z');
  const ref = new Date(referenceDate + 'T00:00:00Z');
  return Math.floor((ref.getTime() - birth.getTime()) / 86_400_000);
}

/** Retorna a data ISO mais recente de um array de strings ISO */
function latestDate(dates: string[]): string | undefined {
  if (dates.length === 0) return undefined;
  return dates.reduce((a, b) => (a > b ? a : b));
}

/** Retorna os dias decorridos desde uma data ISO até a referenceDate */
function daysSince(isoDate: string, referenceDate: string): number {
  const d = new Date(isoDate + 'T00:00:00Z');
  const ref = new Date(referenceDate + 'T00:00:00Z');
  return Math.floor((ref.getTime() - d.getTime()) / 86_400_000);
}

// ─── Regras ───────────────────────────────────────────────────────────────────

/**
 * R1 — Nenhuma consulta nos últimos 90 dias (criança ≤ 24 meses).
 * Fonte: SBP — calendário de puericultura recomenda consultas trimestrais
 * no 1º e 2º ano de vida.
 */
export function r1NoConsultUnder24m(input: RuleInput): AlertDraft | null {
  const { child, consultations, referenceDate } = input;
  const ageInDays = ageInDaysAt(child.birthDate, referenceDate);
  if (ageInDays > 730) return null; // > 24 meses → não se aplica

  const completedDates = consultations
    .filter((c) => c.status === 'completed')
    .map((c) => c.consultationDate);

  const latest = latestDate(completedDates);
  if (latest && daysSince(latest, referenceDate) <= 90) return null;

  const motivo = latest
    ? `Última consulta há ${daysSince(latest, referenceDate)} dias.`
    : 'Nenhuma consulta registrada.';

  return {
    ruleId: 'R1_NO_CONSULT_UNDER_24M',
    category: 'ATTENTION',
    title: 'Consulta de puericultura em atraso',
    description: `${child.fullName} tem ${Math.floor(ageInDays / 30)} meses e está sem consulta há mais de 90 dias. ${motivo} Recomendação SBP: consultas trimestrais no 1º e 2º ano.`,
    clinicalSource: 'SBP — Manual de Puericultura (2023)',
  };
}

/**
 * R2 — Nenhuma consulta nos últimos 180 dias (criança > 24 meses).
 * Fonte: SBP — recomendação de consulta semestral após 2 anos.
 */
export function r2NoConsultOver24m(input: RuleInput): AlertDraft | null {
  const { child, consultations, referenceDate } = input;
  const ageInDays = ageInDaysAt(child.birthDate, referenceDate);
  if (ageInDays <= 730) return null; // ≤ 24 meses → usa R1

  const completedDates = consultations
    .filter((c) => c.status === 'completed')
    .map((c) => c.consultationDate);

  const latest = latestDate(completedDates);
  if (latest && daysSince(latest, referenceDate) <= 180) return null;

  const motivo = latest
    ? `Última consulta há ${daysSince(latest, referenceDate)} dias.`
    : 'Nenhuma consulta registrada.';

  return {
    ruleId: 'R2_NO_CONSULT_OVER_24M',
    category: 'ATTENTION',
    title: 'Consulta de puericultura em atraso',
    description: `${child.fullName} tem ${Math.floor(ageInDays / 30)} meses e está sem consulta há mais de 180 dias. ${motivo} Recomendação SBP: consulta semestral após 2 anos.`,
    clinicalSource: 'SBP — Manual de Puericultura (2023)',
  };
}

/**
 * R3 — Vacinação com status "atrasada" no último registro.
 * Fonte: PNI/Ministério da Saúde — Calendário Nacional de Vacinação.
 */
export function r3LateVaccination(input: RuleInput): AlertDraft | null {
  const { child, vaccinationRecords } = input;
  if (vaccinationRecords.length === 0) return null;

  // Último registro por data
  const sorted = [...vaccinationRecords].sort((a, b) =>
    b.recordDate.localeCompare(a.recordDate)
  );
  const latest = sorted[0];
  if (latest.status !== 'atrasada') return null;

  return {
    ruleId: 'R3_LATE_VACCINATION',
    category: 'HIGH_PRIORITY',
    title: 'Vacinação em atraso',
    description: `O último registro de vacinação de ${child.fullName} indica status "atrasada" (${new Date(latest.recordDate + 'T00:00:00').toLocaleDateString('pt-BR')}). Verificar caderneta e agendar regularização.`,
    clinicalSource: 'PNI/Ministério da Saúde — Calendário Nacional de Vacinação',
  };
}

/**
 * R4 — Nenhum registro de crescimento nos últimos 90 dias.
 * Fonte: OMS — Padrões de Crescimento Infantil (monitoramento trimestral).
 */
export function r4NoGrowth90d(input: RuleInput): AlertDraft | null {
  const { child, growthMeasurements, referenceDate } = input;

  const dates = growthMeasurements.map((m) => m.measurementDate);
  const latest = latestDate(dates);
  if (latest && daysSince(latest, referenceDate) <= 90) return null;

  const motivo = latest
    ? `Última medição há ${daysSince(latest, referenceDate)} dias.`
    : 'Nenhuma medição de crescimento registrada.';

  return {
    ruleId: 'R4_NO_GROWTH_90D',
    category: 'ATTENTION',
    title: 'Monitoramento de crescimento pendente',
    description: `${child.fullName} está sem registro de crescimento há mais de 90 dias. ${motivo}`,
    clinicalSource: 'OMS — Padrões de Crescimento Infantil (2006)',
  };
}

/**
 * R5 — Sem medição de peso nos últimos 30 dias em criança ≤ 6 meses.
 * Fonte: OMS — recomendação de avaliação mensal no 1º semestre (e feedback do médico de puericultura).
 */
export function r5NoWeight30dUnder6m(input: RuleInput): AlertDraft | null {
  const { child, growthMeasurements, referenceDate } = input;
  const ageInDays = ageInDaysAt(child.birthDate, referenceDate);
  if (ageInDays > 180) return null; // > 6 meses → não se aplica

  const withWeight = growthMeasurements.filter((m) => m.weightKg !== undefined);
  const dates = withWeight.map((m) => m.measurementDate);
  const latest = latestDate(dates);
  if (latest && daysSince(latest, referenceDate) <= 30) return null;

  const motivo = latest
    ? `Último peso registrado há ${daysSince(latest, referenceDate)} dias.`
    : 'Nenhuma medição de peso registrada.';

  return {
    ruleId: 'R5_NO_WEIGHT_30D_UNDER_6M',
    category: 'HIGH_PRIORITY',
    title: 'Peso não aferido (< 6 meses)',
    description: `${child.fullName} tem ${Math.floor(ageInDays / 30)} meses e está sem registro de peso há mais de 30 dias. ${motivo} Lactentes jovens devem ser pesados mensalmente.`,
    clinicalSource: 'OMS — Padrões de Crescimento Infantil (2006)',
  };
}

/**
 * R6 — Profissional marcou requiresFollowUp em desenvolvimento.
 * O alerta reflete o sinalizador que o próprio profissional registrou —
 * não é uma inferência automática.
 */
export function r6DevelopmentFollowUp(input: RuleInput): AlertDraft | null {
  const { child, developmentAssessments } = input;
  if (developmentAssessments.length === 0) return null;

  const sorted = [...developmentAssessments].sort((a, b) =>
    b.assessmentDate.localeCompare(a.assessmentDate)
  );
  const latest = sorted[0];
  if (!latest.requiresFollowUp) return null;

  return {
    ruleId: 'R6_DEVELOPMENT_FOLLOW_UP',
    category: 'ATTENTION',
    title: 'Acompanhamento de desenvolvimento indicado',
    description: `O profissional sinalizou necessidade de acompanhamento na última avaliação de desenvolvimento de ${child.fullName} (${new Date(latest.assessmentDate + 'T00:00:00').toLocaleDateString('pt-BR')}). Agendar reavaliação.`,
    clinicalSource: 'SBP — Manual de Puericultura (2023)',
  };
}

/**
 * R7 — Alimentação com requiresFollowUp em ≥ 2 registros recentes.
 * Indica dificuldades alimentares recorrentes sinalizadas pelo profissional.
 */
export function r7FeedingFollowUpRecurrent(input: RuleInput): AlertDraft | null {
  const { child, feedingRecords } = input;

  const withFollowUp = feedingRecords.filter((r) => r.requiresFollowUp);
  if (withFollowUp.length < 2) return null;

  return {
    ruleId: 'R7_CHOKING_RECURRENT',
    category: 'HIGH_PRIORITY',
    title: 'Dificuldades alimentares recorrentes',
    description: `${child.fullName} possui ${withFollowUp.length} registros de alimentação com necessidade de acompanhamento indicada pelo profissional. Avaliar encaminhamento especializado.`,
    clinicalSource: 'MS — Caderno de Atenção Básica nº 23 (Saúde da Criança)',
  };
}

/**
 * R8 — Sono com requiresFollowUp em ≥ 2 registros recentes.
 * Indica problemas de sono recorrentes sinalizados pelo profissional.
 */
export function r8SleepFollowUpRecurrent(input: RuleInput): AlertDraft | null {
  const { child, sleepRecords } = input;

  const withFollowUp = sleepRecords.filter((r) => r.requiresFollowUp);
  if (withFollowUp.length < 2) return null;

  return {
    ruleId: 'R8_PRONE_SLEEP_UNDER_6M',
    category: 'HIGH_PRIORITY',
    title: 'Dificuldades de sono recorrentes',
    description: `${child.fullName} possui ${withFollowUp.length} registros de sono com necessidade de acompanhamento indicada pelo profissional. Considerar avaliação especializada.`,
    clinicalSource: 'SBP — Manual de Puericultura (2023)',
  };
}

/**
 * R9 — Atraso no desenvolvimento (Vigilância baseada no gráfico de Denver).
 * Se tiver 1 marco atrasado: Alerta ATTENTION de acompanhamento.
 * Se tiver 2 ou mais marcos atrasados: Alerta HIGH_PRIORITY de encaminhamento ao Neuropediatra.
 */
export function r9DevelopmentDelayMultiple(input: RuleInput): AlertDraft | null {
  const { child, developmentAssessments } = input;
  if (developmentAssessments.length === 0) return null;

  // Ordena por data decrescente para pegar a avaliação mais recente
  const sorted = [...developmentAssessments].sort((a, b) =>
    b.assessmentDate.localeCompare(a.assessmentDate)
  );
  const latest = sorted[0];

  const delayedMilestones = latest.milestones.filter((m) => m.status === 'NOT_ACHIEVED');
  if (delayedMilestones.length === 0) return null;

  if (delayedMilestones.length === 1) {
    return {
      ruleId: 'R9_DEVELOPMENT_DELAY_MULTIPLE',
      category: 'ATTENTION',
      title: 'Atraso no desenvolvimento (Denver II)',
      description: `${child.fullName} apresenta 1 marco de desenvolvimento não alcançado (${delayedMilestones[0].description}). Necessita de avaliação cuidadosa.`,
      clinicalSource: 'Referência: Gráfico de Desenvolvimento de Denver II / SBP',
    };
  }

  // 2 ou mais marcos não alcançados
  const listaMarcos = delayedMilestones.map((m) => m.description).join(', ');
  return {
    ruleId: 'R9_DEVELOPMENT_DELAY_MULTIPLE',
    category: 'HIGH_PRIORITY',
    title: 'Atrasos múltiplos no desenvolvimento - Avaliar Neuro',
    description: `${child.fullName} apresenta múltiplos atrasos (${delayedMilestones.length} marcos não alcançados: ${listaMarcos}). Necessidade de avaliação cuidadosa e indicação de encaminhamento para o Neuropediatra.`,
    clinicalSource: 'Referência: Gráfico de Desenvolvimento de Denver II / SBP',
  };
}

/**
 * R10 — Alerta de segurança de primeira ocorrência para Engasgo e Apneia.
 * Qualquer registro recente contendo menção a engasgo ou apneia justifica alta prioridade.
 * Fonte: SBP / Diretrizes de Segurança do Lactente.
 */
export function r10SafetyAlertChokingApnea(input: RuleInput): AlertDraft | null {
  const { child, consultations } = input;
  if (consultations.length === 0) return null;

  // Pega a consulta completada mais recente
  const completed = consultations
    .filter((c) => c.status === 'completed')
    .sort((a, b) => b.consultationDate.localeCompare(a.consultationDate));
  
  if (completed.length === 0) return null;
  const latest = completed[0];

  const textToSearch = [
    latest.intervalHistory,
    latest.clinicalNotes,
    latest.reason,
    latest.assessment
  ].join(' ').toLowerCase();

  const hasChoking = textToSearch.includes('engasgo') || textToSearch.includes('choking') || textToSearch.includes('engasgou');
  const hasApnea = textToSearch.includes('apneia') || textToSearch.includes('apnea') || textToSearch.includes('apneia');

  if (hasChoking && hasApnea) {
    return {
      ruleId: 'R10_SAFETY_ALERT_CHOKING_APNEA',
      category: 'HIGH_PRIORITY',
      title: 'Alerta de Segurança: Engasgo e Apneia',
      description: `Registrado episódio recente de engasgo e apneia para ${child.fullName} na consulta de ${new Date(latest.consultationDate + 'T00:00:00').toLocaleDateString('pt-BR')}. Risco imediato.`,
      clinicalSource: 'SBP / Diretrizes de Segurança do Lactente',
    };
  }

  if (hasChoking) {
    return {
      ruleId: 'R10_SAFETY_ALERT_CHOKING_APNEA',
      category: 'HIGH_PRIORITY',
      title: 'Alerta de Segurança: Engasgo',
      description: `Registrado episódio recente de engasgo para ${child.fullName} na consulta de ${new Date(latest.consultationDate + 'T00:00:00').toLocaleDateString('pt-BR')}. Avaliar vias aéreas e orientar manobra de desobstrução.`,
      clinicalSource: 'SBP / Diretrizes de Segurança do Lactente',
    };
  }

  if (hasApnea) {
    return {
      ruleId: 'R10_SAFETY_ALERT_CHOKING_APNEA',
      category: 'HIGH_PRIORITY',
      title: 'Alerta de Segurança: Apneia',
      description: `Registrado episódio recente de apneia para ${child.fullName} na consulta de ${new Date(latest.consultationDate + 'T00:00:00').toLocaleDateString('pt-BR')}. Avaliar clinicamente com urgência.`,
      clinicalSource: 'SBP / Diretrizes de Segurança do Lactente',
    };
  }

  return null;
}

// ─── Executor de todas as regras ──────────────────────────────────────────────

/** Todas as regras disponíveis — ordem por gravidade (HIGH_PRIORITY primeiro) */
const RULES = [
  r3LateVaccination,
  r5NoWeight30dUnder6m,
  r7FeedingFollowUpRecurrent,
  r8SleepFollowUpRecurrent,
  r9DevelopmentDelayMultiple,
  r10SafetyAlertChokingApnea,
  r1NoConsultUnder24m,
  r2NoConsultOver24m,
  r4NoGrowth90d,
  r6DevelopmentFollowUp,
];

/**
 * Avalia todas as regras para uma criança e retorna os alertas gerados.
 * Função pura — sem I/O.
 */
export function evaluateRules(input: RuleInput): AlertDraft[] {
  const results: AlertDraft[] = [];
  for (const rule of RULES) {
    const alert = rule(input);
    if (alert) results.push(alert);
  }
  return results;
}
