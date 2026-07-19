'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getChild } from '@/services/childService';
import { listConsultationsByProfessional } from '@/services/consultationService';
import { listGrowthMeasurementsByProfessional } from '@/services/growthService';
import { buildTimeline } from '@/lib/children/timeline';
import { formatAgeInDays } from '@/lib/consultations/ageInDays';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import type { Child, Consultation, ConsultationStatus, GrowthMeasurement } from '@/lib/types';

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

function measurementSummary(m: GrowthMeasurement): string {
  const parts: string[] = [];
  if (m.weightKg !== undefined) parts.push(`${m.weightKg} kg`);
  if (m.heightCm !== undefined) parts.push(`${m.heightCm} cm`);
  if (m.headCircumferenceCm !== undefined) parts.push(`PC ${m.headCircumferenceCm} cm`);
  return parts.join(' · ');
}

export default function LinhaDoTempoPage() {
  const { id: childId } = useParams<{ id: string }>();
  const { userProfile } = useAuth();

  const [child, setChild] = useState<Child | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [measurements, setMeasurements] = useState<GrowthMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    (async () => {
      try {
        const foundChild = await getChild(childId);
        if (!foundChild || foundChild.professionalId !== userProfile.uid) {
          setNotFound(true);
          return;
        }
        setChild(foundChild);

        const [allConsultations, allMeasurements] = await Promise.all([
          listConsultationsByProfessional(userProfile.uid),
          listGrowthMeasurementsByProfessional(userProfile.uid),
        ]);
        setConsultations(allConsultations.filter((c) => c.childId === childId));
        setMeasurements(allMeasurements.filter((m) => m.childId === childId));
      } catch {
        setError('Não foi possível carregar a linha do tempo.');
      } finally {
        setLoading(false);
      }
    })();
  }, [childId, userProfile]);

  const timeline = useMemo(() => buildTimeline(consultations, measurements), [consultations, measurements]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/pacientes" className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
          ← Voltar para pacientes
        </Link>
        <div className="mt-2 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            {loading ? 'Linha do tempo' : child ? `Linha do tempo — ${child.fullName}` : 'Linha do tempo'}
          </h2>
          {child?.active && <Button href={`/pacientes/${childId}/consultas/nova`}>+ Nova consulta</Button>}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Carregando...
        </p>
      ) : notFound ? (
        <Alert variant="error" title="Paciente não encontrado">
          Este cadastro não existe ou não pertence à sua conta.
        </Alert>
      ) : (
        <>
          {child && !child.active && (
            <Alert variant="warning">
              Paciente inativo — não é possível iniciar novas consultas ou medições. O histórico abaixo é preservado.
            </Alert>
          )}

          {timeline.length === 0 ? (
            <Card>
              <p className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Nenhum registro ainda — nem consulta, nem medição de crescimento.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {timeline.map((entry) =>
                entry.kind === 'consultation' ? (
                  <Link key={`c-${entry.id}`} href={`/pacientes/${childId}/consultas/${entry.id}`}>
                    <Card className="transition-colors hover:bg-[var(--color-primary-light)]">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-medium uppercase" style={{ color: 'var(--color-text-subtle)' }}>
                            Consulta
                          </p>
                          <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                            {new Date(entry.data.consultationDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            {formatAgeInDays(entry.data.ageInDays)}
                            {entry.data.reason ? ` · ${entry.data.reason}` : ''}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClasses[entry.data.status]}`}
                        >
                          {statusLabels[entry.data.status]}
                        </span>
                      </div>
                    </Card>
                  </Link>
                ) : (
                  <Link key={`m-${entry.id}`} href={`/pacientes/${childId}/crescimento`}>
                    <Card className="transition-colors hover:bg-[var(--color-primary-light)]">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-medium uppercase" style={{ color: 'var(--color-text-subtle)' }}>
                            Medição de crescimento
                          </p>
                          <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                            {new Date(entry.data.measurementDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            {formatAgeInDays(entry.data.ageInDays)} · {measurementSummary(entry.data)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                )
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
