/**
 * Tipos relacionados à entidade Consulta (Consultation) — Sprint 3.
 * Escopo desta entidade nesta fase: registro central da consulta, rascunho
 * e evolução clínica. Antropometria (Sprint 4), desenvolvimento (Sprint 5)
 * e alimentação/sono/vacinação (Sprint 6) ficam fora deste tipo por ora.
 */

export type ConsultationStatus = 'draft' | 'completed' | 'cancelled';

/**
 * Entidade principal: Consulta.
 * Armazenada na coleção `consultations` do Firestore.
 */
export interface Consultation {
  id: string;
  /** ID da criança atendida — imutável após a criação */
  childId: string;
  /** ID do profissional responsável — imutável após a criação */
  professionalId: string;

  /** ISO 8601: YYYY-MM-DD */
  consultationDate: string;
  /** Idade da criança na data da consulta, em dias (calculada automaticamente) */
  ageInDays: number;

  /** Motivo da consulta */
  reason?: string;
  /** Intercorrências desde a última consulta */
  intervalHistory?: string;
  /** Observações clínicas / exame */
  clinicalNotes?: string;
  /** Avaliação clínica (evolução) */
  assessment?: string;
  /** Conduta e orientações */
  plan?: string;

  /**
   * draft: rascunho, editável livremente.
   * completed: consulta finalizada (registro da evolução clínica).
   * cancelled: "exclusão" de um rascunho — preserva rastreabilidade,
   * sem apagar o documento (hard delete restrito a ADMIN, ver firestore.rules).
   */
  status: ConsultationStatus;

  createdAt: string;
  updatedAt: string;
}

/**
 * Payload para criação de uma nova consulta.
 */
export type CreateConsultationPayload = Omit<Consultation, 'id' | 'createdAt' | 'updatedAt'>;
