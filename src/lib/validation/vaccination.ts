import { z } from 'zod';
import { PNI_ALL_DOSES } from '@/lib/vaccination/schedule';

export const vaccinationStatuses = ['em_dia', 'atrasada', 'nao_informado'] as const;

const validScheduleKeys = new Set(PNI_ALL_DOSES.map((d) => d.key));

export const vaccinationRecordSchema = z.object({
  recordDate: z
    .string()
    .min(1, 'Informe a data do registro')
    .refine((v) => new Date(v) <= new Date(), 'A data do registro não pode ser no futuro'),
  status: z.enum(vaccinationStatuses),
  scheduleKey: z
    .string()
    .optional()
    .refine((v) => !v || validScheduleKeys.has(v), 'Dose do calendário inválida'),
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
    scheduleKey: '',
    vaccineName: '',
    doseDescription: '',
    lot: '',
    facility: '',
    observations: '',
  };
}

/**
 * Converte os valores do formulário no payload do service.
 * Quando a dose do calendário (scheduleKey) é informada, preenche nome e dose
 * a partir da tabela PNI se o profissional não digitou esses campos.
 */
export function toVaccinationRecordContentPayload(data: VaccinationRecordFormValues) {
  const scheduleDose = data.scheduleKey
    ? PNI_ALL_DOSES.find((d) => d.key === data.scheduleKey)
    : undefined;

  return {
    recordDate: data.recordDate,
    status: data.status,
    scheduleKey: scheduleDose?.key,
    vaccineName: data.vaccineName || scheduleDose?.vaccine || undefined,
    doseDescription: data.doseDescription || scheduleDose?.dose || undefined,
    lot: data.lot || undefined,
    facility: data.facility || undefined,
    observations: data.observations || undefined,
  };
}
