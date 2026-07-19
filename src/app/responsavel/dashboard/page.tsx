'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

/**
 * Página de destino do login para o perfil CAREGIVER.
 *
 * O portal do responsável não faz parte deste MVP — o PRD limita o acesso
 * de pais/responsáveis a "relatórios exportados" (documentacao/prd.txt,
 * seção 2), recurso que também ainda não existe (ver auditoria de
 * progresso). Antes desta página, o login de uma conta CAREGIVER caía em
 * 404 (rota inexistente). Esta tela só evita o 404 e explica o estado
 * atual — não implementa nenhuma funcionalidade nova de portal.
 */
export default function ResponsavelDashboardPage() {
  const { user, userProfile, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="flex flex-col items-center gap-3">
          <svg
            className="h-8 w-8 animate-spin"
            style={{ color: 'var(--color-primary)' }}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Verificando acesso...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)] shadow-lg mb-4">
            <span className="text-2xl" aria-hidden="true">👶</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            PueriCare
          </h1>
        </div>

        <Card>
          <h2 className="mb-1 text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            Olá, {userProfile?.displayName ?? 'responsável'}
          </h2>
          <p className="mb-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Acesso de responsável
          </p>

          <Alert variant="info" title="Portal do responsável ainda não disponível">
            Esta versão do PueriCare atende apenas profissionais de saúde. O
            acompanhamento da criança pode ser combinado diretamente com o
            profissional responsável pela consulta.
          </Alert>

          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={logout}>
              Sair
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
