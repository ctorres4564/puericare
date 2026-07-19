import type { VaccinationStatus } from '@/lib/types';

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
