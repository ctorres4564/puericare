'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getChild } from '@/services/childService';
import { createSleepRecord } from '@/services/sleepService';
import {
  sleepRecordSchema,
  sleepRecordFormDefaults,
  toSleepRecordContentPayload,
  type SleepRecordFormValues,
} from '@/lib/validation/sleep';
import { calculateAgeInDays } from '@/lib/consultations/ageInDays';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import type { Child } from '@/lib/types';

export default function NovoRegistroSonoPage() {
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
  } = useForm<SleepRecordFormValues>({
    resolver: zodResolver(sleepRecordSchema),
    defaultValues: sleepRecordFormDefaults(today),
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

  const onSubmit = async (data: SleepRecordFormValues) => {
    if (!child || !userProfile) return;
    setError(null);
    try {
      const payload = toSleepRecordContentPayload(data);
      await createSleepRecord(userProfile.uid, {
        childId,
        ...payload,
        ageInDays: calculateAgeInDays(child.birthDate, data.recordDate),
      });
      router.push(`/pacientes/${childId}/sono`);
    } catch {
      setError('Não foi possível registrar. Tente novamente.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/pacientes/${childId}/sono`} className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
          ← Voltar para sono
        </Link>
        <h2 className="mt-2 text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          Novo registro de sono
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
            <CardHeader title="Sono" description="Preencha ao menos um campo." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Horário de dormir"
                placeholder="ex.: 20:30"
                error={errors.bedtime?.message}
                {...register('bedtime')}
              />
              <Input
                label="Número de despertares"
                type="number"
                error={errors.nightWakings?.message}
                {...register('nightWakings')}
              />
              <Input
                label="Duração aproximada do sono noturno (horas)"
                type="number"
                step="0.5"
                error={errors.sleepDurationHours?.message}
                {...register('sleepDurationHours')}
              />
              <Input label="Cochilos" placeholder="ex.: 2 cochilos de 1h" error={errors.naps?.message} {...register('naps')} />
            </div>
            <div className="mt-4 flex flex-col gap-4">
              <Textarea label="Rotina de sono" error={errors.routine?.message} {...register('routine')} />
              <Textarea
                label="Dificuldades percebidas"
                error={errors.difficulties?.message}
                {...register('difficulties')}
              />
              <Textarea label="Observações" error={errors.observations?.message} {...register('observations')} />
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text)' }}>
                <input type="checkbox" {...register('requiresFollowUp')} />
                Necessita acompanhamento
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
