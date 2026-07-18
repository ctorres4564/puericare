/**
 * Utilitários compartilhados entre os services do Firestore.
 */

/**
 * Remove recursivamente campos `undefined` de um objeto (e de objetos aninhados),
 * já que o Firestore rejeita `undefined` em qualquer nível.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }

  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, stripUndefined(v)]);
    return Object.fromEntries(entries) as T;
  }

  return value;
}
