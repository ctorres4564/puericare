/**
 * Tipos relacionados à entidade Medição de Crescimento (GrowthMeasurement) —
 * Sprint 4.
 *
 * Escopo desta entidade nesta fase: peso, comprimento/estatura, perímetro
 * cefálico, IMC (quando aplicável) e histórico cronológico. Percentis,
 * escore-Z e curvas de referência (OMS) NÃO são calculados — o PRD exclui
 * curvas completas da OMS deste MVP (ver documentacao/prd.txt, seções 7 e 18)
 * e nenhuma tabela de referência oficial está disponível no projeto. Ver
 * documentacao/sprint-4-crescimento.md para a pendência registrada.
 *
 * Medições são imutáveis após criadas (nunca sobrescritas) — não há
 * atualização nesta entidade, só criação e leitura. Retificação/adendo
 * auditável é requisito futuro (mesma decisão já registrada para
 * consultas finalizadas no Sprint 3).
 */
export interface GrowthMeasurement {
  id: string;
  /** ID da criança medida — imutável (a entidade inteira é imutável) */
  childId: string;
  /** ID do profissional responsável — imutável */
  professionalId: string;

  /** ISO 8601: YYYY-MM-DD */
  measurementDate: string;
  /** Idade da criança na data da medição, em dias (calculada automaticamente) */
  ageInDays: number;

  /** Peso em quilogramas */
  weightKg?: number;
  /** Comprimento (deitado) ou estatura (em pé), em centímetros */
  heightCm?: number;
  /** Perímetro cefálico em centímetros */
  headCircumferenceCm?: number;
  /** IMC (kg/m²), calculado automaticamente quando weightKg e heightCm existem */
  bmi?: number;

  createdAt: string;
  updatedAt: string;
}

/** Payload para criação de uma nova medição. */
export type CreateGrowthMeasurementPayload = Omit<GrowthMeasurement, 'id' | 'createdAt' | 'updatedAt'>;
