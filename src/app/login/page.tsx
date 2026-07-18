'use client';

// Evita pre-render estático — Firebase requer env vars em runtime
export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

import { signIn } from '@/lib/firebase/auth';
import { getUserProfile } from '@/services/userService';
import { Input }  from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert }  from '@/components/ui/Alert';
import { Card }   from '@/components/ui/Card';

/* ─── Schema de validação ─────────────────────────────────────── */
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Informe o e-mail')
    .email('E-mail inválido'),
  password: z
    .string()
    .min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/* ─── Mapeamento de erros Firebase → mensagens amigáveis ─────── */
function mapFirebaseError(code: string): string {
  const messages: Record<string, string> = {
    'auth/invalid-credential':      'E-mail ou senha incorretos.',
    'auth/user-not-found':          'Nenhuma conta encontrada com este e-mail.',
    'auth/wrong-password':          'Senha incorreta.',
    'auth/user-disabled':           'Esta conta foi desativada. Entre em contato com o suporte.',
    'auth/too-many-requests':       'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
    'auth/network-request-failed':  'Falha de conexão. Verifique sua internet.',
  };
  return messages[code] ?? 'Ocorreu um erro inesperado. Tente novamente.';
}

/* ─── Componente ──────────────────────────────────────────────── */
export default function LoginPage() {
  const router  = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setServerError(null);
    try {
      const user = await signIn(data.email, data.password);
      const profile = await getUserProfile(user.uid);

      // Redireciona conforme o perfil
      if (profile?.role === 'ADMIN') {
        router.push('/admin/dashboard');
      } else if (profile?.role === 'CAREGIVER') {
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
        Entrar na sua conta
      </h2>
      <p className="mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Acesso exclusivo para profissionais autorizados
      </p>

      {serverError && (
        <Alert variant="error" className="mb-4">
          {serverError}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Input
          label="E-mail profissional"
          type="email"
          autoComplete="email"
          placeholder="seu@email.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Senha"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex justify-end">
          <Link
            href="/esqueci-senha"
            className="text-sm font-medium transition-colors"
            style={{ color: 'var(--color-primary)' }}
          >
            Esqueci minha senha
          </Link>
        </div>

        <Button
          type="submit"
          fullWidth
          loading={isSubmitting}
          size="lg"
          className="mt-2"
        >
          Entrar
        </Button>
      </form>
    </Card>
  );
}
