'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getChild } from '@/services/childService';
import { listSleepRecordsByProfessional } from '@/services/sleepService';
import { formatAgeInDays } from '@/lib/consultations/ageInDays';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import type { Child, SleepRecord } from '@/lib/types';

function sleepSummary(r: SleepRecord): string {
  const parts: string[] = [];
  if (r.bedtime) parts.push(`Dorme às ${r.bedtime}`);
  if (r.nightWakings !== undefined) parts.push(`${r.nightWakings} despertar(es)`);
  if (r.sleepDurationHours !== undefined) parts.push(`${r.sleepDurationHours}h de sono`);
  return parts.join(' · ');
}

export default function SonoPage() {
  const { id: childId } = useParams<{ id: string }>();
  const { userProfile } = useAuth();

  const [child, setChild] = useState<Child | null>(null);
  const [records, setRecords] = useState<SleepRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    (async () => {
      try {
        const foundChild = await getChild(childId);
        if (!foundChild || foundChild.professionalId !== userProfile.uid) {
          setNotFound(true);
          return;
        }
        setChild(foundChild);
        const all = await listSleepRecordsByProfessional(userProfile.uid);
        setRecords(all.filter((r) => r.childId === childId).reverse());
      } catch {
        setError('Não foi possível carregar o histórico de sono.');
      } finally {
        setLoading(false);
      }
    })();
  }, [childId, userProfile]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/pacientes" className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
          ← Voltar para pacientes
        </Link>
        <div className="mt-2 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            {loading ? 'Sono' : child ? `Sono — ${child.fullName}` : 'Sono'}
          </h2>
          {child?.active && <Button href={`/pacientes/${childId}/sono/nova`}>+ Novo registro</Button>}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Carregando...
        </p>
      ) : notFound ? (
        <Alert variant="error" title="Paciente não encontrado">
          Este cadastro não existe ou não pertence à sua conta.
        </Alert>
      ) : (
        <>
          {child && !child.active && (
            <Alert variant="warning">
              Paciente inativo — não é possível registrar novas observações. O histórico abaixo é preservado.
            </Alert>
          )}

          {records.length === 0 ? (
            <Card>
              <p className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Nenhum registro de sono ainda.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {records.map((r) => (
                <Card key={r.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                        {new Date(r.recordDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {formatAgeInDays(r.ageInDays)}
                        {sleepSummary(r) ? ` · ${sleepSummary(r)}` : ''}
                      </p>
                    </div>
                    {r.requiresFollowUp && (
                      <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        Necessita acompanhamento
                      </span>
                    )}
                  </div>
                  {(r.naps || r.routine || r.difficulties || r.observations) && (
                    <dl className="mt-3 flex flex-col gap-2 text-sm">
                      {r.naps && (
                        <div>
                          <dt className="font-medium" style={{ color: 'var(--color-text)' }}>Cochilos</dt>
                          <dd style={{ color: 'var(--color-text-muted)' }}>{r.naps}</dd>
                        </div>
                      )}
                      {r.routine && (
                        <div>
                          <dt className="font-medium" style={{ color: 'var(--color-text)' }}>Rotina</dt>
                          <dd style={{ color: 'var(--color-text-muted)' }}>{r.routine}</dd>
                        </div>
                      )}
                      {r.difficulties && (
                        <div>
                          <dt className="font-medium" style={{ color: 'var(--color-text)' }}>Dificuldades</dt>
                          <dd style={{ color: 'var(--color-text-muted)' }}>{r.difficulties}</dd>
                        </div>
                      )}
                      {r.observations && (
                        <div>
                          <dt className="font-medium" style={{ color: 'var(--color-text)' }}>Observações</dt>
                          <dd style={{ color: 'var(--color-text-muted)' }}>{r.observations}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
