'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getChild } from '@/services/childService';
import { listDevelopmentAssessmentsByProfessional } from '@/services/developmentService';
import { formatAgeInDays } from '@/lib/consultations/ageInDays';
import { domainLabels, milestoneStatusLabels } from '@/lib/development/labels';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import type { Child, DevelopmentAssessment, MilestoneStatus } from '@/lib/types';

const statusBadgeClasses: Record<MilestoneStatus, string> = {
  ACHIEVED: 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200',
  NOT_ACHIEVED: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
  NOT_EVALUATED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  UNCERTAIN: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
};

export default function DesenvolvimentoPage() {
  const { id: childId } = useParams<{ id: string }>();
  const { userProfile } = useAuth();

  const [child, setChild] = useState<Child | null>(null);
  const [assessments, setAssessments] = useState<DevelopmentAssessment[]>([]);
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

        const all = await listDevelopmentAssessmentsByProfessional(userProfile.uid);
        setAssessments(all.filter((a) => a.childId === childId).reverse()); // mais recente primeiro
      } catch {
        setError('Não foi possível carregar o histórico de desenvolvimento.');
      } finally {
        setLoading(false);
      }
    })();
  }, [childId, userProfile]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/pacientes" className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
          ← Voltar para pacientes
        </Link>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              {loading ? 'Desenvolvimento' : child ? `Desenvolvimento — ${child.fullName}` : 'Desenvolvimento'}
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Acompanhamento longitudinal — não é triagem nem diagnóstico.
            </p>
          </div>
          {child?.active && <Button href={`/pacientes/${childId}/desenvolvimento/nova`}>+ Novo registro</Button>}
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
              Paciente inativo — não é possível registrar novas avaliações. O histórico abaixo é preservado.
            </Alert>
          )}

          {assessments.length === 0 ? (
            <Card>
              <p className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Nenhum registro de desenvolvimento ainda.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {assessments.map((a) => (
                <Card key={a.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                        {new Date(a.assessmentDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {formatAgeInDays(a.ageInDays)}
                      </p>
                    </div>
                    {a.requiresFollowUp && (
                      <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        Necessita acompanhamento
                      </span>
                    )}
                  </div>

                  {a.milestones.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2">
                      {a.milestones.map((m, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClasses[m.status]}`}
                          >
                            {milestoneStatusLabels[m.status]}
                          </span>
                          <span style={{ color: 'var(--color-text-muted)' }}>{domainLabels[m.domain]}:</span>
                          <span style={{ color: 'var(--color-text)' }}>{m.description}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {a.observations && (
                    <p className="mt-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      {a.observations}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
