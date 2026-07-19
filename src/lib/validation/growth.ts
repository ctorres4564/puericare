import { z } from 'zod';
import { optionalNumberString, toNumber } from '@/lib/validation/numberField';
import { calculateBmi } from '@/lib/growth/bmi';

/**
 * Faixas de plausibilidade para pegar erro de digitação (ex.: trocar cm por
 * m, ou dígito a mais) — NÃO são pontos de corte clínicos nem indicam
 * normalidade/anormalidade. Cobrem crianças de 0 a ~6 anos (faixa do
 * cadastro, prompt.txt: "nascimento até 5 anos e 11 meses"), com folga
 * generosa para prematuridade extrema num extremo e crianças grandes no
 * outro.
 */
const WEIGHT_KG_RANGE = [0.3, 40] as const;
const HEIGHT_CM_RANGE = [25, 130] as const;
const HEAD_CIRCUMFERENCE_CM_RANGE = [20, 58] as const;

export const growthMeasurementSchema = z
  .object({
    measurementDate: z
      .string()
      .min(1, 'Informe a data da medição')
      .refine((v) => new Date(v) <= new Date(), 'A data da medição não pode ser no futuro'),
    weightKg: optionalNumberString(...WEIGHT_KG_RANGE),
    heightCm: optionalNumberString(...HEIGHT_CM_RANGE),
    headCircumferenceCm: optionalNumberString(...HEAD_CIRCUMFERENCE_CM_RANGE),
  })
  .refine((data) => data.weightKg || data.heightCm || data.headCircumferenceCm, {
    message: 'Informe ao menos uma medida: peso, comprimento/altura ou perímetro cefálico.',
    path: ['weightKg'],
  });

export type GrowthMeasurementFormValues = z.infer<typeof growthMeasurementSchema>;

export function growthMeasurementFormDefaults(measurementDate: string): GrowthMeasurementFormValues {
  return { measurementDate, weightKg: '', heightCm: '', headCircumferenceCm: '' };
}

/** Converte os valores do formulário para o payload salvo no Firestore (IMC calculado automaticamente). */
export function toGrowthMeasurementContentPayload(data: GrowthMeasurementFormValues) {
  const weightKg = toNumber(data.weightKg);
  const heightCm = toNumber(data.heightCm);
  return {
    measurementDate: data.measurementDate,
    weightKg,
    heightCm,
    headCircumferenceCm: toNumber(data.headCircumferenceCm),
    bmi: calculateBmi(weightKg, heightCm),
  };
}
