import { describe, test, expect, beforeEach } from 'vitest';

import { vi } from 'vitest';
vi.mock('firebase/firestore', () => import('../test/mocks/firestore'));
vi.mock('@/lib/firebase/firestore', () => ({ getFirebaseDb: () => ({}) }));

import { __reset } from '../test/mocks/firestore';
import { createChild } from './childService';
import { createGrowthMeasurement } from './growthService';
import {
  createDraftReport,
  getReport,
  listReportsByChild,
  getOrCreateDraftReport,
  updateDraftReport,
  issueReport,
  createNewVersion,
  deleteDraftReport,
  ReportConflictError,
} from './reportService';

const childPayload = {
  fullName: 'Maria Teste',
  birthDate: '2024-01-15',
  sexAtBirth: 'female' as const,
  caregiverName: 'Joana Responsável',
  contactPhone: '11988887777',
};

beforeEach(() => {
  __reset();
});

async function setupChild(professionalId = 'pro-1') {
  return createChild(professionalId, childPayload);
}

describe('createDraftReport', () => {
  test('cria um rascunho com version 0, status DRAFT e composição inicial', async () => {
    const child = await setupChild();
    const draft = await createDraftReport('pro-1', { childId: child.id });

    expect(draft.status).toBe('DRAFT');
    expect(draft.version).toBe(0);
    expect(draft.childId).toBe(child.id);
    expect(draft.professionalId).toBe('pro-1');
    expect(draft.title).toBe('Relatório Clínico de Acompanhamento');
    expect(draft.compositionSnapshot).toBeTruthy();
    expect(draft.clinicalDataSnapshot).toBeUndefined();
    expect(draft.pdfModelSnapshot).toBeUndefined();
    expect(draft.schemaVersion).toBe(1);
    expect(draft.rendererVersion).toBe('1');
  });

  test('rejeita paciente inexistente ou de outro profissional', async () => {
    const child = await setupChild('pro-1');
    await expect(createDraftReport('pro-2', { childId: child.id })).rejects.toThrow();
    await expect(createDraftReport('pro-1', { childId: 'nao-existe' })).rejects.toThrow();
  });
});

describe('getOrCreateDraftReport', () => {
  test('cria um rascunho na primeira chamada e reaproveita nas seguintes', async () => {
    const child = await setupChild();
    const first = await getOrCreateDraftReport('pro-1', child.id);
    const second = await getOrCreateDraftReport('pro-1', child.id);
    expect(second.id).toBe(first.id);

    const all = await listReportsByChild(child.id, 'pro-1');
    expect(all).toHaveLength(1);
  });
});

describe('updateDraftReport', () => {
  test('atualiza a composição e o updatedAt de um rascunho', async () => {
    const child = await setupChild();
    const draft = await createDraftReport('pro-1', { childId: child.id });

    const updated = await updateDraftReport(draft.id, 'pro-1', {
      composition: { ...draft.compositionSnapshot, narrative: { ...draft.compositionSnapshot.narrative, purpose: 'Acompanhamento de rotina' } },
      title: 'Relatório Clínico de Acompanhamento',
      expectedUpdatedAt: draft.updatedAt,
    });

    expect(updated.compositionSnapshot.narrative.purpose).toBe('Acompanhamento de rotina');
    expect(updated.updatedAt).not.toBe(draft.updatedAt);
  });

  test('lança ReportConflictError quando updatedAt não confere (edição em outra sessão)', async () => {
    const child = await setupChild();
    const draft = await createDraftReport('pro-1', { childId: child.id });

    await expect(
      updateDraftReport(draft.id, 'pro-1', {
        composition: draft.compositionSnapshot,
        title: draft.title,
        expectedUpdatedAt: '2000-01-01T00:00:00.000Z',
      })
    ).rejects.toThrow(ReportConflictError);
  });

  test('rejeita atualização por profissional que não é dono', async () => {
    const child = await setupChild('pro-1');
    const draft = await createDraftReport('pro-1', { childId: child.id });

    await expect(
      updateDraftReport(draft.id, 'pro-2', {
        composition: draft.compositionSnapshot,
        title: draft.title,
        expectedUpdatedAt: draft.updatedAt,
      })
    ).rejects.toThrow();
  });

  test('relatório emitido não pode ser editado (nem pelo dono)', async () => {
    const child = await setupChild();
    const draft = await createDraftReport('pro-1', { childId: child.id });
    const issued = await issueReport(draft.id, 'pro-1', { title: draft.title });

    await expect(
      updateDraftReport(issued.id, 'pro-1', {
        composition: issued.compositionSnapshot,
        title: 'Tentativa',
        expectedUpdatedAt: issued.updatedAt,
      })
    ).rejects.toThrow();
  });
});

describe('issueReport', () => {
  test('emite o relatório, congela o snapshot e atribui version 1', async () => {
    const child = await setupChild();
    await createGrowthMeasurement('pro-1', {
      childId: child.id,
      measurementDate: '2024-06-01',
      ageInDays: 138,
      weightKg: 7.5,
    });
    const draft = await createDraftReport('pro-1', { childId: child.id });

    const issued = await issueReport(draft.id, 'pro-1', { title: 'Relatório de Junho' });

    expect(issued.status).toBe('ISSUED');
    expect(issued.version).toBe(1);
    expect(issued.title).toBe('Relatório de Junho');
    expect(issued.issuedBy).toBe('pro-1');
    expect(issued.issuedAt).toBeTruthy();
    expect(issued.clinicalDataSnapshot).toBeTruthy();
    expect(issued.clinicalDataSnapshot!.growth.measurements).toHaveLength(1);
    expect(issued.pdfModelSnapshot).toBeTruthy();
    expect(issued.schemaVersion).toBe(1);
    expect(issued.rendererVersion).toBe('1');
  });

  test('rejeita emissão com título vazio', async () => {
    const child = await setupChild();
    const draft = await createDraftReport('pro-1', { childId: child.id });
    await expect(issueReport(draft.id, 'pro-1', { title: '   ' })).rejects.toThrow();
  });

  test('rejeita emissão por quem não é o profissional dono', async () => {
    const child = await setupChild('pro-1');
    const draft = await createDraftReport('pro-1', { childId: child.id });
    await expect(issueReport(draft.id, 'pro-2', { title: 'Título' })).rejects.toThrow();
  });

  test('rejeita emitir um relatório que já foi emitido', async () => {
    const child = await setupChild();
    const draft = await createDraftReport('pro-1', { childId: child.id });
    const issued = await issueReport(draft.id, 'pro-1', { title: 'Título' });
    await expect(issueReport(issued.id, 'pro-1', { title: 'Título' })).rejects.toThrow();
  });

  test('snapshot congelado: alterar o prontuário depois NÃO muda o relatório já emitido', async () => {
    const child = await setupChild();
    await createGrowthMeasurement('pro-1', {
      childId: child.id,
      measurementDate: '2024-06-01',
      ageInDays: 138,
      weightKg: 7.5,
    });
    const draft = await createDraftReport('pro-1', { childId: child.id });
    const issued = await issueReport(draft.id, 'pro-1', { title: 'Título' });

    // Novo dado clínico registrado DEPOIS da emissão.
    await createGrowthMeasurement('pro-1', {
      childId: child.id,
      measurementDate: '2024-09-01',
      ageInDays: 230,
      weightKg: 8.9,
    });

    const reloaded = await getReport(issued.id);
    expect(reloaded!.clinicalDataSnapshot!.growth.measurements).toHaveLength(1);
    expect(reloaded!.clinicalDataSnapshot!.growth.measurements[0].weightKg).toBe(7.5);
  });

  test('duas emissões concorrentes nunca recebem a mesma versão', async () => {
    const childA = await setupChild();
    const draftA1 = await createDraftReport('pro-1', { childId: childA.id });
    const draftA2 = await createDraftReport('pro-1', { childId: childA.id });

    const [issuedA1, issuedA2] = await Promise.all([
      issueReport(draftA1.id, 'pro-1', { title: 'V1' }),
      issueReport(draftA2.id, 'pro-1', { title: 'V2' }),
    ]);

    const versions = [issuedA1.version, issuedA2.version].sort();
    expect(versions).toEqual([1, 2]);
  });

  test('versões de crianças diferentes são independentes (contadores por criança)', async () => {
    const childA = await createChild('pro-1', childPayload);
    const childB = await createChild('pro-1', { ...childPayload, fullName: 'Outra Criança' });
    const draftA = await createDraftReport('pro-1', { childId: childA.id });
    const draftB = await createDraftReport('pro-1', { childId: childB.id });

    const issuedA = await issueReport(draftA.id, 'pro-1', { title: 'A' });
    const issuedB = await issueReport(draftB.id, 'pro-1', { title: 'B' });

    expect(issuedA.version).toBe(1);
    expect(issuedB.version).toBe(1);
  });
});

describe('createNewVersion', () => {
  test('versão 2 não altera a versão 1; ambas coexistem no histórico', async () => {
    const child = await setupChild();
    await createGrowthMeasurement('pro-1', {
      childId: child.id,
      measurementDate: '2024-06-01',
      ageInDays: 138,
      weightKg: 7.5,
    });
    const draft1 = await createDraftReport('pro-1', { childId: child.id });
    const v1 = await issueReport(draft1.id, 'pro-1', { title: 'Versão 1' });

    // Novo dado clínico registrado depois da v1.
    await createGrowthMeasurement('pro-1', {
      childId: child.id,
      measurementDate: '2024-09-01',
      ageInDays: 230,
      weightKg: 8.9,
    });

    const draft2 = await createNewVersion(v1.id, 'pro-1');
    expect(draft2.status).toBe('DRAFT');
    expect(draft2.previousVersionId).toBe(v1.id);

    const v2 = await issueReport(draft2.id, 'pro-1', { title: 'Versão 2' });

    expect(v2.version).toBe(2);
    expect(v2.clinicalDataSnapshot!.growth.measurements).toHaveLength(2);

    // A v1 permanece exatamente como foi emitida.
    const v1Reloaded = await getReport(v1.id);
    expect(v1Reloaded!.version).toBe(1);
    expect(v1Reloaded!.clinicalDataSnapshot!.growth.measurements).toHaveLength(1);
  });

  test('rejeita nova versão a partir de um DRAFT (só a partir de ISSUED)', async () => {
    const child = await setupChild();
    const draft = await createDraftReport('pro-1', { childId: child.id });
    await expect(createNewVersion(draft.id, 'pro-1')).rejects.toThrow();
  });
});

describe('listReportsByChild — ordenação e isolamento', () => {
  test('rascunho aparece antes dos emitidos; emitidos em ordem decrescente de versão', async () => {
    const child = await setupChild();
    const draft1 = await createDraftReport('pro-1', { childId: child.id });
    const v1 = await issueReport(draft1.id, 'pro-1', { title: 'V1' });
    const draft2 = await createNewVersion(v1.id, 'pro-1');
    await issueReport(draft2.id, 'pro-1', { title: 'V2' });
    await createDraftReport('pro-1', { childId: child.id }); // novo rascunho em andamento

    const list = await listReportsByChild(child.id, 'pro-1');
    expect(list.map((r) => r.status)).toEqual(['DRAFT', 'ISSUED', 'ISSUED']);
    expect(list[1].version).toBe(2);
    expect(list[2].version).toBe(1);
  });

  test('isolamento: não lista relatórios de outro profissional', async () => {
    const child = await setupChild('pro-1');
    await createDraftReport('pro-1', { childId: child.id });

    const listForOther = await listReportsByChild(child.id, 'pro-2');
    expect(listForOther).toEqual([]);
  });
});

describe('deleteDraftReport', () => {
  test('exclui um rascunho próprio', async () => {
    const child = await setupChild();
    const draft = await createDraftReport('pro-1', { childId: child.id });

    await deleteDraftReport(draft.id, 'pro-1');

    expect(await getReport(draft.id)).toBeNull();
  });

  test('não exclui relatório emitido', async () => {
    const child = await setupChild();
    const draft = await createDraftReport('pro-1', { childId: child.id });
    const issued = await issueReport(draft.id, 'pro-1', { title: 'Título' });

    await expect(deleteDraftReport(issued.id, 'pro-1')).rejects.toThrow();
    expect(await getReport(issued.id)).not.toBeNull();
  });

  test('não exclui rascunho de outro profissional', async () => {
    const child = await setupChild('pro-1');
    const draft = await createDraftReport('pro-1', { childId: child.id });

    await expect(deleteDraftReport(draft.id, 'pro-2')).rejects.toThrow();
    expect(await getReport(draft.id)).not.toBeNull();
  });
});
