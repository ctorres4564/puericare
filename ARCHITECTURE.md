# ARCHITECTURE.md

## Visão geral da arquitetura

- **Frontend**: Next.js (App Router) usando React 19, TypeScript estrito e Tailwind CSS. Cada módulo (Dashboard, Pacientes, Consulta, etc.) está isolado em sua própria rota dentro `src/app/`.
- **Autenticação**: Firebase Authentication (email/senha). O token do usuário é armazenado em `localStorage` com refresh automático.
- **Banco de dados**: Cloud Firestore, com coleções `users`, `children`, `consultations`, `growth`, `development`, `knowledge`, `reports`. Cada documento contém apenas os campos necessários ao MVP; os campos sensíveis são criptografados ou hash‑ed antes de salvar.
- **Armazenamento de arquivos**: Firebase Storage para PDFs de relatórios.
- **IA / RAG**: Placeholder para integração com OpenAI (`openai` package) e documentos científicos armazenados em Firestore (`knowledge`).
- **CI/CD**: Vercel (preview / production). Deploy automático ao push no branch `main`.
- **Segurança**:
  - Regras de segurança do Firestore limitam acesso a documentos por `request.auth.uid`.
  - Dados pessoais são armazenados em campos privados e nunca são enviados ao cliente sem anonimização.
  - Conformidade com LGPD – consentimento armazenado no documento de usuário.

---

*Este documento será complementado nas próximas fases com diagramas de fluxo e detalhes de infraestrutura.*
