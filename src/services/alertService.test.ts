/**
 * services/alertService.test.ts — Testes do CRUD de alertas no Firestore.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  upsertAlert,
  resolveAlert,
  listAlertsByProfessional,
  listActiveAlertsByChild,
  countActiveAlerts,
  buildAlertId,
} from './alertService';
import type { CreateAlertPayload } from '@/lib/types';

vi.mock('firebase/firestore', () => import('../test/mocks/firestore'));
vi.mock('@/lib/firebase/firestore', () => ({ getFirebaseDb: () => ({}) }));

const { __reset } = await import('../test/mocks/firestore');

beforeEach(() => __reset());

function makePayload(overrides: Partial<CreateAlertPayload> = {}): CreateAlertPayload {
  return {
    childId: 'child-1',
    childName: 'Maria Silva',
    professionalId: 'prof-1',
    ruleId: 'R1_NO_CONSULT_UNDER_24M',
    category: 'ATTENTION',
    title: 'Consulta em atraso',
    description: 'Sem consulta há mais de 90 dias.',
    clinicalSource: 'SBP — Manual de Puericultura (2023)',
    status: 'active',
    detectedAt: '2026-07-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildAlertId', () => {
  it('gera ID determinístico a partir de childId + ruleId', () => {
    expect(buildAlertId('child-1', 'R1_NO_CONSULT_UNDER_24M')).toBe('child-1_R1_NO_CONSULT_UNDER_24M');
  });
});

describe('upsertAlert', () => {
  it('cria alerta com ID determinístico', async () => {
    const payload = makePayload();
    const alert = await upsertAlert(payload);
    expect(alert.id).toBe('child-1_R1_NO_CONSULT_UNDER_24M');
    expect(alert.status).toBe('active');
    expect(alert.childName).toBe('Maria Silva');
  });

  it('atualiza alerta existente (upsert)', async () => {
    await upsertAlert(makePayload({ title: 'Título original' }));
    const updated = await upsertAlert(makePayload({ title: 'Título atualizado' }));
    expect(updated.title).toBe('Título atualizado');
  });
});

describe('resolveAlert', () => {
  it('marca alerta como resolved com nota', async () => {
    const alert = await upsertAlert(makePayload());
    await resolveAlert(alert.id, { status: 'resolved', resolutionNote: 'Consulta realizada.' });

    const alerts = await listAlertsByProfessional('prof-1', 'resolved');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].resolutionNote).toBe('Consulta realizada.');
    expect(alerts[0].resolvedAt).toBeDefined();
  });

  it('marca alerta como dismissed', async () => {
    const alert = await upsertAlert(makePayload());
    await resolveAlert(alert.id, { status: 'dismissed' });

    const active = await listAlertsByProfessional('prof-1', 'active');
    expect(active).toHaveLength(0);
  });
});

describe('listAlertsByProfessional', () => {
  it('lista todos os alertas do profissional', async () => {
    await upsertAlert(makePayload({ ruleId: 'R1_NO_CONSULT_UNDER_24M' }));
    await upsertAlert(makePayload({ ruleId: 'R3_LATE_VACCINATION' }));

    const all = await listAlertsByProfessional('prof-1');
    expect(all).toHaveLength(2);
  });

  it('filtra por status', async () => {
    await upsertAlert(makePayload({ ruleId: 'R1_NO_CONSULT_UNDER_24M' }));
    const alert2 = await upsertAlert(makePayload({ ruleId: 'R3_LATE_VACCINATION' }));
    await resolveAlert(alert2.id, { status: 'resolved' });

    const active = await listAlertsByProfessional('prof-1', 'active');
    expect(active).toHaveLength(1);
    expect(active[0].ruleId).toBe('R1_NO_CONSULT_UNDER_24M');
  });

  it('não retorna alertas de outro profissional', async () => {
    await upsertAlert(makePayload({ professionalId: 'prof-2', childId: 'child-2' }));
    const alerts = await listAlertsByProfessional('prof-1');
    expect(alerts).toHaveLength(0);
  });
});

describe('listActiveAlertsByChild', () => {
  it('lista alertas ativos de uma criança', async () => {
    await upsertAlert(makePayload({ ruleId: 'R1_NO_CONSULT_UNDER_24M' }));
    await upsertAlert(makePayload({ ruleId: 'R3_LATE_VACCINATION' }));

    const alerts = await listActiveAlertsByChild('child-1');
    expect(alerts).toHaveLength(2);
  });

  it('não retorna alertas resolvidos', async () => {
    const alert = await upsertAlert(makePayload());
    await resolveAlert(alert.id, { status: 'resolved' });

    const active = await listActiveAlertsByChild('child-1');
    expect(active).toHaveLength(0);
  });
});

describe('countActiveAlerts', () => {
  it('conta alertas ativos do profissional', async () => {
    await upsertAlert(makePayload({ ruleId: 'R1_NO_CONSULT_UNDER_24M' }));
    await upsertAlert(makePayload({ ruleId: 'R3_LATE_VACCINATION' }));
    await upsertAlert(makePayload({ ruleId: 'R4_NO_GROWTH_90D' }));

    const count = await countActiveAlerts('prof-1');
    expect(count).toBe(3);
  });

  it('retorna 0 sem alertas', async () => {
    expect(await countActiveAlerts('prof-1')).toBe(0);
  });
});
