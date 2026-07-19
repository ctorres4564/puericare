'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getChild } from '@/services/childService';
import { listGrowthMeasurementsByProfessional } from '@/services/growthService';
import { formatAgeInDays } from '@/lib/consultations/ageInDays';
import { GrowthChart } from '@/components/growth/GrowthChart';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import type { Child, GrowthMeasurement } from '@/lib/types';

export default function CrescimentoPage() {
  const { id: childId } = useParams<{ id: string }>();
  const { userProfile } = useAuth();

  const [child, setChild] = useState<Child | null>(null);
  const [measurements, setMeasurements] = useState<GrowthMeasurement[]>([]);
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

        const all = await listGrowthMeasurementsByProfessional(userProfile.uid);
        setMeasurements(all.filter((m) => m.childId === childId));
      } catch {
        setError('Não foi possível carregar o histórico de crescimento.');
      } finally {
        setLoading(false);
      }
    })();
  }, [childId, userProfile]);

  const weightPoints = measurements
    .filter((m) => m.weightKg !== undefined)
    .map((m) => ({ date: m.measurementDate, value: m.weightKg as number }));
  const heightPoints = measurements
    .filter((m) => m.heightCm !== undefined)
    .map((m) => ({ date: m.measurementDate, value: m.heightCm as number }));
  const headPoints = measurements
    .filter((m) => m.headCircumferenceCm !== undefined)
    .map((m) => ({ date: m.measurementDate, value: m.headCircumferenceCm as number }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/pacientes" className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
          ← Voltar para pacientes
        </Link>
        <div className="mt-2 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            {loading ? 'Crescimento' : child ? `Crescimento — ${child.fullName}` : 'Crescimento'}
          </h2>
          {child?.active && <Button href={`/pacientes/${childId}/crescimento/nova`}>+ Nova medição</Button>}
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
              Paciente inativo — não é possível registrar novas medições. O histórico abaixo é preservado.
            </Alert>
          )}

          {measurements.length === 0 ? (
            <Card>
              <p className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Nenhuma medição registrada ainda.
              </p>
            </Card>
          ) : (
            <>
              <Card>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <GrowthChart title="Peso" unit="kg" points={weightPoints} />
                  <GrowthChart title="Comprimento/altura" unit="cm" points={heightPoints} />
                  <GrowthChart title="Perímetro cefálico" unit="cm" points={headPoints} />
                </div>
              </Card>

              <Card padded={false}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                        {['Data', 'Idade', 'Peso (kg)', 'Compr./altura (cm)', 'PC (cm)', 'IMC'].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left font-medium"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...measurements].reverse().map((m) => (
                        <tr key={m.id} className="border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                          <td className="px-4 py-3" style={{ color: 'var(--color-text)' }}>
                            {new Date(m.measurementDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>
                            {formatAgeInDays(m.ageInDays)}
                          </td>
                          <td className="px-4 py-3" style={{ color: 'var(--color-text)' }}>{m.weightKg ?? '—'}</td>
                          <td className="px-4 py-3" style={{ color: 'var(--color-text)' }}>{m.heightCm ?? '—'}</td>
                          <td className="px-4 py-3" style={{ color: 'var(--color-text)' }}>{m.headCircumferenceCm ?? '—'}</td>
                          <td className="px-4 py-3" style={{ color: 'var(--color-text)' }}>{m.bmi ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
