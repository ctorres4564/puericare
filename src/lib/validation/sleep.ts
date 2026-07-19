import { z } from 'zod';
import { optionalNumberString, toNumber } from '@/lib/validation/numberField';

/**
 * Faixas de plausibilidade (erro de digitação), não pontos de corte
 * clínicos — mesmo espírito das faixas de crescimento (Sprint 4).
 */
const NIGHT_WAKINGS_RANGE = [0, 15] as const;
const SLEEP_DURATION_HOURS_RANGE = [0, 16] as const;

export const sleepRecordSchema = z
  .object({
    recordDate: z
      .string()
      .min(1, 'Informe a data do registro')
      .refine((v) => new Date(v) <= new Date(), 'A data do registro não pode ser no futuro'),
    bedtime: z.string().optional(),
    nightWakings: optionalNumberString(...NIGHT_WAKINGS_RANGE),
    sleepDurationHours: optionalNumberString(...SLEEP_DURATION_HOURS_RANGE),
    naps: z.string().optional(),
    routine: z.string().optional(),
    observations: z.string().optional(),
    difficulties: z.string().optional(),
    requiresFollowUp: z.boolean(),
  })
  .refine(
    (data) =>
      !!(
        data.bedtime?.trim() ||
        data.nightWakings ||
        data.sleepDurationHours ||
        data.naps?.trim() ||
        data.routine?.trim() ||
        data.observations?.trim() ||
        data.difficulties?.trim()
      ),
    {
      message: 'Preencha ao menos um campo do registro.',
      path: ['bedtime'],
    }
  );

export type SleepRecordFormValues = z.infer<typeof sleepRecordSchema>;

export function sleepRecordFormDefaults(recordDate: string): SleepRecordFormValues {
  return {
    recordDate,
    bedtime: '',
    nightWakings: '',
    sleepDurationHours: '',
    naps: '',
    routine: '',
    observations: '',
    difficulties: '',
    requiresFollowUp: false,
  };
}

export function toSleepRecordContentPayload(data: SleepRecordFormValues) {
  return {
    recordDate: data.recordDate,
    bedtime: data.bedtime || undefined,
    nightWakings: toNumber(data.nightWakings),
    sleepDurationHours: toNumber(data.sleepDurationHours),
    naps: data.naps || undefined,
    routine: data.routine || undefined,
    observations: data.observations || undefined,
    difficulties: data.difficulties || undefined,
    requiresFollowUp: data.requiresFollowUp,
  };
}
