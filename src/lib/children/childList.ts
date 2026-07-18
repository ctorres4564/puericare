import type { Child } from '@/lib/types';

/**
 * Filtra a listagem de pacientes: só ativos, e por nome (parcial,
 * case-insensitive) quando há termo de busca.
 */
export function filterActiveChildren(children: Child[], search: string): Child[] {
  const term = search.trim().toLowerCase();
  return children
    .filter((c) => c.active)
    .filter((c) => !term || c.fullName.toLowerCase().includes(term));
}

/** Idade em texto (meses até 23, depois anos) a partir da data de nascimento (YYYY-MM-DD). */
export function calculateAge(birthDate: string): string {
  const birth = new Date(birthDate);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 1) return 'recém-nascido(a)';
  if (months < 24) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'ano' : 'anos'}`;
}
