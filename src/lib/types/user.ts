/**
 * Perfis de usuário do sistema PueriCare.
 *
 * ADMIN       — Administrador do sistema (gerencia usuários, base científica)
 * PROFESSIONAL— Médico/profissional de saúde (acessa pacientes próprios)
 * CAREGIVER   — Responsável pela criança (visualização limitada)
 */
export type UserRole = 'ADMIN' | 'PROFESSIONAL' | 'CAREGIVER';

/**
 * Perfil de usuário armazenado no Firestore (coleção `users`).
 */
export interface UserProfile {
  /** UID do Firebase Authentication */
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  /** Apenas para PROFESSIONAL */
  crm?: string;
  specialty?: string;
  /** Apenas para CAREGIVER — IDs das crianças vinculadas */
  linkedChildIds?: string[];
  /** Conta ativa ou bloqueada */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload para criação de um novo perfil.
 */
export type CreateUserProfilePayload = Omit<UserProfile, 'createdAt' | 'updatedAt'>;
