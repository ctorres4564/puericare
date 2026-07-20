# Sprint B.4 — Persistência, versionamento e histórico de relatórios clínicos

Continuação dos Sprints B.1 (agregação — `ClinicalReportData`), B.2 (composição —
`ReportComposition`) e B.3/B.3.1 (modelo e renderização de PDF —
`ReportPdfModel` / `ClinicalReportPdf`), que produziam o relatório inteiramente
em memória, sem persistência. Este sprint não adiciona nenhuma funcionalidade
clínica nova — adiciona **persistência, versionamento e histórico confiável**
ao que já existia.

## Princípio fundamental

> Um relatório clínico **emitido** é imutável. Alterações posteriores no
> prontuário nunca recalculam nem modificam um relatório já emitido.

## Modelo de domínio

`ClinicalReportRecord` (`src/lib/types/clinicalReport.ts`) — ciclo de vida
`DRAFT → ISSUED`:

| Campo | DRAFT | ISSUED |
|---|---|---|
| `version` | `0` | inteiro ≥ 1, atribuído atomicamente na emissão |
| `compositionSnapshot` | composição de trabalho atual (editável) | congelada no momento da emissão |
| `clinicalDataSnapshot` | **ausente** | congelada no momento da emissão |
| `pdfModelSnapshot` | **ausente** | congelada no momento da emissão |
| `issuedAt` / `issuedBy` | ausentes | definidos na emissão, nunca depois |

Optou-se por **não usar** um estado `CANCELLED`/`VOID` nesta fase — não há
necessidade concreta ainda (nenhum caso de uso de "anular documento emitido"
foi pedido). Fica registrado como evolução futura (ver seção "Limitações").

### Por que dados clínicos não são congelados em DRAFT

Decisão central deste sprint: enquanto o relatório está em rascunho, ele
**não** tem uma cópia congelada do prontuário — a tela sempre recarrega os
dados clínicos atuais via `getClinicalReportData` (o mesmo agregador do
Sprint B.1), deixando isso explícito ao profissional ("os dados refletem o
prontuário agora"). Só no exato momento da emissão (`issueReport`) é que os
três snapshots (`clinicalDataSnapshot`, `compositionSnapshot`,
`pdfModelSnapshot`) são lidos e congelados juntos, atomicamente, dentro da
mesma operação que atribui a versão. A partir daí, abrir esse relatório nunca
mais consulta o prontuário — usa só o que foi salvo.

Isso resolve de forma direta o requisito "não usar dados atuais do paciente
para alterar visualmente um documento já emitido" sem precisar de nenhuma
lógica adicional de "não deixar o rascunho ficar desatualizado": o rascunho
*é* sempre atualizado, por definição, até o instante em que deixa de ser
rascunho.

### Redundância do snapshot (decisão A vs. B)

Optou-se pela opção B do enunciado: persistir `clinicalDataSnapshot` +
`compositionSnapshot` + `pdfModelSnapshot` juntos, e não só os dois primeiros
com reconstrução do `ReportPdfModel` sob demanda. Justificativa:
`buildReportPdfModel` é uma função pura hoje, mas nada garante que
permaneça bit-a-bit idêntica para sempre (rótulos, formatação, uma futura
correção de bug) — se ela mudar, reconstruir o modelo a partir do snapshot
"antigo" de dados clínicos produziria um documento visualmente diferente do
que foi de fato emitido. Persistir o `pdfModelSnapshot` pronto elimina essa
dependência: reabrir um relatório histórico nunca executa
`buildReportPdfModel` de novo, só desenha o que já foi calculado.
`rendererVersion` registra qual "geração" do modelo documental gerou aquele
snapshot, para permitir uma futura migração explícita se o formato mudar.

## Versionamento atômico

Versão nunca é "última versão + 1" lida e escrita separadamente (sujeito a
condição de corrida). `issueReport` usa `runTransaction` do Firestore com um
documento contador dedicado por criança, `reportCounters/{childId}`
(`{ lastIssuedVersion: number }`): dentro da mesma transação, lê o contador,
soma 1, escreve o contador de volta **e** atualiza o relatório para `ISSUED`
com essa versão. Duas emissões concorrentes para a mesma criança nunca
recebem a mesma versão — o Firestore rejeita e reexecuta automaticamente a
transação cujo contador mudou entre a leitura e a escrita.

Validado tanto no fake de testes unitários (fila serializada — ver nota em
`src/test/mocks/firestore.ts`) quanto **contra transactions reais do
Firestore**, em `Promise.all` de duas emissões simultâneas no projeto real
(ver seção de validação manual).

## Concorrência em rascunhos (optimistic concurrency)

`updateDraftReport` exige `expectedUpdatedAt` (o `updatedAt` que a tela
carregou). Dentro de uma transação, compara com o `updatedAt` atualmente
persistido; se divergir, lança `ReportConflictError` em vez de sobrescrever
silenciosamente — a tela mostra "Este rascunho foi alterado em outra sessão.
Recarregue antes de salvar." com um botão de recarregar.

## Coleções Firestore

- `reports/{reportId}` — um documento por relatório (rascunho ou versão
  emitida). Sem subcoleções.
- `reportCounters/{childId}` — um documento por criança, uso interno exclusivo
  da transação de emissão; a UI nunca lê nem escreve nele diretamente.

Índices: as consultas usadas (`where('professionalId','==',...)`,
`where('childId','==',...) + where('professionalId','==',...)`) não exigiram
índice composto adicional além do padrão automático do Firestore para
igualdade simples/dupla — confirmado pelos testes de `list query` rodando
sem erro de índice ausente contra o Emulator.

## Regras de segurança (`firestore.rules`)

- `create`: só como `DRAFT`, `version == 0`, para paciente próprio e ativo.
- `update`: permitido **somente** quando `resource.data.status == 'DRAFT'`
  (uma vez `ISSUED`, a condição de nível mais alto já bloqueia qualquer
  atualização, inclusive para ADMIN — a imutabilidade não depende da
  interface). Duas transições possíveis a partir de um DRAFT próprio:
  salvar (mesmo status, mesma versão) ou emitir (`ISSUED`, versão > 0,
  `issuedBy == request.auth.uid`, título não vazio).
- `delete`: autor pode excluir o próprio `DRAFT`; `ISSUED` só ADMIN (mesma
  política de hard-delete das demais coleções clínicas do projeto).
- CAREGIVER: nenhum acesso nesta fase (igual às demais coleções clínicas —
  não há portal do responsável ainda).
- `reportCounters/{childId}`: leitura/escrita restritas ao profissional dono
  da criança (ou ADMIN para leitura).

162 testes de regras passam contra o Firestore Emulator (`npm run
test:rules`), incluindo o bloco novo deste sprint (`reports`,
`reportCounters`, list query composta, bloqueio de conta).

## Serviço (`src/services/reportService.ts`)

Única porta de entrada — a UI nunca escreve no Firestore diretamente:
`createDraftReport`, `getReport`, `listReportsByChild`,
`getOrCreateDraftReport`, `updateDraftReport`, `issueReport`,
`createNewVersion`, `deleteDraftReport`.

## "Criar nova versão"

Não altera o relatório anterior. Cria um novo `DRAFT`: composição (seções +
textos + dados institucionais) copiada da versão anterior, mas totalmente
editável; dados clínicos serão os atuais do prontuário no momento em que
esse novo rascunho for emitido (nunca antes). `previousVersionId` referencia
a versão de origem, para rastreabilidade no histórico.

## PDF

Sem Storage nesta fase — decisão explícita. Para `DRAFT`, o PDF é gerado sob
demanda a partir da composição revisada na tela (`buildReportPdfModel`
executado ao vivo, como já era desde o Sprint B.3). Para `ISSUED`, o PDF usa
diretamente `pdfModelSnapshot` — nunca reconstrói nada a partir do prontuário
atual nem dos services clínicos. `ExportReportPdfButton` foi ajustado para
aceitar um `model` pronto (modo congelado) ou `report`+`composition` (modo ao
vivo).

**Limitação registrada**: a regeneração do PDF depende de
`@react-pdf/renderer` continuar produzindo a mesma saída visual para o mesmo
`pdfModelSnapshot` ao longo do tempo — uma atualização futura da biblioteca
poderia, em tese, alterar detalhes de layout (não o conteúdo, que está
congelado no modelo). `rendererVersion` existe para que uma mudança de
formato deliberada no futuro possa ser rastreada e, se necessário, tratada
com uma migração — mas nenhuma migração foi implementada agora, por não haver
necessidade (esta é a primeira versão do schema).

## Interface

- `/pacientes/[id]/relatorio` — editor do rascunho atual (auto-retomado via
  `getOrCreateDraftReport`) **ou**, com `?reportId=`, visualização somente
  leitura de uma versão emitida específica. Ações: Salvar rascunho / Emitir
  relatório (com confirmação explícita e aviso de imutabilidade) / Exportar
  PDF / Criar nova versão (quando ISSUED).
- `/pacientes/[id]/relatorios` — histórico: rascunho em andamento (se houver)
  primeiro, depois emitidos em ordem decrescente de versão, com ações
  Visualizar/Continuar edição/Excluir rascunho.

Estados cobertos: carregando, salvando, salvo, erro, paciente inexistente
(404 tratado), rascunho, emitido, histórico vazio, conflito de versão,
confirmação de emissão, falha de emissão — botões desabilitados durante
operações em andamento para evitar duplo clique.

## Testes

- **21 testes unitários** novos (`src/services/reportService.test.ts`):
  criar/atualizar/excluir rascunho, isolamento por profissional, conflito de
  `updatedAt`, emissão (título vazio, não-dono, já emitido), snapshot
  congelado (prontuário muda depois, relatório não), duas emissões
  concorrentes nunca com a mesma versão, contadores independentes por
  criança, nova versão (v1 preservada, v2 com dados novos), ordenação do
  histórico.
- **Mock de Firestore estendido** (`src/test/mocks/firestore.ts`) com
  `deleteDoc` e `runTransaction` (transações serializadas por fila — ver nota
  no próprio arquivo).
- **Testes de regras** (`tests/firestore.rules.test.ts`): criação/leitura/
  isolamento, as duas transições de `update` permitidas, imutabilidade real
  de `ISSUED` (inclusive contra ADMIN), exclusão restrita, list query
  composta, bloqueio de conta.
- Suíte completa preservada: 333 testes unitários e 162 testes de regras,
  todos passando.

## Validação manual (dados descartáveis, projeto real)

`firestore.rules` foi publicado no projeto real (`puericultura-62969`) para
permitir a validação. Script descartável reproduziu os cenários A–E do
enunciado usando o SDK real do Firestore (transactions reais, não o fake dos
testes) — resultado e limpeza registrados na entrega deste sprint.

## Limitações que ficam para depois (fora deste sprint)

- Estado `CANCELLED`/`VOID` para anular um relatório emitido por engano —
  não implementado, sem necessidade concreta ainda.
- Acesso do responsável (CAREGIVER) aos relatórios — Sprint B.5.
- Upload/armazenamento do PDF no Firebase Storage — decisão explícita de não
  fazer agora (ver seção "PDF").
- IA/RAG na composição do relatório — fora de escopo, como em todo o projeto.
- Documentos muito longos (histórico extenso) podem, em tese, aproximar-se do
  limite de 1 MB por documento do Firestore, já que os três snapshots ficam
  no próprio documento `reports/{id}`. Não há paciente real perto disso hoje;
  registrado para reavaliação futura caso o histórico cresça muito.
