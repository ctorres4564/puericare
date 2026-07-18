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
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

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
