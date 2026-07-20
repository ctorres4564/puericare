'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getChild } from '@/services/childService';
import { createVaccinationRecord } from '@/services/vaccinationService';
import {
  vaccinationRecordSchema,
  vaccinationRecordFormDefaults,
  toVaccinationRecordContentPayload,
  vaccinationStatuses,
  type VaccinationRecordFormValues,
} from '@/lib/validation/vaccination';
import { vaccinationStatusLabels, scheduleDoseLabel } from '@/lib/vaccination/labels';
import { PNI_ALL_DOSES } from '@/lib/vaccination/schedule';
import { calculateAgeInDays } from '@/lib/consultations/ageInDays';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import type { Child } from '@/lib/types';

export default function NovoRegistroVacinacaoPage() {
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
  } = useForm<VaccinationRecordFormValues>({
    resolver: zodResolver(vaccinationRecordSchema),
    defaultValues: vaccinationRecordFormDefaults(today),
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

  const onSubmit = async (data: VaccinationRecordFormValues) => {
    if (!child || !userProfile) return;
    setError(null);
    try {
      const payload = toVaccinationRecordContentPayload(data);
      await createVaccinationRecord(userProfile.uid, {
        childId,
        ...payload,
        ageInDays: calculateAgeInDays(child.birthDate, data.recordDate),
      });
      router.push(`/pacientes/${childId}/vacinacao`);
    } catch {
      setError('Não foi possível registrar. Tente novamente.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/pacientes/${childId}/vacinacao`}
          className="text-sm font-medium"
          style={{ color: 'var(--color-primary)' }}
        >
          ← Voltar para vacinação
        </Link>
        <h2 className="mt-2 text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          Novo registro de vacinação
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Vincule a dose ao calendário PNI para que o sistema acompanhe atrasos automaticamente.
        </p>
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
            <CardHeader title="Data e status" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Data do registro" type="date" error={errors.recordDate?.message} {...register('recordDate')} />
              <Select label="Status vacinal" error={errors.status?.message} {...register('status')}>
                {vaccinationStatuses.map((s) => (
                  <option key={s} value={s}>
                    {vaccinationStatusLabels[s]}
                  </option>
                ))}
              </Select>
            </div>
          </Card>

          <Card>
            <CardHeader title="Dose aplicada (opcional)" description="Preencha se esta visita incluiu aplicação de vacina." />
            <Select
              label="Dose do calendário PNI (opcional)"
              error={errors.scheduleKey?.message}
              {...register('scheduleKey')}
            >
              <option value="">Não vincular ao calendário</option>
              {PNI_ALL_DOSES.map((d) => (
                <option key={d.key} value={d.key}>
                  {scheduleDoseLabel(d)}
                </option>
              ))}
            </Select>
            <p className="mt-1 mb-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Ao vincular, nome e dose são preenchidos automaticamente se deixados em branco.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Nome da vacina" placeholder="ex.: Pentavalente" error={errors.vaccineName?.message} {...register('vaccineName')} />
              <Input label="Dose" placeholder="ex.: 1ª dose, reforço" error={errors.doseDescription?.message} {...register('doseDescription')} />
              <Input label="Lote (opcional)" error={errors.lot?.message} {...register('lot')} />
              <Input label="Estabelecimento (opcional)" error={errors.facility?.message} {...register('facility')} />
            </div>
            <div className="mt-4">
              <Textarea label="Observações" error={errors.observations?.message} {...register('observations')} />
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
