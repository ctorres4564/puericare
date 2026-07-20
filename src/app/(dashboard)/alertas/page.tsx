'use client';

export const dynamic = 'force-dynamic';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { runAlertEngineForProfessional } from '@/lib/alerts/engine';
import {
  listAlertsByProfessional,
  resolveAlert,
} from '@/services/alertService';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { ClinicalAlert, AlertCategory, AlertStatus } from '@/lib/types';

// ─── Labels e estilos ────────────────────────────────────────────────────────

const categoryLabel: Record<AlertCategory, string> = {
  HIGH_PRIORITY: 'Alta prioridade',
  ATTENTION:     'Atenção',
  INFO:          'Informativo',
};

const categoryColor: Record<AlertCategory, string> = {
  HIGH_PRIORITY: 'var(--color-danger, #ef4444)',
  ATTENTION:     'var(--color-warning, #f59e0b)',
  INFO:          'var(--color-info, #3b82f6)',
};

const categoryIcon: Record<AlertCategory, string> = {
  HIGH_PRIORITY: '🔴',
  ATTENTION:     '🟡',
  INFO:          'ℹ️',
};

const statusLabel: Record<AlertStatus, string> = {
  active:    'Ativo',
  resolved:  'Resolvido',
  dismissed: 'Ignorado',
};

// ─── Componente de card de alerta ─────────────────────────────────────────────

interface AlertCardProps {
  alert: ClinicalAlert;
  onResolve: (id: string, status: 'resolved' | 'dismissed', note?: string) => void;
  resolving: string | null;
}

function AlertCard({ alert, onResolve, resolving }: AlertCardProps) {
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState<'resolved' | 'dismissed' | null>(null);
  const isResolving = resolving === alert.id;

  const handleConfirm = () => {
    if (!showNoteInput) return;
    onResolve(alert.id, showNoteInput, note.trim() || undefined);
    setShowNoteInput(null);
    setNote('');
  };

  return (
    <div
      className="rounded-xl border p-4 transition-all"
      style={{
        background:   'var(--color-bg-card)',
        borderColor:  alert.status === 'active' ? categoryColor[alert.category] : 'var(--color-border)',
        borderLeftWidth: alert.status === 'active' ? '4px' : '1px',
        opacity: alert.status !== 'active' ? 0.6 : 1,
      }}
    >
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{categoryIcon[alert.category]}</span>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
              {alert.title}
            </p>
            <p className="text-xs" style={{ color: categoryColor[alert.category] }}>
              {categoryLabel[alert.category]} · {alert.childName}
            </p>
          </div>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            background: 'var(--color-primary-light)',
            color:      'var(--color-text-muted)',
          }}
        >
          {statusLabel[alert.status]}
        </span>
      </div>

      {/* Descrição */}
      <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        {alert.description}
      </p>

      {/* Fonte clínica */}
      <p className="mt-1 text-xs italic" style={{ color: 'var(--color-text-subtle, var(--color-text-muted))' }}>
        Fonte: {alert.clinicalSource}
      </p>

      {/* Resolução — só para alertas ativos */}
      {alert.status === 'active' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {showNoteInput ? (
            <div className="flex w-full flex-col gap-2">
              <input
                type="text"
                placeholder={showNoteInput === 'resolved' ? 'Nota de resolução (opcional)' : 'Motivo para ignorar (opcional)'}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border px-3 py-1.5 text-sm"
                style={{
                  background:   'var(--color-bg)',
                  borderColor:  'var(--color-border)',
                  color:        'var(--color-text)',
                }}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleConfirm} disabled={isResolving}>
                  {isResolving ? 'Salvando...' : 'Confirmar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowNoteInput(null); setNote(''); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button size="sm" onClick={() => setShowNoteInput('resolved')} disabled={isResolving}>
                ✓ Resolver
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNoteInput('dismissed')} disabled={isResolving}>
                Ignorar
              </Button>
              <Button size="sm" variant="secondary" href={`/pacientes/${alert.childId}/consultas`}>
                Ver paciente
              </Button>
            </>
          )}
        </div>
      )}

      {/* Nota de resolução */}
      {alert.resolutionNote && (
        <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          📝 {alert.resolutionNote}
        </p>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

type FilterStatus = 'active' | 'all';
type FilterCategory = 'all' | AlertCategory;

export default function AlertasPage() {
  const { userProfile } = useAuth();

  const [alerts, setAlerts] = useState<ClinicalAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('active');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');

  // Recarrega a lista sem mexer no estado de loading inicial — usada após
  // rodar o motor de alertas (evento de clique, não efeito).
  const refreshAlerts = useCallback(async () => {
    if (!userProfile) return;
    const all = await listAlertsByProfessional(userProfile.uid);
    setAlerts(all);
  }, [userProfile]);

  useEffect(() => {
    if (!userProfile) return;
    (async () => {
      try {
        const all = await listAlertsByProfessional(userProfile.uid);
        setAlerts(all);
      } catch {
        setError('Não foi possível carregar os alertas.');
      } finally {
        setLoading(false);
      }
    })();
  }, [userProfile]);

  const handleRunEngine = async () => {
    if (!userProfile) return;
    setRunning(true);
    setError(null);
    try {
      await runAlertEngineForProfessional(userProfile.uid);
      await refreshAlerts();
    } catch {
      setError('Erro ao executar o motor de alertas. Tente novamente.');
    } finally {
      setRunning(false);
    }
  };

  const handleResolve = async (id: string, status: 'resolved' | 'dismissed', note?: string) => {
    setResolving(id);
    try {
      await resolveAlert(id, { status, resolutionNote: note });
      setAlerts((prev) => prev.map((a) =>
        a.id === id
          ? { ...a, status, resolvedAt: new Date().toISOString(), resolutionNote: note }
          : a
      ));
    } catch {
      setError('Não foi possível atualizar o alerta. Tente novamente.');
    } finally {
      setResolving(null);
    }
  };

  const filtered = useMemo(() => {
    return alerts
      .filter((a) => filterStatus === 'all' || a.status === filterStatus)
      .filter((a) => filterCategory === 'all' || a.category === filterCategory)
      .sort((a, b) => {
        const order: Record<AlertCategory, number> = { HIGH_PRIORITY: 0, ATTENTION: 1, INFO: 2 };
        return (order[a.category] ?? 3) - (order[b.category] ?? 3);
      });
  }, [alerts, filterStatus, filterCategory]);

  const activeCount = alerts.filter((a) => a.status === 'active').length;

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            Alertas clínicos
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {activeCount > 0
              ? `${activeCount} alerta${activeCount > 1 ? 's' : ''} ativo${activeCount > 1 ? 's' : ''}`
              : 'Nenhum alerta ativo'}
          </p>
        </div>
        <Button onClick={handleRunEngine} disabled={running}>
          {running ? '⏳ Verificando...' : '🔍 Verificar alertas agora'}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-2">
          {(['active', 'all'] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="rounded-full px-3 py-1 text-sm font-medium transition-colors"
              style={{
                background: filterStatus === s ? 'var(--color-primary)' : 'var(--color-bg-card)',
                color:      filterStatus === s ? '#fff' : 'var(--color-text-muted)',
                border:     '1px solid var(--color-border)',
              }}
            >
              {s === 'active' ? 'Ativos' : 'Todos'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(['all', 'HIGH_PRIORITY', 'ATTENTION', 'INFO'] as FilterCategory[]).map((c) => (
            <button
              key={c}
              onClick={() => setFilterCategory(c)}
              className="rounded-full px-3 py-1 text-sm font-medium transition-colors"
              style={{
                background: filterCategory === c ? 'var(--color-primary)' : 'var(--color-bg-card)',
                color:      filterCategory === c ? '#fff' : 'var(--color-text-muted)',
                border:     '1px solid var(--color-border)',
              }}
            >
              {c === 'all' ? 'Todos' : `${categoryIcon[c as AlertCategory]} ${categoryLabel[c as AlertCategory]}`}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de alertas */}
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {alerts.length === 0
              ? 'Nenhum alerta encontrado. Clique em "Verificar alertas agora" para analisar seus pacientes.'
              : 'Nenhum alerta corresponde aos filtros selecionados.'}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onResolve={handleResolve}
              resolving={resolving}
            />
          ))}
        </div>
      )}

      {/* Legenda */}
      <Card>
        <CardHeader title="Sobre os alertas" />
        <div className="flex flex-col gap-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <p>🔴 <strong>Alta prioridade</strong> — requer atenção imediata</p>
          <p>🟡 <strong>Atenção</strong> — acompanhar em breve</p>
          <p>ℹ️ <strong>Informativo</strong> — sem urgência</p>
          <p className="mt-2 text-xs">
            Todos os alertas são baseados em regras determinísticas com fontes clínicas explícitas.
            O sistema não emite diagnósticos e não substitui a avaliação do profissional.
          </p>
        </div>
      </Card>
    </div>
  );
}
