'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getChild } from '@/services/childService';
import { listVaccinationRecordsByProfessional } from '@/services/vaccinationService';
import { formatAgeInDays } from '@/lib/consultations/ageInDays';
import { vaccinationStatusLabels, vaccinationStatusBadgeClasses } from '@/lib/vaccination/labels';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import type { Child, VaccinationRecord } from '@/lib/types';

export default function VacinacaoPage() {
  const { id: childId } = useParams<{ id: string }>();
  const { userProfile } = useAuth();

  const [child, setChild] = useState<Child | null>(null);
  const [records, setRecords] = useState<VaccinationRecord[]>([]);
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
        const all = await listVaccinationRecordsByProfessional(userProfile.uid);
        setRecords(all.filter((r) => r.childId === childId).reverse());
      } catch {
        setError('Não foi possível carregar o histórico de vacinação.');
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
            {loading ? 'Vacinação' : child ? `Vacinação — ${child.fullName}` : 'Vacinação'}
          </h2>
          {child?.active && <Button href={`/pacientes/${childId}/vacinacao/nova`}>+ Novo registro</Button>}
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
                Nenhum registro de vacinação ainda.
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
                        {r.vaccineName ? ` · ${r.vaccineName}${r.doseDescription ? ` (${r.doseDescription})` : ''}` : ''}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${vaccinationStatusBadgeClasses[r.status]}`}
                    >
                      {vaccinationStatusLabels[r.status]}
                    </span>
                  </div>
                  {r.observations && (
                    <p className="mt-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      {r.observations}
                    </p>
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
