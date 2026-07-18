/**
 * Tipos relacionados à entidade Criança (Child).
 * Cobre dados cadastrais, perinatais e status da criança no sistema.
 */

export type SexAtBirth = 'female' | 'male' | 'other' | 'not_informed';

/**
 * Dados perinatais da criança.
 */
export interface PerinatalData {
  /** Idade gestacional em semanas */
  gestationalAgeWeeks?: number;
  /** Tipo de parto */
  deliveryType?: 'vaginal' | 'cesarean' | 'forceps' | 'other';
  /** Peso ao nascer em gramas */
  birthWeightGrams?: number;
  /** Comprimento ao nascer em cm */
  birthLengthCm?: number;
  /** Perímetro cefálico ao nascer em cm */
  birthHeadCircumferenceCm?: number;
  /** Apgar no 1º minuto */
  apgar1?: number;
  /** Apgar no 5º minuto */
  apgar5?: number;
  /** Se nasceu prematuro (< 37 semanas) */
  premature: boolean;
  /** Se houve internação neonatal */
  neonatalHospitalization: boolean;
  /** Descrição de intercorrências neonatais */
  neonatalComplications?: string;
}

/**
 * Entidade principal: Criança.
 * Armazenada na coleção `children` do Firestore.
 */
export interface Child {
  id: string;
  /** ID do profissional responsável */
  professionalId: string;
  /** IDs dos responsáveis (cuidadores) */
  caregiverIds: string[];

  /* ── Dados de identificação ── */
  fullName: string;
  /** ISO 8601: YYYY-MM-DD */
  birthDate: string;
  sexAtBirth: SexAtBirth;
  /** Nome social, se aplicável */
  socialName?: string;

  /* ── Contato ── */
  /** Telefone de contato do responsável */
  contactPhone?: string;
  contactEmail?: string;

  /* ── Documentos ── */
  susCardNumber?: string;
  healthInsurance?: string;

  /* ── Perinatais ── */
  perinatalData?: PerinatalData;

  /* ── Status ── */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload para criação de uma nova criança.
 */
export type CreateChildPayload = Omit<Child, 'id' | 'createdAt' | 'updatedAt'>;
