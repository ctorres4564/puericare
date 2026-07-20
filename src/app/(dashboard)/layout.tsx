'use client';

// Força renderização dinâmica — evita tentativa de pre-render estático com Firebase
export const dynamic = 'force-dynamic';

import React, { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header }  from '@/components/layout/Header';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, userProfile, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Cada papel tem sua área: o grupo (dashboard) é exclusivo do PROFESSIONAL.
  useEffect(() => {
    if (!loading && user && userProfile) {
      if (userProfile.role === 'CAREGIVER') {
        router.replace('/responsavel/dashboard');
      } else if (userProfile.role === 'ADMIN') {
        router.replace('/admin/dashboard');
      }
    }
  }, [user, userProfile, loading, router]);

  // Tela de loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
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

  // Não renderiza nada enquanto redireciona para login
  if (!user) return null;

  // Perfil não encontrado no Firestore — mostra mensagem informativa
  if (!userProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div
          className="w-full max-w-md rounded-xl border p-8 text-center"
          style={{
            background: 'var(--color-bg-card)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div className="mb-4 text-4xl">⚠️</div>
          <h2 className="mb-2 text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            Perfil não encontrado
          </h2>
          <p className="mb-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Sua conta de autenticação existe, mas o perfil correspondente não foi encontrado no
            banco de dados. Isso pode acontecer se o usuário foi cadastrado diretamente no Firebase
            Authentication sem criar o documento na coleção <strong>users</strong> do Firestore.
          </p>
          <p className="mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <strong>Solução:</strong> Verifique no Firebase Console se existe um documento em{' '}
            <code className="rounded px-1 py-0.5 text-xs" style={{ background: 'var(--color-primary-light)' }}>
              Firestore → users/{user.uid}
            </code>{' '}
            com os campos obrigatórios: <em>uid, email, displayName, role, active, createdAt, updatedAt</em>.
          </p>
          <button
            onClick={async () => {
              await logout();
              router.push('/login');
            }}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors"
            style={{ background: 'var(--color-primary)' }}
          >
            Voltar para o Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      {/* Sidebar fixo */}
      <Sidebar />

      {/* Área principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />

        <main
          className="flex-1 overflow-y-auto p-6"
          style={{ background: 'var(--color-bg)' }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
