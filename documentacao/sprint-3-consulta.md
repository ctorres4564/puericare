# Sprint 3 — Consulta, Rascunho, Evolução Clínica e Linha do Tempo

## Objetivo

Implementar o núcleo da consulta de puericultura: criação, salvamento como rascunho,
retomada e edição, finalização (registro da evolução clínica) e visualização
cronológica (linha do tempo) por paciente e por profissional.

**Escopo desta sprint** (conforme `documentacao/planejamento do mvp.txt`, seção 18):
consulta; rascunho; evolução clínica; linha do tempo. Antropometria/crescimento
(Sprint 4), desenvolvimento (Sprint 5) e alimentação/sono/vacinação (Sprint 6)
ficam fora — os campos usados aqui (`reason`, `intervalHistory`, `clinicalNotes`,
`assessment`, `plan`) seguem exatamente o tipo `Consultation` definido no
planejamento (seção 12).

---

## Modelo de dados

```
Consultation {
  id, childId, professionalId          // childId e professionalId imutáveis após criação
  consultationDate, ageInDays           // idade calculada automaticamente na criação/edição
  reason?, intervalHistory?,
  clinicalNotes?, assessment?, plan?    // todos opcionais — um rascunho pode ficar incompleto
  status: 'draft' | 'completed' | 'cancelled'
  createdAt, updatedAt
}
```

- `ageInDays` é calculado a partir da `birthDate` da criança e da `consultationDate`,
  recalculado a cada salvamento (não muda sozinho depois).
- `status: 'cancelled'` é o "soft delete" de um rascunho — o documento nunca é
  apagado (hard delete restrito a ADMIN, igual ao padrão já usado em `children`).
- Uma vez `completed`, o formulário fica somente leitura na UI (a evolução
  clínica registrada não é editável por acidente).

## Firestore — coleção `consultations`

Regras (`firestore.rules`, publicadas no projeto real):

- **create**: só `PROFESSIONAL`, com `professionalId` igual ao próprio uid, dono
  da criança referenciada (`childId`) e **com a criança ativa** — não é possível
  iniciar consulta nova para um paciente desativado.
- **read**: só o profissional dono ou ADMIN. Sem acesso de `CAREGIVER` nesta
  fase (responsáveis só verão dados via relatório exportado — Sprint futuro).
- **update**: só o profissional dono ou ADMIN; `childId` e `professionalId`
  são imutáveis.
- **delete**: só ADMIN (hard delete). O profissional "exclui" um rascunho via
  `status: 'cancelled'`.

## Fluxo de uso

1. **Iniciar consulta**: `/pacientes/[id]/consultas/nova` cria o rascunho
   (`status: 'draft'`, data de hoje, idade calculada) e redireciona para o editor.
2. **Editor** (`/pacientes/[id]/consultas/[consultationId]`): formulário com
   data, motivo, intercorrências, observações/exame, avaliação clínica e
   conduta. Botões: *Salvar rascunho* (permanece editável), *Finalizar
   consulta* (`status: 'completed'`, some da edição), *Cancelar rascunho*
   (`status: 'cancelled'`, só aparece em rascunhos).
3. **Linha do tempo do paciente** (`/pacientes/[id]/consultas`): consultas do
   paciente (exceto canceladas), mais recente primeiro, com atalho para
   iniciar uma nova.
4. **Consultas** (`/consultas`, item já existente na barra lateral desde o
   Sprint 1): todas as consultas do profissional, entre pacientes, mesma
   ordenação.

## Estrutura de arquivos

```
src/
├── lib/
│   ├── types/consultation.ts
│   ├── validation/consultation.ts
│   └── consultations/ageInDays.ts        ← cálculo/formatação de idade
├── services/consultationService.ts       ← create/get/list/update/cancel/complete
├── components/consultations/ConsultationForm.tsx
└── app/(dashboard)/
    ├── consultas/page.tsx                ← lista global do profissional
    └── pacientes/[id]/consultas/
        ├── page.tsx                      ← linha do tempo do paciente
        ├── nova/page.tsx                 ← cria rascunho e redireciona
        └── [consultationId]/page.tsx     ← editor
```

## Testes (comprovados nesta sessão)

- **Unitários** (`npm run test`, mock de Firestore): 24 novos — cálculo/formatação
  de idade, schema de validação, `toConsultationContentPayload`, e todo o
  `consultationService` (criar, buscar, listar com isolamento, editar, finalizar,
  cancelar). Total do projeto: **64 testes unitários**, todos verdes.
- **Regras via Firestore Emulator** (`npm run test:rules`): 16 novos —
  criação vinculada ao paciente certo, bloqueio de criação com paciente de
  outro profissional, bloqueio de criação com paciente inativo, isolamento de
  leitura/edição entre profissionais, imutabilidade de `childId`/`professionalId`,
  hard delete restrito a ADMIN. Total: **42 testes de regras**, todos verdes.
- **Homologação funcional** contra o projeto Firebase real (dados descartáveis,
  removidos ao final): 14/14 verificações — criação, salvamento de rascunho,
  retomada e edição, finalização com evolução clínica, associação correta ao
  paciente, ordenação cronológica, isolamento entre profissionais, bloqueio de
  nova consulta após soft delete do paciente (com histórico preservado), e
  persistência após "recarregar" (nova sessão/login).

## Pendências / fora de escopo (registrado, não implementado)

- Antropometria, desenvolvimento, alimentação, sono e vacinação — Sprints 4–6.
- Alertas clínicos, relatório em PDF — fases posteriores.
- A linha do tempo mostra apenas consultas; quando Sprint 4+ adicionar medidas/
  vacinas/marcos, a mesma página pode ser estendida para mesclar essas fontes
  (decidiu-se não criar uma coleção `timelineEvents` genérica agora, com um só
  produtor de eventos — seria antecipar uma necessidade que só existe a partir
  de múltiplas fontes).
- Portal do responsável (CAREGIVER) sobre consultas — v2.0, fora do MVP.
