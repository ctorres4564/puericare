'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getChild } from '@/services/childService';
import { getConsultation, updateConsultation, cancelConsultation } from '@/services/consultationService';
import { listVaccinationRecordsByProfessional } from '@/services/vaccinationService';
import { calculateAgeInDays } from '@/lib/consultations/ageInDays';
import { buildConsultationRoteiro } from '@/lib/consultations/roteiro';
import { scheduleDoseStatusLabels, scheduleDoseStatusBadgeClasses } from '@/lib/vaccination/labels';
import { toConsultationContentPayload, type ConsultationFormValues } from '@/lib/validation/consultation';
import { ConsultationForm } from '@/components/consultations/ConsultationForm';
import { Alert } from '@/components/ui/Alert';
import { Card, CardHeader } from '@/components/ui/Card';
import type { Child, Consultation, VaccinationRecord } from '@/lib/types';

export default function ConsultaPage() {
  const { id: childId, consultationId } = useParams<{ id: string; consultationId: string }>();
  const router = useRouter();
  const { userProfile } = useAuth();

  const [child, setChild] = useState<Child | null>(null);
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [vaccinationRecords, setVaccinationRecords] = useState<VaccinationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState<'draft' | 'finalize' | 'cancel' | null>(null);

  const roteiro = useMemo(
    () =>
      child && consultation
        ? buildConsultationRoteiro(
            child.birthDate,
            consultation.consultationDate,
            vaccinationRecords.filter((r) => r.childId === child.id)
          )
        : null,
    [child, consultation, vaccinationRecords]
  );

  useEffect(() => {
    if (!userProfile) return;
    (async () => {
      try {
        const [foundChild, foundConsultation, allVaccinationRecords] = await Promise.all([
          getChild(childId),
          getConsultation(consultationId),
          listVaccinationRecordsByProfessional(userProfile.uid),
        ]);

        if (
          !foundChild ||
          !foundConsultation ||
          foundConsultation.childId !== childId ||
          foundConsultation.professionalId !== userProfile.uid
        ) {
          setNotFound(true);
          return;
        }

        setChild(foundChild);
        setConsultation(foundConsultation);
        setVaccinationRecords(allVaccinationRecords);
      } catch {
        setError('Não foi possível carregar a consulta.');
      } finally {
        setLoading(false);
      }
    })();
  }, [childId, consultationId, userProfile]);

  const persist = async (data: ConsultationFormValues, status: 'draft' | 'completed') => {
    if (!child) return;
    const ageInDays = calculateAgeInDays(child.birthDate, data.consultationDate);
    await updateConsultation(consultationId, {
      ...toConsultationContentPayload(data),
      ageInDays,
      status,
    });
  };

  const onSaveDraft = async (data: ConsultationFormValues) => {
    setError(null);
    setInfo(null);
    setSaving('draft');
    try {
      await persist(data, 'draft');
      setInfo('Rascunho salvo.');
    } catch {
      setError('Não foi possível salvar o rascunho. Tente novamente.');
    } finally {
      setSaving(null);
    }
  };

  const onFinalize = async (data: ConsultationFormValues) => {
    setError(null);
    setSaving('finalize');
    try {
      await persist(data, 'completed');
      router.push(`/pacientes/${childId}/consultas`);
    } catch {
      setError('Não foi possível finalizar a consulta. Tente novamente.');
      setSaving(null);
    }
  };

  const onCancelDraft = async () => {
    setError(null);
    setSaving('cancel');
    try {
      await cancelConsultation(consultationId);
      router.push(`/pacientes/${childId}/consultas`);
    } catch {
      setError('Não foi possível cancelar o rascunho. Tente novamente.');
      setSaving(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/pacientes/${childId}/consultas`}
          className="text-sm font-medium"
          style={{ color: 'var(--color-primary)' }}
        >
          ← Voltar para a linha do tempo
        </Link>
        <h2 className="mt-2 text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          {loading ? 'Consulta' : child ? `Consulta — ${child.fullName}` : 'Consulta'}
        </h2>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {info && <Alert variant="success">{info}</Alert>}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Carregando...
        </p>
      ) : notFound ? (
        <Alert variant="error" title="Consulta não encontrada">
          Este registro não existe ou não pertence à sua conta.
        </Alert>
      ) : child && consultation ? (
        <>
          {consultation.status === 'draft' && roteiro && (
            <Card>
              <CardHeader
                title={`Roteiro sugerido — ${roteiro.ageLabel}`}
                description="Apoio à memória para esta faixa etária — não é protocolo clínico e não substitui o julgamento profissional."
              />
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Antropometria
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {roteiro.measurements.map((m) => (
                      <span
                        key={m}
                        className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Vacinas (PNI) a conferir nesta data
                  </p>
                  {roteiro.vaccinesToCheck.length === 0 ? (
                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      Nenhuma dose do esquema fixo a conferir nesta data. Influenza e Covid-19:
                      conferir recomendação vigente.
                    </p>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-1">
                      {roteiro.vaccinesToCheck.map((d) => (
                        <li key={d.key} className="flex items-center justify-between gap-4">
                          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            {d.vaccine} — {d.dose}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${scheduleDoseStatusBadgeClasses[d.status]}`}
                          >
                            {scheduleDoseStatusLabels[d.status]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Desenvolvimento
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {roteiro.developmentReminder}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Orientações sugeridas
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {roteiro.guidanceTopics.map((t) => (
                      <li key={t} className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          )}

          <ConsultationForm
            defaultValues={{
              consultationDate: consultation.consultationDate,
              reason: consultation.reason ?? '',
              intervalHistory: consultation.intervalHistory ?? '',
              clinicalNotes: consultation.clinicalNotes ?? '',
              assessment: consultation.assessment ?? '',
              plan: consultation.plan ?? '',
            }}
            childBirthDate={child.birthDate}
            status={consultation.status}
            onSaveDraft={onSaveDraft}
            onFinalize={onFinalize}
            onCancelDraft={consultation.status === 'draft' ? onCancelDraft : undefined}
            saving={saving}
          />
        </>
      ) : null}
    </div>
  );
}
