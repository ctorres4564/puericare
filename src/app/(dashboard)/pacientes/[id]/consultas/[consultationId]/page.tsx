'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getChild } from '@/services/childService';
import { getConsultation, updateConsultation, cancelConsultation } from '@/services/consultationService';
import { calculateAgeInDays } from '@/lib/consultations/ageInDays';
import { toConsultationContentPayload, type ConsultationFormValues } from '@/lib/validation/consultation';
import { ConsultationForm } from '@/components/consultations/ConsultationForm';
import { Alert } from '@/components/ui/Alert';
import type { Child, Consultation } from '@/lib/types';

export default function ConsultaPage() {
  const { id: childId, consultationId } = useParams<{ id: string; consultationId: string }>();
  const router = useRouter();
  const { userProfile } = useAuth();

  const [child, setChild] = useState<Child | null>(null);
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState<'draft' | 'finalize' | 'cancel' | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    (async () => {
      try {
        const [foundChild, foundConsultation] = await Promise.all([
          getChild(childId),
          getConsultation(consultationId),
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
      ) : null}
    </div>
  );
}
