'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { listReportsByChild, deleteDraftReport } from '@/services/reportService';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import type { ClinicalReportRecord } from '@/lib/types';

/**
 * Histórico de relatórios clínicos de um paciente — Sprint B.4.
 *
 * Lista rascunho (no máximo um por vez, "em andamento") e todos os
 * relatórios emitidos, mais recente primeiro. Nenhuma versão emitida é
 * recalculada aqui — cada uma reflete exatamente o snapshot congelado no
 * momento em que foi emitida.
 */
export default function RelatoriosHistoricoPage() {
  const { id: childId } = useParams<{ id: string }>();
  const { userProfile } = useAuth();

  const [reports, setReports] = useState<ClinicalReportRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!userProfile) return;
    (async () => {
      try {
        const list = await listReportsByChild(childId, userProfile.uid);
        setReports(list);
      } catch {
        setError('Não foi possível carregar o histórico de relatórios.');
      }
    })();
  }, [childId, userProfile, reloadToken]);

  async function handleDeleteDraft(reportId: string) {
    if (!userProfile) return;
    setDeletingId(reportId);
    try {
      await deleteDraftReport(reportId, userProfile.uid);
      setReloadToken((n) => n + 1);
    } catch {
      setError('Não foi possível excluir o rascunho.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/pacientes/${childId}/consultas`}
          className="text-sm font-medium"
          style={{ color: 'var(--color-primary)' }}
        >
          ← Voltar para o paciente
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            Histórico de relatórios
          </h2>
          <Button href={`/pacientes/${childId}/relatorio`}>+ Novo relatório</Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {reports === null ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Carregando...
        </p>
      ) : reports.length === 0 ? (
        <Card>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Nenhum relatório criado ainda para este paciente.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                      {r.status === 'ISSUED' ? `${r.title} — v${r.version}` : `${r.title} (rascunho)`}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === 'ISSUED'
                          ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200'
                          : 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                      }`}
                    >
                      {r.status === 'ISSUED' ? 'Emitido' : 'Em andamento'}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {r.status === 'ISSUED'
                      ? `Emitido em ${new Date(r.issuedAt!).toLocaleString('pt-BR')}`
                      : `Atualizado em ${new Date(r.updatedAt).toLocaleString('pt-BR')}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {r.status === 'ISSUED' ? (
                    <Link
                      href={`/pacientes/${childId}/relatorio?reportId=${r.id}`}
                      className="text-sm font-medium"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      Visualizar
                    </Link>
                  ) : (
                    <>
                      <Link
                        href={`/pacientes/${childId}/relatorio`}
                        className="text-sm font-medium"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        Continuar edição
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDraft(r.id)}
                        loading={deletingId === r.id}
                        disabled={deletingId !== null}
                      >
                        Excluir rascunho
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
