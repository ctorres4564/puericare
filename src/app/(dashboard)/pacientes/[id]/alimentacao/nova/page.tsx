'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getChild } from '@/services/childService';
import { createFeedingRecord } from '@/services/feedingService';
import {
  feedingRecordSchema,
  feedingRecordFormDefaults,
  toFeedingRecordContentPayload,
  type FeedingRecordFormValues,
} from '@/lib/validation/feeding';
import { calculateAgeInDays } from '@/lib/consultations/ageInDays';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import type { Child } from '@/lib/types';

export default function NovoRegistroAlimentacaoPage() {
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
  } = useForm<FeedingRecordFormValues>({
    resolver: zodResolver(feedingRecordSchema),
    defaultValues: feedingRecordFormDefaults(today),
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
          setError('Este paciente está inativo. Reative o cadastro para registrar novas observações.');
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

  const onSubmit = async (data: FeedingRecordFormValues) => {
    if (!child || !userProfile) return;
    setError(null);
    try {
      const payload = toFeedingRecordContentPayload(data);
      await createFeedingRecord(userProfile.uid, {
        childId,
        ...payload,
        ageInDays: calculateAgeInDays(child.birthDate, data.recordDate),
      });
      router.push(`/pacientes/${childId}/alimentacao`);
    } catch {
      setError('Não foi possível registrar. Tente novamente.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/pacientes/${childId}/alimentacao`}
          className="text-sm font-medium"
          style={{ color: 'var(--color-primary)' }}
        >
          ← Voltar para alimentação
        </Link>
        <h2 className="mt-2 text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          Novo registro de alimentação
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
            <CardHeader title="Data do registro" />
            <Input label="Data" type="date" error={errors.recordDate?.message} {...register('recordDate')} />
          </Card>

          <Card>
            <CardHeader title="Alimentação" description="Preencha ao menos um campo." />
            <div className="flex flex-col gap-4">
              <Textarea
                label="Histórico alimentar (aleitamento, fórmula, alimentação atual)"
                error={errors.feedingHistory?.message}
                {...register('feedingHistory')}
              />
              <Textarea label="Rotina alimentar" error={errors.routine?.message} {...register('routine')} />
              <Textarea
                label="Introdução alimentar"
                error={errors.foodIntroduction?.message}
                {...register('foodIntroduction')}
              />
              <Textarea
                label="Dificuldades alimentares"
                error={errors.difficulties?.message}
                {...register('difficulties')}
              />
              <Textarea
                label="Observações do profissional"
                error={errors.observations?.message}
                {...register('observations')}
              />
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text)' }}>
                <input type="checkbox" {...register('requiresFollowUp')} />
                Necessita acompanhamento / conduta
              </label>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting} size="lg">
              Registrar
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
