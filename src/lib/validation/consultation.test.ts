import { describe, test, expect } from 'vitest';
import { consultationSchema, consultationFormDefaults, toConsultationContentPayload } from './consultation';

describe('consultationSchema — validações relevantes', () => {
  test('aceita um rascunho só com a data (demais campos vazios)', () => {
    const result = consultationSchema.safeParse(consultationFormDefaults('2025-06-01'));
    expect(result.success).toBe(true);
  });

  test('rejeita data da consulta ausente', () => {
    const result = consultationSchema.safeParse({ ...consultationFormDefaults(''), consultationDate: '' });
    expect(result.success).toBe(false);
  });

  test('rejeita data da consulta no futuro', () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
    const result = consultationSchema.safeParse(consultationFormDefaults(futureDate));
    expect(result.success).toBe(false);
  });

  test('aceita consulta com todos os blocos de texto preenchidos', () => {
    const result = consultationSchema.safeParse({
      consultationDate: '2025-06-01',
      reason: 'Consulta de rotina',
      intervalHistory: 'Sem intercorrências',
      clinicalNotes: 'Criança ativa e reativa',
      assessment: 'Desenvolvimento adequado para a idade',
      plan: 'Retorno em 2 meses',
    });
    expect(result.success).toBe(true);
  });
});

describe('toConsultationContentPayload', () => {
  test('converte campos de texto vazios para undefined', () => {
    const payload = toConsultationContentPayload(consultationFormDefaults('2025-06-01'));
    expect(payload.reason).toBeUndefined();
    expect(payload.intervalHistory).toBeUndefined();
    expect(payload.clinicalNotes).toBeUndefined();
    expect(payload.assessment).toBeUndefined();
    expect(payload.plan).toBeUndefined();
    expect(payload.consultationDate).toBe('2025-06-01');
  });

  test('preserva campos de texto preenchidos', () => {
    const payload = toConsultationContentPayload({
      consultationDate: '2025-06-01',
      reason: 'Febre',
      intervalHistory: '',
      clinicalNotes: '',
      assessment: '',
      plan: 'Observar',
    });
    expect(payload.reason).toBe('Febre');
    expect(payload.plan).toBe('Observar');
  });
});
