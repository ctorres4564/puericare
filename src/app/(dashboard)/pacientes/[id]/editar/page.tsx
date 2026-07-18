'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getChild, updateChild } from '@/services/childService';
import { ChildForm } from '@/components/children/ChildForm';
import { toChildPayload, type ChildFormValues } from '@/lib/validation/child';
import { Alert } from '@/components/ui/Alert';
import type { Child } from '@/lib/types';

function numberToString(n?: number): string {
  return n === undefined ? '' : String(n);
}

function childToFormValues(child: Child): ChildFormValues {
  const perinatal = child.perinatalData;
  return {
    fullName: child.fullName,
    socialName: child.socialName ?? '',
    birthDate: child.birthDate,
    sexAtBirth: child.sexAtBirth,
    caregiverName: child.caregiverName,
    contactPhone: child.contactPhone,
    contactEmail: child.contactEmail ?? '',
    susCardNumber: child.susCardNumber ?? '',
    healthInsurance: child.healthInsurance ?? '',
    perinatalData: {
      gestationalAgeWeeks: numberToString(perinatal?.gestationalAgeWeeks),
      deliveryType: perinatal?.deliveryType ?? '',
      birthWeightGrams: numberToString(perinatal?.birthWeightGrams),
      birthLengthCm: numberToString(perinatal?.birthLengthCm),
      birthHeadCircumferenceCm: numberToString(perinatal?.birthHeadCircumferenceCm),
      apgar1: numberToString(perinatal?.apgar1),
      apgar5: numberToString(perinatal?.apgar5),
      premature: perinatal?.premature ?? false,
      neonatalHospitalization: perinatal?.neonatalHospitalization ?? false,
      neonatalComplications: perinatal?.neonatalComplications ?? '',
    },
  };
}

export default function EditarPacientePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userProfile } = useAuth();

  const [child, setChild] = useState<Child | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    getChild(id)
      .then((result) => {
        if (!result || result.professionalId !== userProfile.uid) {
          setNotFound(true);
          return;
        }
        setChild(result);
      })
      .catch(() => setError('Não foi possível carregar o cadastro.'))
      .finally(() => setLoading(false));
  }, [id, userProfile]);

  const onSubmit = async (data: ChildFormValues) => {
    setError(null);
    try {
      await updateChild(id, toChildPayload(data));
      router.push('/pacientes');
    } catch (err) {
      console.error('[EditarPaciente] Erro ao salvar:', err);
      setError('Não foi possível salvar as alterações. Tente novamente.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/pacientes" className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
          ← Voltar para a lista
        </Link>
        <h2 className="mt-2 text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          Editar paciente
        </h2>
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
      ) : child ? (
        <ChildForm defaultValues={childToFormValues(child)} onSubmit={onSubmit} submitLabel="Salvar alterações" />
      ) : null}
    </div>
  );
}
