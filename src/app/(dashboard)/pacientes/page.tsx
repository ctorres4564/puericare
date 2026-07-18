'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { listChildrenByProfessional, deactivateChild } from '@/services/childService';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import type { Child, SexAtBirth } from '@/lib/types';

const sexLabels: Record<SexAtBirth, string> = {
  female: 'Feminino',
  male: 'Masculino',
  other: 'Outro',
  not_informed: 'Não informado',
};

function calculateAge(birthDate: string): string {
  const birth = new Date(birthDate);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 1) return 'recém-nascido(a)';
  if (months < 24) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'ano' : 'anos'}`;
}

export default function PacientesPage() {
  const { userProfile } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    listChildrenByProfessional(userProfile.uid)
      .then(setChildren)
      .catch(() => setError('Não foi possível carregar os pacientes.'))
      .finally(() => setLoading(false));
  }, [userProfile]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return children
      .filter((c) => c.active)
      .filter((c) => !term || c.fullName.toLowerCase().includes(term));
  }, [children, search]);

  const handleDeactivate = async (id: string) => {
    setConfirmingId(null);
    try {
      await deactivateChild(id);
      setChildren((prev) => prev.map((c) => (c.id === id ? { ...c, active: false } : c)));
    } catch {
      setError('Não foi possível excluir o cadastro. Tente novamente.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          Pacientes
        </h2>
        <Button href="/pacientes/novo">+ Novo paciente</Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Input
        placeholder="Buscar por nome..."
        aria-label="Buscar paciente por nome"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Carregando...
        </p>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {children.length === 0
              ? 'Nenhum paciente cadastrado ainda.'
              : 'Nenhum paciente encontrado para essa busca.'}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((child) => (
            <Card key={child.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                  {child.fullName}
                </p>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {calculateAge(child.birthDate)} · {sexLabels[child.sexAtBirth]} · Responsável: {child.caregiverName}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {confirmingId === child.id ? (
                  <>
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      Excluir cadastro?
                    </span>
                    <Button variant="danger" size="sm" onClick={() => handleDeactivate(child.id)}>
                      Confirmar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmingId(null)}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="secondary" size="sm" href={`/pacientes/${child.id}/editar`}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmingId(child.id)}>
                      Excluir
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
