import { describe, test, expect } from 'vitest';
import {
  vaccinationRecordSchema,
  vaccinationRecordFormDefaults,
  toVaccinationRecordContentPayload,
} from './vaccination';

describe('vaccinationRecordSchema — validações relevantes', () => {
  test('aceita registro só com status (demais campos opcionais)', () => {
    const result = vaccinationRecordSchema.safeParse(vaccinationRecordFormDefaults('2025-06-01'));
    expect(result.success).toBe(true);
  });

  test('aceita os 3 status previstos no PRD', () => {
    for (const status of ['em_dia', 'atrasada', 'nao_informado'] as const) {
      const result = vaccinationRecordSchema.safeParse({
        ...vaccinationRecordFormDefaults('2025-06-01'),
        status,
      });
      expect(result.success).toBe(true);
    }
  });

  test('rejeita status fora da lista', () => {
    const result = vaccinationRecordSchema.safeParse({
      ...vaccinationRecordFormDefaults('2025-06-01'),
      status: 'completo',
    });
    expect(result.success).toBe(false);
  });

  test('rejeita data ausente', () => {
    const result = vaccinationRecordSchema.safeParse({
      ...vaccinationRecordFormDefaults(''),
    });
    expect(result.success).toBe(false);
  });

  test('rejeita data no futuro', () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
    const result = vaccinationRecordSchema.safeParse(vaccinationRecordFormDefaults(futureDate));
    expect(result.success).toBe(false);
  });

  test('aceita registro completo com dose aplicada', () => {
    const result = vaccinationRecordSchema.safeParse({
      recordDate: '2025-06-01',
      status: 'em_dia',
      vaccineName: 'Pentavalente',
      doseDescription: '1ª dose',
      lot: 'AB123',
      facility: 'UBS Central',
      observations: '',
    });
    expect(result.success).toBe(true);
  });
});

describe('toVaccinationRecordContentPayload', () => {
  test('converte campos vazios para undefined, preserva status', () => {
    const payload = toVaccinationRecordContentPayload(vaccinationRecordFormDefaults('2025-06-01'));
    expect(payload.status).toBe('nao_informado');
    expect(payload.vaccineName).toBeUndefined();
    expect(payload.lot).toBeUndefined();
  });

  test('preserva dados da dose quando informados', () => {
    const payload = toVaccinationRecordContentPayload({
      recordDate: '2025-06-01',
      status: 'em_dia',
      vaccineName: 'BCG',
      doseDescription: 'Dose única',
      lot: '',
      facility: '',
      observations: '',
    });
    expect(payload.vaccineName).toBe('BCG');
    expect(payload.doseDescription).toBe('Dose única');
  });
});
