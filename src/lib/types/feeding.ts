/**
 * Tipos relacionados ao Registro de Alimentação (FeedingRecord) — Sprint 6.
 *
 * `prd.txt` (seção 6, bloco "Alimentação" da consulta) define o campo como
 * "texto livre". Esta entidade organiza esse texto livre em seções
 * conceitualmente distintas (instrução desta etapa), sem inventar campos,
 * alertas ou classificações não previstos: histórico alimentar, rotina,
 * introdução alimentar, dificuldades e observações — todos texto livre.
 *
 * NÃO implementado (ver documentacao/sprint-6-alimentacao-sono-vacinacao.md):
 * diagnóstico automático de transtorno alimentar, disfagia, seletividade
 * alimentar patológica, alergia ou intolerância; alertas automáticos de
 * "idade de introdução antes do configurado", "consistência inadequada" ou
 * "engasgo recorrente" (exigiriam referência normativa não disponível).
 * `requiresFollowUp` é sempre definido manualmente pelo profissional —
 * nunca inferido a partir do conteúdo do texto.
 */
export interface FeedingRecord {
  id: string;
  /** ID da criança — imutável (a entidade inteira é imutável) */
  childId: string;
  /** ID do profissional responsável — imutável */
  professionalId: string;

  /** ISO 8601: YYYY-MM-DD */
  recordDate: string;
  /** Idade cronológica da criança na data do registro, em dias */
  ageInDays: number;

  /** Histórico alimentar (aleitamento, fórmula, alimentação atual) */
  feedingHistory?: string;
  /** Rotina alimentar */
  routine?: string;
  /** Introdução alimentar (quando/como, descrito livremente) */
  foodIntroduction?: string;
  /** Dificuldades alimentares percebidas */
  difficulties?: string;
  /** Observações do profissional */
  observations?: string;
  /** Conduta/acompanhamento — definido manualmente pelo profissional */
  requiresFollowUp: boolean;

  createdAt: string;
  updatedAt: string;
}

export type CreateFeedingRecordPayload = Omit<FeedingRecord, 'id' | 'createdAt' | 'updatedAt'>;
