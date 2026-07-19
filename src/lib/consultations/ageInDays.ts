/**
 * Idade calculada automaticamente (PRD 6 — Consulta / Dados básicos).
 * Guardamos a idade em dias no momento da consulta, não recalculada depois,
 * já que a data da consulta é histórica e não deve mudar com o tempo.
 */

/** Dias entre o nascimento e a data da consulta (>= 0). */
export function calculateAgeInDays(birthDate: string, consultationDate: string): number {
  const birth = new Date(birthDate);
  const consultation = new Date(consultationDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.round((consultation.getTime() - birth.getTime()) / msPerDay);
  return Math.max(0, days);
}

/** Formata uma idade em dias como texto legível (dias, meses ou anos). */
export function formatAgeInDays(days: number): string {
  if (days < 1) return 'recém-nascido(a)';
  if (days < 60) return `${days} ${days === 1 ? 'dia' : 'dias'}`;

  const months = Math.floor(days / 30);
  if (months < 24) return `${months} ${months === 1 ? 'mês' : 'meses'}`;

  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'ano' : 'anos'}`;
}
