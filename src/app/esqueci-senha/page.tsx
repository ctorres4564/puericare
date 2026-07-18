'use client';

// Evita pre-render estático — Firebase requer env vars em runtime
export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

import { resetPassword } from '@/lib/firebase/auth';
import { Input }  from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert }  from '@/components/ui/Alert';
import { Card }   from '@/components/ui/Card';

const schema = z.object({
  email: z.string().min(1, 'Informe o e-mail').email('E-mail inválido'),
});
type FormValues = z.infer<typeof schema>;

export default function EsqueciSenhaPage() {
  const [sent, setSent]         = useState(false);
  const [serverError, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setError(null);
    try {
      await resetPassword(data.email);
      setSent(true);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/user-not-found') {
        // Por segurança, não revelamos se o e-mail existe
        setSent(true);
      } else if (code === 'auth/network-request-failed') {
        setError('Falha de conexão. Verifique sua internet.');
      } else {
        setError('Não foi possível enviar o e-mail. Tente novamente.');
      }
    }
  };

  return (
    <Card>
      <h2
        className="mb-1 text-xl font-semibold"
        style={{ color: 'var(--color-text)' }}
      >
        Recuperar senha
      </h2>
      <p className="mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Informe seu e-mail e enviaremos um link para redefinir sua senha.
      </p>

      {sent ? (
        <Alert variant="success" title="E-mail enviado">
          Se houver uma conta com este endereço, você receberá as instruções em
          breve. Verifique também sua pasta de spam.
        </Alert>
      ) : (
        <>
          {serverError && (
            <Alert variant="error" className="mb-4">
              {serverError}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <Input
              label="E-mail"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Button type="submit" fullWidth loading={isSubmitting} size="lg">
              Enviar link de recuperação
            </Button>
          </form>
        </>
      )}

      <div className="mt-4 text-center">
        <Link
          href="/login"
          className="text-sm transition-colors"
          style={{ color: 'var(--color-primary)' }}
        >
          ← Voltar ao login
        </Link>
      </div>
    </Card>
  );
}
