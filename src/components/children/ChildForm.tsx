'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { childSchema, childFormDefaults, type ChildFormValues } from '@/lib/validation/child';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';

interface ChildFormProps {
  defaultValues?: ChildFormValues;
  onSubmit: (data: ChildFormValues) => Promise<void>;
  submitLabel?: string;
}

export function ChildForm({ defaultValues = childFormDefaults, onSubmit, submitLabel = 'Salvar' }: ChildFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChildFormValues>({
    resolver: zodResolver(childSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Dados da criança" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Nome completo"
            className="sm:col-span-2"
            error={errors.fullName?.message}
            {...register('fullName')}
          />
          <Input
            label="Nome social (opcional)"
            error={errors.socialName?.message}
            {...register('socialName')}
          />
          <Input
            label="Data de nascimento"
            type="date"
            error={errors.birthDate?.message}
            {...register('birthDate')}
          />
          <Select label="Sexo" error={errors.sexAtBirth?.message} {...register('sexAtBirth')}>
            <option value="not_informed">Não informado</option>
            <option value="female">Feminino</option>
            <option value="male">Masculino</option>
            <option value="other">Outro</option>
          </Select>
          <Input
            label="Cartão SUS (opcional)"
            error={errors.susCardNumber?.message}
            {...register('susCardNumber')}
          />
          <Input
            label="Plano de saúde (opcional)"
            error={errors.healthInsurance?.message}
            {...register('healthInsurance')}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Responsável principal" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Nome do responsável"
            error={errors.caregiverName?.message}
            {...register('caregiverName')}
          />
          <Input
            label="Telefone"
            placeholder="(11) 91234-5678"
            error={errors.contactPhone?.message}
            {...register('contactPhone')}
          />
          <Input
            label="E-mail (opcional)"
            type="email"
            className="sm:col-span-2"
            error={errors.contactEmail?.message}
            {...register('contactEmail')}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Dados perinatais" description="Preencha o que estiver disponível." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Idade gestacional (semanas)"
            type="number"
            error={errors.perinatalData?.gestationalAgeWeeks?.message}
            {...register('perinatalData.gestationalAgeWeeks')}
          />
          <Select
            label="Tipo de parto"
            error={errors.perinatalData?.deliveryType?.message}
            {...register('perinatalData.deliveryType')}
          >
            <option value="">Não informado</option>
            <option value="vaginal">Vaginal</option>
            <option value="cesarean">Cesárea</option>
            <option value="forceps">Fórceps</option>
            <option value="other">Outro</option>
          </Select>
          <Input
            label="Peso ao nascer (g)"
            type="number"
            error={errors.perinatalData?.birthWeightGrams?.message}
            {...register('perinatalData.birthWeightGrams')}
          />
          <Input
            label="Comprimento ao nascer (cm)"
            type="number"
            step="0.1"
            error={errors.perinatalData?.birthLengthCm?.message}
            {...register('perinatalData.birthLengthCm')}
          />
          <Input
            label="Perímetro cefálico (cm)"
            type="number"
            step="0.1"
            error={errors.perinatalData?.birthHeadCircumferenceCm?.message}
            {...register('perinatalData.birthHeadCircumferenceCm')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Apgar 1º min"
              type="number"
              error={errors.perinatalData?.apgar1?.message}
              {...register('perinatalData.apgar1')}
            />
            <Input
              label="Apgar 5º min"
              type="number"
              error={errors.perinatalData?.apgar5?.message}
              {...register('perinatalData.apgar5')}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-8">
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text)' }}>
            <input type="checkbox" {...register('perinatalData.premature')} />
            Prematuro (&lt; 37 semanas)
          </label>
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text)' }}>
            <input type="checkbox" {...register('perinatalData.neonatalHospitalization')} />
            Internação neonatal
          </label>
        </div>

        <div className="mt-4">
          <Textarea
            label="Intercorrências neonatais (opcional)"
            error={errors.perinatalData?.neonatalComplications?.message}
            {...register('perinatalData.neonatalComplications')}
          />
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" loading={isSubmitting} size="lg">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
