import { describe, test, expect } from 'vitest';
import { calculateAgeInDays, formatAgeInDays } from './ageInDays';

describe('calculateAgeInDays', () => {
  test('calcula os dias entre nascimento e a data da consulta', () => {
    expect(calculateAgeInDays('2025-01-01', '2025-01-11')).toBe(10);
  });

  test('consulta no mesmo dia do nascimento resulta em 0 dias', () => {
    expect(calculateAgeInDays('2025-01-01', '2025-01-01')).toBe(0);
  });

  test('nunca retorna valor negativo (data da consulta antes do nascimento)', () => {
    expect(calculateAgeInDays('2025-06-01', '2025-01-01')).toBe(0);
  });

  test('calcula meses corretamente (30 dias em fevereiro incluso)', () => {
    expect(calculateAgeInDays('2025-01-01', '2025-07-01')).toBe(181);
  });
});

describe('formatAgeInDays', () => {
  test('menos de 1 dia: recém-nascido(a)', () => {
    expect(formatAgeInDays(0)).toBe('recém-nascido(a)');
  });

  test('poucos dias: singular e plural', () => {
    expect(formatAgeInDays(1)).toBe('1 dia');
    expect(formatAgeInDays(10)).toBe('10 dias');
  });

  test('meses (a partir de 60 dias, antes de 24 meses)', () => {
    expect(formatAgeInDays(90)).toBe('3 meses');
    expect(formatAgeInDays(30)).toBe('30 dias'); // < 60 dias ainda é exibido em dias
  });

  test('anos (a partir de 24 meses = 720 dias)', () => {
    expect(formatAgeInDays(365 * 3)).toBe('3 anos');
  });
});
