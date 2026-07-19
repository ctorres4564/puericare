import { z } from 'zod';

/**
 * Campos numéricos vêm de <input type="number"> como string.
 * Não usamos z.coerce/z.preprocess aqui: nessa combinação de versões
 * (zod 4 + @hookform/resolvers 5), o tipo de entrada do coerce vira
 * `unknown`, o que quebra a inferência de tipos do zodResolver com
 * useForm<T>. Em vez disso, validamos a string e convertemos para
 * number só depois, no limite com o Firestore.
 */
export function optionalNumberString(min: number, max: number) {
  return z.string().optional().refine(
    (v) => v === undefined || v === '' || (!Number.isNaN(Number(v)) && Number(v) >= min && Number(v) <= max),
    `Informe um valor entre ${min} e ${max}`
  );
}

export function toNumber(v?: string): number | undefined {
  return v === undefined || v === '' ? undefined : Number(v);
}
