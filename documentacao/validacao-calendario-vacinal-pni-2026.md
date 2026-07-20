# Validação clínica — Calendário vacinal PueriCare (referência PNI 2026)

**Para**: médico(a) ou enfermeiro(a) com experiência em vacinação
**Objeto**: tabela implementada em `src/lib/vaccination/schedule.ts` (commit `da2da9f`)
**Data do documento**: 2026-07-20
**Como validar**: conferir cada linha contra o Calendário Nacional de Vacinação
vigente (https://www.gov.br/saude/pt-br/vacinacao/calendario) e marcar
☐ OK / ☐ Corrigir (anotar a correção ao lado). Ao final, assinar.

---

## 1. Doses de esquema fixo (cálculo automático)

| # | Vacina | Dose | Idade recomendada | Carência até "possível atraso" | Validação |
|---|--------|------|-------------------|-------------------------------|-----------|
| 1 | BCG | Dose única | ao nascer | 30 dias* | ☐ |
| 2 | Hepatite B | 1ª dose | ao nascer | 30 dias* | ☐ |
| 3 | Pentavalente | 1ª dose | 2 meses | 30 dias* | ☐ |
| 4 | VIP (poliomielite inativada) | 1ª dose | 2 meses | 30 dias* | ☐ |
| 5 | Pneumocócica 10v | 1ª dose | 2 meses | 30 dias* | ☐ |
| 6 | Rotavírus | 1ª dose | 2 meses | **45 dias (limite máx. 3m15d — PNI)** | ☐ |
| 7 | Meningocócica C | 1ª dose | 3 meses | 30 dias* | ☐ |
| 8 | Pentavalente | 2ª dose | 4 meses | 30 dias* | ☐ |
| 9 | VIP | 2ª dose | 4 meses | 30 dias* | ☐ |
| 10 | Pneumocócica 10v | 2ª dose | 4 meses | 30 dias* | ☐ |
| 11 | Rotavírus | 2ª dose | 4 meses | **120 dias (limite máx. 7m29d — PNI)** | ☐ |
| 12 | Meningocócica C | 2ª dose | 5 meses | 30 dias* | ☐ |
| 13 | Pentavalente | 3ª dose | 6 meses | 30 dias* | ☐ |
| 14 | VIP | 3ª dose | 6 meses | 30 dias* | ☐ |
| 15 | Febre amarela | 1ª dose | 9 meses | 30 dias* | ☐ |
| 16 | Tríplice viral | 1ª dose | 12 meses | 30 dias* | ☐ |
| 17 | Pneumocócica 10v | Reforço | 12 meses | 30 dias* | ☐ |
| 18 | **Meningocócica ACWY** | Reforço | 12 meses | 30 dias* | ☐ |
| 19 | DTP | 1º reforço | 15 meses | 30 dias* | ☐ |
| 20 | VIP | 1º reforço | 15 meses | 30 dias* | ☐ |
| 21 | Tetraviral (tríplice viral D2 + varicela D1) | Dose única | 15 meses | 30 dias* | ☐ |
| 22 | Hepatite A | Dose única | 15 meses | 30 dias* | ☐ |
| 23 | DTP | 2º reforço | 4 anos | 30 dias* | ☐ |
| 24 | VIP | 2º reforço | 4 anos | 30 dias* | ☐ |
| 25 | Febre amarela | Reforço | 4 anos | 30 dias* | ☐ |
| 26 | Varicela | 2ª dose | 4 anos | 30 dias* | ☐ |

\* **Convenção do sistema, não regra do PNI**: o sistema sinaliza "possível
atraso" 30 dias após a idade recomendada para todas as doses sem limite
oficial codificado. Ver item 4 — é um dos pontos que mais precisa de revisão.

## 2. Vacinas sazonais/por campanha (sem cálculo de atraso)

| Vacina | Como aparece no sistema | Validação |
|--------|------------------------|-----------|
| Influenza | "Dose anual, conforme campanha vigente" — status sempre "Conferir separadamente", mostra data do último registro | ☐ |
| Covid-19 | "Conforme recomendação vigente para a faixa etária" — idem | ☐ |

## 3. Pontos específicos a confirmar (mudanças da referência 2026)

1. ☐ Reforço de meningocócica aos 12 meses é **ACWY** (não Men C).
2. ☐ Poliomielite: esquema de **5 doses, todas VIP** (2, 4, 6 meses + 1º
   reforço aos 15 meses + 2º reforço aos 4 anos). **VOP não consta mais**
   do esquema de rotina.
3. ☐ Limites máximos do rotavírus: D1 até 3m15d, D2 até 7m29d.
4. ☐ Febre amarela: 1ª dose aos 9 meses + reforço aos 4 anos.
5. ☐ Varicela: 1ª dose aos 15 meses (tetraviral) + 2ª dose aos 4 anos.

## 4. Regras do sistema que NÃO vêm do PNI (decisões a validar ou corrigir)

1. **Carência padrão de 30 dias** para sinalizar "possível atraso" em todas
   as doses sem limite oficial codificado. Aceitável como convenção? Há
   vacinas para as quais a carência deveria ser outra?
2. **Janela de "disponível"**: a dose aparece como disponível 30 dias antes
   da idade recomendada. O PNI admite antecipações? Em quais casos?
3. **Casamento de registros antigos por nome** (texto livre): registros sem
   vínculo com o calendário são atribuídos por alias (ex.: "penta" →
   Pentavalente) em ordem cronológica. Algum alias pode gerar casamento
   errado perigoso? (lista completa em `schedule.ts`, campo `aliases`)
4. **Escopo**: situações especiais (prematuros, imunodeprimidos, resgate,
   gestantes) estão fora do cálculo — o sistema não as menciona. Deve
   ao menos exibir um aviso para esses casos?
5. **Alerta R11** ("Vacinação a conferir", categoria ATTENTION): o texto
   "Não há registro no PueriCare de N dose(s)... conferir a caderneta de
   vacinação" é adequado? Alguma situação justificaria prioridade maior?

## 5. Resultado da validação

- ☐ Tabela aprovada sem ressalvas
- ☐ Aprovada com correções (listadas acima)
- ☐ Necessita revisão maior (descrever)

**Nome / registro profissional**: ______________________________

**Assinatura / data**: ______________________________

---

*Após a validação, as correções entram em `schedule.ts` (tabela única —
testes automatizados travam regressões) e a nota "validação profissional
pendente" é removida do cabeçalho do arquivo.*
