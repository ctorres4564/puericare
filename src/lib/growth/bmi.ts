/**
 * IMC (Índice de Massa Corporal) = peso(kg) / altura(m)².
 *
 * Fórmula universal (índice de Quetelet), a mesma para qualquer idade —
 * não depende de referência populacional. Retorna apenas o valor bruto,
 * arredondado a 1 casa decimal; NÃO classifica o resultado (não há
 * "baixo peso"/"normal"/"sobrepeso" aqui) porque essa classificação em
 * pediatria depende de curvas de IMC-por-idade-e-sexo (OMS), que este
 * MVP não implementa — ver documentacao/sprint-4-crescimento.md.
 */
export function calculateBmi(weightKg?: number, heightCm?: number): number | undefined {
  if (weightKg === undefined || heightCm === undefined || heightCm <= 0 || weightKg <= 0) {
    return undefined;
  }
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 10) / 10;
}
