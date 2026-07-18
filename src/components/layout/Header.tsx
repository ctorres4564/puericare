'use client';

import React from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/Button';

interface HeaderProps {
  /** Título da página atual, exibido no breadcrumb */
  pageTitle?: string;
}

export function Header({ pageTitle }: HeaderProps) {
  const { userProfile, logout } = useAuth();

  const initials = userProfile?.displayName
    ? userProfile.displayName
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '?';

  const roleLabel: Record<string, string> = {
    ADMIN:        'Administrador',
    PROFESSIONAL: 'Profissional',
    CAREGIVER:    'Responsável',
  };

  return (
    <header
      className="flex h-16 shrink-0 items-center justify-between border-b px-6"
      style={{
        background:   'var(--color-bg-card)',
        borderColor:  'var(--color-border)',
        boxShadow:    'var(--shadow-sm)',
      }}
    >
      {/* Breadcrumb / título */}
      <div>
        {pageTitle && (
          <h1 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
            {pageTitle}
          </h1>
        )}
      </div>

      {/* Usuário + logout */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
          style={{ background: 'var(--color-primary)' }}
          aria-hidden="true"
        >
          {initials}
        </div>

        {/* Informações */}
        <div className="hidden sm:block text-right">
          <p className="text-sm font-medium leading-tight" style={{ color: 'var(--color-text)' }}>
            {userProfile?.displayName ?? 'Carregando...'}
          </p>
          <p className="text-xs leading-tight" style={{ color: 'var(--color-text-muted)' }}>
            {userProfile ? roleLabel[userProfile.role] : ''}
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={logout} aria-label="Sair da conta">
          Sair
        </Button>
      </div>
    </header>
  );
}
