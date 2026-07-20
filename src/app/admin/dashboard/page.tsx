'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { listUsers, setUserActive, setUserRole } from '@/services/userService';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';
import type { UserProfile, UserRole } from '@/lib/types';

/**
 * Painel administrativo mínimo (Sprint A): listar usuários, ativar/bloquear
 * contas e alterar papel entre PROFESSIONAL e CAREGIVER.
 *
 * Promoção a ADMIN NÃO é oferecida pela UI — o bootstrap do primeiro ADMIN
 * é manual no console do Firebase e as regras do Firestore bloqueiam
 * autopromoção (ver firestore.rules, match /users/{userId}).
 *
 * Esta rota fica fora do grupo (dashboard), que é exclusivo do profissional,
 * então tem guarda própria de autenticação e de papel.
 */

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  PROFESSIONAL: 'Profissional',
  CAREGIVER: 'Responsável',
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading, logout } = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!userProfile || userProfile.role !== 'ADMIN') return;
    (async () => {
      try {
        setUsers(await listUsers());
      } catch {
        setError('Não foi possível carregar a lista de usuários.');
      } finally {
        setLoading(false);
      }
    })();
  }, [userProfile]);

  const handleToggleActive = async (target: UserProfile) => {
    setUpdatingUid(target.uid);
    setError(null);
    try {
      await setUserActive(target.uid, !target.active);
      setUsers((prev) =>
        prev.map((u) => (u.uid === target.uid ? { ...u, active: !target.active } : u))
      );
    } catch {
      setError('Não foi possível atualizar o status da conta.');
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleChangeRole = async (target: UserProfile, role: UserRole) => {
    setUpdatingUid(target.uid);
    setError(null);
    try {
      await setUserRole(target.uid, role);
      setUsers((prev) => prev.map((u) => (u.uid === target.uid ? { ...u, role } : u)));
    } catch {
      setError('Não foi possível alterar o papel do usuário.');
    } finally {
      setUpdatingUid(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Verificando acesso...
        </p>
      </div>
    );
  }

  if (!userProfile || userProfile.role !== 'ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ background: 'var(--color-bg)' }}>
        <div className="w-full max-w-md">
          <Alert variant="error" title="Acesso restrito">
            Esta área é exclusiva para administradores do sistema.
          </Alert>
          <div className="mt-4 flex justify-center gap-3">
            <Button variant="secondary" href="/dashboard">Ir para o dashboard</Button>
            <Button
              variant="ghost"
              onClick={async () => { await logout(); router.push('/login'); }}
            >
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--color-bg)' }}>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              Administração de usuários
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={async () => { await logout(); router.push('/login'); }}
          >
            Sair
          </Button>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Carregando...
          </p>
        ) : users.length === 0 ? (
          <Card>
            <p className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Nenhum usuário cadastrado.
            </p>
          </Card>
        ) : (
          <Card padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                    {['Nome', 'E-mail', 'Papel', 'Status', 'Ações'].map((h) => (
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
                  {users.map((u) => (
                    <tr key={u.uid} className="border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-4 py-3" style={{ color: 'var(--color-text)' }}>
                        {u.displayName}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>
                        {u.email}
                      </td>
                      <td className="px-4 py-3">
                        {u.role === 'ADMIN' ? (
                          <span style={{ color: 'var(--color-text)' }}>{roleLabels.ADMIN}</span>
                        ) : (
                          <Select
                            aria-label={`Papel de ${u.displayName}`}
                            value={u.role}
                            disabled={updatingUid === u.uid}
                            onChange={(e) => handleChangeRole(u, e.target.value as UserRole)}
                          >
                            <option value="PROFESSIONAL">{roleLabels.PROFESSIONAL}</option>
                            <option value="CAREGIVER">{roleLabels.CAREGIVER}</option>
                          </Select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            u.active
                              ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {u.active ? 'Ativo' : 'Bloqueado'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.role !== 'ADMIN' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={updatingUid === u.uid}
                            onClick={() => handleToggleActive(u)}
                          >
                            {u.active ? 'Bloquear' : 'Reativar'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title="Sobre este painel" />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Alterações de papel e bloqueio têm efeito imediato nas permissões do Firestore.
            Contas bloqueadas (inativas) não conseguem acessar o sistema. A criação de novos
            administradores não é permitida pela interface — ver firestore.rules.
          </p>
        </Card>
      </div>
    </div>
  );
}
