/**
 * Estilos do PDF do Relatório Clínico — Sprint B.3.
 * Aparência documental: fundo branco, tipografia Helvetica, hierarquia sóbria,
 * uso econômico de cor. Sem elementos de dashboard.
 */
import { StyleSheet } from '@react-pdf/renderer';

const INK = '#1a1a1a';
const MUTED = '#555555';
const SUBTLE = '#888888';
const LINE = '#dddddd';
const ACCENT = '#1e4f8a';

export const pdfStyles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    color: INK,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    // NÃO usar lineHeight unitless aqui: bug conhecido do @react-pdf/renderer
    // 4.5.x (issue #3452) — com elemento `render` (números de página), o
    // lineHeight sem unidade é multiplicado pelo fontSize a cada passada de
    // paginação e o documento quebra ("unsupported number") em docs longos.
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
  },

  /* Cabeçalho do documento (primeira página) */
  header: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: ACCENT,
  },
  headerClinic: {
    fontSize: 9,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Helvetica-Bold',
    color: ACCENT,
  },
  headerDate: {
    fontSize: 9,
    color: MUTED,
    marginTop: 4,
  },

  /* Seções */
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: ACCENT,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: LINE,
  },
  sectionNote: {
    fontSize: 8,
    color: SUBTLE,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  emptySection: {
    fontSize: 9,
    color: SUBTLE,
    fontStyle: 'italic',
  },

  /* Campos rótulo/valor */
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  fieldLabel: {
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
  },
  fieldValue: {
    color: INK,
    flexShrink: 1,
  },

  /* Blocos de registro datado */
  record: {
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  recordTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: INK,
  },
  recordBadge: {
    fontSize: 7.5,
    color: MUTED,
    borderWidth: 0.75,
    borderColor: LINE,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },

  /* Tabela (crescimento) */
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingBottom: 3,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 2,
    borderBottomWidth: 0.25,
    borderBottomColor: LINE,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
  },
  tableCell: {
    fontSize: 9,
    color: INK,
  },

  /* Indicação discreta de continuação (tabela multipágina) */
  continuationNote: {
    fontSize: 8,
    color: SUBTLE,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 3,
  },

  /* Narrativa */
  narrativeBlock: {
    marginBottom: 10,
  },
  narrativeLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
    marginBottom: 2,
  },
  narrativeText: {
    fontSize: 9.5,
    color: INK,
    textAlign: 'justify',
  },

  /* Bloco do profissional + área de assinatura */
  professionalBlock: {
    marginTop: 8,
  },
  signatureArea: {
    marginTop: 36,
    alignItems: 'center',
  },
  signatureLine: {
    width: 220,
    borderTopWidth: 0.75,
    borderTopColor: INK,
    marginBottom: 4,
  },
  signatureText: {
    fontSize: 9,
    color: MUTED,
    textAlign: 'center',
  },

  /* Rodapé fixo */
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 6,
  },
  footerDisclaimer: {
    fontSize: 7,
    color: SUBTLE,
    textAlign: 'center',
    marginBottom: 3,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: SUBTLE,
  },
});
