import { z } from 'zod';

export const vaccinationStatuses = ['em_dia', 'atrasada', 'nao_informado'] as const;

export const vaccinationRecordSchema = z.object({
  recordDate: z
    .string()
    .min(1, 'Informe a data do registro')
    .refine((v) => new Date(v) <= new Date(), 'A data do registro não pode ser no futuro'),
  status: z.enum(vaccinationStatuses),
  vaccineName: z.string().optional(),
  doseDescription: z.string().optional(),
  lot: z.string().optional(),
  facility: z.string().optional(),
  observations: z.string().optional(),
});

export type VaccinationRecordFormValues = z.infer<typeof vaccinationRecordSchema>;

export function vaccinationRecordFormDefaults(recordDate: string): VaccinationRecordFormValues {
  return {
    recordDate,
    status: 'nao_informado',
    vaccineName: '',
    doseDescription: '',
    lot: '',
    facility: '',
    observations: '',
  };
}

export function toVaccinationRecordContentPayload(data: VaccinationRecordFormValues) {
  return {
    recordDate: data.recordDate,
    status: data.status,
    vaccineName: data.vaccineName || undefined,
    doseDescription: data.doseDescription || undefined,
    lot: data.lot || undefined,
    facility: data.facility || undefined,
    observations: data.observations || undefined,
  };
}
