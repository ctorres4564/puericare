# Planejamento dos Sprints Restantes — Conclusão do MVP PueriCare

Data: 2026-07-19
Base: `documentacao/planejamento do mvp.txt` (Sprints 1–12, Módulos 1–11),
`documentacao/prd.txt`, `documentacao/AUDITORIA_KIMI.md` e verificação direta
do código em 2026-07-19.

---

## 1. Estado atual (verificado no código)

| Sprint original | Escopo | Status |
|---|---|---|
| 1 — Auth, perfis, regras | `AuthProvider`, login, cadastro, `firestore.rules` | ✅ Pronto |
| 2 — Cadastro da criança | `children`, dados perinatais, listagem/busca | ✅ Pronto |
| 3 — Consulta + linha do tempo | `consultations`, rascunho, timeline por paciente | ✅ Pronto (timeline parcial — ver Sprint A) |
| 4 — Crescimento | `growthMeasurements`, gráficos, IMC | ✅ Pronto (sem percentil/escore-Z — excluído do MVP pelo PRD) |
| 5 — Desenvolvimento | `developmentAssessments`, marcos | ✅ Pronto |
| 6 — Alimentação, sono, vacinação | `feedingRecords`, `sleepRecords`, `vaccinationRecords` | ✅ Pronto |
| 7 — Motor de alertas | `clinicalAlerts`, regras R1–R10, página `/alertas` | ✅ Pronto |
| 8 — Relatórios, PDF, resumo longitudinal | — | ❌ Não iniciado |
| 9 — Base científica (upload, extração, revisão) | — | ❌ Não iniciado |
| 10 — RAG (chunks, embeddings, busca, citações) | — | ❌ Não iniciado |
| 11 — Monitoramento de fontes | — | ❌ Não iniciado |
| 12 — Testes, segurança, piloto, deploy | — | ❌ Não iniciado |

### Lacunas transversais encontradas (não estavam em nenhum sprint)

1. **Rotas fantasma**: sidebar aponta para `/crescimento` e `/conhecimento` (404);
   login redireciona ADMIN para `/admin/dashboard` (404).
2. **Página agregada de crescimento** não existe — só a visão por paciente.
3. **Painel ADMIN** inexistente: as regras já suportam ADMIN (promover, bloquear),
   mas não há UI — hoje exige edição manual no console.
4. **Portal do responsável** é só um placeholder anti-404; o PRD (§2) prevê acesso
   a "relatórios exportados" — depende do Sprint 8 original.
5. **Timeline** cobre 4 tipos (consulta, medição, desenvolvimento, vacina); o
   Módulo 10 prevê também alimentação, sono e alertas.
6. **3 erros de lint pré-existentes** (`alertas/page.tsx`, `lib/alerts/rules.test.ts`).
7. **`firebase.json` não tem hosting nem functions** — deploy ainda não configurado.

---

## 2. Mapa dos sprints restantes

Os sprints originais 8–12 foram resequenciados em 6 sprints (A–F). A ordem
prioriza o que é necessário para o **piloto de campo** e empurra o risco técnico
maior (RAG) para depois do primeiro feedback de profissionais.

| Sprint | Conteúdo | Sprint original | Estimativa |
|---|---|---|---|
| A | Consolidação: rotas, admin, timeline completa, lint | lacunas transversais | 3–5 dias |
| B | Relatório PDF + portal do responsável | 8 | 5–8 dias |
| C | Base científica documental (sem RAG) | 9 | 5–8 dias |
| D | RAG supervisionado | 10 | 8–12 dias |
| E | Monitoramento de fontes | 11 | 3–5 dias |
| F | Piloto: segurança, testes E2E, deploy | 12 | 5–8 dias |

**Portões sugeridos:**
- Fim do Sprint B → **MVP clínico completo**, apto a piloto de campo *sem* o módulo
  de conhecimento (é o mínimo honesto para colocar na mão de profissionais).
- Fim do Sprint E → MVP completo conforme planejamento original, incluindo RAG.
- Sprint F fecha com deploy e instrumentação do piloto.

---

## Sprint A — Consolidação e rotas (3–5 dias)

**Objetivo**: eliminar todos os 404 e pendências transversais antes de qualquer
funcionalidade nova. Nenhuma coleção nova; baixo risco.

### A.1 — Página agregada `/crescimento`
- Criar `src/app/(dashboard)/crescimento/page.tsx`: lista de pacientes ativos do
  profissional com última medição (data, peso, altura, PC, IMC) e link para
  `/pacientes/[id]/crescimento`.
- Reuso: `listChildrenByProfessional`, `listGrowthMeasurementsByProfessional`;
  agregação "última medição por criança" em `src/lib/growth/` (função pura, testada,
  no padrão de `lib/dashboard/stats.ts`).
- Testes: unitários da agregação + render básico.

### A.2 — Rota `/conhecimento`
- Opção mínima (recomendada até o Sprint C): página "Em breve" explicando o módulo,
  no estilo do placeholder de `responsavel/dashboard/page.tsx`.
- Alternativa: remover o link da sidebar até o Sprint C. **Não** deixar 404.

### A.3 — Painel ADMIN mínimo `/admin/dashboard`
- Listar usuários (`users`), ativar/bloquear (`active`), alterar papel
  (`PROFESSIONAL`/`CAREGIVER`) — tudo já permitido pelas regras atuais para ADMIN.
- Novo service: `listUsers()`, `setUserActive()`, `setUserRole()` em `userService.ts`.
- Guarda de rota: a página verifica `userProfile.role === 'ADMIN'`.
- Regra de segurança adicional: `allow list` em `users` hoje exige
  `request.auth.uid == userId || isAdmin()` — **list query por ADMIN já funciona**
  (isAdmin é constante por request); cobrir com teste de regras (list query de ADMIN).
- Testes: service (mock) + regras (emulador).

### A.4 — Timeline completa (Módulo 10)
- Estender `src/lib/children/timeline.ts` com `feedingRecord`, `sleepRecord` e
  `clinicalAlert` (tipos já existem; é aditivo e retrocompatível).
- Atualizar a página de consultas do paciente para renderizar os novos tipos.
- "Intercorrências, orientações e documentos" (Módulo 10) ficam cobertos pelos
  campos de texto da consulta — sem coleções novas neste MVP.
- Testes: estender `timeline.test.ts`.

### A.5 — Lint
- Corrigir `src/app/(dashboard)/alertas/page.tsx:187` (`set-state-in-effect`) e
  `src/lib/alerts/rules.test.ts:80` (`no-explicit-any`).

**Critério de aceite**: zero 404 navegando por todos os papéis; `lint`, `typecheck`,
`test`, `test:rules`, `build` verdes.

---

## Sprint B — Relatório PDF + portal do responsável (5–8 dias)
**(Sprint 8 original — Módulo 11)**

**Objetivo**: o profissional emite um relatório longitudinal editável em PDF por
paciente; o responsável (CAREGIVER) acessa os relatórios do seu filho. É o que
transforma o portal do responsável de placeholder em recurso real.

### B.1 — Geração de PDF (client-side)
- Decisão técnica: **`@react-pdf/renderer`** (componentes React, tipado, sem
  dependência de DOM) — adicionar dependência (hoje não existe nenhuma lib de PDF).
- `src/lib/reports/buildReportData.ts`: agrega dados já existentes (criança,
  dados perinatais, última medição, desenvolvimento, alimentação, sono, vacinação,
  alertas ativos/resolvidos, plano/orientações da última consulta) — função pura.
- `src/components/reports/ReportDocument.tsx`: layout do PDF.
- Botão "Emitir relatório" em `/pacientes/[id]` com **tela de revisão/edição**
  antes da emissão (Módulo 11: "o documento deve ser editável antes da emissão"):
  campos editáveis de plano e orientações + resumo gerado.

### B.2 — Coleção `reports`
```ts
interface Report {
  id: string;
  childId: string;
  professionalId: string;
  /** imutável após emissão — conteúdo congelado do relatório */
  content: ReportContent;
  createdAt: string;
  createdBy: string;
}
```
- Regras (`firestore.rules`):
  - `create`: PROFESSIONAL dono da criança (mesmo padrão de `consultations`).
  - `read`: profissional dono, ADMIN **e CAREGIVER vinculado**
    (`request.auth.uid in childOf(resource.data.childId).caregiverIds`) — primeiro
    recurso de leitura do portal do responsável.
  - Sem `update`/`delete` para profissional (relatório emitido é imutável);
    delete só ADMIN.
- Testes de regras: criar/ler/isolamento/caregiver vinculado e não vinculado.

### B.3 — Portal do responsável
- Substituir o placeholder: `responsavel/dashboard` lista as crianças vinculadas
  (`children` onde `caregiverIds` contém o uid — regra de leitura já existe) e os
  relatórios disponíveis para download.
- Regra adicional necessária: **list query de `children` por caregiver**
  (`where('caregiverIds', 'array-contains', uid)`) — validar no emulador que a
  regra atual (`request.auth.uid in resource.data.caregiverIds`) prova essa query.

### B.4 — Resumo longitudinal (Sprint 8 original)
- A tela de revisão do relatório inclui um resumo longitudinal textual gerado
  deterministicamente (contagens, datas, última medição vs. anterior) — sem IA.

**Critério de aceite**: profissional emite PDF editável; caregiver vê e baixa só os
relatórios das crianças vinculadas; testes de regras cobrem o isolamento.

---

## Sprint C — Base científica documental (5–8 dias)
**(Sprint 9 original)**

**Objetivo**: base documental supervisionada — upload, metadados e fluxo de revisão.
**Sem busca semântica ainda** (isso é o Sprint D). Entrega a seção "Conhecimento"
da sidebar com conteúdo real.

### C.1 — Modelo de dados (3 coleções novas)
```ts
// scientificSources — de onde vêm os documentos
{ id, institution, url, topic, connectorType: 'manual', frequency, state,
  lastCheckedAt, lastSuccessAt, lastError }

// scientificDocuments — documentos ingeridos
{ id, sourceId, title, institution, publishedAt, topic, status:
  'pending' | 'approved' | 'rejected', storagePath, hash,
  supersedesDocumentId?, preliminaryScore?, createdAt, reviewedBy?, reviewedAt }

// scientificReviews — decisões de revisão (auditoria)
{ id, documentId, action: 'approve' | 'reject' | 'request_changes',
  notes, reviewerId, createdAt }
```

### C.2 — Regras
- MVP: revisão feita por **ADMIN** (o papel "revisor científico" dedicado fica para
  v1.1 — evita mexer no modelo de papéis em véspera de piloto).
- `read` de documentos **aprovados**: qualquer profissional autenticado.
- `read` de pendentes + `write` em todas: só ADMIN.
- Firebase Storage para os arquivos (adicionar `storage.rules`: write só ADMIN,
  read autenticado; habilitar Storage no projeto).

### C.3 — Upload e extração
- Upload via console ou tela admin (PDF/TXT). Extração de texto no cliente para
  TXT; para PDF, usar `pdfjs-dist` no cliente ou deixar a extração para o Sprint D
  (decisão: manter Sprint C só com metadados + arquivo — extração entra no D).
- Telas admin: **Fontes**, **Documentos pendentes**, **Revisão** (conforme
  planejamento §9 — sem "resumo automático" e "diff de versões", que dependem de IA).

### C.4 — Página `/conhecimento` (profissional)
- Substitui o placeholder do Sprint A.2: lista de documentos **aprovados**, com
  instituição, tema, data e download/visualização.

**Critério de aceite**: ADMIN cadastra fonte, sobe documento, aprova; profissional
vê o documento aprovado em `/conhecimento`; documento pendente/rejeitado nunca
aparece para profissional (teste de regras).

---

## Sprint D — RAG supervisionado (8–12 dias)
**(Sprint 10 original)**

**Objetivo**: o profissional pergunta em linguagem natural e recebe resposta
**exclusivamente** baseada nos documentos aprovados, com citações. Princípio do
planejamento: "ausência de evidência gera resposta de insuficiência".

> ⚠️ **Decisões de infraestrutura antes de começar** (bloqueantes):
> 1. **Plano Blaze** do Firebase — Cloud Functions com chamadas de rede externas
>    (API de embeddings/LLM) não funcionam no plano Spark.
> 2. **Provedor de LLM/embeddings** (ex.: OpenAI, Gemini) — chave fica em
>    Cloud Functions, **nunca** no cliente.
> 3. Adicionar `functions/` ao projeto (firebase.json + `firebase init functions`).

### D.1 — Indexação (Cloud Function, trigger Firestore)
- Trigger onUpdate de `scientificDocuments`: quando `status` vira `approved`,
  extrai texto (pdf-parse), divide em **chunks** (~500 tokens, sobreposição 10%),
  gera embeddings e grava em `scientificChunks`:
```ts
{ id, documentId, chunkIndex, text, embedding: number[], metadata }
```
- Regras: `scientificChunks` — write negado no cliente (só Admin SDK); read só via
  Function (nenhum acesso direto do cliente).

### D.2 — Consulta (Callable Function `askKnowledgeBase`)
1. Recebe a pergunta do profissional autenticado (validar role via `users`).
2. Embedding da pergunta → busca por similaridade (cosseno) nos chunks
   (top-k=5; MVP pode calcular em memória se a base for pequena — <10k chunks;
   acima disso, avaliar Firestore Vector Search, já disponível no Firestore).
3. Se similaridade máxima < limiar → resposta de insuficiência ("a base não
   contém evidência suficiente sobre este tema").
4. Senão → LLM gera resposta **restrita aos trechos recuperados**, com citação
   obrigatória (documento, instituição, página/seção quando houver).
5. Persistir em `knowledgeQueries` (pergunta, resposta, citações, uid, data) para
   auditoria — regra: read só do próprio profissional + ADMIN.

### D.3 — UI
- Caixa de pergunta em `/conhecimento`: resposta com citações clicáveis
  (abrem o documento) e aviso permanente de que o conteúdo é apoio, não conduta.

### D.4 — Guarda-rails clínicos (obrigatórios, do planejamento)
- Nunca responder sem fonte recuperada; nunca inventar referência.
- Prompt de sistema fixo, versionado no código; temperatura 0.
- Log de todas as consultas para revisão do piloto.

**Critério de aceite**: pergunta dentro da base → resposta com citação correta;
pergunta fora da base → resposta de insuficiência; nenhuma chamada de LLM sai do
cliente; testes de integração da Function com emulador + mocks da API de LLM.

---

## Sprint E — Monitoramento de fontes (3–5 dias)
**(Sprint 11 original)**

**Objetivo**: detectar documentos novos/atualizados nas fontes cadastradas.

- Scheduled Function (Cloud Scheduler, 1×/dia): para cada `scientificSource` com
  `connectorType: 'rss' | 'sitemap'`, busca o feed/sitemap, compara **hash** do
  conteúdo com o último conhecido.
- Novidade detectada → cria `scientificDocuments` com `status: 'pending'` (entra
  na fila de revisão do Sprint C) e atualiza `lastCheckedAt/lastSuccessAt/lastError`.
- Estado e erros visíveis na tela Fontes (campos já previstos no modelo do Sprint C).
- Nada é publicado sem revisão humana (invariante do planejamento: "nenhuma
  atualização científica é publicada diretamente").

**Critério de aceite**: fonte RSS de teste gera documento pendente; erro de rede
registra `lastError` sem derrubar a rotina; testes com fetch mockado.

---

## Sprint F — Piloto, segurança e deploy (5–8 dias)
**(Sprint 12 original)**

### F.1 — Deploy
- `firebase.json`: adicionar **hosting** (Next.js — `next.config.mjs` com output
  adequado ou Firebase App Hosting) e functions (se Sprint D/E entregues).
- Publicar `firestore.rules` e `storage.rules` (hoje as rules são publicadas
  manualmente — documentar o comando no README).
- Domínio, variáveis de ambiente de produção, `.env` segregados por ambiente.

### F.2 — Segurança
- Revisão final das regras contra `SECURITY.md`; rodar `test:rules` completo.
- Habilitar **Firebase App Check** (reCAPTCHA) para mitigar abuso da API web key.
- Verificar índices necessários (`firestore.indexes.json`) para as queries usadas.
- LGPD: termo de consentimento no cadastro de paciente; dados de saúde de menores —
  revisar texto legal com o contratante antes do piloto.

### F.3 — Qualidade
- Testes E2E mínimos do fluxo do piloto (login → cadastro → consulta → medição →
  alerta → relatório PDF) — Playwright (dependência nova) ou checklist manual
  scriptado. Decisão: checklist manual scriptado é suficiente para o piloto.
- `npm run test:all`, lint, typecheck, build — gate obrigatório.

### F.4 — Preparação do piloto
- Script de seed (emulador → dump) para dados de demonstração.
- Roteiro de teste de campo: tarefas para os profissionais executarem + formulário
  de feedback (Google Forms já resolve).
- Canal de suporte e plano de rollback (hosting versions do Firebase).

**Critério de aceite**: app no ar em URL pública; 3–5 profissionais executam o
roteiro completo sem erro bloqueante; feedback coletado e triado.

---

## 3. Fora de escopo (confirmar com o produto — v1.1+)

- **Curvas completas da OMS, percentil, escore-Z, classificação nutricional** —
  o PRD (§7, §18, §19) exclui do MVP e o planejamento remete à v1.1; exigem as
  tabelas oficiais OMS/WHO licenciadas no projeto.
- Alerta de "queda relevante na curva" (depende de escore-Z).
- Papel dedicado de "revisor científico" (MVP usa ADMIN).
- Resumo automático e diff de versões na revisão de documentos (IA).
- Reconhecimento de voz, app mobile nativo, modo offline.

## 4. Decisões que preciso que você tome

1. **Plano Blaze** (obrigatório para Sprints D/E — RAG e monitoramento). Sem ele,
   o piloto sai ao fim do Sprint C com a base documental manual.
2. **Provedor de LLM/embeddings** e orçamento (Sprint D).
3. **Lib de PDF**: `@react-pdf/renderer` (recomendada) ou `jspdf`.
4. **Portal do responsável no piloto**: entra (Sprint B.3) ou o piloto é só com
   profissionais? Se não entrar, o Sprint B encolhe ~2 dias.
5. **Ordem**: recomendo A → B → (piloto clínico) → C → D → E → F. Alternativa:
   A → B → C → D → E → F com piloto único no final.

## 5. Riscos principais

| Risco | Mitigação |
|---|---|
| RAG alucinar conteúdo clínico | Resposta restrita a chunks + limiar de similaridade + temperatura 0 + log auditável (Sprint D.4) |
| Custo de embeddings/LLM | Base pequena e supervisionada; cache de embeddings; limite de consultas/dia por usuário |
| Criar primeiro ADMIN para o painel | Já documentado nas regras: bootstrap manual no console (1×) |
| Escopo do piloto inflar | Portões: piloto clínico pode começar após o Sprint B, sem esperar o RAG |
