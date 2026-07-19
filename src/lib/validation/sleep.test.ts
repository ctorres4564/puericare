import { describe, test, expect } from 'vitest';
import { sleepRecordSchema, sleepRecordFormDefaults, toSleepRecordContentPayload } from './sleep';

describe('sleepRecordSchema — validações relevantes', () => {
  test('aceita registro só com horário de dormir', () => {
    const result = sleepRecordSchema.safeParse({
      ...sleepRecordFormDefaults('2025-06-01'),
      bedtime: '20:30',
    });
    expect(result.success).toBe(true);
  });

  test('aceita registro só com número de despertares', () => {
    const result = sleepRecordSchema.safeParse({
      ...sleepRecordFormDefaults('2025-06-01'),
      nightWakings: '2',
    });
    expect(result.success).toBe(true);
  });

  test('rejeita registro totalmente vazio', () => {
    const result = sleepRecordSchema.safeParse(sleepRecordFormDefaults('2025-06-01'));
    expect(result.success).toBe(false);
  });

  test('rejeita data no futuro', () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
    const result = sleepRecordSchema.safeParse({
      ...sleepRecordFormDefaults(futureDate),
      bedtime: '20:00',
    });
    expect(result.success).toBe(false);
  });

  test('valor de fronteira: despertares no limite superior (15) é aceito', () => {
    const result = sleepRecordSchema.safeParse({
      ...sleepRecordFormDefaults('2025-06-01'),
      nightWakings: '15',
    });
    expect(result.success).toBe(true);
  });

  test('valor de fronteira: despertares acima do limite é rejeitado', () => {
    const result = sleepRecordSchema.safeParse({
      ...sleepRecordFormDefaults('2025-06-01'),
      nightWakings: '20',
    });
    expect(result.success).toBe(false);
  });

  test('valor de fronteira: duração do sono acima do limite (16h) é rejeitada', () => {
    const result = sleepRecordSchema.safeParse({
      ...sleepRecordFormDefaults('2025-06-01'),
      sleepDurationHours: '18',
    });
    expect(result.success).toBe(false);
  });
});

describe('toSleepRecordContentPayload', () => {
  test('converte número de despertares e duração para number', () => {
    const payload = toSleepRecordContentPayload({
      ...sleepRecordFormDefaults('2025-06-01'),
      nightWakings: '3',
      sleepDurationHours: '7.5',
    });
    expect(payload.nightWakings).toBe(3);
    expect(payload.sleepDurationHours).toBe(7.5);
  });

  test('converte campos vazios para undefined', () => {
    const payload = toSleepRecordContentPayload({
      ...sleepRecordFormDefaults('2025-06-01'),
      bedtime: '20:00',
    });
    expect(payload.nightWakings).toBeUndefined();
    expect(payload.sleepDurationHours).toBeUndefined();
    expect(payload.naps).toBeUndefined();
  });
});
