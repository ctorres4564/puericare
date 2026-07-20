import type { GrowthMeasurement } from '@/lib/types';

/**
 * Agregações da página agregada de crescimento (/crescimento) — Sprint A.
 *
 * Determinísticas e sem interpretação clínica: a "situação da medição" usa
 * exatamente o mesmo limiar da regra de alerta R4 do motor de alertas
 * (sem registro de crescimento há mais de 90 dias — ver lib/alerts/rules.ts),
 * que já tem fonte clínica explícita (OMS, monitoramento trimestral).
 * Nenhum percentil, escore-Z ou classificação é calculado aqui.
 */

/** Limiar de monitoramento em dias — espelha a regra R4 (90 dias). */
export const GROWTH_MONITORING_THRESHOLD_DAYS = 90;

/** Dias entre uma data ISO (YYYY-MM-DD) e a data de referência (>= 0). */
export function daysSinceDate(isoDate: string, referenceDate: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const from = new Date(isoDate + 'T00:00:00').getTime();
  const to = new Date(referenceDate + 'T00:00:00').getTime();
  return Math.max(0, Math.round((to - from) / msPerDay));
}

/**
 * Última medição de cada criança. Desempate: `createdAt` mais recente
 * (mesmo critério de countChildrenWithLatestVaccinationStatus em
 * lib/dashboard/stats.ts).
 */
export function latestMeasurementByChild(
  measurements: GrowthMeasurement[]
): Map<string, GrowthMeasurement> {
  const latestByChild = new Map<string, GrowthMeasurement>();

  for (const m of measurements) {
    const current = latestByChild.get(m.childId);
    const isNewer =
      !current ||
      m.measurementDate > current.measurementDate ||
      (m.measurementDate === current.measurementDate && m.createdAt > current.createdAt);
    if (isNewer) latestByChild.set(m.childId, m);
  }

  return latestByChild;
}

export type GrowthMonitoringStatus = 'no_measurement' | 'overdue' | 'up_to_date';

/**
 * Situação do monitoramento de crescimento de uma criança, dado seu último
 * registro (se houver) e a data de referência (YYYY-MM-DD).
 */
export function growthMonitoringStatus(
  latest: GrowthMeasurement | undefined,
  referenceDate: string
): GrowthMonitoringStatus {
  if (!latest) return 'no_measurement';
  return daysSinceDate(latest.measurementDate, referenceDate) > GROWTH_MONITORING_THRESHOLD_DAYS
    ? 'overdue'
    : 'up_to_date';
}
