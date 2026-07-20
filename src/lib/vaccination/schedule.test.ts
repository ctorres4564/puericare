/**
 * lib/vaccination/schedule.test.ts — Testes do calendário vacinal PNI.
 *
 * Funções puras — sem I/O, sem Firebase. Datas fixas para determinismo.
 */

import { describe, it, expect } from 'vitest';
import {
  PNI_SCHEDULE,
  PNI_SEASONAL,
  PNI_ALL_DOSES,
  DEFAULT_DELAY_GRACE_DAYS,
  AVAILABLE_WINDOW_DAYS,
  addDays,
  buildVaccinationSchedule,
  summarizeSchedule,
  sortForDisplay,
  matchRecords,
  countPossibleDelayDoses,
} from './schedule';
import type { VaccinationRecord } from '@/lib/types';

// ─── Factories ────────────────────────────────────────────────────────────────

let seq = 0;
function makeRecord(overrides: Partial<VaccinationRecord> = {}): VaccinationRecord {
  seq++;
  return {
    id: `rec-${seq}`,
    childId: 'child-1',
    professionalId: 'prof-1',
    recordDate: '2025-01-01',
    ageInDays: 0,
    status: 'em_dia',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function doseByKey(views: ReturnType<typeof buildVaccinationSchedule>, key: string) {
  const found = views.find((d) => d.key === key);
  if (!found) throw new Error(`dose não encontrada: ${key}`);
  return found;
}

// ─── Tabela (referência PNI 2026) ─────────────────────────────────────────────

describe('PNI_SCHEDULE — referência 2026', () => {
  it('tem chaves únicas e idades não negativas', () => {
    const keys = PNI_ALL_DOSES.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const d of PNI_ALL_DOSES) expect(d.ageDays).toBeGreaterThanOrEqual(0);
  });

  it('está ordenada por idade recomendada', () => {
    for (let i = 1; i < PNI_SCHEDULE.length; i++) {
      expect(PNI_SCHEDULE[i].ageDays).toBeGreaterThanOrEqual(PNI_SCHEDULE[i - 1].ageDays);
    }
  });

  it('cobre os marcos do 1º ano (nascer, 2, 3, 4, 5, 6, 9, 12, 15 meses)', () => {
    const ages = new Set(PNI_SCHEDULE.map((d) => d.ageDays));
    for (const m of [0, 2, 3, 4, 5, 6, 9, 12, 15]) {
      expect(ages.has(m * 30)).toBe(true);
    }
  });

  it('reforço de meningocócica aos 12 meses é ACWY (referência 2026)', () => {
    const dose = PNI_SCHEDULE.find((d) => d.key === 'menacwy-ref');
    expect(dose).toBeDefined();
    expect(dose!.vaccine).toContain('ACWY');
    expect(dose!.ageDays).toBe(360);
    // nenhum reforço de Men C aos 12 meses
    expect(PNI_SCHEDULE.some((d) => d.key === 'menc-ref')).toBe(false);
  });

  it('poliomielite: esquema de 5 doses, todas VIP — sem VOP no calendário', () => {
    const polio = PNI_SCHEDULE.filter((d) => d.vaccine.includes('poliomielite'));
    expect(polio).toHaveLength(5);
    expect(polio.every((d) => d.vaccine.startsWith('VIP'))).toBe(true);
    expect(polio.map((d) => d.key)).toEqual(['vip-d1', 'vip-d2', 'vip-d3', 'vip-ref1', 'vip-ref2']);
    expect(PNI_ALL_DOSES.some((d) => d.key.startsWith('vop'))).toBe(false);
    expect(PNI_ALL_DOSES.some((d) => d.vaccine.includes('VOP'))).toBe(false);
  });

  it('influenza e Covid-19 existem como itens sazonais de conferência manual', () => {
    const keys = PNI_SEASONAL.map((d) => d.key);
    expect(keys).toContain('influenza-anual');
    expect(keys).toContain('covid19-infantil');
    expect(PNI_SEASONAL.every((d) => d.seasonal)).toBe(true);
  });
});

// ─── addDays ──────────────────────────────────────────────────────────────────

describe('addDays', () => {
  it('soma dias dentro do mês', () => {
    expect(addDays('2025-01-01', 60)).toBe('2025-03-02');
  });

  it('cruza ano bissexto corretamente', () => {
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });
});

// ─── buildVaccinationSchedule: status ─────────────────────────────────────────

describe('buildVaccinationSchedule — status', () => {
  const BIRTH = '2025-01-01';

  it('recém-nascido: doses do nascimento disponíveis, demais previstas', () => {
    const views = buildVaccinationSchedule(BIRTH, [], BIRTH);
    expect(doseByKey(views, 'bcg-d1').status).toBe('available');
    expect(doseByKey(views, 'hepb-d1').status).toBe('available');
    expect(doseByKey(views, 'penta-d1').status).toBe('planned');
  });

  it('dose vencida além da carência fica como possível atraso', () => {
    // 1 ano de idade, sem registros: penta-d1 (60d + 30d carência) já venceu
    const views = buildVaccinationSchedule(BIRTH, [], '2026-01-01');
    expect(doseByKey(views, 'penta-d1').status).toBe('possible_delay');
    expect(doseByKey(views, 'bcg-d1').status).toBe('possible_delay');
  });

  it('dentro da carência ainda é "available", não "possible_delay"', () => {
    const ref = addDays(BIRTH, 60 + DEFAULT_DELAY_GRACE_DAYS);
    const views = buildVaccinationSchedule(BIRTH, [], ref);
    expect(doseByKey(views, 'penta-d1').status).toBe('available');
  });

  it('entra na janela AVAILABLE_WINDOW_DAYS antes da idade recomendada', () => {
    const ref = addDays(BIRTH, 60 - AVAILABLE_WINDOW_DAYS);
    const views = buildVaccinationSchedule(BIRTH, [], ref);
    expect(doseByKey(views, 'penta-d1').status).toBe('available');
    const antes = buildVaccinationSchedule(BIRTH, [], addDays(BIRTH, 60 - AVAILABLE_WINDOW_DAYS - 1));
    expect(doseByKey(antes, 'penta-d1').status).toBe('planned');
  });

  it('rotavírus respeita o limite máximo de idade do PNI (graceDays próprio)', () => {
    // rota-d1: recomendada aos 60d, limite máximo 105d (graceDays 45)
    const dentroDoLimite = buildVaccinationSchedule(BIRTH, [], addDays(BIRTH, 104));
    expect(doseByKey(dentroDoLimite, 'rota-d1').status).toBe('available');
    const aposLimite = buildVaccinationSchedule(BIRTH, [], addDays(BIRTH, 106));
    expect(doseByKey(aposLimite, 'rota-d1').status).toBe('possible_delay');
  });

  it('dueDate é birthDate + ageDays', () => {
    const views = buildVaccinationSchedule(BIRTH, [], BIRTH);
    expect(doseByKey(views, 'bcg-d1').dueDate).toBe('2025-01-01');
    expect(doseByKey(views, 'tv-d1').dueDate).toBe('2025-12-27'); // 12 × 30 = 360 dias
  });
});

// ─── Vacinas sazonais ─────────────────────────────────────────────────────────

describe('buildVaccinationSchedule — sazonais (conferência manual)', () => {
  const BIRTH = '2025-01-01';

  it('nunca geram possível atraso, mesmo para criança de 5 anos sem registros', () => {
    const views = buildVaccinationSchedule(BIRTH, [], '2030-01-01');
    for (const seasonal of PNI_SEASONAL) {
      expect(doseByKey(views, seasonal.key).status).toBe('pending_check');
    }
  });

  it('mostram a data do último registro, quando existe', () => {
    const records = [
      makeRecord({ scheduleKey: 'influenza-anual', vaccineName: 'Influenza', recordDate: '2025-06-01' }),
      makeRecord({ scheduleKey: 'influenza-anual', vaccineName: 'Influenza', recordDate: '2026-05-01' }),
    ];
    const views = buildVaccinationSchedule(BIRTH, records, '2026-07-01');
    const flu = doseByKey(views, 'influenza-anual');
    expect(flu.status).toBe('pending_check');
    expect(flu.appliedDate).toBe('2026-05-01'); // mais recente, não a primeira
  });

  it('casam registros legados por alias', () => {
    const records = [makeRecord({ vaccineName: 'Vacina da gripe', recordDate: '2026-04-10' })];
    const views = buildVaccinationSchedule(BIRTH, records, '2026-07-01');
    expect(doseByKey(views, 'influenza-anual').appliedDate).toBe('2026-04-10');
  });
});

// ─── Casamento de registros ───────────────────────────────────────────────────

describe('matchRecords', () => {
  it('casa por scheduleKey com prioridade sobre alias', () => {
    const records = [
      makeRecord({ scheduleKey: 'penta-d2', vaccineName: 'Pentavalente', recordDate: '2025-05-01' }),
      makeRecord({ vaccineName: 'Pentavalente', recordDate: '2025-03-01', createdAt: '2025-03-01T00:00:00Z' }),
    ];
    const matched = matchRecords(records);
    expect(matched.get('penta-d2')?.id).toBe(records[0].id);
    expect(matched.get('penta-d1')?.id).toBe(records[1].id);
    expect(matched.has('penta-d3')).toBe(false);
  });

  it('atribui registros legados às doses em ordem cronológica', () => {
    const records = [
      makeRecord({ vaccineName: 'penta', recordDate: '2025-05-01', createdAt: '2025-05-01T00:00:00Z' }),
      makeRecord({ vaccineName: 'Pentavalente', recordDate: '2025-03-01', createdAt: '2025-03-01T00:00:00Z' }),
      makeRecord({ vaccineName: 'PENTAVALENTE D3', recordDate: '2025-07-01', createdAt: '2025-07-01T00:00:00Z' }),
    ];
    const matched = matchRecords(records);
    expect(matched.get('penta-d1')?.recordDate).toBe('2025-03-01');
    expect(matched.get('penta-d2')?.recordDate).toBe('2025-05-01');
    expect(matched.get('penta-d3')?.recordDate).toBe('2025-07-01');
  });

  it('ignora acentos e caixa no texto livre', () => {
    const records = [makeRecord({ vaccineName: 'Rotavírus humano', recordDate: '2025-03-01' })];
    const matched = matchRecords(records);
    expect(matched.has('rota-d1')).toBe(true);
  });

  it('casa registro legado de VOP com o reforço VIP (mudança de esquema 2026)', () => {
    const records = [
      makeRecord({ vaccineName: 'VIP', recordDate: '2025-03-01', createdAt: '2025-03-01T00:00:00Z' }),
      makeRecord({ vaccineName: 'VIP', recordDate: '2025-05-01', createdAt: '2025-05-01T00:00:00Z' }),
      makeRecord({ vaccineName: 'VIP', recordDate: '2025-07-01', createdAt: '2025-07-01T00:00:00Z' }),
      makeRecord({ vaccineName: 'VOP (gotinha)', recordDate: '2026-04-01', createdAt: '2026-04-01T00:00:00Z' }),
    ];
    const matched = matchRecords(records);
    expect(matched.get('vip-ref1')?.recordDate).toBe('2026-04-01');
  });

  it('não casa registro sem nome de vacina nem scheduleKey', () => {
    const records = [makeRecord({ status: 'nao_informado' })];
    const matched = matchRecords(records);
    expect(matched.size).toBe(0);
  });

  it('scheduleKey desconhecido não casa com nada', () => {
    const records = [makeRecord({ scheduleKey: 'hpv-d1', vaccineName: 'HPV' })];
    const matched = matchRecords(records);
    expect(matched.size).toBe(0);
  });
});

describe('buildVaccinationSchedule — registro', () => {
  const BIRTH = '2025-01-01';

  it('marca dose registrada com a data do registro', () => {
    const records = [
      makeRecord({ scheduleKey: 'bcg-d1', vaccineName: 'BCG', recordDate: '2025-01-02' }),
    ];
    const views = buildVaccinationSchedule(BIRTH, records, '2025-02-01');
    const bcg = doseByKey(views, 'bcg-d1');
    expect(bcg.status).toBe('registered');
    expect(bcg.appliedDate).toBe('2025-01-02');
  });

  it('dose registrada nunca vira possível atraso, mesmo fora da janela', () => {
    const records = [
      makeRecord({ scheduleKey: 'penta-d1', vaccineName: 'Pentavalente', recordDate: '2025-06-01' }),
    ];
    const views = buildVaccinationSchedule(BIRTH, records, '2026-01-01');
    expect(doseByKey(views, 'penta-d1').status).toBe('registered');
  });
});

// ─── summarizeSchedule / sortForDisplay ───────────────────────────────────────

describe('summarizeSchedule', () => {
  it('conta corretamente os cinco status', () => {
    const views = buildVaccinationSchedule('2025-01-01', [], '2025-04-15');
    const summary = summarizeSchedule(views);
    const total =
      summary.registered + summary.possible_delay + summary.available + summary.planned + summary.pending_check;
    expect(total).toBe(PNI_ALL_DOSES.length);
    // 104 dias: nascimento vencido (0+30), 2m vencido (60+30) — rota-d1 tem grace 45 (limite 105d)
    expect(summary.possible_delay).toBe(5); // bcg, hepb, penta-d1, vip-d1, pneumo10-d1
    expect(summary.pending_check).toBe(PNI_SEASONAL.length);
  });
});

describe('sortForDisplay', () => {
  it('ordena: possível atraso → disponível → conferir → prevista → registrada', () => {
    const records = [makeRecord({ scheduleKey: 'bcg-d1', vaccineName: 'BCG', recordDate: '2025-01-01' })];
    const views = buildVaccinationSchedule('2025-01-01', records, '2025-05-01');
    const sorted = sortForDisplay(views);
    const statuses = sorted.map((d) => d.status);
    expect(statuses[0]).toBe('possible_delay');
    expect(statuses[statuses.length - 1]).toBe('registered');
    const prio = { possible_delay: 0, available: 1, pending_check: 2, planned: 3, registered: 4 } as const;
    for (let i = 1; i < statuses.length; i++) {
      expect(prio[statuses[i]]).toBeGreaterThanOrEqual(prio[statuses[i - 1]]);
    }
  });
});

// ─── countPossibleDelayDoses (badge "Vacinação a conferir") ──────────────────

describe('countPossibleDelayDoses', () => {
  it('retorna 0 para recém-nascido (nada vencido) e para esquema registrado', () => {
    expect(countPossibleDelayDoses('2026-07-19', [], '2026-07-19')).toBe(0);

    const records = PNI_SCHEDULE.filter((d) => d.ageDays <= 180).map((d) =>
      makeRecord({ scheduleKey: d.key, vaccineName: d.vaccine, recordDate: '2026-07-01' })
    );
    expect(countPossibleDelayDoses('2026-01-19', records, '2026-07-19')).toBe(0);
  });

  it('conta apenas as doses sem registro após a janela', () => {
    // 6 meses (181 dias), nenhum registro → vencidas: nascimento (bcg, hepb),
    // 2m (penta, vip, pneumo, rota-d1 grace 45=105), 3m (menc-d1), 4m (penta,
    // vip, pneumo — rota-d2 grace 120=240 ainda não) e 5m (menc-d2, 150+30=180)
    expect(countPossibleDelayDoses('2026-01-19', [], '2026-07-19')).toBe(11);
  });

  it('ignora vacinas sazonais (nunca entram na contagem)', () => {
    // 5 anos sem nenhum registro: sazonais continuam fora da conta
    const count = countPossibleDelayDoses('2020-01-01', [], '2026-07-19');
    const views = buildVaccinationSchedule('2020-01-01', [], '2026-07-19');
    expect(count).toBe(views.filter((d) => d.status === 'possible_delay').length);
    expect(views.some((d) => d.seasonal && d.status === 'possible_delay')).toBe(false);
  });
});
