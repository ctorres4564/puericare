'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { listChildrenByProfessional } from '@/services/childService';
import { listGrowthMeasurementsByProfessional } from '@/services/growthService';
import {
  latestMeasurementByChild,
  growthMonitoringStatus,
  daysSinceDate,
  type GrowthMonitoringStatus,
} from '@/lib/growth/latestMeasurement';
import { calculateAgeInDays, formatAgeInDays } from '@/lib/consultations/ageInDays';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import type { Child, GrowthMeasurement } from '@/lib/types';

const statusLabels: Record<GrowthMonitoringStatus, string> = {
  up_to_date: 'Medição em dia',
  overdue: 'Sem medição há mais de 90 dias',
  no_measurement: 'Nenhuma medição',
};

const statusBadgeClasses: Record<GrowthMonitoringStatus, string> = {
  up_to_date: 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200',
  overdue: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  no_measurement: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

function measurementSummary(m: GrowthMeasurement): string {
  const parts: string[] = [];
  if (m.weightKg !== undefined) parts.push(`${m.weightKg} kg`);
  if (m.heightCm !== undefined) parts.push(`${m.heightCm} cm`);
  if (m.headCircumferenceCm !== undefined) parts.push(`PC ${m.headCircumferenceCm} cm`);
  if (m.bmi !== undefined) parts.push(`IMC ${m.bmi}`);
  return parts.join(' · ');
}

export default function CrescimentoGlobalPage() {
  const { userProfile } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [measurements, setMeasurements] = useState<GrowthMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    (async () => {
      try {
        const [allChildren, allMeasurements] = await Promise.all([
          listChildrenByProfessional(userProfile.uid),
          listGrowthMeasurementsByProfessional(userProfile.uid),
        ]);
        setChildren(allChildren.filter((c) => c.active));
        setMeasurements(allMeasurements);
      } catch {
        setError('Não foi possível carregar os dados de crescimento.');
      } finally {
        setLoading(false);
      }
    })();
  }, [userProfile]);

  const today = new Date().toISOString().slice(0, 10);
  const rows = useMemo(() => {
    const latestByChild = latestMeasurementByChild(measurements);
    return children.map((child) => {
      const latest = latestByChild.get(child.id);
      return {
        child,
        latest,
        status: growthMonitoringStatus(latest, today),
        daysSince: latest ? daysSinceDate(latest.measurementDate, today) : null,
      };
    });
  }, [children, measurements, today]);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
        Crescimento
      </h2>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Carregando...
        </p>
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Nenhum paciente ativo ainda. Comece pela lista de{' '}
            <Link href="/pacientes" className="font-medium" style={{ color: 'var(--color-primary)' }}>
              pacientes
            </Link>
            .
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map(({ child, latest, status, daysSince }) => (
            <Link key={child.id} href={`/pacientes/${child.id}/crescimento`}>
              <Card className="transition-colors hover:bg-[var(--color-primary-light)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                      {child.fullName}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      {formatAgeInDays(calculateAgeInDays(child.birthDate, today))}
                      {latest
                        ? ` · Última medição em ${new Date(latest.measurementDate + 'T00:00:00').toLocaleDateString('pt-BR')} (há ${daysSince} dias)`
                        : ' · Nenhuma medição registrada'}
                    </p>
                    {latest && (
                      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {measurementSummary(latest)}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClasses[status]}`}
                  >
                    {statusLabels[status]}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
