'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getChild } from '@/services/childService';
import { createGrowthMeasurement } from '@/services/growthService';
import {
  growthMeasurementSchema,
  growthMeasurementFormDefaults,
  toGrowthMeasurementContentPayload,
  type GrowthMeasurementFormValues,
} from '@/lib/validation/growth';
import { calculateAgeInDays } from '@/lib/consultations/ageInDays';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import type { Child } from '@/lib/types';

export default function NovaMedicaoPage() {
  const { id: childId } = useParams<{ id: string }>();
  const router = useRouter();
  const { userProfile } = useAuth();

  const [child, setChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GrowthMeasurementFormValues>({
    resolver: zodResolver(growthMeasurementSchema),
    defaultValues: growthMeasurementFormDefaults(today),
  });

  useEffect(() => {
    if (!userProfile) return;
    (async () => {
      try {
        const found = await getChild(childId);
        if (!found || found.professionalId !== userProfile.uid) {
          setNotFound(true);
          return;
        }
        if (!found.active) {
          setError('Este paciente está inativo. Reative o cadastro para registrar novas medições.');
          return;
        }
        setChild(found);
      } catch {
        setError('Não foi possível carregar o paciente.');
      } finally {
        setLoading(false);
      }
    })();
  }, [childId, userProfile]);

  const onSubmit = async (data: GrowthMeasurementFormValues) => {
    if (!child || !userProfile) return;
    setError(null);
    try {
      const payload = toGrowthMeasurementContentPayload(data);
      await createGrowthMeasurement(userProfile.uid, {
        childId,
        ...payload,
        ageInDays: calculateAgeInDays(child.birthDate, data.measurementDate),
      });
      router.push(`/pacientes/${childId}/crescimento`);
    } catch {
      setError('Não foi possível registrar a medição. Tente novamente.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/pacientes/${childId}/crescimento`}
          className="text-sm font-medium"
          style={{ color: 'var(--color-primary)' }}
        >
          ← Voltar para o crescimento
        </Link>
        <h2 className="mt-2 text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          Nova medição
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
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
          <Card>
            <CardHeader
              title="Dados da medição"
              description="Preencha ao menos uma medida. Todas em unidades explícitas."
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Data da medição"
                type="date"
                error={errors.measurementDate?.message}
                {...register('measurementDate')}
              />
              <div />
              <Input
                label="Peso (kg)"
                type="number"
                step="0.01"
                placeholder="ex.: 10.2"
                error={errors.weightKg?.message}
                {...register('weightKg')}
              />
              <Input
                label="Comprimento/altura (cm)"
                type="number"
                step="0.1"
                placeholder="ex.: 75.5"
                error={errors.heightCm?.message}
                {...register('heightCm')}
              />
              <Input
                label="Perímetro cefálico (cm)"
                type="number"
                step="0.1"
                placeholder="ex.: 45.0"
                error={errors.headCircumferenceCm?.message}
                {...register('headCircumferenceCm')}
              />
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting} size="lg">
              Registrar medição
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
