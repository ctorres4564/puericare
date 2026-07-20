'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getClinicalReportData } from '@/services/clinicalReportService';
import {
  getOrCreateDraftReport,
  getReport,
  updateDraftReport,
  issueReport,
  createNewVersion,
  ReportConflictError,
} from '@/services/reportService';
import {
  listReportSections,
  isSectionIncluded,
  setSectionIncluded,
  setNarrativeField,
  setInstitutionalField,
  REPORT_NARRATIVE_FIELDS,
  type ReportComposition,
} from '@/lib/reports/composition';
import { formatAgeInDays } from '@/lib/consultations/ageInDays';
import { domainLabels, milestoneStatusLabels } from '@/lib/development/labels';
import { vaccinationStatusLabels, vaccinationStatusBadgeClasses } from '@/lib/vaccination/labels';
import { Card, CardHeader } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { ExportReportPdfButton } from '@/components/reports/ExportReportPdfButton';
import type {
  ClinicalReportData,
  ClinicalReportRecord,
  SexAtBirth,
  PerinatalData,
  ConsultationStatus,
  AlertCategory,
  AlertStatus,
} from '@/lib/types';
import type { TimelineEntry } from '@/lib/children/timeline';

/* ── Rótulos (mesma linguagem das demais telas) ── */

const sexLabels: Record<SexAtBirth, string> = {
  female: 'Feminino',
  male: 'Masculino',
  other: 'Outro',
  not_informed: 'Não informado',
};

const deliveryTypeLabels: Record<NonNullable<PerinatalData['deliveryType']>, string> = {
  vaginal: 'Vaginal',
  cesarean: 'Cesárea',
  forceps: 'Fórceps',
  other: 'Outro',
};

const consultationStatusLabels: Record<ConsultationStatus, string> = {
  draft: 'Rascunho',
  completed: 'Finalizada',
  cancelled: 'Cancelada',
};

const alertCategoryLabels: Record<AlertCategory, string> = {
  HIGH_PRIORITY: 'Alta prioridade',
  ATTENTION: 'Atenção',
  INFO: 'Informativo',
};

const alertCategoryBadgeClasses: Record<AlertCategory, string> = {
  HIGH_PRIORITY: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
  ATTENTION: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  INFO: 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
};

const alertStatusLabels: Record<AlertStatus, string> = {
  active: 'Ativo',
  resolved: 'Resolvido',
  dismissed: 'Ignorado',
};

const timelineKindLabels: Record<TimelineEntry['kind'], string> = {
  consultation: 'Consulta',
  growthMeasurement: 'Medição de crescimento',
  developmentAssessment: 'Desenvolvimento',
  vaccinationRecord: 'Vacinação',
  feedingRecord: 'Alimentação',
  sleepRecord: 'Sono',
  clinicalAlert: 'Alerta clínico',
};

/* ── Helpers de apresentação ── */

function fmtDate(isoDate: string): string {
  return new Date(isoDate.slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR');
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <p className="text-sm" style={{ color: 'var(--color-text)' }}>
      <span className="font-medium" style={{ color: 'var(--color-text-muted)' }}>
        {label}:{' '}
      </span>
      {value}
    </p>
  );
}

function EmptySection() {
  return (
    <p className="text-sm italic" style={{ color: 'var(--color-text-subtle)' }}>
      Sem registros disponíveis.
    </p>
  );
}

function RecordDate({ date, ageInDays }: { date: string; ageInDays?: number }) {
  return (
    <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
      {fmtDate(date)}
      {ageInDays !== undefined && (
        <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>
          {' '}
          · {formatAgeInDays(ageInDays)}
        </span>
      )}
    </p>
  );
}

/* ── Prévia (somente leitura) — reaproveitada tanto para o rascunho (dados ao vivo) quanto para um relatório emitido (snapshot congelado) ── */

function ReportPreview({ data, composition }: { data: ClinicalReportData; composition: ReportComposition }) {
  const { patient, professional } = data;
  const { narrative, institutional } = composition;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Identificação" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="Nome" value={patient.fullName} />
          <Field label="Nome social" value={patient.socialName} />
          <Field label="Data de nascimento" value={fmtDate(patient.birthDate)} />
          <Field label="Idade" value={formatAgeInDays(patient.ageInDays)} />
          <Field label="Sexo" value={sexLabels[patient.sexAtBirth]} />
          <Field label="Responsável" value={patient.caregiverName} />
          <Field label="Telefone" value={patient.contactPhone} />
          <Field label="E-mail" value={patient.contactEmail} />
        </div>
        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Profissional" value={institutional.professionalName || professional?.displayName} />
            <Field label="CRM/registro" value={institutional.professionalRegistry} />
            <Field label="Especialidade" value={institutional.specialty} />
            <Field label="Clínica/serviço" value={institutional.clinicName} />
            <Field label="Local" value={institutional.location} />
            <Field label="Data do relatório" value={institutional.reportDate ? fmtDate(institutional.reportDate) : ''} />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Textos do profissional" />
        <div className="flex flex-col gap-4">
          {REPORT_NARRATIVE_FIELDS.map((f) => (
            <div key={f.id}>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                {f.label}
              </p>
              {narrative[f.id].trim() ? (
                <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--color-text)' }}>
                  {narrative[f.id]}
                </p>
              ) : (
                <p className="text-sm italic" style={{ color: 'var(--color-text-subtle)' }}>
                  Não preenchido.
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {isSectionIncluded(composition, 'perinatal') && (
        <Card>
          <CardHeader title="Dados perinatais" />
          {!data.perinatal ? (
            <EmptySection />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field
                label="Idade gestacional"
                value={data.perinatal.gestationalAgeWeeks !== undefined ? `${data.perinatal.gestationalAgeWeeks} semanas` : undefined}
              />
              <Field
                label="Tipo de parto"
                value={data.perinatal.deliveryType ? deliveryTypeLabels[data.perinatal.deliveryType] : undefined}
              />
              <Field
                label="Peso ao nascer"
                value={data.perinatal.birthWeightGrams !== undefined ? `${data.perinatal.birthWeightGrams} g` : undefined}
              />
              <Field
                label="Comprimento ao nascer"
                value={data.perinatal.birthLengthCm !== undefined ? `${data.perinatal.birthLengthCm} cm` : undefined}
              />
              <Field
                label="Perímetro cefálico ao nascer"
                value={data.perinatal.birthHeadCircumferenceCm !== undefined ? `${data.perinatal.birthHeadCircumferenceCm} cm` : undefined}
              />
              <Field label="Apgar 1º minuto" value={data.perinatal.apgar1} />
              <Field label="Apgar 5º minuto" value={data.perinatal.apgar5} />
              <Field label="Prematuridade" value={data.perinatal.premature ? 'Sim' : 'Não'} />
              <Field label="Internação neonatal" value={data.perinatal.neonatalHospitalization ? 'Sim' : 'Não'} />
              <Field label="Intercorrências neonatais" value={data.perinatal.neonatalComplications} />
            </div>
          )}
        </Card>
      )}

      {isSectionIncluded(composition, 'growth') && (
        <Card>
          <CardHeader
            title="Crescimento"
            description={data.growth.latest ? `Última medição em ${fmtDate(data.growth.latest.measurementDate)}.` : undefined}
          />
          {data.growth.measurements.length === 0 ? (
            <EmptySection />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ color: 'var(--color-text-muted)' }}>
                    <th className="pb-2 pr-4 font-medium">Data</th>
                    <th className="pb-2 pr-4 font-medium">Idade</th>
                    <th className="pb-2 pr-4 font-medium">Peso</th>
                    <th className="pb-2 pr-4 font-medium">Comprimento</th>
                    <th className="pb-2 pr-4 font-medium">PC</th>
                    <th className="pb-2 font-medium">IMC</th>
                  </tr>
                </thead>
                <tbody>
                  {data.growth.measurements.map((m) => (
                    <tr key={m.id} className="border-t" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                      <td className="py-2 pr-4">{fmtDate(m.measurementDate)}</td>
                      <td className="py-2 pr-4">{formatAgeInDays(m.ageInDays)}</td>
                      <td className="py-2 pr-4">{m.weightKg !== undefined ? `${m.weightKg} kg` : '—'}</td>
                      <td className="py-2 pr-4">{m.heightCm !== undefined ? `${m.heightCm} cm` : '—'}</td>
                      <td className="py-2 pr-4">{m.headCircumferenceCm !== undefined ? `${m.headCircumferenceCm} cm` : '—'}</td>
                      <td className="py-2">{m.bmi !== undefined ? m.bmi : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {isSectionIncluded(composition, 'development') && (
        <Card>
          <CardHeader title="Desenvolvimento" />
          {data.development.assessments.length === 0 ? (
            <EmptySection />
          ) : (
            <div className="flex flex-col gap-4">
              {data.development.assessments.map((a) => (
                <div key={a.id} className="border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center justify-between gap-4">
                    <RecordDate date={a.assessmentDate} ageInDays={a.ageInDays} />
                    {a.requiresFollowUp && (
                      <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        Necessita acompanhamento
                      </span>
                    )}
                  </div>
                  {a.milestones.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1">
                      {a.milestones.map((ms, i) => (
                        <li key={i} className="text-sm" style={{ color: 'var(--color-text)' }}>
                          <span className="font-medium">{domainLabels[ms.domain]}</span> — {ms.description} ·{' '}
                          <span style={{ color: 'var(--color-text-muted)' }}>{milestoneStatusLabels[ms.status]}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Field label="Observações" value={a.observations} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {isSectionIncluded(composition, 'feeding') && (
        <Card>
          <CardHeader title="Alimentação" />
          {data.feeding.records.length === 0 ? (
            <EmptySection />
          ) : (
            <div className="flex flex-col gap-4">
              {data.feeding.records.map((r) => (
                <div key={r.id} className="border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--color-border)' }}>
                  <RecordDate date={r.recordDate} ageInDays={r.ageInDays} />
                  <Field label="Histórico alimentar" value={r.feedingHistory} />
                  <Field label="Rotina" value={r.routine} />
                  <Field label="Introdução alimentar" value={r.foodIntroduction} />
                  <Field label="Dificuldades" value={r.difficulties} />
                  <Field label="Observações" value={r.observations} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {isSectionIncluded(composition, 'sleep') && (
        <Card>
          <CardHeader title="Sono" />
          {data.sleep.records.length === 0 ? (
            <EmptySection />
          ) : (
            <div className="flex flex-col gap-4">
              {data.sleep.records.map((r) => (
                <div key={r.id} className="border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--color-border)' }}>
                  <RecordDate date={r.recordDate} ageInDays={r.ageInDays} />
                  <Field label="Horário de dormir" value={r.bedtime} />
                  <Field label="Despertares noturnos" value={r.nightWakings} />
                  <Field label="Duração do sono" value={r.sleepDurationHours !== undefined ? `${r.sleepDurationHours} h` : undefined} />
                  <Field label="Cochilos" value={r.naps} />
                  <Field label="Rotina" value={r.routine} />
                  <Field label="Dificuldades" value={r.difficulties} />
                  <Field label="Observações" value={r.observations} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {isSectionIncluded(composition, 'vaccination') && (
        <Card>
          <CardHeader title="Vacinação" description="Somente doses e status registrados — sem inferência de esquema vacinal." />
          {data.vaccination.records.length === 0 ? (
            <EmptySection />
          ) : (
            <div className="flex flex-col gap-4">
              {data.vaccination.records.map((v) => (
                <div key={v.id} className="border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center justify-between gap-4">
                    <RecordDate date={v.recordDate} ageInDays={v.ageInDays} />
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${vaccinationStatusBadgeClasses[v.status]}`}>
                      {vaccinationStatusLabels[v.status]}
                    </span>
                  </div>
                  <Field label="Vacina" value={v.vaccineName} />
                  <Field label="Dose" value={v.doseDescription} />
                  <Field label="Lote" value={v.lot} />
                  <Field label="Estabelecimento" value={v.facility} />
                  <Field label="Observações" value={v.observations} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {isSectionIncluded(composition, 'consultations') && (
        <Card>
          <CardHeader title="Consultas" />
          {data.consultations.length === 0 ? (
            <EmptySection />
          ) : (
            <div className="flex flex-col gap-4">
              {data.consultations.map((c) => (
                <div key={c.id} className="border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center justify-between gap-4">
                    <RecordDate date={c.consultationDate} ageInDays={c.ageInDays} />
                    <span className="shrink-0 text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                      {consultationStatusLabels[c.status]}
                    </span>
                  </div>
                  <Field label="Motivo" value={c.reason} />
                  <Field label="Intercorrências" value={c.intervalHistory} />
                  <Field label="Observações clínicas" value={c.clinicalNotes} />
                  <Field label="Avaliação" value={c.assessment} />
                  <Field label="Conduta/orientações" value={c.plan} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {isSectionIncluded(composition, 'alerts') && (
        <Card>
          <CardHeader title="Alertas clínicos" description="Sinais gerados por regras com fonte clínica — não são diagnósticos." />
          {data.alerts.length === 0 ? (
            <EmptySection />
          ) : (
            <div className="flex flex-col gap-4">
              {data.alerts.map((a) => (
                <div key={a.id} className="border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      {a.title}
                    </p>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${alertCategoryBadgeClasses[a.category]}`}>
                      {alertCategoryLabels[a.category]}
                    </span>
                  </div>
                  <Field label="Situação" value={a.description} />
                  <Field label="Status" value={alertStatusLabels[a.status]} />
                  <Field label="Detectado em" value={fmtDate(a.detectedAt)} />
                  <Field label="Fonte" value={a.clinicalSource} />
                  <Field label="Nota de resolução" value={a.resolutionNote} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {isSectionIncluded(composition, 'timeline') && (
        <Card>
          <CardHeader title="Linha do tempo" description="Visão cronológica consolidada (mais recente primeiro)." />
          {data.timeline.length === 0 ? (
            <EmptySection />
          ) : (
            <ul className="flex flex-col gap-1">
              {data.timeline.map((e) => (
                <li key={`${e.kind}-${e.id}`} className="text-sm" style={{ color: 'var(--color-text)' }}>
                  <span className="font-medium">{fmtDate(e.date)}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}> · {timelineKindLabels[e.kind]}</span>
                  {e.kind === 'consultation' && e.data.reason ? ` — ${e.data.reason}` : ''}
                  {e.kind === 'vaccinationRecord' && e.data.vaccineName ? ` — ${e.data.vaccineName}` : ''}
                  {e.kind === 'clinicalAlert' ? ` — ${e.data.title}` : ''}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

/* ── Página ── */

export default function RelatorioPage() {
  const { id: childId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userProfile } = useAuth();

  const viewReportId = searchParams.get('reportId');

  const [record, setRecord] = useState<ClinicalReportRecord | null>(null);
  const [liveData, setLiveData] = useState<ClinicalReportData | null>(null);
  const [composition, setComposition] = useState<ReportComposition | null>(null);
  const [title, setTitle] = useState('');

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [savedJustNow, setSavedJustNow] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const [confirmingIssue, setConfirmingIssue] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  const [creatingVersion, setCreatingVersion] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!userProfile) return;
    (async () => {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        if (viewReportId) {
          const rec = await getReport(viewReportId);
          if (!rec || rec.professionalId !== userProfile.uid || rec.childId !== childId) {
            setNotFound(true);
            return;
          }
          setRecord(rec);
          setComposition(rec.compositionSnapshot);
          setTitle(rec.title);
          setLiveData(null);
        } else {
          const rec = await getOrCreateDraftReport(userProfile.uid, childId);
          const data = await getClinicalReportData(childId, userProfile.uid);
          if (!data) {
            setNotFound(true);
            return;
          }
          setRecord(rec);
          setComposition(rec.compositionSnapshot);
          setTitle(rec.title);
          setLiveData(data);
        }
      } catch {
        setError('Não foi possível carregar o relatório.');
      } finally {
        setLoading(false);
      }
    })();
  }, [childId, userProfile, viewReportId, reloadToken]);

  async function handleSaveDraft() {
    if (!record || !composition || !userProfile) return;
    setSaving(true);
    setSaveError(null);
    setSavedJustNow(false);
    setConflict(false);
    try {
      const updated = await updateDraftReport(record.id, userProfile.uid, {
        composition,
        title,
        expectedUpdatedAt: record.updatedAt,
      });
      setRecord(updated);
      setSavedJustNow(true);
      setTimeout(() => setSavedJustNow(false), 3000);
    } catch (err) {
      if (err instanceof ReportConflictError) {
        setConflict(true);
      } else {
        setSaveError('Não foi possível salvar o rascunho. Tente novamente.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleIssue() {
    if (!record || !userProfile) return;
    setIssuing(true);
    setIssueError(null);
    try {
      const issued = await issueReport(record.id, userProfile.uid, { title });
      setRecord(issued);
      setComposition(issued.compositionSnapshot);
      setConfirmingIssue(false);
    } catch {
      setIssueError('Não foi possível emitir o relatório. Tente novamente.');
    } finally {
      setIssuing(false);
    }
  }

  async function handleCreateNewVersion() {
    if (!record || !userProfile) return;
    setCreatingVersion(true);
    try {
      await createNewVersion(record.id, userProfile.uid);
      // Sem reportId na URL = editor do rascunho atual (getOrCreateDraftReport
      // encontra o rascunho recém-criado, já que só pode haver um por vez).
      router.push(`/pacientes/${childId}/relatorio`);
    } finally {
      setCreatingVersion(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Carregando...
      </p>
    );
  }

  if (notFound) {
    return (
      <Alert variant="error" title="Não encontrado">
        Este relatório ou paciente não existe, ou não pertence à sua conta.
      </Alert>
    );
  }

  if (error || !record || !composition) {
    return <Alert variant="error">{error ?? 'Não foi possível carregar o relatório.'}</Alert>;
  }

  const isDraft = record.status === 'DRAFT';
  const previewData = isDraft ? liveData : record.clinicalDataSnapshot!;

  if (!previewData) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Carregando...
      </p>
    );
  }

  const patientName = previewData.patient.fullName;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/pacientes/${childId}/consultas`}
          className="text-sm font-medium"
          style={{ color: 'var(--color-primary)' }}
        >
          ← Voltar para o paciente
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              Relatório clínico — {patientName}
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {isDraft
                ? 'Selecione as seções, escreva os textos e revise a prévia. O PDF reflete exatamente o que está na tela.'
                : `Relatório emitido — versão ${record.version}. Este documento é imutável.`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/pacientes/${childId}/relatorios`}
              className="text-sm font-medium"
              style={{ color: 'var(--color-primary)' }}
            >
              Ver histórico
            </Link>
            <ExportReportPdfButton
              patientName={patientName}
              reportDateIso={isDraft ? composition.institutional.reportDate : record.sourceReferenceDate}
              model={isDraft ? undefined : record.pdfModelSnapshot}
              report={isDraft ? previewData : undefined}
              composition={isDraft ? composition : undefined}
            />
          </div>
        </div>
      </div>

      {!previewData.patient.active && (
        <Alert variant="warning">
          Paciente inativo — o relatório reflete apenas o histórico preservado.
        </Alert>
      )}

      {!isDraft && (
        <Alert variant="info" title={`Emitido em ${fmtDateTime(record.issuedAt!)}`}>
          Relatório imutável — alterações no prontuário feitas depois desta emissão não afetam este documento.
          Para refletir dados novos, crie uma nova versão.
          <div className="mt-3">
            <Button onClick={handleCreateNewVersion} loading={creatingVersion} disabled={creatingVersion} size="sm">
              Criar nova versão
            </Button>
          </div>
        </Alert>
      )}

      {isDraft && (
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-[240px] flex-1">
              <Input label="Título do relatório" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {savedJustNow && (
                <span className="text-sm" style={{ color: 'var(--color-success, #16a34a)' }}>
                  Salvo.
                </span>
              )}
              <Button variant="secondary" onClick={handleSaveDraft} loading={saving} disabled={saving || issuing}>
                Salvar rascunho
              </Button>
              <Button onClick={() => setConfirmingIssue(true)} disabled={saving || issuing || confirmingIssue}>
                Emitir relatório
              </Button>
            </div>
          </div>

          {saveError && (
            <Alert variant="error" className="mt-3">
              {saveError}
            </Alert>
          )}
          {conflict && (
            <Alert variant="warning" title="Conflito de edição" className="mt-3">
              Este rascunho foi alterado em outra sessão. Recarregue antes de salvar.
              <div className="mt-2">
                <Button size="sm" variant="secondary" onClick={() => setReloadToken((n) => n + 1)}>
                  Recarregar
                </Button>
              </div>
            </Alert>
          )}

          {confirmingIssue && (
            <Alert variant="warning" title="Confirmar emissão" className="mt-3">
              Após a emissão, este relatório não poderá ser alterado. Novas informações exigirão a emissão de uma
              nova versão.
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={handleIssue} loading={issuing} disabled={issuing}>
                  Confirmar emissão
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirmingIssue(false)} disabled={issuing}>
                  Cancelar
                </Button>
              </div>
              {issueError && <p className="mt-2 text-sm text-red-700 dark:text-red-300">{issueError}</p>}
            </Alert>
          )}
        </Card>
      )}

      <div className={isDraft ? 'grid grid-cols-1 items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]' : ''}>
        {isDraft && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader title="Seções do relatório" description="Identificação é sempre incluída." />
              <ul className="flex flex-col gap-2">
                <li className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  <input type="checkbox" checked disabled aria-label="Identificação (sempre incluída)" />
                  Identificação
                </li>
                {listReportSections(previewData, composition).map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text)' }}>
                    <input
                      type="checkbox"
                      checked={s.included}
                      onChange={(e) => setComposition(setSectionIncluded(composition, s.id, e.target.checked))}
                      aria-label={`Incluir seção ${s.title}`}
                    />
                    {s.title}
                    {!s.hasData && (
                      <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                        (sem dados)
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader
                title="Textos do profissional"
                description="Escritos exclusivamente por você — nenhum texto é gerado automaticamente."
              />
              <div className="flex flex-col gap-4">
                {REPORT_NARRATIVE_FIELDS.map((f) => (
                  <Textarea
                    key={f.id}
                    label={f.label}
                    value={composition.narrative[f.id]}
                    onChange={(e) => setComposition(setNarrativeField(composition, f.id, e.target.value))}
                  />
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Dados institucionais" description="Usados no cabeçalho do PDF." />
              <div className="flex flex-col gap-4">
                <Input
                  label="Nome do profissional"
                  value={composition.institutional.professionalName}
                  onChange={(e) => setComposition(setInstitutionalField(composition, 'professionalName', e.target.value))}
                />
                <Input
                  label="CRM/registro profissional"
                  value={composition.institutional.professionalRegistry}
                  onChange={(e) => setComposition(setInstitutionalField(composition, 'professionalRegistry', e.target.value))}
                />
                <Input
                  label="Especialidade"
                  value={composition.institutional.specialty}
                  onChange={(e) => setComposition(setInstitutionalField(composition, 'specialty', e.target.value))}
                />
                <Input
                  label="Clínica/serviço (opcional)"
                  value={composition.institutional.clinicName}
                  onChange={(e) => setComposition(setInstitutionalField(composition, 'clinicName', e.target.value))}
                />
                <Input
                  label="Local (opcional)"
                  value={composition.institutional.location}
                  onChange={(e) => setComposition(setInstitutionalField(composition, 'location', e.target.value))}
                />
                <Input
                  label="Data do relatório"
                  type="date"
                  value={composition.institutional.reportDate}
                  onChange={(e) => setComposition(setInstitutionalField(composition, 'reportDate', e.target.value))}
                />
              </div>
            </Card>
          </div>
        )}

        <ReportPreview data={previewData} composition={composition} />
      </div>
    </div>
  );
}
