# Sprint 5 — Desenvolvimento / Neurodesenvolvimento

## Objetivo

Registrar acompanhamento longitudinal do desenvolvimento por domínio,
diferenciando explicitamente vigilância, triagem e diagnóstico — sem simular
nenhum dos dois últimos.

## Princípio clínico: os três níveis

| Nível | O que é | Implementado nesta sprint? |
|---|---|---|
| **1. Vigilância/acompanhamento** | Registro longitudinal de habilidades, observações e preocupações ao longo do tempo | **Sim** — é o escopo integral desta sprint |
| **2. Triagem** | Aplicação de instrumento estruturado e validado (ex.: Denver II, ASQ-3, M-CHAT-R), com regras próprias de aplicação e pontuação | **Não** — nenhum instrumento previsto no PRD; envolveria licenciamento que não pode ser verificado por esta sessão (ver PENDÊNCIAS) |
| **3. Avaliação diagnóstica** | Processo clínico especializado | **Nunca simulado.** O sistema não emite frases como "atraso do desenvolvimento", "suspeita de autismo" ou "desenvolvimento normal" |

O único "alerta" existente é `requiresFollowUp`, um campo que **o
profissional marca manualmente** ("Necessita acompanhamento/reavaliação") —
nunca uma inferência automática do sistema a partir dos status dos marcos.
Linguagem sempre operacional, nunca diagnóstica.

## Auditoria dos requisitos (antes de codificar)

Requisitos do Módulo 5 (`documentacao/planejamento do mvp.txt`) e do PRD
(seção 8), classificados:

| Requisito | Classificação | Implementado? |
|---|---|---|
| Checklist por domínio, com registro de marco presente/ausente/não avaliado/incerto | Registro (estrutura) | **Sim** |
| Observação livre | Registro | **Sim** |
| Comparação com avaliações anteriores | Vigilância (listagem cronológica) | **Sim** — histórico, sem diff automático |
| Conteúdo dos marcos por idade (ex.: "anda aos 12 meses") | Exige referência normativa | **Não** — ver PENDÊNCIAS |
| Alerta de marco importante ausente (automático) | Beira triagem/diagnóstico sem base normativa | **Não automatizado** — só o flag manual do profissional |
| Indicação de necessidade de reavaliação | Operacional | **Sim**, como campo manual (`requiresFollowUp`) |
| Idade corrigida por prematuridade | Verificado nos documentos | **Não é requisito** — nem `prd.txt` nem `planejamento do mvp.txt` mencionam idade corrigida em nenhum lugar; não implementada por não ser exigida (não por falta de fonte) |
| Instrumento de triagem formal (Denver/ASQ/M-CHAT) | Triagem | **Não previsto no PRD.** Não implementado |

## Modelo de dados

```
DevelopmentAssessment {
  id, childId, professionalId          // imutáveis — nunca reatribuídos
  assessmentDate, ageInDays             // idade cronológica calculada automaticamente
  milestones: [{ domain, description, status }]
  observations?
  requiresFollowUp                      // definido SÓ pelo profissional
  createdAt, updatedAt
}
```

- **Domínios** (exatamente os 5 do Módulo 5, sem acréscimos): motor grosso,
  motor fino, comunicação, cognição, social e adaptativo.
- **Status** (exatamente os 4 do Módulo 5): `ACHIEVED` (presente),
  `NOT_ACHIEVED` (ausente), `NOT_EVALUATED` (não avaliado), `UNCERTAIN`
  (incerto).
- **Marcos são de descrição livre**, não vêm de um banco pré-carregado por
  idade — ver seção "Por que os marcos não têm conteúdo pré-definido".
- Um registro precisa ter ao menos um marco **ou** uma observação (não pode
  ficar totalmente vazio).
- **Imutável após criado** — mesma política de `growthMeasurements`
  (Sprint 4): nenhuma regra de `update` existe, nem para o profissional dono
  nem para ADMIN. "Não sobrescreva registros anteriores" (instrução
  explícita) é garantido na arquitetura, não por convenção.
- Hard delete restrito a ADMIN (mesmo padrão de `children`/`consultations`/
  `growthMeasurements`).

## Por que os marcos não têm conteúdo pré-definido

`prd.txt` (seção 8) apresenta uma lista de marcos por idade (12/24/36 meses)
mas rotulada como **"Exemplo"**, sem citar SBP, OMS/WHO, CDC ou qualquer
fonte com versão e população definidas — e a própria seção conclui "**os
marcos serão parametrizados**". `planejamento do mvp.txt` (Módulo 5) também
não cita fonte para o conteúdo dos marcos, só os domínios e estados.

Sem uma referência oficial citável (fonte, versão, faixa etária), transcrever
esses exemplos como banco fixo de marcos seria exatamente o tipo de
aproximação que esta etapa proíbe. Por isso: **a estrutura de registro foi
implementada integralmente; o banco de marcos por idade fica pendência
explícita**, a ser preenchido quando uma fonte oficial (ex.: Caderneta da
Criança SBP/Ministério da Saúde, ou WHO/CDC "Developmental Milestones") for
formalmente adotada, com fonte, versão e faixa etária documentadas.

## Firestore — coleção `developmentAssessments`

Mesma política de `growthMeasurements` (Sprint 4):

- **create**: só `PROFESSIONAL`, `professionalId` igual ao próprio uid, dono
  da criança referenciada, **com a criança ativa**.
- **read**: só o profissional dono ou ADMIN (sem portal do responsável nesta
  fase).
- **update**: inexistente — imutável para todos.
- **delete**: só ADMIN (hard delete).

Regras de `users`/`children`/`consultations`/`growthMeasurements` (Sprints
1–4) não foram alteradas.

## Linha do tempo

`buildTimeline` (Sprint 3, estendido no Sprint 4) ganhou um terceiro tipo de
entrada: `developmentAssessment`. Continua sendo uma composição em memória
das três listas (consultas, medições, desenvolvimento) — nenhuma coleção
`timelineEvents` genérica foi criada, preservando a decisão do Sprint 3.

## Estrutura de arquivos

```
src/
├── lib/
│   ├── types/development.ts
│   ├── validation/development.ts
│   └── development/labels.ts             ← rótulos de domínio/status (linguagem operacional)
├── services/developmentService.ts        ← create/get/list (sem update)
└── app/(dashboard)/pacientes/[id]/desenvolvimento/
    ├── page.tsx                          ← histórico longitudinal
    └── nova/page.tsx                     ← registrar avaliação (marcos dinâmicos)
```

## Testes (comprovados nesta sessão)

- **Unitários** (`npm run test`): +33 — schema de validação (4 estados, 5
  domínios, domínio inválido rejeitado, "ao menos um marco ou observação"),
  `developmentService` (criação, isolamento, ordenação, `requiresFollowUp`
  nunca inferido), `buildTimeline` com o terceiro tipo de entrada. Total do
  projeto: **118 testes unitários**.
- **Regras via Emulator** (`npm run test:rules`): +12 — vínculo ao paciente
  certo, bloqueio de paciente alheio, bloqueio de paciente inativo,
  isolamento de leitura, **imutabilidade (update sempre negado, inclusive
  para ADMIN)**, hard delete restrito a ADMIN. Total: **66 testes de
  regras**. Nenhuma regressão nos 151 testes anteriores.
- **Homologação funcional** contra o projeto Firebase real (dados
  descartáveis, removidos ao final): 12/12 — criação com associação e idade
  corretas, marcos e `requiresFollowUp` preservados exatamente como
  definidos pelo profissional (sem campo de inferência automática),
  histórico longitudinal, persistência após recarregar, imutabilidade,
  dados prontos para a linha do tempo mesclada, isolamento entre
  profissionais, bloqueio de novo registro com paciente inativo (histórico
  preservado).

## Limitações clínicas (explícitas)

- Nenhum cálculo ou classificação clínica automática existe além da idade
  cronológica (aritmética de calendário). O sistema nunca infere "atraso",
  "suspeita" ou "normalidade" a partir dos marcos registrados.
- A comparação entre avaliações é apenas a listagem cronológica lado a lado
  — não há diff automático nem destaque de regressão/estagnação.

## Não implementado e motivo

1. **Banco de marcos por idade (conteúdo)** — sem fonte oficial citável no
   projeto (fonte, versão, população). Estrutura pronta para receber o
   conteúdo assim que uma referência formal for adotada.
2. **Idade corrigida por prematuridade** — verificado: não é requisito em
   nenhum dos documentos do projeto. Não implementada por não ser exigida.
3. **Instrumento de triagem estruturado/validado** (Denver II, ASQ-3,
   M-CHAT-R etc.) — não previsto no PRD; mesmo se fosse, exigiria verificar
   licenciamento e existência de versão brasileira antes de reproduzir
   qualquer instrumento, o que está fora do que esta sessão pode confirmar.
4. **Alerta automático de marco importante ausente** — exigiria saber qual
   marco é "importante" para qual idade (mesma dependência do item 1).
   Implementado apenas como flag manual do profissional.
5. **Avaliação diagnóstica** — deliberadamente fora de escopo, nunca
   simulada.
6. **Retificação/adendo auditável** para registros incorretos — requisito
   futuro já registrado (mesma decisão de consultas/crescimento).
