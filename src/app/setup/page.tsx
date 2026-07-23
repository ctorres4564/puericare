'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { createUserProfile } from '@/services/userService';
import { setupSchema as schema, type SetupFormValues as FormValues } from '@/lib/validation/setup';
import type { UserRole } from '@/lib/types';
import { Input }  from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert }  from '@/components/ui/Alert';
import { Card }   from '@/components/ui/Card';

/* ─── Componente ──────────────────────────────────────────────── */
export default function SetupPage() {
  const [created, setCreated] = useState<{ email: string; role: string } | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'PROFESSIONAL' },
  });

  const role = useWatch({ control, name: 'role' });

  const onSubmit = async (data: FormValues) => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      let uid: string;

      try {
        // Tenta criar novo usuário no Firebase Authentication
        const credential = await createUserWithEmailAndPassword(auth, data.email, data.password);
        uid = credential.user.uid;
      } catch (createErr: unknown) {
        const code = (createErr as { code?: string }).code ?? '';
        if (code === 'auth/email-already-in-use') {
          // Usuário já existe no Auth — faz login para obter o UID e criar o perfil
          const { signInWithEmailAndPassword } = await import('firebase/auth');
          try {
            const existing = await signInWithEmailAndPassword(auth, data.email, data.password);
            uid = existing.user.uid;
          } catch {
            setError(
              'Usuário já existe no Auth mas a senha está incorreta. ' +
              'Use a senha definida anteriormente para este e-mail.'
            );
            return;
          }
        } else {
          throw createErr;
        }
      }

      // Cria ou sobrescreve o perfil no Firestore
      await createUserProfile(uid, {
        email:          data.email,
        displayName:    data.displayName,
        role:           data.role as UserRole,
        crm:            data.crm,
        specialty:      data.specialty,
        active:         true,
        linkedChildIds: data.role === 'CAREGIVER' ? [] : undefined,
      });

      setCreated({ email: data.email, role: data.role });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setError(`Erro: ${code || 'inesperado'}. Tente novamente.`);
    }
  };

  // Bloqueada em produção: mesmo que a Firestore rule já impeça a criação
  // de ADMIN, essa rota não deve ficar acessível fora de desenvolvimento.
  if (process.env.NODE_ENV === 'production') {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'var(--color-bg)' }}
      >
        <div className="w-full max-w-md">
          <Alert variant="error" title="Rota indisponível">
            Esta página de setup só existe em desenvolvimento. Para criar o
            primeiro administrador em produção, veja SECURITY.md.
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="w-full max-w-md">
        {/* Cabeçalho */}
        <div className="mb-6 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 shadow-lg mb-4">
            <span className="text-2xl">⚙️</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            Setup Inicial
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Crie o primeiro usuário do sistema
          </p>
        </div>

        <Alert variant="warning" className="mb-4">
          <strong>Ambiente de desenvolvimento.</strong> Disponível apenas fora
          de produção. Contas ADMIN não podem ser criadas por aqui — o
          Firestore rejeita essa criação pelo cliente (veja SECURITY.md).
        </Alert>

        {created ? (
          <Card>
            <Alert variant="success" title="Usuário criado com sucesso!">
              <p className="mt-1"><strong>E-mail:</strong> {created.email}</p>
              <p><strong>Perfil:</strong> {created.role}</p>
            </Alert>
            <div className="mt-4 text-center">
              <a
                href="/login"
                className="text-sm font-medium"
                style={{ color: 'var(--color-primary)' }}
              >
                → Ir para o login
              </a>
            </div>
          </Card>
        ) : (
          <Card>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
              <Input
                label="Nome completo"
                placeholder="Dr. João Silva"
                error={errors.displayName?.message}
                {...register('displayName')}
              />

              <Input
                label="E-mail"
                type="email"
                placeholder="medico@clinica.com.br"
                error={errors.email?.message}
                {...register('email')}
              />

              <Input
                label="Senha"
                type="password"
                placeholder="Mínimo 6 caracteres"
                error={errors.password?.message}
                {...register('password')}
              />

              {/* Perfil */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  Perfil
                </label>
                <select
                  className="rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
                  style={{
                    borderColor: 'var(--color-border)',
                    background:  'var(--color-bg-card)',
                    color:       'var(--color-text)',
                  }}
                  {...register('role')}
                >
                  <option value="PROFESSIONAL">Profissional (médico/a)</option>
                  <option value="CAREGIVER">Responsável (cuidador)</option>
                </select>
              </div>

              {/* Campos extras para PROFESSIONAL */}
              {role === 'PROFESSIONAL' && (
                <>
                  <Input
                    label="CRM (opcional)"
                    placeholder="CRM/SP 123456"
                    error={errors.crm?.message}
                    {...register('crm')}
                  />
                  <Input
                    label="Especialidade (opcional)"
                    placeholder="Pediatria"
                    error={errors.specialty?.message}
                    {...register('specialty')}
                  />
                </>
              )}

              {error && <Alert variant="error">{error}</Alert>}

              <Button type="submit" fullWidth loading={isSubmitting} size="lg">
                Criar usuário
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
