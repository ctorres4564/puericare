# Sprint 4 — Antropometria e Crescimento

## Objetivo

Registrar medidas antropométricas (peso, comprimento/altura, perímetro
cefálico), calcular idade e IMC automaticamente, e exibir histórico e gráfico
de evolução — sem inventar fórmulas, percentis, escores-Z ou curvas de
referência.

## Escopo e princípio clínico

`documentacao/prd.txt` (seção 7) é explícito: **"Neste MVP não serão
implementadas curvas completas da OMS"**, e a seção 18 ("Fora do escopo")
repete a exclusão; o roadmap pós-MVP (seção 19) reserva "curvas completas da
OMS e alertas automáticos de crescimento" para a **Versão 1.1**. O
`planejamento do mvp.txt` (Módulo 4) lista percentil/escore-Z como "Funções"
da visão de produto completa, mas nenhum dos dois documentos fornece a fonte,
o algoritmo (parâmetros LMS) ou as tabelas oficiais por sexo/idade
necessárias. Nenhuma tabela desse tipo existe no projeto.

**Decisão**: implementar apenas o que é determinístico e não depende de
referência populacional (idade, IMC bruto, histórico, gráfico dos valores da
própria criança). Percentil, escore-Z, classificação nutricional e
"indicação de tendência" (que pressupõe uma curva de referência para dizer
o que é tendência normal ou anormal) ficam registrados como **pendência**,
não implementados — ver seção "Pendências" abaixo.

## Modelo de dados

```
GrowthMeasurement {
  id, childId, professionalId          // imutáveis — nunca reatribuídos
  measurementDate, ageInDays            // idade calculada automaticamente
  weightKg?, heightCm?, headCircumferenceCm?
  bmi?                                  // calculado quando weightKg e heightCm existem
  createdAt, updatedAt
}
```

- Ao menos uma medida (peso, altura ou PC) é obrigatória; as três são
  individualmente opcionais (nem toda visita mede as três).
- **Medições são imutáveis.** Não existe `updateGrowthMeasurement` — nenhuma
  regra de `update` foi escrita para a coleção, nem para o profissional dono
  nem para ADMIN. "Não sobrescreva medições anteriores" (instrução explícita
  desta etapa) é garantido na própria arquitetura: não há como escrever por
  cima de um registro já criado.
- Hard delete continua restrito a ADMIN (mesmo padrão de `children` e
  `consultations`).

## Fórmulas utilizadas (e por que são seguras)

| Cálculo | Fórmula | Fonte | Por que não é "invenção" |
|---|---|---|---|
| Idade em dias | `dias = data_medição − data_nascimento` | Aritmética de calendário | Reaproveita `calculateAgeInDays` já implementado e testado no Sprint 3 |
| IMC | `peso(kg) / altura(m)²` | Índice de Quetelet — fórmula universal, a mesma para qualquer idade/sexo | Não é uma referência populacional; é uma identidade aritmética. **Não é classificado** (não dizemos "baixo peso"/"normal"/"sobrepeso") porque essa classificação em pediatria exige curvas de IMC-por-idade-e-sexo (OMS), que este MVP não implementa |

Nenhum percentil, escore-Z, ponto de corte nutricional ou curva de
crescimento foi calculado ou aproximado.

## Validações (plausibilidade, não diagnóstico)

Faixas para capturar erro de digitação (ex.: confundir metros com
centímetros), **não pontos de corte clínicos**:

| Campo | Faixa aceita |
|---|---|
| Peso | 0,3 kg – 40 kg |
| Comprimento/altura | 25 cm – 130 cm |
| Perímetro cefálico | 20 cm – 58 cm |

Faixas generosas cobrindo prematuridade extrema num extremo e crianças
grandes no outro (cadastro cobre nascimento até ~5 anos e 11 meses). Testado
inclusive o caso de confusão de unidade (altura "0.75" rejeitada, pois seria
0,75 cm, não 75 cm).

## Firestore — coleção `growthMeasurements`

- **create**: só `PROFESSIONAL`, `professionalId` igual ao próprio uid, dono
  da criança referenciada, **com a criança ativa** (mesma condição já usada
  em `consultations`).
- **read**: só o profissional dono ou ADMIN (sem portal do responsável nesta
  fase, mesma política de `consultations`).
- **update**: inexistente — nenhuma regra permite. Imutável para todos.
- **delete**: só ADMIN (hard delete).

Regras de `users`/`children`/`consultations` (Sprints 1–3) não foram
alteradas.

## Linha do tempo

`src/lib/children/timeline.ts` (`buildTimeline`) mescla consultas e medições
de crescimento em memória, ordenadas cronologicamente, sem criar nenhuma
coleção nova no Firestore — mantém a decisão arquitetural do Sprint 3 de não
criar prematuramente um `timelineEvents` genérico. A página
`/pacientes/[id]/consultas` (linha do tempo do paciente) passou a exibir os
dois tipos de registro lado a lado.

## Gráfico de evolução

`src/components/growth/GrowthChart.tsx` — SVG simples, sem biblioteca de
gráficos, plotando **só os valores medidos da própria criança** (peso,
altura, PC — três gráficos separados, nunca dois eixos-Y num mesmo
gráfico). Sem curva de referência populacional. Marcadores com tooltip
nativo (`<title>`) mostrando data e valor; tabela de histórico completa
acompanha os gráficos.

## Estrutura de arquivos

```
src/
├── lib/
│   ├── types/growth.ts
│   ├── validation/growth.ts
│   ├── validation/numberField.ts         ← extraído de child.ts (reuso)
│   ├── growth/bmi.ts
│   └── children/timeline.ts              ← merge consultas + medições
├── services/growthService.ts             ← create/get/list (sem update)
├── components/growth/GrowthChart.tsx
└── app/(dashboard)/pacientes/[id]/crescimento/
    ├── page.tsx                          ← histórico + gráficos
    └── nova/page.tsx                     ← registrar medição
```

## Testes (comprovados nesta sessão)

- **Unitários** (`npm run test`): +33 — IMC (casos normais, fronteiras,
  divisão por zero, valores de referência conhecidos), schema de validação
  (fronteiras, confusão de unidade, "ao menos uma medida"), `growthService`
  (criação, isolamento, ordenação), `buildTimeline` (merge, exclusão de
  consultas canceladas). Total do projeto: **97 testes unitários**.
- **Regras via Emulator** (`npm run test:rules`): +12 — vínculo ao paciente
  certo, bloqueio de paciente alheio, bloqueio de paciente inativo,
  isolamento de leitura, **imutabilidade (update sempre negado, inclusive
  para ADMIN)**, hard delete restrito a ADMIN. Total: **54 testes de
  regras**. Nenhuma regressão nos 66 testes do Sprint 2/3.
- **Homologação funcional** contra o projeto Firebase real (dados
  descartáveis, removidos ao final): 12/12 — registro de medição com IMC
  calculado corretamente, associação ao paciente, histórico cronológico,
  persistência após recarregar, imutabilidade confirmada, isolamento entre
  profissionais, bloqueio de nova medição com paciente inativo (histórico
  preservado), dados prontos para a linha do tempo mesclada.

## Decisões arquiteturais

- Medições imutáveis (create-only) em vez de um fluxo de edição — decisão
  deliberadamente alinhada à mesma política já aprovada para consultas
  finalizadas no Sprint 3 (retificação/adendo auditável fica pendente para
  ambas as entidades, ver abaixo).
- Coleção `growthMeasurements` independente de `consultations` — uma medição
  não referencia uma consulta específica (nem o PRD nem o planejamento
  exigem esse vínculo; a lista de coleções em ambos os documentos já trata
  `growth`/`growthRecords` como coleção própria).
- Gráfico sem biblioteca externa — SVG simples, consistente com a ausência
  de dependências de chart no projeto até aqui.

## Pendências (registradas, não implementadas)

1. **Percentil e escore-Z** (peso-para-idade, comprimento-para-idade,
   peso-para-comprimento, PC-para-idade): requer as tabelas oficiais OMS/WHO
   Child Growth Standards (parâmetros LMS por sexo e idade em meses/dias).
   Nenhum dataset desse tipo existe no projeto hoje. **Não deve ser
   aproximado nem estimado** — precisa das tabelas oficiais importadas
   explicitamente antes de qualquer implementação.
2. **Curvas de referência / gráfico com faixas de normalidade**: mesma
   dependência do item 1. O PRD explicitamente exclui isso deste MVP.
3. **"Indicação de tendência" e "alerta de valor discrepante"** (do
   planejamento do mvp.txt, Módulo 4): pressupõem comparação com uma curva
   de referência para dizer o que é uma queda/tendência anormal — mesma
   dependência do item 1. A validação de plausibilidade implementada aqui
   (seção acima) cobre só erro de digitação, não avaliação clínica.
4. **Retificação/adendo auditável** para medições incorretas (e para
   consultas finalizadas) — requisito futuro, registrado por instrução
   explícita desta etapa, fora deste Sprint.
5. Classificação nutricional do IMC (baixo peso/normal/sobrepeso) — mesma
   dependência de curvas oficiais do item 1.
