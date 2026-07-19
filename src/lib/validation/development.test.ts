import { describe, test, expect } from 'vitest';
import {
  developmentAssessmentSchema,
  developmentAssessmentFormDefaults,
  toDevelopmentAssessmentContentPayload,
} from './development';

describe('developmentAssessmentSchema — validações relevantes', () => {
  test('aceita registro só com observação (sem marcos)', () => {
    const result = developmentAssessmentSchema.safeParse({
      ...developmentAssessmentFormDefaults('2025-06-01'),
      observations: 'Criança ativa e interativa durante a consulta',
    });
    expect(result.success).toBe(true);
  });

  test('aceita registro só com um marco (sem observação)', () => {
    const result = developmentAssessmentSchema.safeParse({
      ...developmentAssessmentFormDefaults('2025-06-01'),
      milestones: [{ domain: 'motor_grosso', description: 'Anda sem apoio', status: 'ACHIEVED' }],
    });
    expect(result.success).toBe(true);
  });

  test('rejeita quando não há marco nem observação', () => {
    const result = developmentAssessmentSchema.safeParse(developmentAssessmentFormDefaults('2025-06-01'));
    expect(result.success).toBe(false);
  });

  test('rejeita data da avaliação ausente', () => {
    const result = developmentAssessmentSchema.safeParse({
      ...developmentAssessmentFormDefaults(''),
      observations: 'obs',
    });
    expect(result.success).toBe(false);
  });

  test('rejeita data da avaliação no futuro', () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
    const result = developmentAssessmentSchema.safeParse({
      ...developmentAssessmentFormDefaults(futureDate),
      observations: 'obs',
    });
    expect(result.success).toBe(false);
  });

  test('aceita todos os 4 estados de marco definidos no planejamento', () => {
    for (const status of ['ACHIEVED', 'NOT_ACHIEVED', 'NOT_EVALUATED', 'UNCERTAIN'] as const) {
      const result = developmentAssessmentSchema.safeParse({
        ...developmentAssessmentFormDefaults('2025-06-01'),
        milestones: [{ domain: 'cognicao', description: 'Habilidade teste', status }],
      });
      expect(result.success).toBe(true);
    }
  });

  test('aceita os 5 domínios definidos no planejamento', () => {
    for (const domain of ['motor_grosso', 'motor_fino', 'comunicacao', 'cognicao', 'social_adaptativo'] as const) {
      const result = developmentAssessmentSchema.safeParse({
        ...developmentAssessmentFormDefaults('2025-06-01'),
        milestones: [{ domain, description: 'Habilidade teste', status: 'ACHIEVED' }],
      });
      expect(result.success).toBe(true);
    }
  });

  test('rejeita domínio fora da lista prevista', () => {
    const result = developmentAssessmentSchema.safeParse({
      ...developmentAssessmentFormDefaults('2025-06-01'),
      milestones: [{ domain: 'sensorial', description: 'Habilidade teste', status: 'ACHIEVED' }],
    });
    expect(result.success).toBe(false);
  });

  test('rejeita descrição de marco vazia/curta demais', () => {
    const result = developmentAssessmentSchema.safeParse({
      ...developmentAssessmentFormDefaults('2025-06-01'),
      milestones: [{ domain: 'motor_fino', description: 'ok', status: 'ACHIEVED' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('toDevelopmentAssessmentContentPayload', () => {
  test('converte observação vazia para undefined', () => {
    const payload = toDevelopmentAssessmentContentPayload({
      ...developmentAssessmentFormDefaults('2025-06-01'),
      milestones: [{ domain: 'motor_grosso', description: 'Anda sem apoio', status: 'ACHIEVED' }],
    });
    expect(payload.observations).toBeUndefined();
  });

  test('preserva requiresFollowUp definido pelo profissional', () => {
    const payload = toDevelopmentAssessmentContentPayload({
      ...developmentAssessmentFormDefaults('2025-06-01'),
      observations: 'obs',
      requiresFollowUp: true,
    });
    expect(payload.requiresFollowUp).toBe(true);
  });

  test('preserva a lista de marcos intacta', () => {
    const milestones = [
      { domain: 'comunicacao' as const, description: 'Fala frases curtas', status: 'ACHIEVED' as const },
      { domain: 'social_adaptativo' as const, description: 'Brinca com outras crianças', status: 'UNCERTAIN' as const },
    ];
    const payload = toDevelopmentAssessmentContentPayload({
      ...developmentAssessmentFormDefaults('2025-06-01'),
      milestones,
    });
    expect(payload.milestones).toEqual(milestones);
  });
});
