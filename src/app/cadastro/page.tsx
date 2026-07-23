'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

import { signUp } from '@/lib/firebase/auth';
import { createUserProfile } from '@/services/userService';
import { Input }  from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert }  from '@/components/ui/Alert';
import { Card }   from '@/components/ui/Card';

/* ─── Schema de validação Zod com regras condicionais ─── */
const cadastroSchema = z
  .object({
    displayName: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
    email: z.string().min(1, 'Informe o e-mail').email('E-mail inválido'),
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
    role: z.enum(['PROFESSIONAL', 'CAREGIVER'], {
      message: 'Selecione o tipo de perfil',
    }),
    crm: z.string().optional(),
    specialty: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.role === 'PROFESSIONAL') {
        return !!data.crm && data.crm.trim().length > 0;
      }
      return true;
    },
    {
      message: 'CRM é obrigatório para profissionais de saúde',
      path: ['crm'],
    }
  );

type CadastroFormValues = z.infer<typeof cadastroSchema>;

function mapFirebaseError(code: string): string {
  const messages: Record<string, string> = {
    'auth/email-already-in-use':    'Este e-mail já está em uso.',
    'auth/invalid-email':           'Endereço de e-mail inválido.',
    'auth/operation-not-allowed':   'Operação de cadastro desativada.',
    'auth/weak-password':           'A senha digitada é muito fraca.',
    'auth/network-request-failed':  'Falha de conexão. Verifique sua internet.',
  };
  return messages[code] ?? 'Ocorreu um erro inesperado. Tente novamente.';
}

export default function CadastroPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CadastroFormValues>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: {
      role: 'PROFESSIONAL',
    },
  });

  const selectedRole = useWatch({ control, name: 'role' });

  const onSubmit = async (data: CadastroFormValues) => {
    setServerError(null);
    try {
      // 1. Cria a conta no Firebase Auth
      const user = await signUp(data.email, data.password);

      // 2. Prepara o payload para criar o perfil no Firestore
      const profilePayload = {
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        crm: data.role === 'PROFESSIONAL' ? data.crm : undefined,
        specialty: data.role === 'PROFESSIONAL' ? data.specialty : undefined,
        active: true,
      };

      // 3. Persiste o perfil na coleção 'users'
      await createUserProfile(user.uid, profilePayload);

      // 4. Redireciona o usuário recém-criado
      if (data.role === 'CAREGIVER') {
        router.push('/responsavel/dashboard');
      } else {
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setServerError(mapFirebaseError(code));
    }
  };

  return (
    <Card>
      <h2
        className="mb-1 text-xl font-semibold"
        style={{ color: 'var(--color-text)' }}
      >
        Criar sua conta
      </h2>
      <p className="mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Cadastre-se no PueriCare para iniciar o acompanhamento
      </p>

      {serverError && (
        <Alert variant="error" className="mb-4">
          {serverError}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Input
          label="Nome completo"
          type="text"
          placeholder="Seu nome"
          error={errors.displayName?.message}
          {...register('displayName')}
        />

        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="seu@email.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Senha"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 6 caracteres"
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Tipo de Perfil
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
              <input
                type="radio"
                value="PROFESSIONAL"
                {...register('role')}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Profissional de Saúde
            </label>
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
              <input
                type="radio"
                value="CAREGIVER"
                {...register('role')}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Responsável/Familiar
            </label>
          </div>
        </div>

        {selectedRole === 'PROFESSIONAL' && (
          <div className="flex flex-col gap-4 border-t pt-4 mt-2" style={{ borderColor: 'var(--color-border)' }}>
            <Input
              label="CRM"
              type="text"
              placeholder="000000-UF"
              error={errors.crm?.message}
              {...register('crm')}
            />

            <Input
              label="Especialidade (Opcional)"
              type="text"
              placeholder="Ex: Pediatria, Hebiatria"
              error={errors.specialty?.message}
              {...register('specialty')}
            />
          </div>
        )}

        <Button
          type="submit"
          fullWidth
          loading={isSubmitting}
          size="lg"
          className="mt-4"
        >
          Criar Conta
        </Button>
      </form>

      <div className="mt-6 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Já possui uma conta?{' '}
        <Link
          href="/login"
          className="font-medium transition-colors"
          style={{ color: 'var(--color-primary)' }}
        >
          Entrar
        </Link>
      </div>
    </Card>
  );
}
