import type { VaccinationStatus } from '@/lib/types';
import type { ScheduledDose, ScheduleDoseStatus } from './schedule';

/** Os três status previstos em documentacao/prd.txt (seção 6). */
export const vaccinationStatusLabels: Record<VaccinationStatus, string> = {
  em_dia: 'Em dia',
  atrasada: 'Atrasada',
  nao_informado: 'Não informado',
};

export const vaccinationStatusBadgeClasses: Record<VaccinationStatus, string> = {
  em_dia: 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200',
  atrasada: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
  nao_informado: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

// ─── Calendário vacinal (schedule.ts) ─────────────────────────────────────────

/**
 * Rótulos dos status do calendário. Terminologia deliberadamente cautelosa:
 * ausência de registro no PueriCare não prova dose não aplicada — por isso
 * "Possível atraso" (não "Atrasada") e "Conferir separadamente" para as
 * vacinas sazonais/por campanha.
 */
export const scheduleDoseStatusLabels: Record<ScheduleDoseStatus, string> = {
  registered: 'Registrada',
  possible_delay: 'Possível atraso',
  available: 'Disponível',
  planned: 'Prevista',
  pending_check: 'Conferir separadamente',
};

export const scheduleDoseStatusBadgeClasses: Record<ScheduleDoseStatus, string> = {
  registered: 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200',
  possible_delay: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
  available: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  planned: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  pending_check: 'bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
};

/** Rótulo da idade recomendada: 'ao nascer', '2 meses', '4 anos' */
export function scheduleAgeLabel(ageDays: number): string {
  if (ageDays === 0) return 'ao nascer';
  if (ageDays < 365 * 2) {
    const months = Math.round(ageDays / 30);
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  }
  const years = Math.round(ageDays / 365);
  return `${years} ${years === 1 ? 'ano' : 'anos'}`;
}

/**
 * Rótulo de uma dose para selects e listas: 'Pentavalente — 1ª dose (2 meses)'.
 * Doses sazonais não mostram idade — a recomendação depende da campanha.
 */
export function scheduleDoseLabel(dose: ScheduledDose): string {
  if (dose.seasonal) return `${dose.vaccine} — ${dose.dose}`;
  return `${dose.vaccine} — ${dose.dose} (${scheduleAgeLabel(dose.ageDays)})`;
}
