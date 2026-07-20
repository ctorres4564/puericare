'use client';

/**
 * Botão "Exportar PDF" — Sprint B.3.
 *
 * Geração 100% client-side e sob demanda: @react-pdf/renderer e o componente
 * do documento são carregados por dynamic import no clique, então nada de PDF
 * entra no bundle inicial da página (nem das demais rotas). O PDF é baixado
 * localmente via blob — nenhum envio a serviço externo, nenhum upload,
 * nenhum log de conteúdo clínico.
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { buildReportFileName, type ReportPdfModel } from '@/lib/reports/pdfModel';
import type { ClinicalReportData } from '@/lib/types';
import type { ReportComposition } from '@/lib/reports/composition';

interface ExportReportPdfButtonProps {
  /** Nome do paciente e data (YYYY-MM-DD) — usados só para o nome do arquivo. */
  patientName: string;
  reportDateIso: string;
  /**
   * Modo "congelado" (relatório ISSUED — Sprint B.4): o modelo já pronto do
   * snapshot é usado diretamente, sem reconstruir nada a partir do
   * prontuário atual.
   */
  model?: ReportPdfModel;
  /** Modo "ao vivo" (rascunho): o modelo é construído a partir da composição revisada na tela. */
  report?: ClinicalReportData;
  composition?: ReportComposition;
}

export function ExportReportPdfButton({ patientName, reportDateIso, model, report, composition }: ExportReportPdfButtonProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setGenerating(true);
    setError(null);
    try {
      // Carregamento sob demanda — só no clique, nunca no SSR.
      const [{ pdf }, { ClinicalReportPdf }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./ClinicalReportPdf'),
      ]);

      // ISSUED: usa o snapshot congelado tal como foi emitido. DRAFT: reflete
      // EXATAMENTE a composição revisada na tela neste momento.
      const resolvedModel =
        model ?? (await import('@/lib/reports/pdfModel')).buildReportPdfModel(report!, composition!);
      const blob = await pdf(<ClinicalReportPdf model={resolvedModel} />).toBlob();

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = buildReportFileName(patientName, reportDateIso);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button onClick={handleExport} loading={generating} disabled={generating}>
        {generating ? 'Gerando PDF...' : 'Exportar PDF'}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
