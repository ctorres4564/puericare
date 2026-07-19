import { z } from 'zod';

/**
 * Schema do formulário de consulta. Todos os campos de conteúdo são
 * opcionais de propósito: um rascunho pode ser salvo incompleto — essa é
 * a definição de "rascunho" (PRD, Módulo 3: "salvamento como rascunho").
 */
export const consultationSchema = z.object({
  consultationDate: z
    .string()
    .min(1, 'Informe a data da consulta')
    .refine((v) => new Date(v) <= new Date(), 'A data da consulta não pode ser no futuro'),
  reason: z.string().optional(),
  intervalHistory: z.string().optional(),
  clinicalNotes: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
});

export type ConsultationFormValues = z.infer<typeof consultationSchema>;

export function consultationFormDefaults(consultationDate: string): ConsultationFormValues {
  return {
    consultationDate,
    reason: '',
    intervalHistory: '',
    clinicalNotes: '',
    assessment: '',
    plan: '',
  };
}

/** Converte os valores do formulário para o payload salvo no Firestore (strings vazias → undefined). */
export function toConsultationContentPayload(data: ConsultationFormValues) {
  return {
    consultationDate: data.consultationDate,
    reason: data.reason || undefined,
    intervalHistory: data.intervalHistory || undefined,
    clinicalNotes: data.clinicalNotes || undefined,
    assessment: data.assessment || undefined,
    plan: data.plan || undefined,
  };
}
