# Sprint 6 — Alimentação, Sono e Vacinação

## Objetivo

Três módulos tratados como domínios conceitualmente distintos (tipos,
validação, serviço e regras próprios cada um), sem misturar regras clínicas
entre eles, mesmo compartilhando a mesma infraestrutura (entidade
longitudinal imutável, isolamento por profissional, vínculo com paciente
ativo).

## Fontes utilizadas para o escopo

- **`documentacao/prd.txt`** (seção 6, blocos da consulta): a fonte mais
  específica e determinante para esta sprint.
  - Alimentação: **"Campo de texto livre."**
  - Sono: **"Campo de texto livre."**
  - Vacinação: **"Campo simples: Em dia / Atrasada / Não informado."**
- **`documentacao/planejamento do mvp.txt`** (Módulos 6, 7 e 8): visão mais
  ampla e de fases futuras — usada só para nomear os campos estruturantes de
  cada domínio (não para importar os "alertas" e o calendário vacinal
  completo, que exigem referência normativa que este projeto não tem).

## 1. Separação dos três domínios

Três coleções, três tipos, três serviços, três conjuntos de páginas —
nenhuma lógica clínica é compartilhada entre eles além do padrão estrutural
comum (imutabilidade, isolamento, paciente ativo). Cada um tem sua própria
regra de segurança dedicada em `firestore.rules`.

## 2. Alimentação (`FeedingRecord` / `feedingRecords`)

Campos (todos texto livre, ao menos um obrigatório): histórico alimentar,
rotina, introdução alimentar, dificuldades alimentares, observações do
profissional, e `requiresFollowUp` (conduta/acompanhamento — **sempre
definido manualmente pelo profissional**).

**Não implementado** (conforme instrução desta etapa): diagnóstico
automático de transtorno alimentar, disfagia, seletividade alimentar
patológica, alergia ou intolerância; os "alertas iniciais" do planejamento
(idade de introdução antes do configurado, consistência inadequada, engasgo
recorrente, ausência de acompanhamento) — todos exigiriam uma referência
normativa (idade de corte, critério de "consistência inadequada") que este
projeto não tem definida em nenhum documento.

## 3. Sono (`SleepRecord` / `sleepRecords`)

Campos: horário de dormir, número de despertares, duração aproximada do
sono (horas), cochilos, rotina, observações, dificuldades percebidas, e
`requiresFollowUp` manual. Validação de plausibilidade (não clínica):
despertares 0–15, duração 0–16h — pegam erro de digitação, não classificam
o sono como normal/anormal.

**Não implementado**: classificação "normal"/"anormal" do padrão de sono
(instrução explícita desta etapa — sem referência normativa); campos
estruturados dedicados para ronco, pausas respiratórias, uso de telas ou
compartilhamento de cama (do planejamento) — mais sensíveis clinicamente;
cobertos, se o profissional quiser registrá-los, pelo campo livre
`difficulties`.

## 4. Vacinação (`VaccinationRecord` / `vaccinationRecords`)

**Antes de codificar qualquer lógica de calendário, verificado exatamente o
que o PRD exige**: um campo simples de status (Em dia / Atrasada / Não
informado), avaliado pelo profissional a partir da caderneta — não
calculado pelo sistema. Isso é o que foi implementado, mais um registro
opcional de dose aplicada (nome da vacina, descrição da dose, lote,
estabelecimento — todos texto livre, sem vir de nenhuma lista pré-carregada).

**Não implementado — pendência explícita, não aproximada**: calendário
vacinal oficial, cálculo automático de "vacinas atrasadas"/"próximas
vacinas", alertas de pendência, recomendação automática de vacina. Isso
exigiria o **calendário oficial do PNI (Programa Nacional de Imunizações,
Ministério da Saúde)** — fonte e versão que não estão incorporadas a este
projeto. Nenhum nome de vacina, idade de aplicação ou intervalo entre doses
foi codificado a partir de memória.

## 5. Modelo de dados (comum aos três)

```
{Feeding,Sleep,Vaccination}Record {
  id, childId, professionalId          // imutáveis — nunca reatribuídos
  recordDate, ageInDays                 // idade calculada automaticamente
  ...campos específicos do domínio...
  createdAt, updatedAt
}
```

- **Imutáveis após criados** — mesma política de `growthMeasurements`/
  `developmentAssessments` (Sprints 4/5): nenhuma regra de `update` existe
  para nenhuma das três coleções, nem para o profissional dono nem para
  ADMIN. Hard delete restrito a ADMIN.
- **Isolamento por profissional** e **vínculo imutável com a criança**:
  idênticos aos domínios anteriores.
- Regras de `users`/`children`/`consultations`/`growthMeasurements`/
  `developmentAssessments` (Sprints 1–5) não foram alteradas.

## 6. Linha do tempo

`buildTimeline` ganhou um 4º tipo de entrada: `vaccinationRecord` — o único
dos três domínios que o Módulo 10 do planejamento lista explicitamente
("Exibir em ordem cronológica: consultas; medidas; vacinas; ...").
Alimentação e sono **não** entram na linha do tempo compartilhada nesta
etapa (não citados no Módulo 10), mas têm suas próprias páginas de
histórico por paciente. Nenhuma coleção `timelineEvents` genérica foi
criada — mesma decisão do Sprint 3.

Também foi corrigido o link "Vacinação" da barra lateral (`/vacinacao`),
que apontava para uma rota inexistente desde o Sprint 1 — agora é uma
lista global das vacinações do profissional, entre pacientes, no mesmo
padrão da página global `/consultas` (Sprint 3).

## Estrutura de arquivos

```
src/
├── lib/
│   ├── types/{feeding,sleep,vaccination}.ts
│   ├── validation/{feeding,sleep,vaccination}.ts
│   └── vaccination/labels.ts
├── services/{feeding,sleep,vaccination}Service.ts   ← create/get/list (sem update)
└── app/(dashboard)/
    ├── vacinacao/page.tsx                            ← lista global (conserta link do Sprint 1)
    └── pacientes/[id]/
        ├── alimentacao/{page.tsx,nova/page.tsx}
        ├── sono/{page.tsx,nova/page.tsx}
        └── vacinacao/{page.tsx,nova/page.tsx}
```

## Testes (comprovados nesta sessão)

- **Unitários** (`npm run test`): +39 — validação (campos obrigatórios,
  fronteiras de plausibilidade do sono, confusão de unidade, os 3 status de
  vacinação), os três services (criação, isolamento, ordenação), `
  buildTimeline` com o 4º tipo de entrada. Total do projeto: **157 testes
  unitários**.
- **Regras via Emulator** (`npm run test:rules`): +36 (12 por coleção,
  usando um gerador de bateria de testes compartilhado — sem duplicar o
  bloco três vezes) — vínculo ao paciente certo, bloqueio de paciente
  alheio, bloqueio de paciente inativo, isolamento de leitura,
  **imutabilidade (update sempre negado, inclusive para ADMIN)**, hard
  delete restrito a ADMIN. Total: **102 testes de regras**. Nenhuma
  regressão nos 184 testes anteriores.
- **Homologação funcional** contra o projeto Firebase real (dados
  descartáveis, removidos ao final): 11/11 — criação nos três domínios,
  associação correta, histórico longitudinal, persistência após
  recarregar, imutabilidade, integração à linha do tempo (vacinação),
  isolamento entre profissionais, bloqueio de novo registro com paciente
  inativo (histórico preservado nos três domínios).

## Riscos clínicos e técnicos

- **Nenhum risco clínico novo**: nenhum cálculo, alerta ou classificação
  automática foi introduzido. Todo "sinalizador" existente
  (`requiresFollowUp`, status de vacinação) é definido manualmente pelo
  profissional.
- **Risco técnico conhecido**: a lista de ações na linha de cada paciente
  (`Editar`, `Linha do tempo`, `Crescimento`, `Desenvolvimento`,
  `Alimentação`, `Sono`, `Vacinação`, `Iniciar consulta`, `Excluir`) já tem
  9 botões — funciona (com quebra de linha), mas é uma dívida de UX a
  reconsiderar em uma sprint futura de polimento de interface.
- Se o calendário vacinal oficial (PNI) virar prioridade, é um projeto à
  parte: exige importar e manter atualizada uma fonte oficial, não uma
  extensão trivial deste registro.

## Não implementado e motivo (resumo)

1. Alertas de alimentação/sono do planejamento (idade de introdução,
   consistência, engasgo, ronco, pausas respiratórias, telas,
   compartilhamento de cama) — sem referência normativa; PRD não exige.
2. Classificação "normal"/"anormal" de sono — instrução explícita, sem
   referência normativa.
3. Calendário vacinal oficial, cálculo de atraso/próximas vacinas, alertas
   de pendência — exige o calendário do PNI (Ministério da Saúde), não
   incorporado ao projeto.
4. Diagnóstico automático em qualquer um dos três domínios — nunca
   simulado.
5. Retificação/adendo auditável — requisito futuro já registrado (mesma
   decisão de consultas/crescimento/desenvolvimento).
