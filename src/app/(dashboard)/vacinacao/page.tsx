'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { listChildrenByProfessional } from '@/services/childService';
import { listVaccinationRecordsByProfessional } from '@/services/vaccinationService';
import { formatAgeInDays } from '@/lib/consultations/ageInDays';
import { vaccinationStatusLabels, vaccinationStatusBadgeClasses } from '@/lib/vaccination/labels';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import type { VaccinationRecord } from '@/lib/types';

export default function VacinacaoGlobalPage() {
  const { userProfile } = useAuth();
  const [records, setRecords] = useState<VaccinationRecord[]>([]);
  const [childNames, setChildNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    (async () => {
      try {
        const [allRecords, allChildren] = await Promise.all([
          listVaccinationRecordsByProfessional(userProfile.uid),
          listChildrenByProfessional(userProfile.uid),
        ]);
        setRecords(allRecords);
        setChildNames(Object.fromEntries(allChildren.map((c) => [c.id, c.fullName])));
      } catch {
        setError('Não foi possível carregar os registros de vacinação.');
      } finally {
        setLoading(false);
      }
    })();
  }, [userProfile]);

  const sorted = useMemo(() => [...records].reverse(), [records]);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
        Vacinação
      </h2>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Carregando...
        </p>
      ) : sorted.length === 0 ? (
        <Card>
          <p className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Nenhum registro de vacinação ainda. Comece pela lista de{' '}
            <Link href="/pacientes" className="font-medium" style={{ color: 'var(--color-primary)' }}>
              pacientes
            </Link>
            .
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((r) => (
            <Link key={r.id} href={`/pacientes/${r.childId}/vacinacao`}>
              <Card className="transition-colors hover:bg-[var(--color-primary-light)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                      {childNames[r.childId] ?? 'Paciente'}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(r.recordDate + 'T00:00:00').toLocaleDateString('pt-BR')} ·{' '}
                      {formatAgeInDays(r.ageInDays)}
                      {r.vaccineName ? ` · ${r.vaccineName}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${vaccinationStatusBadgeClasses[r.status]}`}
                  >
                    {vaccinationStatusLabels[r.status]}
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
