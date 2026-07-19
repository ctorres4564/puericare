'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getChild } from '@/services/childService';
import { listConsultationsByProfessional } from '@/services/consultationService';
import { formatAgeInDays } from '@/lib/consultations/ageInDays';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import type { Child, Consultation, ConsultationStatus } from '@/lib/types';

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

export default function LinhaDoTempoPage() {
  const { id: childId } = useParams<{ id: string }>();
  const { userProfile } = useAuth();

  const [child, setChild] = useState<Child | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
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

        const all = await listConsultationsByProfessional(userProfile.uid);
        setConsultations(all.filter((c) => c.childId === childId));
      } catch {
        setError('Não foi possível carregar a linha do tempo.');
      } finally {
        setLoading(false);
      }
    })();
  }, [childId, userProfile]);

  const visible = useMemo(() => consultations.filter((c) => c.status !== 'cancelled'), [consultations]);

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
              Paciente inativo — não é possível iniciar novas consultas. O histórico abaixo é preservado.
            </Alert>
          )}

          {visible.length === 0 ? (
            <Card>
              <p className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Nenhuma consulta registrada ainda.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {visible.map((c) => (
                <Link key={c.id} href={`/pacientes/${childId}/consultas/${c.id}`}>
                  <Card className="transition-colors hover:bg-[var(--color-primary-light)]">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                          {new Date(c.consultationDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </p>
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
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
        </>
      )}
    </div>
  );
}
