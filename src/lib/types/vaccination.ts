/**
 * Tipos relacionados ao Registro de Vacinação (VaccinationRecord) — Sprint 6.
 *
 * `prd.txt` (seção 6) define vacinação como um "campo simples": Em dia /
 * Atrasada / Não informado — uma classificação feita pelo profissional a
 * partir da caderneta de vacinação, não calculada pelo sistema. O
 * planejamento do mvp.txt (Módulo 8) descreve uma visão maior (calendário
 * vacinal, próximas vacinas, vacinas atrasadas, alertas de pendência) que
 * exigiria o calendário oficial do PNI (Ministério da Saúde) — não
 * incorporado a este projeto. Por isso:
 *
 * - Implementado: registro do status (campo simples do PRD) e registro
 *   opcional de doses aplicadas (nome, data, lote, estabelecimento) — dados
 *   digitados livremente pelo profissional, sem comparação com nenhum
 *   calendário.
 * - NÃO implementado: calendário vacinal oficial, cálculo automático de
 *   "vacinas atrasadas"/"próximas vacinas", alertas de pendência,
 *   recomendação automática de vacina. Ver
 *   documentacao/sprint-6-alimentacao-sono-vacinacao.md (pendência).
 */
export type VaccinationStatus = 'em_dia' | 'atrasada' | 'nao_informado';

export interface VaccinationRecord {
  id: string;
  /** ID da criança — imutável (a entidade inteira é imutável) */
  childId: string;
  /** ID do profissional responsável — imutável */
  professionalId: string;

  /** ISO 8601: YYYY-MM-DD */
  recordDate: string;
  /** Idade cronológica da criança na data do registro, em dias */
  ageInDays: number;

  /**
   * Status avaliado pelo profissional no momento do registro — nunca
   * calculado a partir de um calendário (não implementado, ver nota acima).
   */
  status: VaccinationStatus;

  /** Nome da vacina aplicada nesta visita, se houver (texto livre) */
  vaccineName?: string;
  /** Descrição da dose (ex.: "1ª dose", "reforço"), texto livre */
  doseDescription?: string;
  /** Lote, opcional */
  lot?: string;
  /** Estabelecimento onde foi aplicada, opcional */
  facility?: string;
  /** Observações do profissional */
  observations?: string;

  createdAt: string;
  updatedAt: string;
}

export type CreateVaccinationRecordPayload = Omit<VaccinationRecord, 'id' | 'createdAt' | 'updatedAt'>;
