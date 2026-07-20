/**
 * lib/consultations/roteiro.ts — Roteiro de consulta por faixa etária.
 *
 * Monta um roteiro de apoio à memória para a consulta de puericultura, a
 * partir da idade da criança na data da consulta: antropometria devida,
 * vacinas do calendário PNI a conferir/aplicar (reusa
 * lib/vaccination/schedule.ts), lembrete de vigilância do desenvolvimento
 * e tópicos de orientação.
 *
 * O QUE ISTO É: um checklist de apoio, exibido ao profissional durante o
 * preenchimento da consulta. NÃO é protocolo clínico, não gera conduta e
 * não registra nada automaticamente — cada item é apenas um lembrete do
 * que costuma ser abordado naquela faixa etária.
 *
 * FONTES DO CONTEÚDO ESTÁTICO:
 * - MS — Caderneta de Saúde da Criança (antropometria, orientações);
 * - MS — Caderno de Atenção Básica nº 23 (Saúde da Criança);
 * - Vacinas: lib/vaccination/schedule.ts (PNI, referência 2026).
 *
 * DECISÕES DELIBERADAS:
 * - Marcos de desenvolvimento NÃO são sugeridos por idade: o projeto não
 *   pré-carrega marcos por decisão documentada (sem fonte oficial com
 *   versão/população — ver lib/types/development.ts). O roteiro apenas
 *   lembra de registrar a vigilância nos 5 domínios.
 * - Tópicos de orientação são genéricos e estáveis (não variam por
 *   campanha nem por versão de diretriz), mas, assim como a tabela
 *   vacinal, aguardam validação profissional — ver
 *   documentacao/validacao-calendario-vacinal-pni-2026.md.
 *
 * Funções PURAS — sem I/O, sem estado.
 */

import type { VaccinationRecord } from '@/lib/types';
import {
  buildVaccinationSchedule,
  type ScheduleDoseView,
} from '@/lib/vaccination/schedule';
import { formatAgeInDays } from './ageInDays';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ConsultationRoteiro {
  /** Idade da criança na data da consulta, em dias */
  ageInDays: number;
  /** Idade formatada para exibição (ex.: '6 meses') */
  ageLabel: string;
  /** Medidas antropométricas devidas na faixa etária */
  measurements: string[];
  /** Doses do calendário PNI disponíveis ou com possível atraso na data */
  vaccinesToCheck: ScheduleDoseView[];
  /** Lembrete de vigilância do desenvolvimento (texto fixo) */
  developmentReminder: string;
  /** Tópicos de orientação sugeridos para a faixa etária */
  guidanceTopics: string[];
}

// ─── Conteúdo estático ────────────────────────────────────────────────────────

const TWO_YEARS_DAYS = 730;
const SIX_MONTHS_DAYS = 180;
const ONE_YEAR_DAYS = 365;

const MEASUREMENTS_UNDER_2Y = ['Peso', 'Comprimento', 'Perímetro cefálico'];
const MEASUREMENTS_OVER_2Y = ['Peso', 'Altura', 'IMC'];

/**
 * Lembrete fixo — deliberadamente NÃO lista marcos por idade
 * (ver nota de design no cabeçalho).
 */
export const DEVELOPMENT_REMINDER =
  'Vigilância do desenvolvimento: observar e registrar os 5 domínios ' +
  '(motor grosso, motor fino, comunicação, cognição, social e adaptativo).';

const GUIDANCE_UNDER_6M = [
  'Aleitamento materno exclusivo',
  'Sono seguro: dormir sempre em decúbito dorsal (de barriga para cima)',
  'Cuidados com o recém-nascido (banho, coto umbilical, cólicas)',
  'Triagens neonatais realizadas (conferir resultados)',
];

const GUIDANCE_6M_TO_1Y = [
  'Introdução alimentar, mantendo o aleitamento materno',
  'Higiene oral a partir da erupção dos primeiros dentes',
  'Prevenção de acidentes: engasgo, quedas e intoxicações',
  'Estímulo ao desenvolvimento: brincar, conversar e ler com a criança',
];

const GUIDANCE_1Y_TO_2Y = [
  'Alimentação: transição gradual para a dieta da família',
  'Rotina e higiene do sono',
  'Linguagem: conversar, nomear objetos e ler com a criança',
  'Prevenção de acidentes domésticos',
];

const GUIDANCE_OVER_2Y = [
  'Alimentação saudável e rotina de refeições',
  'Tempo de tela e atividade física',
  'Higiene e autonomia (banho, dentes, desfralde)',
  'Socialização e convivência (creche/escola)',
];

/** Tópicos de orientação por faixa etária */
export function guidanceTopicsForAge(ageInDays: number): string[] {
  if (ageInDays < SIX_MONTHS_DAYS) return GUIDANCE_UNDER_6M;
  if (ageInDays < ONE_YEAR_DAYS) return GUIDANCE_6M_TO_1Y;
  if (ageInDays < TWO_YEARS_DAYS) return GUIDANCE_1Y_TO_2Y;
  return GUIDANCE_OVER_2Y;
}

/** Medidas antropométricas devidas por faixa etária */
export function measurementsForAge(ageInDays: number): string[] {
  return ageInDays < TWO_YEARS_DAYS ? MEASUREMENTS_UNDER_2Y : MEASUREMENTS_OVER_2Y;
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Monta o roteiro da consulta para uma criança numa data.
 *
 * @param birthDate        ISO YYYY-MM-DD
 * @param consultationDate ISO YYYY-MM-DD
 * @param vaccinationRecords registros de vacinação da criança (para a seção
 *                           de vacinas — mesma regra do calendário PNI)
 */
export function buildConsultationRoteiro(
  birthDate: string,
  consultationDate: string,
  vaccinationRecords: VaccinationRecord[]
): ConsultationRoteiro {
  const birth = new Date(birthDate + 'T00:00:00Z');
  const consult = new Date(consultationDate + 'T00:00:00Z');
  const ageInDays = Math.floor((consult.getTime() - birth.getTime()) / 86_400_000);

  const schedule = buildVaccinationSchedule(birthDate, vaccinationRecords, consultationDate);
  const vaccinesToCheck = schedule.filter(
    (d) => d.status === 'available' || d.status === 'possible_delay'
  );

  return {
    ageInDays,
    ageLabel: formatAgeInDays(ageInDays),
    measurements: measurementsForAge(ageInDays),
    vaccinesToCheck,
    developmentReminder: DEVELOPMENT_REMINDER,
    guidanceTopics: guidanceTopicsForAge(ageInDays),
  };
}
