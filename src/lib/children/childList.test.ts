import { describe, test, expect } from 'vitest';
import { filterActiveChildren, calculateAge } from './childList';
import type { Child } from '@/lib/types';

function makeChild(overrides: Partial<Child>): Child {
  return {
    id: 'x',
    professionalId: 'pro-1',
    caregiverIds: [],
    fullName: 'Nome Padrão',
    birthDate: '2025-01-01',
    sexAtBirth: 'not_informed',
    caregiverName: 'Responsável',
    contactPhone: '11999999999',
    active: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('filterActiveChildren — busca/listagem', () => {
  test('exclui crianças inativas (soft delete)', () => {
    const children = [makeChild({ fullName: 'Ana', active: true }), makeChild({ fullName: 'Bia', active: false })];
    const result = filterActiveChildren(children, '');
    expect(result.map((c) => c.fullName)).toEqual(['Ana']);
  });

  test('busca por nome parcial, case-insensitive', () => {
    const children = [makeChild({ fullName: 'Maria Teste' }), makeChild({ fullName: 'João Pedro' })];
    const result = filterActiveChildren(children, 'MARIA');
    expect(result.map((c) => c.fullName)).toEqual(['Maria Teste']);
  });

  test('termo de busca vazio retorna todas as ativas', () => {
    const children = [makeChild({ fullName: 'Ana' }), makeChild({ fullName: 'Bia' })];
    expect(filterActiveChildren(children, '   ')).toHaveLength(2);
  });

  test('busca sem correspondência retorna lista vazia', () => {
    const children = [makeChild({ fullName: 'Ana' })];
    expect(filterActiveChildren(children, 'zzz')).toHaveLength(0);
  });
});

describe('calculateAge', () => {
  test('recém-nascido (menos de 1 mês)', () => {
    const today = new Date();
    const birth = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5);
    expect(calculateAge(birth.toISOString().slice(0, 10))).toBe('recém-nascido(a)');
  });

  test('idade em meses (menor que 24 meses)', () => {
    const today = new Date();
    const birth = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate());
    expect(calculateAge(birth.toISOString().slice(0, 10))).toBe('6 meses');
  });

  test('idade em anos (24 meses ou mais)', () => {
    const today = new Date();
    const birth = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate());
    expect(calculateAge(birth.toISOString().slice(0, 10))).toBe('3 anos');
  });

  test('singular correto para 1 mês', () => {
    const today = new Date();
    const oneMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    expect(calculateAge(oneMonth.toISOString().slice(0, 10))).toBe('1 mês');
  });

  test('12 meses ainda é exibido em meses, não "1 ano" (limite é 24 meses)', () => {
    // Caracteriza o comportamento atual: a troca para "anos" só ocorre a
    // partir de 24 meses, então o plural singular "1 ano" nunca é atingido
    // (nesse ponto os anos já começam em 2). Não é um bug desta tarefa —
    // é o comportamento pré-existente da função, registrado aqui para não
    // regredir silenciosamente. Ver relatório de limitações.
    const today = new Date();
    const twelveMonths = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    expect(calculateAge(twelveMonths.toISOString().slice(0, 10))).toBe('12 meses');
  });

  test('24 meses passa a exibir em anos, já no plural ("2 anos")', () => {
    const today = new Date();
    const twentyFourMonths = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate());
    expect(calculateAge(twentyFourMonths.toISOString().slice(0, 10))).toBe('2 anos');
  });
});
