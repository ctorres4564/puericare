'use client';

import React from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Card, CardHeader } from '@/components/ui/Card';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  description?: string;
}

function StatCard({ label, value, icon, description }: StatCardProps) {
  return (
    <div
      className="flex items-start gap-4 rounded-xl border p-5"
      style={{
        background:  'var(--color-bg-card)',
        borderColor: 'var(--color-border)',
        boxShadow:   'var(--shadow-sm)',
      }}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
        style={{ background: 'var(--color-primary-light)' }}
      >
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          {value}
        </p>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </p>
        {description && (
          <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-subtle)' }}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { userProfile } = useAuth();

  const firstName = userProfile?.displayName?.split(' ')[0] ?? 'Profissional';

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Bom dia' :
    hour < 18 ? 'Boa tarde' :
                'Boa noite';

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho de boas-vindas */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          {greeting}, {firstName}! 👋
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            day:     'numeric',
            month:   'long',
            year:    'numeric',
          })}
        </p>
      </div>

      {/* Cards de estatísticas — placeholder para MVP */}
      <section aria-label="Resumo">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon="👶"
            label="Pacientes ativos"
            value="—"
            description="Nenhum cadastrado ainda"
          />
          <StatCard
            icon="📋"
            label="Consultas hoje"
            value="—"
            description="Agenda ainda não configurada"
          />
          <StatCard
            icon="⚠️"
            label="Alertas pendentes"
            value="—"
            description="Sem alertas no momento"
          />
          <StatCard
            icon="💉"
            label="Vacinas atrasadas"
            value="—"
            description="Aguardando pacientes"
          />
        </div>
      </section>

      {/* Ações rápidas */}
      <Card>
        <CardHeader
          title="Primeiros passos"
          description="Configure seu ambiente para começar a usar o PueriCare."
        />
        <ol className="flex flex-col gap-3">
          {[
            { step: '1', text: 'Cadastre o primeiro paciente', href: '/pacientes/novo' },
            { step: '2', text: 'Registre uma consulta de puericultura', href: '/consultas/nova' },
            { step: '3', text: 'Adicione o calendário vacinal', href: '/vacinacao' },
          ].map(({ step, text, href }) => (
            <li key={step} className="flex items-center gap-3">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: 'var(--color-primary)' }}
              >
                {step}
              </div>
              <a
                href={href}
                className="text-sm font-medium transition-colors hover:underline"
                style={{ color: 'var(--color-primary)' }}
              >
                {text}
              </a>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
