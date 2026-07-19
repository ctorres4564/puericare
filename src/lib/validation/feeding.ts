import { z } from 'zod';

export const feedingRecordSchema = z
  .object({
    recordDate: z
      .string()
      .min(1, 'Informe a data do registro')
      .refine((v) => new Date(v) <= new Date(), 'A data do registro não pode ser no futuro'),
    feedingHistory: z.string().optional(),
    routine: z.string().optional(),
    foodIntroduction: z.string().optional(),
    difficulties: z.string().optional(),
    observations: z.string().optional(),
    requiresFollowUp: z.boolean(),
  })
  .refine(
    (data) =>
      !!(
        data.feedingHistory?.trim() ||
        data.routine?.trim() ||
        data.foodIntroduction?.trim() ||
        data.difficulties?.trim() ||
        data.observations?.trim()
      ),
    {
      message: 'Preencha ao menos um campo do registro.',
      path: ['feedingHistory'],
    }
  );

export type FeedingRecordFormValues = z.infer<typeof feedingRecordSchema>;

export function feedingRecordFormDefaults(recordDate: string): FeedingRecordFormValues {
  return {
    recordDate,
    feedingHistory: '',
    routine: '',
    foodIntroduction: '',
    difficulties: '',
    observations: '',
    requiresFollowUp: false,
  };
}

export function toFeedingRecordContentPayload(data: FeedingRecordFormValues) {
  return {
    recordDate: data.recordDate,
    feedingHistory: data.feedingHistory || undefined,
    routine: data.routine || undefined,
    foodIntroduction: data.foodIntroduction || undefined,
    difficulties: data.difficulties || undefined,
    observations: data.observations || undefined,
    requiresFollowUp: data.requiresFollowUp,
  };
}
