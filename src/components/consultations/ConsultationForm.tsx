'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { consultationSchema, type ConsultationFormValues } from '@/lib/validation/consultation';
import { calculateAgeInDays, formatAgeInDays } from '@/lib/consultations/ageInDays';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import type { ConsultationStatus } from '@/lib/types';

interface ConsultationFormProps {
  defaultValues: ConsultationFormValues;
  childBirthDate: string;
  status: ConsultationStatus;
  onSaveDraft: (data: ConsultationFormValues) => Promise<void>;
  onFinalize: (data: ConsultationFormValues) => Promise<void>;
  onCancelDraft?: () => Promise<void>;
  saving?: 'draft' | 'finalize' | 'cancel' | null;
}

const statusLabels: Record<ConsultationStatus, string> = {
  draft: 'Rascunho',
  completed: 'Finalizada',
  cancelled: 'Cancelada',
};

export function ConsultationForm({
  defaultValues,
  childBirthDate,
  status,
  onSaveDraft,
  onFinalize,
  onCancelDraft,
  saving = null,
}: ConsultationFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ConsultationFormValues>({
    resolver: zodResolver(consultationSchema),
    defaultValues,
  });

  const consultationDate = watch('consultationDate');
  const ageInDays = consultationDate ? calculateAgeInDays(childBirthDate, consultationDate) : 0;

  const isDraft = status === 'draft';

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-6">
      <Card>
        <CardHeader
          title="Dados básicos"
          description={`Status: ${statusLabels[status]}`}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Data da consulta"
            type="date"
            disabled={!isDraft}
            error={errors.consultationDate?.message}
            {...register('consultationDate')}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Idade na consulta
            </label>
            <p
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              {formatAgeInDays(ageInDays)}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Motivo e intercorrências" />
        <div className="flex flex-col gap-4">
          <Textarea
            label="Motivo da consulta"
            disabled={!isDraft}
            error={errors.reason?.message}
            {...register('reason')}
          />
          <Textarea
            label="Intercorrências desde a última consulta"
            disabled={!isDraft}
            error={errors.intervalHistory?.message}
            {...register('intervalHistory')}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Evolução clínica" />
        <div className="flex flex-col gap-4">
          <Textarea
            label="Observações clínicas / exame"
            disabled={!isDraft}
            error={errors.clinicalNotes?.message}
            {...register('clinicalNotes')}
          />
          <Textarea
            label="Avaliação clínica"
            disabled={!isDraft}
            error={errors.assessment?.message}
            {...register('assessment')}
          />
          <Textarea
            label="Conduta e orientações"
            disabled={!isDraft}
            error={errors.plan?.message}
            {...register('plan')}
          />
        </div>
      </Card>

      {isDraft && (
        <div className="flex flex-wrap justify-end gap-3">
          {onCancelDraft && (
            <Button
              type="button"
              variant="ghost"
              loading={saving === 'cancel'}
              disabled={!!saving}
              onClick={onCancelDraft}
            >
              Cancelar rascunho
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            loading={saving === 'draft'}
            disabled={!!saving}
            onClick={handleSubmit(onSaveDraft)}
          >
            Salvar rascunho
          </Button>
          <Button
            type="button"
            loading={saving === 'finalize'}
            disabled={!!saving}
            onClick={handleSubmit(onFinalize)}
          >
            Finalizar consulta
          </Button>
        </div>
      )}
    </form>
  );
}
