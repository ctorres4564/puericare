/**
 * lib/consultations/roteiro.test.ts — Testes do roteiro de consulta por
 * faixa etária. Funções puras — sem I/O, sem Firebase.
 */

import { describe, it, expect } from 'vitest';
import {
  buildConsultationRoteiro,
  guidanceTopicsForAge,
  measurementsForAge,
  DEVELOPMENT_REMINDER,
} from './roteiro';
import type { VaccinationRecord } from '@/lib/types';

let seq = 0;
function makeRecord(overrides: Partial<VaccinationRecord> = {}): VaccinationRecord {
  seq++;
  return {
    id: `rec-${seq}`,
    childId: 'child-1',
    professionalId: 'prof-1',
    recordDate: '2026-01-01',
    ageInDays: 0,
    status: 'em_dia',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('measurementsForAge', () => {
  it('antes de 2 anos: peso, comprimento e perímetro cefálico', () => {
    expect(measurementsForAge(729)).toEqual(['Peso', 'Comprimento', 'Perímetro cefálico']);
    expect(measurementsForAge(0)).toContain('Perímetro cefálico');
  });

  it('a partir de 2 anos: peso, altura e IMC (sem PC)', () => {
    expect(measurementsForAge(730)).toEqual(['Peso', 'Altura', 'IMC']);
    expect(measurementsForAge(730)).not.toContain('Perímetro cefálico');
  });
});

describe('guidanceTopicsForAge', () => {
  it('seleciona tópicos por faixa etária', () => {
    expect(guidanceTopicsForAge(90).some((t) => t.includes('Aleitamento materno exclusivo'))).toBe(true);
    expect(guidanceTopicsForAge(200).some((t) => t.includes('Introdução alimentar'))).toBe(true);
    expect(guidanceTopicsForAge(500).some((t) => t.includes('dieta da família'))).toBe(true);
    expect(guidanceTopicsForAge(1000).some((t) => t.includes('Tempo de tela'))).toBe(true);
  });

  it('cada faixa retorna tópicos não vazios e distintos entre si', () => {
    const brackets = [guidanceTopicsForAge(90), guidanceTopicsForAge(200), guidanceTopicsForAge(500), guidanceTopicsForAge(1000)];
    for (const b of brackets) expect(b.length).toBeGreaterThan(0);
    expect(new Set(brackets.map((b) => b[0])).size).toBe(brackets.length);
  });
});

describe('buildConsultationRoteiro', () => {
  const BIRTH = '2026-01-01';

  it('calcula idade e rótulo na data da consulta', () => {
    const roteiro = buildConsultationRoteiro(BIRTH, '2026-04-02', []);
    expect(roteiro.ageInDays).toBe(91);
    expect(roteiro.ageLabel).toBeTruthy();
  });

  it('seção de vacinas traz só doses disponíveis ou com possível atraso', () => {
    // 6 meses, sem registros: várias doses vencidas/disponíveis, nenhuma registrada
    const roteiro = buildConsultationRoteiro(BIRTH, '2026-07-01', []);
    expect(roteiro.vaccinesToCheck.length).toBeGreaterThan(0);
    for (const d of roteiro.vaccinesToCheck) {
      expect(['available', 'possible_delay']).toContain(d.status);
    }
  });

  it('doses registradas não aparecem na seção de vacinas', () => {
    const records = [
      makeRecord({ scheduleKey: 'bcg-d1', vaccineName: 'BCG', recordDate: '2026-01-02' }),
    ];
    const roteiro = buildConsultationRoteiro(BIRTH, '2026-02-01', records);
    expect(roteiro.vaccinesToCheck.some((d) => d.key === 'bcg-d1')).toBe(false);
  });

  it('vacinas sazonais nunca aparecem na seção de vacinas', () => {
    const roteiro = buildConsultationRoteiro(BIRTH, '2027-01-01', []);
    expect(roteiro.vaccinesToCheck.some((d) => d.seasonal)).toBe(false);
  });

  it('sempre inclui o lembrete de vigilância do desenvolvimento', () => {
    const roteiro = buildConsultationRoteiro(BIRTH, '2026-06-01', []);
    expect(roteiro.developmentReminder).toBe(DEVELOPMENT_REMINDER);
    expect(roteiro.developmentReminder).toContain('5 domínios');
  });

  it('combina medidas e orientações da faixa etária correta', () => {
    const roteiro = buildConsultationRoteiro(BIRTH, '2028-06-01', []); // ~2,4 anos
    expect(roteiro.measurements).toContain('IMC');
    expect(roteiro.guidanceTopics.some((t) => t.includes('Tempo de tela'))).toBe(true);
  });
});
