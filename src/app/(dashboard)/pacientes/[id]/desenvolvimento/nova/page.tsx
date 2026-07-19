'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getChild } from '@/services/childService';
import { createDevelopmentAssessment } from '@/services/developmentService';
import {
  developmentAssessmentSchema,
  developmentAssessmentFormDefaults,
  toDevelopmentAssessmentContentPayload,
  developmentDomains,
  milestoneStatuses,
  type DevelopmentAssessmentFormValues,
} from '@/lib/validation/development';
import { domainLabels, milestoneStatusLabels } from '@/lib/development/labels';
import { calculateAgeInDays } from '@/lib/consultations/ageInDays';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import type { Child } from '@/lib/types';

export default function NovoRegistroDesenvolvimentoPage() {
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
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DevelopmentAssessmentFormValues>({
    resolver: zodResolver(developmentAssessmentSchema),
    defaultValues: developmentAssessmentFormDefaults(today),
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'milestones' });

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
          setError('Este paciente está inativo. Reative o cadastro para registrar novas avaliações.');
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

  const onSubmit = async (data: DevelopmentAssessmentFormValues) => {
    if (!child || !userProfile) return;
    setError(null);
    try {
      const payload = toDevelopmentAssessmentContentPayload(data);
      await createDevelopmentAssessment(userProfile.uid, {
        childId,
        ...payload,
        ageInDays: calculateAgeInDays(child.birthDate, data.assessmentDate),
      });
      router.push(`/pacientes/${childId}/desenvolvimento`);
    } catch {
      setError('Não foi possível registrar a avaliação. Tente novamente.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/pacientes/${childId}/desenvolvimento`}
          className="text-sm font-medium"
          style={{ color: 'var(--color-primary)' }}
        >
          ← Voltar para desenvolvimento
        </Link>
        <h2 className="mt-2 text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          Novo registro de desenvolvimento
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Acompanhamento longitudinal — não é triagem nem diagnóstico.
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
            <CardHeader title="Data da avaliação" />
            <Input
              label="Data"
              type="date"
              error={errors.assessmentDate?.message}
              {...register('assessmentDate')}
            />
          </Card>

          <Card>
            <CardHeader
              title="Marcos observados"
              description="Descreva livremente a habilidade observada em cada domínio."
            />
            <div className="flex flex-col gap-4">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_2fr_1fr_auto]" style={{ borderColor: 'var(--color-border)' }}>
                  <Select
                    label="Domínio"
                    error={errors.milestones?.[index]?.domain?.message}
                    {...register(`milestones.${index}.domain` as const)}
                  >
                    {developmentDomains.map((d) => (
                      <option key={d} value={d}>
                        {domainLabels[d]}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Habilidade observada"
                    placeholder="ex.: anda sem apoio"
                    error={errors.milestones?.[index]?.description?.message}
                    {...register(`milestones.${index}.description` as const)}
                  />
                  <Select
                    label="Status"
                    error={errors.milestones?.[index]?.status?.message}
                    {...register(`milestones.${index}.status` as const)}
                  >
                    {milestoneStatuses.map((s) => (
                      <option key={s} value={s}>
                        {milestoneStatusLabels[s]}
                      </option>
                    ))}
                  </Select>
                  <div className="flex items-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                      Remover
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="secondary"
                onClick={() => append({ domain: 'motor_grosso', description: '', status: 'NOT_EVALUATED' })}
              >
                + Adicionar marco
              </Button>

              {errors.observations?.message && fields.length === 0 && (
                <p role="alert" className="text-xs text-red-500">
                  {errors.observations.message}
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Observações e acompanhamento" />
            <div className="flex flex-col gap-4">
              <Textarea
                label="Observações clínicas (opcional)"
                error={errors.observations?.message}
                {...register('observations')}
              />
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text)' }}>
                <input type="checkbox" {...register('requiresFollowUp')} />
                Necessita acompanhamento / reavaliação
              </label>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting} size="lg">
              Registrar avaliação
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
