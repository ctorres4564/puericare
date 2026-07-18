import { describe, test, expect } from 'vitest';
import { childSchema, toChildPayload, childFormDefaults } from './child';

const validForm = {
  ...childFormDefaults,
  fullName: 'Maria Teste',
  birthDate: '2025-01-15',
  sexAtBirth: 'female' as const,
  caregiverName: 'Joana Responsável',
  contactPhone: '11988887777',
};

describe('childSchema — validações relevantes', () => {
  test('aceita um cadastro mínimo válido', () => {
    const result = childSchema.safeParse(validForm);
    expect(result.success).toBe(true);
  });

  test('rejeita nome completo curto demais', () => {
    const result = childSchema.safeParse({ ...validForm, fullName: 'Jo' });
    expect(result.success).toBe(false);
  });

  test('rejeita data de nascimento ausente', () => {
    const result = childSchema.safeParse({ ...validForm, birthDate: '' });
    expect(result.success).toBe(false);
  });

  test('rejeita data de nascimento no futuro', () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().slice(0, 10);
    const result = childSchema.safeParse({ ...validForm, birthDate: futureDate });
    expect(result.success).toBe(false);
  });

  test('rejeita responsável sem nome', () => {
    const result = childSchema.safeParse({ ...validForm, caregiverName: 'Jo' });
    expect(result.success).toBe(false);
  });

  test('rejeita telefone do responsável curto demais', () => {
    const result = childSchema.safeParse({ ...validForm, contactPhone: '123' });
    expect(result.success).toBe(false);
  });

  test('rejeita e-mail do responsável inválido quando preenchido', () => {
    const result = childSchema.safeParse({ ...validForm, contactEmail: 'nao-e-email' });
    expect(result.success).toBe(false);
  });

  test('aceita e-mail do responsável vazio (opcional)', () => {
    const result = childSchema.safeParse({ ...validForm, contactEmail: '' });
    expect(result.success).toBe(true);
  });

  test('rejeita Apgar fora da faixa 0–10', () => {
    const result = childSchema.safeParse({
      ...validForm,
      perinatalData: { ...validForm.perinatalData, apgar1: '15' },
    });
    expect(result.success).toBe(false);
  });

  test('rejeita idade gestacional fora da faixa 20–45 semanas', () => {
    const result = childSchema.safeParse({
      ...validForm,
      perinatalData: { ...validForm.perinatalData, gestationalAgeWeeks: '10' },
    });
    expect(result.success).toBe(false);
  });

  test('aceita campos perinatais vazios (todos opcionais)', () => {
    const result = childSchema.safeParse(validForm); // childFormDefaults já tem perinatalData com strings vazias
    expect(result.success).toBe(true);
  });
});

describe('toChildPayload — conversão para o formato salvo no Firestore', () => {
  test('converte strings numéricas dos dados perinatais para number', () => {
    const payload = toChildPayload({
      ...validForm,
      perinatalData: {
        ...validForm.perinatalData,
        gestationalAgeWeeks: '38',
        birthWeightGrams: '3200',
        birthLengthCm: '48.5',
        apgar1: '8',
        apgar5: '9',
      },
    });

    expect(payload.perinatalData?.gestationalAgeWeeks).toBe(38);
    expect(typeof payload.perinatalData?.gestationalAgeWeeks).toBe('number');
    expect(payload.perinatalData?.birthWeightGrams).toBe(3200);
    expect(payload.perinatalData?.birthLengthCm).toBe(48.5);
    expect(payload.perinatalData?.apgar1).toBe(8);
    expect(payload.perinatalData?.apgar5).toBe(9);
  });

  test('converte campos numéricos vazios para undefined (não zero)', () => {
    const payload = toChildPayload(validForm); // perinatalData todo com strings vazias
    expect(payload.perinatalData?.gestationalAgeWeeks).toBeUndefined();
    expect(payload.perinatalData?.birthWeightGrams).toBeUndefined();
  });

  test('converte campos de texto opcionais vazios para undefined', () => {
    const payload = toChildPayload(validForm);
    expect(payload.socialName).toBeUndefined();
    expect(payload.contactEmail).toBeUndefined();
    expect(payload.susCardNumber).toBeUndefined();
    expect(payload.healthInsurance).toBeUndefined();
    expect(payload.perinatalData?.deliveryType).toBeUndefined();
  });

  test('preserva booleanos perinatais', () => {
    const payload = toChildPayload({
      ...validForm,
      perinatalData: { ...validForm.perinatalData, premature: true, neonatalHospitalization: true },
    });
    expect(payload.perinatalData?.premature).toBe(true);
    expect(payload.perinatalData?.neonatalHospitalization).toBe(true);
  });
});
