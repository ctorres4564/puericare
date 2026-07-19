# RELATÓRIO DE AUDITORIA TÉCNICA — PueriCare (MVP 1, Sprint 1)

**Escopo auditado:** `C:/puericultura` (raiz) e `app/` (aplicação Next.js 16 + React 19 + Firebase).
**Estado do repositório:** 2 commits em `app/`; há alterações não commitadas (`firestore.ts`, `userService.ts`) e a rota `setup/` ainda não versionada. O `.git` da raiz não possui nenhum commit.

---

## 1. Arquitetura — Nota 6,5

**Pontos observados:**

- Estrutura de pastas convencional e previsível: `src/app` (rotas), `src/components/ui` e `src/components/layout`, `src/lib` (firebase, auth, types), `src/services`. Boa separação entre UI, serviços e tipos.
- Inicialização *lazy* do Firebase (`client.ts`, `firestore.ts`) é uma solução bem pensada para o problema de pré-render sem variáveis de ambiente.
- Camada de serviços (`userService.ts`) isola o acesso ao Firestore — bom desacoplamento para um MVP.
- Route group `(dashboard)` separando área autenticada das rotas públicas.

**Problemas:**

- **A proteção de rotas é apenas client-side.** `proxy.ts` (edge) não verifica token nenhum — apenas redireciona `/` para `/login`. O próprio comentário admite isso. Todo o conteúdo do dashboard é entregue ao navegador independentemente de autenticação; a "guarda" é cosmética contra um atacante, que pode simplesmente ler o Firestore diretamente com o SDK client (as chaves `NEXT_PUBLIC_*` são públicas por natureza).
- **Não existe camada de autorização por papel.** `UserRole` existe no tipo, há redirecionamento por papel no login, mas nenhuma verificação de permissão em nenhum lugar — nem no cliente, nem (principalmente) no banco.
- **Rotas fantasma:** o login redireciona `ADMIN` para `/admin/dashboard` e `CAREGIVER` para `/responsavel/dashboard`, rotas que **não existem** (404 garantido). Sidebar e dashboard linkam para `/pacientes`, `/consultas`, `/crescimento`, `/vacinacao`, `/conhecimento`, `/pacientes/novo` — todas inexistentes.
- **Monorepo acidental e conflitante:** a raiz tem `package.json`, `package-lock.json`, `node_modules/`, `tsconfig.json` e `tsconfig.tsbuildinfo` próprios, com versões **diferentes e incompatíveis** das de `app/` (detalhes na seção 10). Há dois repositórios git aninhados (raiz sem commits, `app/` com commits).
- Escalabilidade futura: não há camada de domínio/casos de uso; à medida que consultas, crescimento e vacinação entrarem, os services vão inchar. Aceitável para sprint 1, mas já é dívida anunciada.

---

## 2. Qualidade do Código — Nota 7

**Pontos positivos:**

- Código legível, funções curtas, nomes claros e consistentes, comentários em português explicando decisões (ex.: `proxy.ts`, `client.ts`).
- Componentes pequenos e coesos; nenhum arquivo excede 210 linhas.
- Reutilização real: `Input`, `Button`, `Alert`, `Card` usados em todas as páginas; layout de autenticação compartilhado entre `login` e `esqueci-senha`.
- `stripUndefined` resolve corretamente uma armadilha real do Firestore (rejeita `undefined`).

**Problemas:**

- **Padrão `Proxy` deprecated** (`auth` e `db` em `client.ts:61-65` e `firestore.ts:28-32`): truque frágil, quebra tree-shaking e análise estática. Está marcado `@deprecated`, mas código morto deveria ser removido, não mantido.
- **Casts que contornam o type-checker:** `as UserProfile` (`userService.ts:74`) após leitura sem validação; `as { code?: string }` repetido em 4 lugares para extrair erros Firebase — deveria ser um helper único (`getFirebaseErrorCode`).
- **Duplicação:** schema de e-mail zod repetido em `login/page.tsx` e `esqueci-senha/page.tsx`; mapeamento de erros Firebase só existe no login (o reset de senha tem tratamento paralelo e divergente).
- **Mensagem de erro inadequada ao usuário final** em `setup/page.tsx:91`: "Verifique se o Firestore está ativo e no **modo de teste**" — vaza detalhe de infraestrutura e revela o estado inseguro do banco.
- Assets mortos do create-next-app em `public/` (`next.svg`, `vercel.svg` etc.).
- `pageTitle` do `Header` nunca é passado pelo layout — prop órfã.

---

## 3. Segurança — Nota 3

**Pontos positivos (reais, mas poucos):**

- `.env.local` **não está versionado**; `.gitignore` correto; `.env.local.example` bem documentado.
- Reset de senha não revela se o e-mail existe (anti-enumeration) — boa prática.
- Validação de entrada com zod nos formulários; mapeamento de erros Firebase para mensagens genéricas no login.
- Sem uso de `dangerouslySetInnerHTML` ou HTML injetado — risco de XSS baixo no código atual.

**Problemas graves:**

- **CRÍTICO — Ausência total de Firestore Security Rules no repositório.** Não existe `firestore.rules`, `firebase.json` ou `.firebaserc` em nenhum lugar. O `SECURITY.md` afirma que "cada usuário só pode ler/escrever documentos com `ownerId` igual ao seu UID" — mas (a) não há regras versionadas e (b) o campo `ownerId` **nem existe no modelo** (`Child` usa `professionalId`/`caregiverIds`). A mensagem de erro da página de setup sugere que o banco está em **modo de teste** (leitura/escrita abertas a qualquer pessoa com a API key, que é pública). Para um sistema que armazenará **dados de saúde de crianças**, isso é o problema mais grave do projeto.
- **CRÍTICO — Rota `/setup` pública e sem autenticação**, que cria usuários com qualquer papel, **inclusive `ADMIN`**, e sobrescreve perfis existentes no Firestore. A própria página exibe um aviso de "não expor em produção", mas nada a protege tecnicamente. Qualquer visitante pode se auto-promover a administrador.
- **Autorização inexistente:** nenhuma verificação de `role` em código; o conceito de ADMIN/PROFESSIONAL/CAREGIVER é apenas cosmético.
- **Autenticação apenas client-side:** conforme seção 1, um usuário não autenticado recebe todo o JS do dashboard e pode chamar o Firestore diretamente.
- **Sem headers de segurança:** `next.config.mjs` não define `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, `Permissions-Policy` etc.
- **LGPD:** `SECURITY.md` promete criptografia de campos sensíveis com `crypto.subtle`, consentimento registrado e direito ao esquecimento — **nada disso existe no código**. A documentação descreve uma segurança que não foi implementada, o que é pior do que não documentar: cria falsa sensação de conformidade.
- Sessão com `browserLocalPersistence` (sessão persiste indefinidamente no navegador) sem timeout ou política de expiração — atenção para computadores compartilhados em consultórios.

---

## 4. Performance — Nota 6

- **Tudo é `'use client'` + `force-dynamic`:** as quatro páginas e o layout do dashboard forçam renderização dinâmica e hidratação completa. Abre-se mão de SSR/SSG/streaming — o principal motivo de usar Next.js. Para app autenticado é parcialmente justificável, mas login e esqueci-senha poderiam ser Server Components com apenas o formulário no cliente.
- Pontos bons: fontes via `next/font` (otimizadas, sem FOUT externo), imports modulares do Firebase (tree-shakeable), design tokens em CSS variables (zero runtime CSS-in-JS), bundle pequeno por ora.
- Ausências (irrelevantes hoje, mas sem estratégia): sem memoização, sem cache de dados Firestore (cada navegação relê o perfil), sem `onSnapshot` (leituras duplicadas em `AuthProvider` + `login/page.tsx` — o perfil é buscado duas vezes no fluxo de login).
- Dark mode via `prefers-color-scheme` sem toggle — barato, mas a sidebar usa cores fixas escuras que podem conflitar com o tema claro do sistema.

---

## 5. Banco de Dados — Nota 4

- **Modelagem de tipos é o ponto forte:** `Child` e `PerinatalData` são bem desenhados (unidades explícitas nos nomes dos campos: `birthWeightGrams`, `gestationalAgeWeeks`), com enums adequados.
- **Inconsistência de timestamps:** grava-se `createdAt`/`updatedAt` como ISO string local **e** `_serverCreatedAt`/`_serverUpdatedAt` como `serverTimestamp()`. Duas fontes de verdade para o mesmo dado; o relógio do cliente pode estar errado e é o valor que o app lê.
- **Sem regras, sem índices, sem validação server-side:** qualquer formato de documento pode ser gravado por qualquer cliente. O tipo TypeScript não protege nada no Firestore.
- **Desnormalização sem contrapartida:** `linkedChildIds` no usuário e `caregiverIds` na criança — duas listas que precisam ser mantidas sincronizadas sem transação nem trigger.
- Leitura sem validação de schema (`snap.data()` + cast): um documento malformado quebra a UI em runtime.
- Coleções do PRD (`consultations`, `growth`, `development`, `knowledge`, `reports`) ainda não existem — impossível avaliar; a modelagem atual não demonstra estratégia de subcoleções, paginação ou custos de leitura.

---

## 6. TypeScript — Nota 7,5

- `strict: true`, path alias `@/*`, tipos de domínio bem documentados com JSDoc, inferência de zod (`z.infer`), `forwardRef` tipado corretamente.
- **Zero `any` explícito** no código — raro e positivo.
- Ressalvas: casts inseguros citados na seção 2 (`as UserProfile`, `as keyof Auth`, `as { code?: string }`), `target: ES2017` conservador (irrelevante na prática com o compilador do Next), e a raiz do repositório declara `typescript: 7.0.2` (versão inexistente/inválida — ver seção 10).

---

## 7. Front-end — Nota 7

- Design system embrionário bem feito: tokens em CSS variables, componentes UI com variantes, foco visível, `aria-describedby`, `aria-invalid`, `role="alert"`, `aria-current="page"` — acessibilidade acima da média para um MVP.
- Responsividade: grid do dashboard adapta (`sm:`, `xl:`), header esconde info em mobile.
- **Problemas:** sidebar fixa de 256px **sem versão mobile** (sem menu hambúrguer — em telas pequenas a navegação some ou quebra o layout); emojis como ícones (inconsistente entre plataformas); 6 links da sidebar e 3 do dashboard levam a 404; dark mode herdado do SO sem controle do usuário; nenhum teste de acessibilidade.

---

## 8. Back-end — Nota 2 (inexistente)

Não há back-end: zero API routes, zero Server Actions, zero Firebase Admin SDK, zero Cloud Functions. A arquitetura é 100% BaaS client-to-Firestore. Isso é uma escolha válida para MVP — **mas só funciona com Security Rules rigorosas, que não existem**. Sem regras, o "back-end implícito" do projeto é um banco aberto na internet. Qualquer lógica sensível futura (RAG com OpenAI, geração de PDF, anonimização) exigirá um back-end que hoje não tem onde viver.

---

## 9. Firebase — Nota 2,5

- **Auth:** corretamente encapsulado, lazy init, persistência local, tratamento de erros. Ponto forte relativo.
- **Firestore:** sem regras versionadas (provável modo teste), sem índices, sem `firebase.json`, sem emuladores configurados para desenvolvimento/testes, leituras sem validação.
- **Storage:** mencionado nos docs, não configurado nem usado.
- **Custos:** nenhuma estratégia — sem paginação, sem cache, sem limites de leitura. Com dados clínicos crescendo por paciente, leituras ingênuas escalam o custo linearmente.
- Não há procedimento de bootstrap de produção (criação do primeiro admin depende da rota insegura `/setup`).

---

## 10. Dependências — Nota 5

- `app/package.json`: enxuto e moderno — next 16.2.10, react 19.2.4, zod 4, react-hook-form 7, firebase 12. Nada supérfluo.
- **`npm audit`: 2 vulnerabilidades moderadas** (postcss < 8.5.10, XSS via stringify — GHSA-qx2v-qp2m-jg93, transitiva do next). Corrigível com atualização minor.
- **Raiz do repositório em estado quebrado:** `package.json` declara `next ^14.2.0` + `react ^18` (conflita com next 16/react 19 de `app/`), `typescript 7.0.2` (versão que não existe no npm — `npm install` na raiz **falha**), e devDependencies de teste (`vitest`, `playwright`, `@testing-library/*`) que **não existem em `app/`** — ou seja, os scripts `test` e `test:e2e` estão quebrados nos dois lugares. Há um `node_modules/` gigante na raiz (105+ pacotes) com cópias divergentes de firebase/next.
- Docs mencionam `openai` — não instalado (coerente por ora).

---

## 11. Testes — Nota 0

**Não existe um único teste.** Sem arquivos `*.test.*`/`*.spec.*`, sem `vitest.config`, sem `playwright.config`, sem as dependências de teste instaladas em `app/`. Scripts `test` e `test:e2e` quebram ao serem executados. Para um sistema que manipulará dados clínicos, os testes ausentes mais importantes seriam: regras do Firestore (emulador), fluxos de autenticação/autorização, e validação dos schemas.

---

## 12. DevOps — Nota 2,5

- Sem CI/CD: nenhum workflow (`.github/workflows` inexistente), embora os docs afirmem "deploy automático na Vercel ao push em main" — não configurado no repositório.
- `output: 'standalone'` no next.config sugere intenção de deploy em container, mas não há Dockerfile.
- Repositório duplo/confuso (git na raiz sem commits + git em `app/`), dois lockfiles, dois `node_modules`.
- Pontos bons: `.env.local.example` completo, `.gitignore` correto cobrindo `.env*`, scripts de `lint` e `typecheck` funcionais, `tsconfig.tsbuildinfo` ignorado em `app/` (mas commitado na raiz).

---

## 13. Documentação — Nota 5,5

- Positivo: README objetivo com stack, instalação e scripts; PRD claro; `AGENTS.md` com regra útil sobre a versão do Next; documentação de sprint em `documentacao/`; JSDoc consistente no código.
- Negativo: **a documentação descreve um sistema que não existe** — regras de Firestore por `ownerId`, criptografia de campos sensíveis, consentimento LGPD, CI/CD Vercel, coleções que não foram criadas. `README.md` referencia `ROADMAP.md` e `FUTURE.md` (inexistentes) e `.env.example` (o arquivo real é `.env.local.example`). Novo desenvolvedor será induzido a falsas premissas de segurança.

---

# RELATÓRIO FINAL

## Resumo Executivo

O PueriCare é um MVP em sprint 1 com uma base de código **limpa, legível e bem organizada** — autenticação Firebase, três telas de auth, dashboard placeholder e design tokens. A qualidade do código escrito está acima da média de protótipos. Porém, o projeto tem **dois bloqueadores críticos de segurança**: não existem Firestore Security Rules versionadas (o banco aparenta estar em modo de teste, aberto à internet) e a rota pública `/setup` permite criar usuários ADMIN sem autenticação. Somados à proteção de rotas apenas client-side e à ausência de autorização por papel, o sistema **não pode, sob nenhuma hipótese, receber dados reais de pacientes** — agravado pelo fato de serem dados de saúde de menores (LGPD, dados sensíveis). A documentação de segurança descreve controles inexistentes no código, criando falso senso de conformidade. Não há nenhum teste, nenhum CI/CD, e a raiz do repositório está em estado inconsistente (dependências conflitantes, `typescript@7.0.2` inexistente, git sem commits). O caminho para produção é curto e claro — as correções são bem delimitadas — mas é indispensável executá-las antes de qualquer piloto com dados reais.

## Tabela de Notas

| Área | Nota | Comentários |
|---|---|---|
| 1. Arquitetura | 6,5 | Estrutura limpa; guarda de rotas apenas client-side; autorização ausente; monorepo acidental |
| 2. Qualidade do Código | 7,0 | Legível e coeso; casts inseguros, duplicações leves, código morto deprecated |
| 3. Segurança | 3,0 | Sem regras do Firestore; `/setup` cria ADMIN sem auth; sem headers; LGPD só no papel |
| 4. Performance | 6,0 | Tudo client/dynamic; sem cache; bundle enxuto por ora |
| 5. Banco de Dados | 4,0 | Tipos bons; sem regras/índices/validação; timestamps duplicados; desnormalização frágil |
| 6. TypeScript | 7,5 | Strict, zero `any`, bons tipos de domínio; alguns casts |
| 7. Front-end | 7,0 | Boa acessibilidade e tokens; sidebar sem mobile; links mortos |
| 8. Back-end | 2,0 | Inexistente; BaaS sem regras = banco aberto |
| 9. Firebase | 2,5 | Auth ok; Firestore sem regras, índices, emuladores ou estratégia de custos |
| 10. Dependências | 5,0 | `app/` enxuto; 2 vulns moderadas; raiz quebrada e conflitante |
| 11. Testes | 0,0 | Nenhum teste, nenhuma config, scripts quebrados |
| 12. DevOps | 2,5 | Sem CI/CD; repos git aninhados; lockfiles duplos |
| 13. Documentação | 5,5 | Boa estrutura, mas diverge do código em pontos críticos de segurança |

## Problemas Encontrados

### CRÍTICO

1. **Ausência de Firestore Security Rules**
   - Descrição: nenhum `firestore.rules`/`firebase.json` no repositório; evidências (mensagem em `setup/page.tsx:91`) indicam banco em modo de teste.
   - Impacto: qualquer pessoa com a API key pública pode ler/gravar/apagar todos os dados.
   - Risco: vazamento massivo de dados de saúde de crianças; incidente LGPD grave; destruição de dados.
   - Recomendação: escrever regras por papel (`professionalId`, `caregiverIds`), versionar no repo, testar com emulador, ativar antes de qualquer dado real.

2. **Rota `/setup` pública com criação de ADMIN**
   - Descrição: `app/src/app/setup/page.tsx` cria usuários com qualquer papel e sobrescreve perfis, sem autenticação.
   - Impacto: escalada de privilégio por qualquer visitante anônimo.
   - Risco: tomada total do sistema em produção.
   - Recomendação: remover a rota ou substituir por script server-side (Admin SDK) executado uma única vez; bloquear em produção via env.

3. **Autenticação/autorização apenas client-side**
   - Descrição: `proxy.ts` não valida token; o layout do dashboard só esconde a UI após hidratação; nenhuma verificação de `role` existe.
   - Impacto: a "proteção" é teatral — dados trafegam para clientes não autenticados.
   - Risco: acesso indevido a dados clínicos.
   - Recomendação: combinar regras do Firestore (defesa real) com verificação server-side (Admin SDK + session cookies) nas rotas sensíveis.

### ALTO

4. **Documentação de segurança diverge do código** — `SECURITY.md` promete criptografia, `ownerId` e consentimento LGPD inexistentes. Impacto: falsa conformidade; decisões clínicas/comerciais baseadas em premissas falsas. Recomendação: implementar ou reescrever o documento refletindo o estado real.
5. **Zero testes, scripts de teste quebrados** — vitest/playwright não instalados em `app/`. Impacto: nenhuma rede de segurança para evoluir. Recomendação: instalar dependências, configurar e começar pelas regras do Firestore e fluxos de auth.
6. **Repositório raiz inconsistente** — `package.json` com next 14/react 18/`typescript@7.0.2` (inexistente), `node_modules` duplicado, `.git` sem commits. Impacto: instalação quebrada, confusão de lockfiles, builds não reproduzíveis. Recomendação: consolidar tudo em `app/` (ou configurar workspace real) e remover o restante.
7. **Rotas de destino do login inexistentes** — ADMIN e CAREGIVER caem em 404 após autenticar. Impacto: funcionalidade central quebrada para 2 dos 3 papéis. Recomendação: criar as rotas ou unificar o destino até existirem.
8. **Sem CI/CD apesar do docs afirmarem o contrário.** Impacto: nenhuma validação automática (lint/typecheck/test) antes de deploy. Recomendação: pipeline mínimo com `lint`, `typecheck`, `test` e `build`.

### MÉDIO

9. **Leitura do Firestore sem validação de schema** (`userService.ts:74`) — documento malformado quebra a UI. Recomendação: validar com zod na fronteira de dados.
10. **Timestamps duplicados** (ISO local + `serverTimestamp`) — duas fontes de verdade, relógio de cliente não confiável. Recomendação: padronizar em `serverTimestamp` e converter na leitura.
11. **Vulnerabilidades moderadas de dependência** (postcss via next, GHSA-qx2v-qp2m-jg93). Recomendação: atualizar next/postcss e adicionar `npm audit` ao CI.
12. **Sem headers de segurança** no `next.config.mjs`. Recomendação: CSP, `X-Frame-Options`/`frame-ancestors`, HSTS, `Referrer-Policy`, `Permissions-Policy`.
13. **Sidebar sem navegação mobile** — layout inutilizável em telas pequenas. Recomendação: menu colapsável/drawer.
14. **Desnormalização `linkedChildIds` × `caregiverIds` sem sincronização transacional.** Recomendação: escolher uma fonte de verdade ou usar batch/transação.
15. **Sessão sem política de expiração** (`browserLocalPersistence` permanente) — risco em estações compartilhadas de consultório. Recomendação: avaliar `browserSessionPersistence` ou timeout de inatividade.

### BAIXO

16. Padrão `Proxy` deprecated (`auth`, `db`) mantido como código morto — remover.
17. Duplicação de schemas zod e tratamento de erro Firebase divergente entre páginas — extrair helpers.
18. Assets default do create-next-app em `public/`; prop `pageTitle` órfã no `Header`.
19. Mensagem de erro ao usuário expondo detalhe de infraestrutura ("modo de teste").
20. Links da sidebar/dashboard para rotas inexistentes (complementar ao item 7 — ocultar até implementar).
21. `tsconfig.tsbuildinfo` commitado na raiz.

## Pontos Fortes

- Código limpo, curto e legível, com comentários que explicam *decisões*, não obviedades.
- TypeScript estrito com **zero `any`** e tipos de domínio clínicos bem modelados (unidades explícitas nos campos).
- Inicialização lazy do Firebase resolvendo corretamente o pré-render do Next.
- Componentes UI reutilizáveis com acessibilidade acima da média (`aria-*`, `role="alert"`, foco visível).
- Design tokens em CSS variables — theming barato e consistente.
- Anti-enumeration no reset de senha; mensagens de erro amigáveis e mapeadas.
- Segredos fora do git; `.env.local.example` completo e instruído.
- Stack moderna e enxuta em `app/`, sem dependências supérfluas.
- PRD claro com restrições clínicas explícitas (sem diagnóstico automático).

## Dívida Técnica

1. Back-end inexistente: sem Admin SDK, API routes ou Cloud Functions para as operações sensíveis do roadmap (RAG, PDF, anonimização LGPD).
2. Ausência total de testes e de infraestrutura de teste (incluindo emulador Firebase).
3. Modelo de autorização por papel definido no tipo mas nunca aplicado.
4. Monorepo acidental na raiz com dependências incompatíveis.
5. Tudo client-side/dynamic — decisão que precisará ser revisitada conforme o app crescer.
6. Desnormalização usuário↔criança sem estratégia de consistência.
7. Documentação que descreve o sistema ideal em vez do real.
8. Navegação e rotas placeholder (6 seções da sidebar sem destino).

## Plano de Correção

**Fase 1 — Bloqueadores de segurança (antes de qualquer dado real, ~1 semana)**
- Escrever, versionar e publicar Firestore Security Rules por papel; testar com emulador.
- Remover/proteger `/setup`; criar bootstrap de admin via Admin SDK server-side.
- Consolidar o repositório (eliminar raiz duplicada, lockfile único).
- Reescrever `SECURITY.md` refletindo o estado real.

**Fase 2 — Fundações de produção (~1–2 semanas)**
- CI mínimo: lint + typecheck + test + build + `npm audit`.
- Instalar/configurar vitest + playwright; primeiros testes: regras do Firestore, auth, validações.
- Headers de segurança no `next.config.mjs`; corrigir redirecionamentos por papel (criar ou unificar rotas).
- Atualizar dependências (postcss/next).
- Validação zod nas leituras do Firestore; padronizar `serverTimestamp`.

**Fase 3 — Robustez de dados e UX (~2–3 semanas)**
- Session cookies + verificação server-side de token (Admin SDK).
- Estratégia de consistência para vínculos usuário↔criança (transações/batch).
- Navegação mobile; remover código morto (Proxy deprecated, assets, props órfãs); extrair helpers duplicados.
- Índices e paginação do Firestore; estimativa de custos.

**Fase 4 — Conformidade e preparação para escala (contínuo)**
- Implementar de fato os controles LGPD documentados (consentimento, exclusão, minimização) com base legal definida.
- Back-end para operações sensíveis (Cloud Functions/rotas server) antes do RAG e dos PDFs.
- Observabilidade (logs sem PII, alertas), política de sessão, backup/retenção.
- Cobertura de testes nas regras de negócio clínicas.

## Nota Final

- Arquitetura: **6,5**
- Código: **7,0**
- Segurança: **3,0**
- Performance: **6,0**
- Escalabilidade: **4,0**
- Manutenibilidade: **6,5**
- Prontidão para Produção: **2,0**

**Nota Geral: 4,6 / 10**

## Veredito

🟡 **Requer Correções Antes da Produção**

Justificativa: o código que existe é de boa qualidade — base de tipos, componentes e autenticação bem construídos — e os problemas são delimitados e corrigíveis em poucas semanas, o que afasta o veredito 🔴 (reservado a bases irrecuperáveis ou arquiteturas fundamentalmente erradas). Mas o veredito não pode ser 🟢 nem próximo disso: no estado atual, o sistema tem um banco de dados provavelmente aberto à internet, uma rota pública de criação de administradores e nenhuma autorização real — inaceitável para qualquer ambiente com dados reais, e particularmente grave por se tratar de **dados de saúde de crianças sob LGPD**. A Fase 1 do plano é obrigatória e inegociável antes de qualquer piloto; as Fases 2 e 3, antes do go-live.

---

# ADENDO — Homologação Sprint 2 (2026-07-18)

**Escopo desta homologação:** commit `a413097` (`feat(sprint-2): cadastro de pacientes + regras de seguranca do Firestore`), único commit aplicado desde a auditoria original. Cobre a Fase 1 do plano de correção (regras do Firestore + `/setup`) e o Sprint 2 do planejamento (cadastro da criança, responsável, dados perinatais, listagem e busca). Não reavalia as demais áreas do relatório acima (performance, dependências, DevOps etc.), que permanecem como estavam. Todos os itens abaixo foram efetivamente executados e observados nesta sessão, não apenas inspecionados no código.

## Bloqueadores críticos da Fase 1 — status

| Item | Status | Evidência |
|---|---|---|
| Firestore Security Rules por papel, versionadas | ✅ Corrigido | `firestore.rules` commitado; conteúdo publicado no projeto (`puericultura-62969`) confere byte a byte com o arquivo do commit `a413097`; nega por padrão qualquer coleção sem regra explícita |
| Rota `/setup` cria ADMIN sem autenticação | ✅ Corrigido | Opção "Administrador" removida do formulário; regra do Firestore rejeita `role == 'ADMIN'` em `create`; build de produção real (`next build` + `next start`) confirma que `/setup` responde "Rota indisponível" fora de desenvolvimento |
| Autorização por papel apenas no tipo, nunca aplicada | ✅ Parcialmente corrigido | Aplicada nas regras do Firestore para `users` e `children` (dono/ADMIN); guarda de rotas do dashboard continua client-side (não fazia parte do escopo desta fase) |

## Verificação funcional do Sprint 2 (dados de teste descartáveis, removidos após o teste)

27 verificações automatizadas contra o projeto Firebase real (não simulado), cobrindo cada requisito do PRD 5.3/Módulo 2 — todas passaram:
- Cadastro da criança: nome completo, nome social, data de nascimento, sexo.
- Responsável: nome, telefone, e-mail.
- Dados opcionais: cartão SUS, plano de saúde.
- Dados perinatais: idade gestacional, tipo de parto, peso, comprimento, perímetro cefálico, Apgar 1º/5º min, prematuridade, internação neonatal — persistidos com os tipos corretos (números como `number`, não `string`).
- Listagem por profissional, ordenada por nome; busca por nome (parcial, case-insensitive).
- Edição de cadastro (com `professionalId` imutável).
- Exclusão como desativação (`active: false`), removendo o registro da listagem ativa sem apagar o histórico.
- Isolamento entre profissionais: um profissional não lê o paciente de outro (`permission-denied`), confirmado nas regras publicadas.

## Build, lint e testes automatizados

- `npm run build`: sucesso, sem erros de TypeScript, todas as rotas (`/pacientes`, `/pacientes/novo`, `/pacientes/[id]/editar`, `/setup` etc.) geradas corretamente.
- `npm run lint`: sem erros (um aviso pré-existente e não relacionado, sobre `watch()` do react-hook-form em `/setup`).
- **`npm run test`: ainda não existe suíte de testes real em `app/`.** `vitest`/`playwright` não constam nas `devDependencies` de `app/package.json` nem em `app/node_modules`. Uma execução anterior de `npm run test` parecia funcionar porque o Node resolve `node_modules/.bin` subindo diretórios — como `c:/puericultura` (raiz) tem seu próprio `node_modules` com `vitest` instalado (parte do monorepo acidental já apontado na seção 10), o comando "funcionava" por acidente, não por configuração correta de `app/`. Isso confirma e detalha o problema nº 5 (Testes) desta auditoria: segue **sem nenhum teste real**.

## Controle de versão

- `git status` em `app/`: working tree limpo, nada pendente.
- Commit `a413097` contém apenas os arquivos do Sprint 2 e da correção de segurança; nenhum arquivo `.env*` versionado; nenhuma chave de API, senha ou segredo encontrado no diff do commit.
- **Nenhum repositório remoto está configurado** — nem em `app/` (`git remote -v` vazio) nem na raiz (que também não possui nenhum commit). O commit `a413097` existe apenas localmente nesta máquina; não foi (e não pode ser, sem configurar um remoto antes) enviado a GitHub/GitLab ou qualquer outro serviço. **Risco:** sem remoto nem backup, o trabalho depende inteiramente do disco local.

## Riscos remanescentes (não bloqueiam o Sprint 2, mas seguem em aberto)

- Ausência total de testes automatizados reais (unitários ou e2e) em `app/`. **[Resolvido após esta auditoria — ver adendo de Sprint 3 abaixo: 106 testes automatizados (unitários + regras) em `app/`.]**
- Nenhum repositório remoto configurado — sem backup, sem histórico compartilhado, sem possibilidade de PR/review. **[Resolvido: `origin` → `https://github.com/ctorres4564/puericare.git`, sincronizado.]**
- Guarda de rotas do dashboard permanece client-side (autenticação/autorização real ainda depende só das regras do Firestore, não de verificação server-side). **[Reavaliado e mantido deliberadamente — ver ADENDO seguinte: sem exposição real de dados; migrar exigiria mudar o fluxo de login do Sprint 1.]**
- Monorepo acidental na raiz (`c:/puericultura/package.json`, `node_modules`) continua presente e já causou um falso positivo (script `test`); recomenda-se removê-lo ou isolá-lo antes que cause outra confusão. **[Resolvido: estrutura acidental removida da raiz.]**

---

# ADENDO — Sprint 3: Consulta, Rascunho, Evolução Clínica e Linha do Tempo (2026-07-19)

**Escopo**: coleção `consultations` (criação, rascunho, edição, finalização,
cancelamento), regras de segurança correspondentes, e páginas de linha do
tempo (por paciente e global). Detalhes completos em
`documentacao/sprint-3-consulta.md`. Não reabre Sprint 1/2 — `users` e
`children` permanecem com as mesmas regras já auditadas.

- **Testes automatizados no projeto (total atualizado)**: 106 — 64 unitários
  (mock de Firestore, sem rede) + 42 de regras (Firestore Emulator, nunca
  produção). Todos verdes; sem `skip`/`todo`.
- **Homologação funcional** contra o projeto Firebase real, com dados
  descartáveis removidos ao final: 14/14 verificações (criação, rascunho,
  retomada/edição, finalização, associação ao paciente, ordenação
  cronológica, isolamento entre profissionais, bloqueio de nova consulta
  após soft delete do paciente com histórico preservado, persistência após
  recarregar).
- **Build/lint/typecheck**: sem erros; mesmos 2 avisos pré-existentes e
  alheios (`watch()` do react-hook-form).
- Regras de `consultations` publicadas no projeto real (`puericultura-62969`),
  idênticas ao arquivo versionado.
- `next start` local acusa incompatibilidade com `output: "standalone"` do `next.config.mjs` (pré-existente, não introduzido pelo Sprint 2); não impediu a verificação, mas deploy via `next start` direto não é o modo correto para essa configuração.
