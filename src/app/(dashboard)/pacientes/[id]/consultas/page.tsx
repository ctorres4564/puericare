'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getChild } from '@/services/childService';
import { listConsultationsByProfessional } from '@/services/consultationService';
import { listGrowthMeasurementsByProfessional } from '@/services/growthService';
import { listDevelopmentAssessmentsByProfessional } from '@/services/developmentService';
import { listVaccinationRecordsByProfessional } from '@/services/vaccinationService';
import { buildTimeline } from '@/lib/children/timeline';
import { formatAgeInDays } from '@/lib/consultations/ageInDays';
import { domainLabels, milestoneStatusLabels } from '@/lib/development/labels';
import { vaccinationStatusLabels, vaccinationStatusBadgeClasses } from '@/lib/vaccination/labels';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import type {
  Child,
  Consultation,
  ConsultationStatus,
  GrowthMeasurement,
  DevelopmentAssessment,
  VaccinationRecord,
} from '@/lib/types';

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

function developmentSummary(a: DevelopmentAssessment): string {
  if (a.milestones.length === 0) return a.observations ? 'Observação livre' : '';
  const first = a.milestones[0];
  const rest = a.milestones.length - 1;
  return `${domainLabels[first.domain]}: ${milestoneStatusLabels[first.status]}${rest > 0 ? ` (+${rest})` : ''}`;
}

export default function LinhaDoTempoPage() {
  const { id: childId } = useParams<{ id: string }>();
  const { userProfile } = useAuth();

  const [child, setChild] = useState<Child | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [measurements, setMeasurements] = useState<GrowthMeasurement[]>([]);
  const [developmentAssessments, setDevelopmentAssessments] = useState<DevelopmentAssessment[]>([]);
  const [vaccinationRecords, setVaccinationRecords] = useState<VaccinationRecord[]>([]);
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

        const [allConsultations, allMeasurements, allDevelopment, allVaccinations] = await Promise.all([
          listConsultationsByProfessional(userProfile.uid),
          listGrowthMeasurementsByProfessional(userProfile.uid),
          listDevelopmentAssessmentsByProfessional(userProfile.uid),
          listVaccinationRecordsByProfessional(userProfile.uid),
        ]);
        setConsultations(allConsultations.filter((c) => c.childId === childId));
        setMeasurements(allMeasurements.filter((m) => m.childId === childId));
        setDevelopmentAssessments(allDevelopment.filter((a) => a.childId === childId));
        setVaccinationRecords(allVaccinations.filter((v) => v.childId === childId));
      } catch {
        setError('Não foi possível carregar a linha do tempo.');
      } finally {
        setLoading(false);
      }
    })();
  }, [childId, userProfile]);

  const timeline = useMemo(
    () => buildTimeline(consultations, measurements, developmentAssessments, vaccinationRecords),
    [consultations, measurements, developmentAssessments, vaccinationRecords]
  );

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
              Paciente inativo — não é possível criar novos registros. O histórico abaixo é preservado.
            </Alert>
          )}

          {timeline.length === 0 ? (
            <Card>
              <p className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Nenhum registro ainda — nem consulta, medição ou avaliação de desenvolvimento.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {timeline.map((entry) => {
                if (entry.kind === 'consultation') {
                  return (
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
                  );
                }

                if (entry.kind === 'growthMeasurement') {
                  return (
                    <Link key={`m-${entry.id}`} href={`/pacientes/${childId}/crescimento`}>
                      <Card className="transition-colors hover:bg-[var(--color-primary-light)]">
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
                      </Card>
                    </Link>
                  );
                }

                if (entry.kind === 'developmentAssessment') {
                  return (
                    <Link key={`d-${entry.id}`} href={`/pacientes/${childId}/desenvolvimento`}>
                      <Card className="transition-colors hover:bg-[var(--color-primary-light)]">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs font-medium uppercase" style={{ color: 'var(--color-text-subtle)' }}>
                              Desenvolvimento
                            </p>
                            <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                              {new Date(entry.data.assessmentDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                              {formatAgeInDays(entry.data.ageInDays)}
                              {developmentSummary(entry.data) ? ` · ${developmentSummary(entry.data)}` : ''}
                            </p>
                          </div>
                          {entry.data.requiresFollowUp && (
                            <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                              Necessita acompanhamento
                            </span>
                          )}
                        </div>
                      </Card>
                    </Link>
                  );
                }

                return (
                  <Link key={`v-${entry.id}`} href={`/pacientes/${childId}/vacinacao`}>
                    <Card className="transition-colors hover:bg-[var(--color-primary-light)]">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-medium uppercase" style={{ color: 'var(--color-text-subtle)' }}>
                            Vacinação
                          </p>
                          <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                            {new Date(entry.data.recordDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            {formatAgeInDays(entry.data.ageInDays)}
                            {entry.data.vaccineName ? ` · ${entry.data.vaccineName}` : ''}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${vaccinationStatusBadgeClasses[entry.data.status]}`}
                        >
                          {vaccinationStatusLabels[entry.data.status]}
                        </span>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
