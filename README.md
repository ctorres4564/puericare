# README.md

## PueriCare – MVP 1

**Objetivo** – Prototipar um sistema de registro de consultas de puericultura para crianças de 0 a 5 anos e 11 meses.

**Stack** – Next.js (App Router), React, TypeScript, Tailwind CSS, Firebase Auth, Firestore, Zod, React Hook Form, Vitest, Vercel.

**Produção** – https://puericare.vercel.app (deploy automático a cada push em `master`; ver `SECURITY.md` § Produção).

**Requisitos locais**
- Node v22.14.0, npm v11.18.0
- `npm install` para dependências

**Instalação**
```bash
cd app
npm install
```

**Execução**
```bash
npm run dev
```

**Scripts**
- `dev` – development server
- `lint` – linting (ESLint)
- `typecheck` – verificação de tipos TypeScript
- `test` – testes unitários (Vitest)
- `test:rules` – testes das Firestore Security Rules (Firebase Emulator)
- `test:all` – `test` + `test:rules`
- `build` – build de produção

Testes end-to-end (navegador) ainda não existem neste projeto — `playwright`
não é uma dependência instalada. Ver `SECURITY.md` § Pendências.

**Variáveis de ambiente** – veja `.env.example`.

**Segurança** – Consulte `SECURITY.md`.

**Status atual** – Ver `documentacao/planejamento-sprints-restantes.md` para o mapeamento completo do que está pronto e do que falta do MVP original.

---

## Documentação
- `PRD.md` – escopo do MVP
- `ARCHITECTURE.md` – visão geral da arquitetura
- `SECURITY.md` – políticas de segurança e LGPD
- `ROADMAP.md` – plano das próximas fases
- `FUTURE.md` – funcionalidades fora do MVP

---

## Licença
Este é um protótipo interno para avaliação clínica.
