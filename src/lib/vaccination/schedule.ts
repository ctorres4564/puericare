/**
 * lib/vaccination/schedule.ts — Calendário vacinal da criança (PNI/MS).
 *
 * Tabela ESTÁTICA e versionada no código com as doses do Calendário Nacional
 * de Vacinação da Criança do Programa Nacional de Imunizações (Ministério da
 * Saúde), limitada ao escopo do produto (0 a 5 anos e 11 meses).
 *
 * REFERÊNCIA: PNI/MS — Calendário Nacional de Vacinação, referência 2026
 * (https://www.gov.br/saude/pt-br/vacinacao/calendario). Pontos relevantes da
 * referência 2026 incorporados aqui:
 * - Reforço de meningocócica aos 12 meses com ACWY (não mais Men C);
 * - Poliomielite: esquema de 5 doses, TODAS com VIP (2, 4, 6 meses, 1º
 *   reforço aos 15 meses e 2º reforço aos 4 anos) — a VOP não faz mais parte
 *   do esquema de rotina;
 * - Influenza e Covid-19 constam do calendário infantil, mas com recomendação
 *   sazonal/por campanha — entram como itens de CONFERÊNCIA MANUAL
 *   (PNI_SEASONAL), nunca como atraso automático.
 *
 * LIMITES CONHECIDOS (validação profissional pendente):
 * - O intervalo até sinalizar "possível atraso" é uma CONVENÇÃO DO SISTEMA
 *   (30 dias após a idade recomendada), não uma regra oficial do PNI. Cada
 *   vacina tem idades, intervalos mínimos e situações de resgate próprios;
 *   doses com limite máximo de idade conhecido trazem `graceDays` próprio
 *   (ex.: rotavírus). A palavra "atraso" é sempre apresentada como POSSÍVEL
 *   atraso e toda saída orienta conferir a caderneta — ausência de registro
 *   no PueriCare não significa dose não aplicada.
 * - A tabela cobre o esquema de rotina; situações especiais (imunodeprimidos,
 *   prematuros, resgate) estão fora do cálculo automático.
 *
 * DESIGN:
 * - Funções PURAS: recebem data de nascimento, registros e data de referência,
 *   retornam a situação de cada dose — sem I/O, sem estado.
 * - O cruzamento com os registros usa `scheduleKey` quando presente; registros
 *   antigos (só texto livre) são casados por alias de nome, em ordem
 *   cronológica — heurística conservadora documentada em `matchRecords`.
 */

import type { VaccinationRecord } from '@/lib/types';

// ─── Metadados da referência ──────────────────────────────────────────────────

/** Identificação da versão do calendário exibida na interface */
export const PNI_REFERENCE = {
  label: 'Calendário Nacional de Vacinação — PNI/MS',
  version: '2026',
  updatedAt: 'julho de 2026',
  sourceUrl: 'https://www.gov.br/saude/pt-br/vacinacao/calendario',
} as const;

// ─── Tabela do calendário ─────────────────────────────────────────────────────

export interface ScheduledDose {
  /** Chave estável gravada em VaccinationRecord.scheduleKey (ex.: 'penta-d1') */
  key: string;
  /** Nome de exibição da vacina */
  vaccine: string;
  /** Descrição da dose (ex.: '1ª dose', 'Reforço') */
  dose: string;
  /** Idade recomendada para aplicação, em dias */
  ageDays: number;
  /** Aliases (minúsculos, sem acento) para casar registros de texto livre */
  aliases: string[];
  /**
   * Dias de carência após a idade recomendada antes de sinalizar "possível
   * atraso". Padrão: DEFAULT_DELAY_GRACE_DAYS. Doses com limite máximo de
   * idade definido pelo PNI usam o limite oficial.
   */
  graceDays?: number;
  /**
   * Vacina sazonal/por campanha (influenza, Covid-19): aparece como item de
   * conferência manual e NUNCA gera "possível atraso".
   */
  seasonal?: boolean;
}

const M = 30; // aproximação de mês em dias, usada só para legibilidade da tabela

/** Esquema fixo de rotina — PNI, referência 2026 */
export const PNI_SCHEDULE: ScheduledDose[] = [
  { key: 'bcg-d1',       vaccine: 'BCG',                          dose: 'Dose única', ageDays: 0, aliases: ['bcg'] },
  { key: 'hepb-d1',      vaccine: 'Hepatite B',                   dose: '1ª dose (ao nascer)', ageDays: 0, aliases: ['hepatite b', 'hepb'] },
  { key: 'penta-d1',     vaccine: 'Pentavalente',                 dose: '1ª dose', ageDays: 2 * M, aliases: ['penta', 'pentavalente'] },
  { key: 'vip-d1',       vaccine: 'VIP (poliomielite inativada)', dose: '1ª dose', ageDays: 2 * M, aliases: ['vip', 'polio inativada', 'poliomielite inativada', 'polio'] },
  { key: 'pneumo10-d1',  vaccine: 'Pneumocócica 10v',             dose: '1ª dose', ageDays: 2 * M, aliases: ['pneumo', 'pneumococica'] },
  // Rotavírus D1: limite máximo 3 meses e 15 dias (PNI) → 105 dias de idade
  { key: 'rota-d1',      vaccine: 'Rotavírus',                    dose: '1ª dose', ageDays: 2 * M, graceDays: 45, aliases: ['rota', 'rotavirus'] },
  { key: 'menc-d1',      vaccine: 'Meningocócica C',              dose: '1ª dose', ageDays: 3 * M, aliases: ['meningo c', 'meningococica c', 'meningo', 'meningococica'] },
  { key: 'penta-d2',     vaccine: 'Pentavalente',                 dose: '2ª dose', ageDays: 4 * M, aliases: ['penta', 'pentavalente'] },
  { key: 'vip-d2',       vaccine: 'VIP (poliomielite inativada)', dose: '2ª dose', ageDays: 4 * M, aliases: ['vip', 'polio inativada', 'poliomielite inativada', 'polio'] },
  { key: 'pneumo10-d2',  vaccine: 'Pneumocócica 10v',             dose: '2ª dose', ageDays: 4 * M, aliases: ['pneumo', 'pneumococica'] },
  // Rotavírus D2: limite máximo 7 meses e 29 dias (PNI) → 240 dias de idade
  { key: 'rota-d2',      vaccine: 'Rotavírus',                    dose: '2ª dose', ageDays: 4 * M, graceDays: 120, aliases: ['rota', 'rotavirus'] },
  { key: 'menc-d2',      vaccine: 'Meningocócica C',              dose: '2ª dose', ageDays: 5 * M, aliases: ['meningo c', 'meningococica c', 'meningo', 'meningococica'] },
  { key: 'penta-d3',     vaccine: 'Pentavalente',                 dose: '3ª dose', ageDays: 6 * M, aliases: ['penta', 'pentavalente'] },
  { key: 'vip-d3',       vaccine: 'VIP (poliomielite inativada)', dose: '3ª dose', ageDays: 6 * M, aliases: ['vip', 'polio inativada', 'poliomielite inativada', 'polio'] },
  { key: 'fa-d1',        vaccine: 'Febre amarela',                dose: '1ª dose', ageDays: 9 * M, aliases: ['febre amarela', 'amarela'] },
  { key: 'tv-d1',        vaccine: 'Tríplice viral',               dose: '1ª dose', ageDays: 12 * M, aliases: ['triplice viral', 'triplice', 'sarampo'] },
  { key: 'pneumo10-ref', vaccine: 'Pneumocócica 10v',             dose: 'Reforço', ageDays: 12 * M, aliases: ['pneumo', 'pneumococica'] },
  // Referência 2026: reforço de meningocócica aos 12 meses é com ACWY
  { key: 'menacwy-ref',  vaccine: 'Meningocócica ACWY',           dose: 'Reforço', ageDays: 12 * M, aliases: ['acwy', 'meningo acwy', 'meningococica acwy', 'meningo', 'meningococica'] },
  { key: 'dtp-ref1',     vaccine: 'DTP',                          dose: '1º reforço', ageDays: 15 * M, aliases: ['dtp'] },
  // Referência 2026: reforços de poliomielite com VIP (VOP fora do esquema).
  // Aliases incluem 'vop' para casar registros legados anteriores à mudança.
  { key: 'vip-ref1',     vaccine: 'VIP (poliomielite inativada)', dose: '1º reforço', ageDays: 15 * M, aliases: ['vip', 'polio inativada', 'poliomielite inativada', 'vop', 'polio oral', 'poliomielite oral', 'polio'] },
  { key: 'tetra-d1',     vaccine: 'Tetraviral',                   dose: 'Dose única (tríplice viral 2ª dose + varicela 1ª dose)', ageDays: 15 * M, aliases: ['tetraviral', 'tetra'] },
  { key: 'hepa-d1',      vaccine: 'Hepatite A',                   dose: 'Dose única', ageDays: 15 * M, aliases: ['hepatite a', 'hepa'] },
  { key: 'dtp-ref2',     vaccine: 'DTP',                          dose: '2º reforço', ageDays: 4 * 365 + 1, aliases: ['dtp'] },
  // Referência 2026: 2º reforço de poliomielite aos 4 anos, com VIP
  { key: 'vip-ref2',     vaccine: 'VIP (poliomielite inativada)', dose: '2º reforço', ageDays: 4 * 365 + 1, aliases: ['vip', 'polio inativada', 'poliomielite inativada', 'vop', 'polio oral', 'poliomielite oral', 'polio'] },
  { key: 'fa-ref',       vaccine: 'Febre amarela',                dose: 'Reforço', ageDays: 4 * 365 + 1, aliases: ['febre amarela', 'amarela'] },
  { key: 'varicela-d2',  vaccine: 'Varicela',                     dose: '2ª dose', ageDays: 4 * 365 + 1, aliases: ['varicela', 'catapora'] },
];

/**
 * Vacinas do calendário infantil com recomendação sazonal/por campanha.
 * Aparecem na interface como itens de conferência manual — o sistema não
 * calcula atraso para elas, pois a indicação depende da campanha vigente.
 */
export const PNI_SEASONAL: ScheduledDose[] = [
  { key: 'influenza-anual', vaccine: 'Influenza', dose: 'Dose anual, conforme campanha vigente', ageDays: 6 * M, aliases: ['influenza', 'gripe'], seasonal: true },
  { key: 'covid19-infantil', vaccine: 'Covid-19', dose: 'Conforme recomendação vigente para a faixa etária', ageDays: 6 * M, aliases: ['covid'], seasonal: true },
];

/** Todas as doses selecionáveis no registro (esquema fixo + sazonais) */
export const PNI_ALL_DOSES: ScheduledDose[] = [...PNI_SCHEDULE, ...PNI_SEASONAL];

// ─── Tipos do resultado ───────────────────────────────────────────────────────

/**
 * registered     — dose casada com um registro
 * possible_delay — sem registro após a idade recomendada + carência; a
 *                  interface sempre apresenta como "possível atraso" e
 *                  orienta conferir a caderneta (ausência de registro ≠
 *                  dose não aplicada)
 * available      — sem registro e dentro da janela de aplicação
 * planned        — sem registro e ainda fora da janela
 * pending_check  — vacina sazonal/por campanha: conferir recomendação
 *                  vigente; nunca gera alerta de atraso
 */
export type ScheduleDoseStatus =
  | 'registered'
  | 'possible_delay'
  | 'available'
  | 'planned'
  | 'pending_check';

export interface ScheduleDoseView extends ScheduledDose {
  status: ScheduleDoseStatus;
  /** Data em que a dose fica recomendada (birthDate + ageDays), ISO YYYY-MM-DD */
  dueDate: string;
  /** Data do registro casado, quando houver (para sazonais: o mais recente) */
  appliedDate?: string;
}

export interface ScheduleSummary {
  registered: number;
  possible_delay: number;
  available: number;
  planned: number;
  pending_check: number;
}

// ─── Constantes de janela ─────────────────────────────────────────────────────

/**
 * Dias de carência após a idade recomendada antes de sinalizar "possível
 * atraso". CONVENÇÃO DO SISTEMA (não é regra oficial do PNI) — conservadora,
 * aplicada só a doses sem `graceDays` próprio. Ver LIMITES CONHECIDOS acima.
 */
export const DEFAULT_DELAY_GRACE_DAYS = 30;
/** Dias antes da idade recomendada em que a dose já fica disponível */
export const AVAILABLE_WINDOW_DAYS = 30;

// ─── Utilitários de data ──────────────────────────────────────────────────────

/** Soma dias a uma data ISO YYYY-MM-DD e retorna ISO YYYY-MM-DD (UTC) */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Idade em dias completos na data de referência */
function ageInDaysAt(birthDate: string, referenceDate: string): number {
  const birth = new Date(birthDate + 'T00:00:00Z');
  const ref = new Date(referenceDate + 'T00:00:00Z');
  return Math.floor((ref.getTime() - birth.getTime()) / 86_400_000);
}

// ─── Casamento de registros com doses ─────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // remove diacríticos (U+0300–U+036F)
}

function recordMatchesDose(record: VaccinationRecord, dose: ScheduledDose): boolean {
  if (record.scheduleKey) return record.scheduleKey === dose.key;
  const name = normalize(record.vaccineName ?? '');
  if (!name) return false;
  return dose.aliases.some((alias) => name.includes(alias));
}

/**
 * Casa registros com doses do calendário de esquema fixo.
 *
 * - Registros com `scheduleKey` casam 1:1 com a dose correspondente.
 * - Registros legados (só `vaccineName` em texto livre) casam por alias e são
 *   atribuídos às doses daquela vacina EM ORDEM (1º registro → 1ª dose etc.).
 * - Um registro marca no máximo uma dose; uma dose é marcada por no máximo um
 *   registro (o mais antigo que casa).
 * - Doses sazonais NÃO entram aqui — ver `latestSeasonalRecord`.
 */
export function matchRecords(
  records: VaccinationRecord[],
  schedule: ScheduledDose[] = PNI_SCHEDULE
): Map<string, VaccinationRecord> {
  const sorted = [...records].sort(
    (a, b) => a.recordDate.localeCompare(b.recordDate) || a.createdAt.localeCompare(b.createdAt)
  );
  const matched = new Map<string, VaccinationRecord>();
  const usedRecords = new Set<string>();

  // 1ª passada: casamentos exatos por scheduleKey (não ambíguos)
  for (const record of sorted) {
    if (!record.scheduleKey || usedRecords.has(record.id)) continue;
    const dose = schedule.find((d) => d.key === record.scheduleKey);
    if (dose && !matched.has(dose.key)) {
      matched.set(dose.key, record);
      usedRecords.add(record.id);
    }
  }

  // 2ª passada: casamento por alias, em ordem cronológica e de calendário
  for (const dose of schedule) {
    if (matched.has(dose.key)) continue;
    const record = sorted.find(
      (r) => !r.scheduleKey && !usedRecords.has(r.id) && recordMatchesDose(r, dose)
    );
    if (record) {
      matched.set(dose.key, record);
      usedRecords.add(record.id);
    }
  }

  return matched;
}

/** Registro mais recente que casa com uma dose sazonal (dose se repete anualmente) */
function latestSeasonalRecord(
  records: VaccinationRecord[],
  dose: ScheduledDose
): VaccinationRecord | undefined {
  const matching = records
    .filter((r) => recordMatchesDose(r, dose))
    .sort((a, b) => b.recordDate.localeCompare(a.recordDate) || b.createdAt.localeCompare(a.createdAt));
  return matching[0];
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Monta a situação de cada dose do calendário para uma criança.
 * Retorna primeiro as doses do esquema fixo (por idade recomendada) e, ao
 * final, os itens sazonais de conferência manual.
 */
export function buildVaccinationSchedule(
  birthDate: string,
  records: VaccinationRecord[],
  referenceDate: string,
  schedule: ScheduledDose[] = PNI_SCHEDULE,
  seasonal: ScheduledDose[] = PNI_SEASONAL
): ScheduleDoseView[] {
  const ageDays = ageInDaysAt(birthDate, referenceDate);
  const matched = matchRecords(records, schedule);

  const fixed: ScheduleDoseView[] = schedule.map((dose) => {
    const record = matched.get(dose.key);
    const dueDate = addDays(birthDate, dose.ageDays);
    const grace = dose.graceDays ?? DEFAULT_DELAY_GRACE_DAYS;

    let status: ScheduleDoseStatus;
    if (record) {
      status = 'registered';
    } else if (ageDays > dose.ageDays + grace) {
      status = 'possible_delay';
    } else if (ageDays >= dose.ageDays - AVAILABLE_WINDOW_DAYS) {
      status = 'available';
    } else {
      status = 'planned';
    }

    return { ...dose, status, dueDate, appliedDate: record?.recordDate };
  });

  const seasonalViews: ScheduleDoseView[] = seasonal.map((dose) => ({
    ...dose,
    status: 'pending_check' as const,
    dueDate: addDays(birthDate, dose.ageDays),
    appliedDate: latestSeasonalRecord(records, dose)?.recordDate,
  }));

  return [...fixed, ...seasonalViews];
}

/** Contagens por status — para badges, dashboards e regras de alerta */
export function summarizeSchedule(doses: ScheduleDoseView[]): ScheduleSummary {
  const summary: ScheduleSummary = {
    registered: 0,
    possible_delay: 0,
    available: 0,
    planned: 0,
    pending_check: 0,
  };
  for (const d of doses) summary[d.status]++;
  return summary;
}

/**
 * Número de doses em "possível atraso" para uma criança — atalho para
 * badges em listas (ex.: "Vacinação a conferir" na lista de pacientes).
 * 0 significa "nada a conferir", não "esquema completo".
 */
export function countPossibleDelayDoses(
  birthDate: string,
  records: VaccinationRecord[],
  referenceDate: string
): number {
  return summarizeSchedule(buildVaccinationSchedule(birthDate, records, referenceDate)).possible_delay;
}

/**
 * Ordena para exibição: possível atraso → disponível → conferência manual →
 * prevista → registrada.
 */
export function sortForDisplay(doses: ScheduleDoseView[]): ScheduleDoseView[] {
  const order: Record<ScheduleDoseStatus, number> = {
    possible_delay: 0,
    available: 1,
    pending_check: 2,
    planned: 3,
    registered: 4,
  };
  return [...doses].sort((a, b) => order[a.status] - order[b.status] || a.ageDays - b.ageDays);
}
