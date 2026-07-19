import { describe, test, expect } from 'vitest';
import { calculateBmi } from './bmi';

describe('calculateBmi', () => {
  test('caso normal: valor de referência conhecido (10 kg, 75 cm -> 17,8)', () => {
    // 10 / 0.75² = 10 / 0,5625 = 17,777... -> arredondado a 1 casa: 17,8
    expect(calculateBmi(10, 75)).toBe(17.8);
  });

  test('outro valor de referência conhecido (adulto padrão didático: 70 kg, 175 cm -> 22,9)', () => {
    // 70 / 1,75² = 70 / 3,0625 = 22,857... -> 22,9
    expect(calculateBmi(70, 175)).toBe(22.9);
  });

  test('indefinido quando falta o peso', () => {
    expect(calculateBmi(undefined, 75)).toBeUndefined();
  });

  test('indefinido quando falta a altura', () => {
    expect(calculateBmi(10, undefined)).toBeUndefined();
  });

  test('indefinido quando faltam os dois', () => {
    expect(calculateBmi(undefined, undefined)).toBeUndefined();
  });

  test('valor de fronteira: altura zero não gera divisão por zero/Infinity', () => {
    expect(calculateBmi(10, 0)).toBeUndefined();
  });

  test('valor de fronteira: peso zero ou negativo é rejeitado', () => {
    expect(calculateBmi(0, 75)).toBeUndefined();
    expect(calculateBmi(-5, 75)).toBeUndefined();
  });

  test('recém-nascido a termo típico (3,2 kg, 48,5 cm)', () => {
    // 3.2 / 0.485² = 3.2 / 0.235225 = 13,605... -> 13,6
    expect(calculateBmi(3.2, 48.5)).toBe(13.6);
  });
});
