'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { listChildrenByProfessional } from '@/services/childService';
import { listConsultationsByProfessional } from '@/services/consultationService';
import { listDevelopmentAssessmentsByProfessional } from '@/services/developmentService';
import { listFeedingRecordsByProfessional } from '@/services/feedingService';
import { listSleepRecordsByProfessional } from '@/services/sleepService';
import { listVaccinationRecordsByProfessional } from '@/services/vaccinationService';
import { countActiveAlerts } from '@/services/alertService';
import {
  countActiveChildren,
  countConsultationsOnDate,
  countRequiringFollowUp,
  countChildrenWithLatestVaccinationStatus,
  recentConsultations,
} from '@/lib/dashboard/stats';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { Child, Consultation, ConsultationStatus } from '@/lib/types';

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

const consultationStatusLabels: Record<ConsultationStatus, string> = {
  draft: 'Rascunho',
  completed: 'Finalizada',
  cancelled: 'Cancelada',
};

export default function DashboardPage() {
  const { userProfile } = useAuth();

  const [children, setChildren] = useState<Child[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [followUpCount, setFollowUpCount] = useState(0);
  const [lateVaccinationCount, setLateVaccinationCount] = useState(0);
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    (async () => {
      try {
        // Usa allSettled para que falhas individuais (ex: regras Firestore) não bloqueiem tudo
        const results = await Promise.allSettled([
          listChildrenByProfessional(userProfile.uid),
          listConsultationsByProfessional(userProfile.uid),
          listDevelopmentAssessmentsByProfessional(userProfile.uid),
          listFeedingRecordsByProfessional(userProfile.uid),
          listSleepRecordsByProfessional(userProfile.uid),
          listVaccinationRecordsByProfessional(userProfile.uid),
          countActiveAlerts(userProfile.uid),
        ]);

        const getValue = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
          r.status === 'fulfilled' ? r.value : fallback;

        const allChildren     = getValue(results[0] as PromiseSettledResult<Child[]>, []);
        const allConsultations = getValue(results[1] as PromiseSettledResult<Consultation[]>, []);
        const allDevelopment  = getValue(results[2] as PromiseSettledResult<unknown[]>, []);
        const allFeeding      = getValue(results[3] as PromiseSettledResult<unknown[]>, []);
        const allSleep        = getValue(results[4] as PromiseSettledResult<unknown[]>, []);
        const allVaccination  = getValue(results[5] as PromiseSettledResult<unknown[]>, []);
        const alertCount      = getValue(results[6] as PromiseSettledResult<number>, 0);

        setChildren(allChildren);
        setConsultations(allConsultations);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setFollowUpCount(countRequiringFollowUp(allDevelopment as any, allFeeding as any, allSleep as any));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setLateVaccinationCount(countChildrenWithLatestVaccinationStatus(allVaccination as any, 'atrasada'));
        setActiveAlertCount(alertCount);

        // Verifica se alguma query falhou e mostra aviso (não erro bloqueante)
        const queryLabels = [
          'children', 'consultations', 'developmentAssessments',
          'feedingRecords', 'sleepRecords', 'vaccinationRecords', 'clinicalAlerts',
        ];
        const failed = results
          .map((r, i) => ({ r, label: queryLabels[i] }))
          .filter(({ r }) => r.status === 'rejected') as { r: PromiseRejectedResult; label: string }[];

        if (failed.length > 0) {
          failed.forEach(({ r, label }) => {
            const err = r.reason as { code?: string; message?: string };
            console.error(`[Dashboard] Falha ao ler "${label}": ${err?.code ?? '?'} — ${err?.message ?? r.reason}`);
          });
          const firstCode = (failed[0].r.reason as { code?: string })?.code ?? 'erro desconhecido';
          setError(`Alguns dados podem estar incompletos (${failed.length} consulta(s) falharam — ${firstCode}). Veja o console do navegador (F12) para detalhes.`);
        }
      } catch (err) {
        console.error('[Dashboard] Erro ao carregar dados:', err);
        setError('Não foi possível carregar os dados do dashboard. Verifique se o perfil do usuário no Firestore está configurado corretamente.');
      } finally {
        setLoading(false);
      }
    })();
  }, [userProfile]);

  const childNames = useMemo(() => Object.fromEntries(children.map((c) => [c.id, c.fullName])), [children]);
  const today = new Date().toISOString().slice(0, 10);
  const activeChildrenCount = countActiveChildren(children);
  const consultationsToday = countConsultationsOnDate(consultations, today);
  const lastConsultations = useMemo(() => recentConsultations(consultations, 5), [consultations]);

  const firstName = userProfile?.displayName?.split(' ')[0] ?? 'Profissional';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho de boas-vindas + ações rápidas */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            {greeting}, {firstName}! 👋
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" href="/pacientes/novo">+ Novo paciente</Button>
          <Button href="/pacientes">+ Nova consulta</Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Cards de estatísticas — dados reais do profissional autenticado */}
      <section aria-label="Resumo">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon="👶"
            label="Pacientes ativos"
            value={loading ? '—' : activeChildrenCount}
            description={!loading && activeChildrenCount === 0 ? 'Nenhum cadastrado ainda' : undefined}
          />
          <StatCard
            icon="📋"
            label="Consultas hoje"
            value={loading ? '—' : consultationsToday}
          />
          <StatCard
            icon="📝"
            label="Necessitam acompanhamento"
            value={loading ? '—' : followUpCount}
            description="Sinalizados pelo profissional (desenvolvimento, alimentação, sono)"
          />
          <StatCard
            icon="💉"
            label="Vacinação atrasada"
            value={loading ? '—' : lateVaccinationCount}
            description="Segundo o último status registrado por criança"
          />
          <StatCard
            icon="🔔"
            label="Alertas ativos"
            value={loading ? '—' : activeAlertCount}
            description={activeAlertCount > 0 ? 'Clique para ver os alertas' : 'Nenhum alerta ativo'}
          />
        </div>
      </section>

      {/* Últimas consultas */}
      <Card>
        <CardHeader title="Últimas consultas" />
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Carregando...</p>
        ) : lastConsultations.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhuma consulta registrada ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2" role="list">
            {lastConsultations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/pacientes/${c.childId}/consultas/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--color-primary-light)]"
                >
                  <span style={{ color: 'var(--color-text)' }}>{childNames[c.childId] ?? 'Paciente'}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(c.consultationDate + 'T00:00:00').toLocaleDateString('pt-BR')} · {consultationStatusLabels[c.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Primeiros passos — só enquanto não há nenhum paciente cadastrado */}
      {!loading && children.length === 0 && (
        <Card>
          <CardHeader
            title="Primeiros passos"
            description="Configure seu ambiente para começar a usar o PueriCare."
          />
          <ol className="flex flex-col gap-3">
            {[
              { step: '1', text: 'Cadastre o primeiro paciente', href: '/pacientes/novo' },
              { step: '2', text: 'Registre uma consulta de puericultura', href: '/pacientes' },
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
      )}
    </div>
  );
}
