'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { listChildrenByProfessional, deactivateChild } from '@/services/childService';
import { filterActiveChildren, calculateAge } from '@/lib/children/childList';
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

  const filtered = useMemo(() => filterActiveChildren(children, search), [children, search]);

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

              <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                    <Button variant="secondary" size="sm" href={`/pacientes/${child.id}/consultas`}>
                      Linha do tempo
                    </Button>
                    <Button variant="secondary" size="sm" href={`/pacientes/${child.id}/crescimento`}>
                      Crescimento
                    </Button>
                    <Button variant="secondary" size="sm" href={`/pacientes/${child.id}/desenvolvimento`}>
                      Desenvolvimento
                    </Button>
                    {child.active && (
                      <Button size="sm" href={`/pacientes/${child.id}/consultas/nova`}>
                        Iniciar consulta
                      </Button>
                    )}
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
