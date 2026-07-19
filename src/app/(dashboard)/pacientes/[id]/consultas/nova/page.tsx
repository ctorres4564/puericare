'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getChild } from '@/services/childService';
import { createConsultation } from '@/services/consultationService';
import { calculateAgeInDays } from '@/lib/consultations/ageInDays';
import { Alert } from '@/components/ui/Alert';

export default function NovaConsultaPage() {
  const { id: childId } = useParams<{ id: string }>();
  const router = useRouter();
  const { userProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!userProfile || started.current) return;
    started.current = true;

    (async () => {
      try {
        const child = await getChild(childId);
        if (!child || child.professionalId !== userProfile.uid) {
          setError('Paciente não encontrado ou não pertence à sua conta.');
          return;
        }
        if (!child.active) {
          setError('Este paciente está inativo. Reative o cadastro para iniciar uma nova consulta.');
          return;
        }

        const today = new Date().toISOString().slice(0, 10);
        const consultation = await createConsultation(userProfile.uid, {
          childId,
          consultationDate: today,
          ageInDays: calculateAgeInDays(child.birthDate, today),
        });

        router.replace(`/pacientes/${childId}/consultas/${consultation.id}`);
      } catch (err) {
        console.error('[NovaConsulta] Erro ao iniciar consulta:', err);
        setError('Não foi possível iniciar a consulta. Tente novamente.');
      }
    })();
  }, [userProfile, childId, router]);

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="error">{error}</Alert>
      ) : (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Iniciando consulta...
        </p>
      )}
    </div>
  );
}
