import { z } from 'zod';

export const developmentDomains = [
  'motor_grosso',
  'motor_fino',
  'comunicacao',
  'cognicao',
  'social_adaptativo',
] as const;

export const milestoneStatuses = ['ACHIEVED', 'NOT_ACHIEVED', 'NOT_EVALUATED', 'UNCERTAIN'] as const;

const milestoneEntrySchema = z.object({
  domain: z.enum(developmentDomains),
  description: z.string().min(3, 'Descreva a habilidade observada'),
  status: z.enum(milestoneStatuses),
});

/**
 * Um registro precisa ter ao menos um marco OU uma observação livre —
 * não faz sentido um registro totalmente vazio (mesmo espírito do "ao
 * menos uma medida" em growth, Sprint 4).
 */
export const developmentAssessmentSchema = z
  .object({
    assessmentDate: z
      .string()
      .min(1, 'Informe a data da avaliação')
      .refine((v) => new Date(v) <= new Date(), 'A data da avaliação não pode ser no futuro'),
    milestones: z.array(milestoneEntrySchema),
    observations: z.string().optional(),
    requiresFollowUp: z.boolean(),
  })
  .refine(
    (data) => data.milestones.length > 0 || !!(data.observations && data.observations.trim().length > 0),
    {
      message: 'Registre ao menos um marco avaliado ou uma observação.',
      path: ['observations'],
    }
  );

export type DevelopmentAssessmentFormValues = z.infer<typeof developmentAssessmentSchema>;

export function developmentAssessmentFormDefaults(assessmentDate: string): DevelopmentAssessmentFormValues {
  return {
    assessmentDate,
    milestones: [],
    observations: '',
    requiresFollowUp: false,
  };
}

/** Converte os valores do formulário para o payload salvo no Firestore. */
export function toDevelopmentAssessmentContentPayload(data: DevelopmentAssessmentFormValues) {
  return {
    assessmentDate: data.assessmentDate,
    milestones: data.milestones,
    observations: data.observations || undefined,
    requiresFollowUp: data.requiresFollowUp,
  };
}
