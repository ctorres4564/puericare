/**
 * Documento PDF do Relatório Clínico — Sprint B.3 / B.3.1.
 *
 * Componente puramente documental: recebe o `ReportPdfModel` já resolvido
 * (lib/reports/pdfModel.ts) e apenas o desenha. Não busca dados, não
 * recalcula lógica clínica, não infere, não modifica a composição e não
 * inventa dados ausentes.
 *
 * Paginação (B.3.1):
 * - TÍTULOS NUNCA ÓRFÃOS: cada seção agrupa título + primeiro bloco num
 *   View wrap={false} (minPresenceAhead NÃO funciona dentro de Views no
 *   @react-pdf/renderer 4.5.x — verificado empiricamente). Quando o primeiro
 *   bloco é longo demais para garantir que caiba com o título numa página
 *   (> SAFE_GROUP_CHARS), a seção inteira inicia em página nova (break) —
 *   garantia equivalente, sem estimar coordenadas.
 * - TABELA MULTIPÁGINA: a tabela de crescimento é fragmentada em chunks de
 *   GROWTH_TABLE_CHUNK_ROWS linhas; cada chunk é wrap={false} e repete o
 *   cabeçalho das colunas, com indicação discreta "— continuação".
 * - Registros individuais (consulta, avaliação etc.) não são cortados ao
 *   meio quando cabem numa página (wrap={false} por tamanho estimado).
 * - Rodapé fixo (criança, data de emissão, página X de Y) fora do fluxo.
 */
import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { pdfStyles as s } from './pdfStyles';
import type {
  ReportPdfModel,
  PdfField,
  PdfRecordBlock,
  PdfSection,
  PdfTableBlock,
  PdfTimelineItem,
} from '@/lib/reports/pdfModel';

/**
 * Limiar conservador de caracteres para decidir se um bloco pode ser
 * agrupado com o título da seção num wrap={false} sem risco de exceder uma
 * página (uma A4 útil comporta ~5.000+ caracteres no corpo; 1.500 é
 * folgado). Acima disso, a seção inicia em página nova (break).
 */
export const SAFE_GROUP_CHARS = 1500;

/** Linhas por chunk da tabela de crescimento (cabe folgado numa página). */
export const GROWTH_TABLE_CHUNK_ROWS = 25;

/** Divide linhas em chunks de tamanho fixo (para repetir cabeçalho). */
export function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

function recordCharCount(record: PdfRecordBlock): number {
  return (
    record.title.length +
    (record.badge?.length ?? 0) +
    record.fields.reduce((n, f) => n + f.label.length + f.value.length, 0)
  );
}

function fieldsCharCount(fields: PdfField[]): number {
  return fields.reduce((n, f) => n + f.label.length + f.value.length, 0);
}

function narrativeCharCount(block: { label: string; text: string }): number {
  return block.label.length + block.text.length;
}

/* ── Blocos básicos ── */

function Fields({ fields }: { fields: PdfField[] }) {
  return (
    <View>
      {fields.map((f, i) => (
        <View key={i} style={s.fieldRow}>
          <Text style={s.fieldLabel}>{f.label}: </Text>
          <Text style={s.fieldValue}>{f.value}</Text>
        </View>
      ))}
    </View>
  );
}

function SectionHeader({ title, note }: { title: string; note?: string }) {
  return (
    <>
      <Text style={s.sectionTitle}>{title}</Text>
      {note && <Text style={s.sectionNote}>{note}</Text>}
    </>
  );
}

function RecordBlock({ record }: { record: PdfRecordBlock }) {
  return (
    <View style={s.record} wrap={recordCharCount(record) <= SAFE_GROUP_CHARS}>
      <View style={s.recordHeader}>
        <Text style={s.recordTitle}>{record.title}</Text>
        {record.badge && <Text style={s.recordBadge}>{record.badge}</Text>}
      </View>
      <Fields fields={record.fields} />
    </View>
  );
}

function NarrativeBlock({ block }: { block: { label: string; text: string } }) {
  return (
    <View style={s.narrativeBlock} wrap={narrativeCharCount(block) <= SAFE_GROUP_CHARS}>
      <Text style={s.narrativeLabel}>{block.label}</Text>
      <Text style={s.narrativeText}>{block.text}</Text>
    </View>
  );
}

function TimelineItemRow({ item }: { item: PdfTimelineItem }) {
  return (
    <Text style={[s.fieldValue, { marginBottom: 1.5 }]}>
      {item.date} · {item.label}
      {item.detail ? ` — ${item.detail}` : ''}
    </Text>
  );
}

/* ── Tabela de crescimento fragmentada (cabeçalho repetido por chunk) ── */

function TableChunk({ table, rows }: { table: PdfTableBlock; rows: string[][] }) {
  const colWidth = `${100 / table.columns.length}%`;
  return (
    <View>
      <View style={s.tableHeaderRow}>
        {table.columns.map((c) => (
          <Text key={c} style={[s.tableHeaderCell, { width: colWidth }]}>
            {c}
          </Text>
        ))}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={s.tableRow} wrap={false}>
          {row.map((cell, j) => (
            <Text key={j} style={[s.tableCell, { width: colWidth }]}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function TableSection({ section }: { section: PdfSection & { table: PdfTableBlock } }) {
  const chunks = chunkRows(section.table.rows, GROWTH_TABLE_CHUNK_ROWS);
  const [firstChunk, ...restChunks] = chunks;

  return (
    <View style={s.section}>
      {/* Título + primeiro chunk juntos: título nunca órfão, cabeçalho sempre presente */}
      <View wrap={false}>
        <SectionHeader title={section.title} note={section.note} />
        <TableChunk table={section.table} rows={firstChunk} />
      </View>
      {restChunks.map((rows, i) => (
        <View key={i} wrap={false}>
          <Text style={s.continuationNote}>{section.title} — continuação</Text>
          <TableChunk table={section.table} rows={rows} />
        </View>
      ))}
    </View>
  );
}

/* ── Seções ── */

function Section({ section }: { section: PdfSection }) {
  if (section.table) {
    return <TableSection section={section as PdfSection & { table: PdfTableBlock }} />;
  }

  const blocks: { node: React.ReactNode; chars: number }[] = [];
  if (section.fields) {
    blocks.push({ node: <Fields fields={section.fields} />, chars: fieldsCharCount(section.fields) });
  }
  section.records?.forEach((record) => {
    blocks.push({ node: <RecordBlock record={record} />, chars: recordCharCount(record) });
  });
  // Itens de timeline são linhas únicas — sempre seguros para agrupar.
  section.timeline?.forEach((item) => {
    blocks.push({ node: <TimelineItemRow item={item} />, chars: 0 });
  });

  const [first, ...rest] = blocks;
  const groupWithTitle = first.chars <= SAFE_GROUP_CHARS;

  return (
    <View style={s.section} break={!groupWithTitle}>
      {groupWithTitle ? (
        <>
          <View wrap={false}>
            <SectionHeader title={section.title} note={section.note} />
            {first.node}
          </View>
          {rest.map((b, i) => (
            <React.Fragment key={i}>{b.node}</React.Fragment>
          ))}
        </>
      ) : (
        <>
          <SectionHeader title={section.title} note={section.note} />
          {blocks.map((b, i) => (
            <React.Fragment key={i}>{b.node}</React.Fragment>
          ))}
        </>
      )}
    </View>
  );
}

/* ── Documento ── */

export function ClinicalReportPdf({ model }: { model: ReportPdfModel }) {
  return (
    <Document title={model.title} author={model.professionalFields[0]?.value ?? ''}>
      <Page size="A4" style={s.page}>
        {/* Cabeçalho — sem logotipo fictício; espaço preparado para futura identidade visual */}
        <View style={s.header}>
          {model.clinicName && <Text style={s.headerClinic}>{model.clinicName}</Text>}
          <Text style={s.headerTitle}>{model.title}</Text>
          {model.reportDate !== '' && <Text style={s.headerDate}>Data do relatório: {model.reportDate}</Text>}
        </View>

        {/* Identificação — sempre presente (bloco pequeno, nunca dividido) */}
        <View style={[s.section]} wrap={false}>
          <Text style={s.sectionTitle}>Identificação</Text>
          <Fields fields={model.patientFields} />
        </View>

        {/* Motivo/finalidade — início do documento, quando preenchido */}
        {model.purpose && (
          <View style={s.section}>
            <View wrap={narrativeCharCount(model.purpose) <= SAFE_GROUP_CHARS ? false : undefined}>
              <Text style={s.sectionTitle}>{model.purpose.label}</Text>
              <Text style={s.narrativeText}>{model.purpose.text}</Text>
            </View>
          </View>
        )}

        {/* Seções clínicas selecionadas (apenas as que têm dados) */}
        {model.sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}

        {/* Parecer do profissional — final do documento */}
        {model.closingNarrative.length > 0 && (
          <ClosingNarrative blocks={model.closingNarrative} />
        )}

        {/* Profissional + área reservada para assinatura (sem assinatura digital) */}
        {model.professionalFields.length > 0 && (
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>Profissional responsável</Text>
            <View style={s.professionalBlock}>
              <Fields fields={model.professionalFields} />
            </View>
            <View style={s.signatureArea}>
              <View style={s.signatureLine} />
              <Text style={s.signatureText}>{model.professionalFields[0].value}</Text>
            </View>
          </View>
        )}

        {/* Rodapé fixo em todas as páginas */}
        <View style={s.footer} fixed>
          <Text>{model.footerChildName}</Text>
          {model.reportDate !== '' && <Text>Emitido em {model.reportDate}</Text>}
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function ClosingNarrative({ blocks }: { blocks: { label: string; text: string }[] }) {
  const [first, ...rest] = blocks;
  const groupWithTitle = narrativeCharCount(first) <= SAFE_GROUP_CHARS;

  return (
    <View style={s.section} break={!groupWithTitle}>
      {groupWithTitle ? (
        <>
          <View wrap={false}>
            <Text style={s.sectionTitle}>Parecer do profissional</Text>
            <NarrativeBlock block={first} />
          </View>
          {rest.map((block, i) => (
            <NarrativeBlock key={i} block={block} />
          ))}
        </>
      ) : (
        <>
          <Text style={s.sectionTitle}>Parecer do profissional</Text>
          {blocks.map((block, i) => (
            <NarrativeBlock key={i} block={block} />
          ))}
        </>
      )}
    </View>
  );
}
