import { describe, test, expect } from 'vitest';
import { feedingRecordSchema, feedingRecordFormDefaults, toFeedingRecordContentPayload } from './feeding';

describe('feedingRecordSchema — validações relevantes', () => {
  test('aceita registro só com histórico alimentar', () => {
    const result = feedingRecordSchema.safeParse({
      ...feedingRecordFormDefaults('2025-06-01'),
      feedingHistory: 'Aleitamento materno exclusivo',
    });
    expect(result.success).toBe(true);
  });

  test('aceita registro só com dificuldades', () => {
    const result = feedingRecordSchema.safeParse({
      ...feedingRecordFormDefaults('2025-06-01'),
      difficulties: 'Recusa alimentar ocasional',
    });
    expect(result.success).toBe(true);
  });

  test('rejeita registro totalmente vazio', () => {
    const result = feedingRecordSchema.safeParse(feedingRecordFormDefaults('2025-06-01'));
    expect(result.success).toBe(false);
  });

  test('rejeita data ausente', () => {
    const result = feedingRecordSchema.safeParse({
      ...feedingRecordFormDefaults(''),
      routine: 'obs',
    });
    expect(result.success).toBe(false);
  });

  test('rejeita data no futuro', () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
    const result = feedingRecordSchema.safeParse({
      ...feedingRecordFormDefaults(futureDate),
      routine: 'obs',
    });
    expect(result.success).toBe(false);
  });
});

describe('toFeedingRecordContentPayload', () => {
  test('converte campos vazios para undefined', () => {
    const payload = toFeedingRecordContentPayload({
      ...feedingRecordFormDefaults('2025-06-01'),
      feedingHistory: 'Fórmula infantil',
    });
    expect(payload.routine).toBeUndefined();
    expect(payload.foodIntroduction).toBeUndefined();
    expect(payload.feedingHistory).toBe('Fórmula infantil');
  });

  test('preserva requiresFollowUp definido pelo profissional', () => {
    const payload = toFeedingRecordContentPayload({
      ...feedingRecordFormDefaults('2025-06-01'),
      observations: 'obs',
      requiresFollowUp: true,
    });
    expect(payload.requiresFollowUp).toBe(true);
  });
});
