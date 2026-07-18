'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { createChild } from '@/services/childService';
import { ChildForm } from '@/components/children/ChildForm';
import { Alert } from '@/components/ui/Alert';
import { toChildPayload, type ChildFormValues } from '@/lib/validation/child';

export default function NovoPacientePage() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (data: ChildFormValues) => {
    if (!userProfile) return;
    setError(null);
    try {
      await createChild(userProfile.uid, toChildPayload(data));
      router.push('/pacientes');
    } catch (err) {
      console.error('[NovoPaciente] Erro ao criar cadastro:', err);
      setError('Não foi possível salvar o cadastro. Tente novamente.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/pacientes" className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
          ← Voltar para a lista
        </Link>
        <h2 className="mt-2 text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          Novo paciente
        </h2>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <ChildForm onSubmit={onSubmit} submitLabel="Cadastrar paciente" />
    </div>
  );
}
