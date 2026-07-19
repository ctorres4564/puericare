import { describe, test, expect } from 'vitest';
import {
  growthMeasurementSchema,
  growthMeasurementFormDefaults,
  toGrowthMeasurementContentPayload,
} from './growth';

describe('growthMeasurementSchema — validações relevantes', () => {
  test('aceita medição só com peso', () => {
    const result = growthMeasurementSchema.safeParse({
      ...growthMeasurementFormDefaults('2025-06-01'),
      weightKg: '10',
    });
    expect(result.success).toBe(true);
  });

  test('aceita medição só com altura', () => {
    const result = growthMeasurementSchema.safeParse({
      ...growthMeasurementFormDefaults('2025-06-01'),
      heightCm: '75',
    });
    expect(result.success).toBe(true);
  });

  test('aceita medição só com perímetro cefálico', () => {
    const result = growthMeasurementSchema.safeParse({
      ...growthMeasurementFormDefaults('2025-06-01'),
      headCircumferenceCm: '45',
    });
    expect(result.success).toBe(true);
  });

  test('rejeita quando nenhuma medida é informada', () => {
    const result = growthMeasurementSchema.safeParse(growthMeasurementFormDefaults('2025-06-01'));
    expect(result.success).toBe(false);
  });

  test('rejeita data da medição ausente', () => {
    const result = growthMeasurementSchema.safeParse({
      ...growthMeasurementFormDefaults(''),
      weightKg: '10',
    });
    expect(result.success).toBe(false);
  });

  test('rejeita data da medição no futuro', () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
    const result = growthMeasurementSchema.safeParse({
      ...growthMeasurementFormDefaults(futureDate),
      weightKg: '10',
    });
    expect(result.success).toBe(false);
  });

  test('valor de fronteira: peso no limite inferior (0,3 kg) é aceito', () => {
    const result = growthMeasurementSchema.safeParse({
      ...growthMeasurementFormDefaults('2025-06-01'),
      weightKg: '0.3',
    });
    expect(result.success).toBe(true);
  });

  test('valor de fronteira: peso abaixo do limite inferior é rejeitado', () => {
    const result = growthMeasurementSchema.safeParse({
      ...growthMeasurementFormDefaults('2025-06-01'),
      weightKg: '0.1',
    });
    expect(result.success).toBe(false);
  });

  test('valor de fronteira: peso acima do limite superior (40 kg) é rejeitado', () => {
    const result = growthMeasurementSchema.safeParse({
      ...growthMeasurementFormDefaults('2025-06-01'),
      weightKg: '45',
    });
    expect(result.success).toBe(false);
  });

  test('entrada implausível por confusão de unidade (altura em metros em vez de cm) é rejeitada', () => {
    const result = growthMeasurementSchema.safeParse({
      ...growthMeasurementFormDefaults('2025-06-01'),
      heightCm: '0.75', // 0,75 m digitado como se fosse cm
    });
    expect(result.success).toBe(false);
  });

  test('entrada inválida (texto não numérico) é rejeitada', () => {
    const result = growthMeasurementSchema.safeParse({
      ...growthMeasurementFormDefaults('2025-06-01'),
      weightKg: 'abc',
    });
    expect(result.success).toBe(false);
  });
});

describe('toGrowthMeasurementContentPayload', () => {
  test('calcula o IMC automaticamente quando peso e altura estão presentes', () => {
    const payload = toGrowthMeasurementContentPayload({
      measurementDate: '2025-06-01',
      weightKg: '10',
      heightCm: '75',
      headCircumferenceCm: '',
    });
    expect(payload.weightKg).toBe(10);
    expect(payload.heightCm).toBe(75);
    expect(payload.bmi).toBe(17.8);
  });

  test('IMC fica indefinido quando falta peso ou altura', () => {
    const payload = toGrowthMeasurementContentPayload({
      measurementDate: '2025-06-01',
      weightKg: '10',
      heightCm: '',
      headCircumferenceCm: '',
    });
    expect(payload.bmi).toBeUndefined();
  });

  test('converte campos vazios para undefined', () => {
    const payload = toGrowthMeasurementContentPayload(growthMeasurementFormDefaults('2025-06-01'));
    expect(payload.weightKg).toBeUndefined();
    expect(payload.heightCm).toBeUndefined();
    expect(payload.headCircumferenceCm).toBeUndefined();
  });
});
