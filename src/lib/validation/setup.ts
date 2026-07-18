import { z } from 'zod';

/**
 * Schema do formulário de setup (dev only). ADMIN não é uma opção: as
 * regras do Firestore (firestore.rules) rejeitam a criação de um usuário
 * com role ADMIN pelo cliente. O primeiro admin é criado manualmente no
 * console do Firebase — veja SECURITY.md.
 */
export const setupSchema = z.object({
  displayName: z.string().min(3, 'Informe o nome completo'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  role: z.enum(['PROFESSIONAL', 'CAREGIVER']),
  crm: z.string().optional(),
  specialty: z.string().optional(),
});

export type SetupFormValues = z.infer<typeof setupSchema>;
