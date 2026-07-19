/**
 * Tipos relacionados ao Registro de Sono (SleepRecord) — Sprint 6.
 *
 * `prd.txt` (seção 6) define sono como "texto livre" na consulta. Esta
 * entidade estrutura os aspectos explicitamente pedidos para esta etapa:
 * horário de dormir, despertares, duração, cochilos, rotina, observações e
 * dificuldades percebidas.
 *
 * NÃO implementado: classificação de "normal"/"anormal" (sem referência
 * normativa explícita — instrução desta etapa), nem os campos mais
 * clinicamente sensíveis do planejamento (ronco, pausas respiratórias,
 * compartilhamento de cama, telas antes de dormir) como campos estruturados
 * dedicados — ficam cobertos, se o profissional quiser registrá-los, pelo
 * campo livre `difficulties`. `requiresFollowUp` é sempre manual.
 */
export interface SleepRecord {
  id: string;
  /** ID da criança — imutável (a entidade inteira é imutável) */
  childId: string;
  /** ID do profissional responsável — imutável */
  professionalId: string;

  /** ISO 8601: YYYY-MM-DD */
  recordDate: string;
  /** Idade cronológica da criança na data do registro, em dias */
  ageInDays: number;

  /** Horário aproximado de dormir (texto livre, ex.: "20:30") */
  bedtime?: string;
  /** Número de despertares noturnos */
  nightWakings?: number;
  /** Duração aproximada do sono noturno, em horas */
  sleepDurationHours?: number;
  /** Cochilos diurnos (texto livre) */
  naps?: string;
  /** Rotina de sono */
  routine?: string;
  /** Observações do profissional */
  observations?: string;
  /** Dificuldades percebidas pelo responsável/profissional */
  difficulties?: string;
  /** Conduta/acompanhamento — definido manualmente pelo profissional */
  requiresFollowUp: boolean;

  createdAt: string;
  updatedAt: string;
}

export type CreateSleepRecordPayload = Omit<SleepRecord, 'id' | 'createdAt' | 'updatedAt'>;
