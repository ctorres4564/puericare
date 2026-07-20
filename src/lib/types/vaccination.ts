/**
 * Tipos relacionados ao Registro de Vacinação (VaccinationRecord) — Sprint 6.
 *
 * `prd.txt` (seção 6) define vacinação como um "campo simples": Em dia /
 * Atrasada / Não informado — uma classificação feita pelo profissional a
 * partir da caderneta de vacinação. A visão maior do mvp.txt (Módulo 8 —
 * calendário vacinal, próximas vacinas, vacinas atrasadas) foi incorporada
 * depois, via lib/vaccination/schedule.ts (calendário PNI versionado no
 * código). Estado atual:
 *
 * - Implementado: registro do status (campo simples do PRD), registro
 *   opcional de doses aplicadas (nome, data, lote, estabelecimento) e
 *   calendário vacinal PNI referência 2026 (lib/vaccination/schedule.ts):
 *   quando o registro informa `scheduleKey`, a dose é casada diretamente
 *   com o calendário; registros antigos (só texto livre) são casados por
 *   nome. O sistema calcula a situação de cada dose (registrada / possível
 *   atraso / disponível / prevista) — sempre como sinal de conferência, não
 *   conclusão clínica. O `status` manual continua existindo como avaliação
 *   do profissional.
 * - Vacinas sazonais/por campanha (influenza, Covid-19): aparecem como
 *   itens de conferência manual, sem cálculo de atraso.
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
   * Status avaliado pelo profissional no momento do registro — avaliação
   * humana, independente do cálculo automático do calendário (scheduleKey).
   */
  status: VaccinationStatus;

  /**
   * Chave da dose no calendário PNI (ScheduledDose.key em
   * lib/vaccination/schedule.ts), quando a visita aplicou uma dose do
   * calendário. Opcional e imutável — registros sem ela são casados por
   * `vaccineName` (heurística de alias).
   */
  scheduleKey?: string;

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
