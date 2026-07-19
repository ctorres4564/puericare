'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { listChildrenByProfessional } from '@/services/childService';
import { listConsultationsByProfessional } from '@/services/consultationService';
import { formatAgeInDays } from '@/lib/consultations/ageInDays';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import type { Consultation, ConsultationStatus } from '@/lib/types';

const statusLabels: Record<ConsultationStatus, string> = {
  draft: 'Rascunho',
  completed: 'Finalizada',
  cancelled: 'Cancelada',
};

const statusBadgeClasses: Record<ConsultationStatus, string> = {
  draft: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
  completed: 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

export default function ConsultasPage() {
  const { userProfile } = useAuth();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [childNames, setChildNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    (async () => {
      try {
        const [allConsultations, allChildren] = await Promise.all([
          listConsultationsByProfessional(userProfile.uid),
          listChildrenByProfessional(userProfile.uid),
        ]);
        setConsultations(allConsultations);
        setChildNames(Object.fromEntries(allChildren.map((c) => [c.id, c.fullName])));
      } catch {
        setError('Não foi possível carregar as consultas.');
      } finally {
        setLoading(false);
      }
    })();
  }, [userProfile]);

  const visible = useMemo(() => consultations.filter((c) => c.status !== 'cancelled'), [consultations]);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
        Consultas
      </h2>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Carregando...
        </p>
      ) : visible.length === 0 ? (
        <Card>
          <p className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Nenhuma consulta registrada ainda. Comece pela lista de{' '}
            <Link href="/pacientes" className="font-medium" style={{ color: 'var(--color-primary)' }}>
              pacientes
            </Link>
            .
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((c) => (
            <Link key={c.id} href={`/pacientes/${c.childId}/consultas/${c.id}`}>
              <Card className="transition-colors hover:bg-[var(--color-primary-light)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                      {childNames[c.childId] ?? 'Paciente'}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(c.consultationDate + 'T00:00:00').toLocaleDateString('pt-BR')} ·{' '}
                      {formatAgeInDays(c.ageInDays)}
                      {c.reason ? ` · ${c.reason}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClasses[c.status]}`}
                  >
                    {statusLabels[c.status]}
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
