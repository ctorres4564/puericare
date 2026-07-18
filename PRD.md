# PRD – PueriCare MVP 1

Este documento resume o escopo e os requisitos do MVP 1 do projeto PueriCare.

## Visão Geral
- **Objetivo**: Prototipar um aplicativo web que permita o registro de consultas de puericultura para crianças de 0 a 5 anos e 11 meses.
- **Público‑alvo**: Pediatras, médicos de família, enfermeiros e residentes em pediatria.
- **Escopo**: Autenticação, dashboard simples, cadastro/gerenciamento de crianças, registro de consultas, acompanhamento de crescimento, checklist de desenvolvimento, assistente científico (RAG) e geração/exportação de relatórios.

## Funcionalidades Prioritárias (MVP)
1. Autenticação via Firebase Auth (login por e‑mail/senha).
2. Dashboard com contadores de crianças e consultas.
3. Cadastro de pacientes (dados básicos e de nascimento).
4. Registro de consultas (dados clínicos livres, crescimento, desenvolvimento).
5. Visualização de histórico de crescimento (gráficos simples).
6. Checklist de desenvolvimento por faixa etária.
7. Assistente científico que responde a dúvidas usando apenas documentos cadastrados, exibindo fontes.
8. Geração de relatório da consulta (PDF – revisão manual).

## Restrições Clínicas e de Segurança
- Não há diagnóstico automático nem prescrição de medicamentos.
- Conteúdos clínicos são provisórios e devem ser validados por profissionais.
- Cada usuário acessa apenas seus próprios pacientes e dados.
- Dados sensíveis são armazenados com exclusão lógica e nunca logados.

## Tecnologias
- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS.
- **Backend**: Cloud Firestore, Firebase Storage, Firebase Authentication.
- **Validação**: Zod.
- **Formulários**: React Hook Form.
- **Testes**: Vitest, React Testing Library, Playwright.
- **Deploy**: Vercel.

## Próximas Etapas
Consulte o `ROADMAP.md` para detalhamento das fases de desenvolvimento.
