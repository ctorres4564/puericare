import { z } from 'zod';
import { optionalNumberString, toNumber } from '@/lib/validation/numberField';
import type { CreateChildPayload, PerinatalData } from '@/lib/types';

export const childSchema = z.object({
  fullName: z.string().min(3, 'Informe o nome completo da criança'),
  socialName: z.string().optional(),
  birthDate: z
    .string()
    .min(1, 'Informe a data de nascimento')
    .refine((v) => new Date(v) <= new Date(), 'A data de nascimento não pode ser no futuro'),
  sexAtBirth: z.enum(['female', 'male', 'other', 'not_informed']),

  caregiverName: z.string().min(3, 'Informe o nome do responsável'),
  contactPhone: z.string().min(8, 'Informe um telefone válido'),
  contactEmail: z.union([z.literal(''), z.string().email('E-mail inválido')]).optional(),

  susCardNumber: z.string().optional(),
  healthInsurance: z.string().optional(),

  perinatalData: z.object({
    gestationalAgeWeeks: optionalNumberString(20, 45),
    deliveryType: z.union([z.literal(''), z.enum(['vaginal', 'cesarean', 'forceps', 'other'])]).optional(),
    birthWeightGrams: optionalNumberString(200, 8000),
    birthLengthCm: optionalNumberString(20, 80),
    birthHeadCircumferenceCm: optionalNumberString(15, 60),
    apgar1: optionalNumberString(0, 10),
    apgar5: optionalNumberString(0, 10),
    premature: z.boolean(),
    neonatalHospitalization: z.boolean(),
    neonatalComplications: z.string().optional(),
  }),
});

export type ChildFormValues = z.infer<typeof childSchema>;

export const childFormDefaults: ChildFormValues = {
  fullName: '',
  socialName: '',
  birthDate: '',
  sexAtBirth: 'not_informed',
  caregiverName: '',
  contactPhone: '',
  contactEmail: '',
  susCardNumber: '',
  healthInsurance: '',
  perinatalData: {
    gestationalAgeWeeks: '',
    deliveryType: '',
    birthWeightGrams: '',
    birthLengthCm: '',
    birthHeadCircumferenceCm: '',
    apgar1: '',
    apgar5: '',
    premature: false,
    neonatalHospitalization: false,
    neonatalComplications: '',
  },
};

/** Converte os valores validados do formulário para o payload salvo no Firestore. */
export function toChildPayload(
  data: ChildFormValues
): Omit<CreateChildPayload, 'professionalId' | 'caregiverIds' | 'active'> {
  const perinatalData: PerinatalData = {
    gestationalAgeWeeks: toNumber(data.perinatalData.gestationalAgeWeeks),
    deliveryType: data.perinatalData.deliveryType || undefined,
    birthWeightGrams: toNumber(data.perinatalData.birthWeightGrams),
    birthLengthCm: toNumber(data.perinatalData.birthLengthCm),
    birthHeadCircumferenceCm: toNumber(data.perinatalData.birthHeadCircumferenceCm),
    apgar1: toNumber(data.perinatalData.apgar1),
    apgar5: toNumber(data.perinatalData.apgar5),
    premature: data.perinatalData.premature,
    neonatalHospitalization: data.perinatalData.neonatalHospitalization,
    neonatalComplications: data.perinatalData.neonatalComplications || undefined,
  };

  return {
    fullName: data.fullName,
    socialName: data.socialName || undefined,
    birthDate: data.birthDate,
    sexAtBirth: data.sexAtBirth,
    caregiverName: data.caregiverName,
    contactPhone: data.contactPhone,
    contactEmail: data.contactEmail || undefined,
    susCardNumber: data.susCardNumber || undefined,
    healthInsurance: data.healthInsurance || undefined,
    perinatalData,
  };
}
