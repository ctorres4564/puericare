# SECURITY.md

## Política de Segurança

Este documento descreve o que **está de fato implementado**. Itens que ainda
não existem estão listados em "Pendências", não aqui.

- **Autenticação**: Firebase Authentication com email/senha. Tokens são armazenados apenas no `localStorage` e renovados automaticamente.
- **Regras do Firestore** (`firestore.rules`, versionado no repo): acesso por papel (`ADMIN`, `PROFESSIONAL`, `CAREGIVER`), não por `ownerId`.
  - `users/{uid}`: cada usuário lê/cria/edita apenas o próprio documento; não pode alterar o próprio `role` ou `active`; **não é possível criar um usuário com `role == 'ADMIN'` pelo cliente**. ADMIN pode ler/editar/apagar qualquer perfil.
  - `children/{id}`: leitura para o `professionalId` dono, para UIDs em `caregiverIds`, ou ADMIN. Criação apenas por PROFESSIONAL, sempre com `professionalId` igual ao próprio UID. `professionalId` é imutável após criado.
  - Qualquer coleção/documento sem regra explícita é **negado por padrão** (substitui o antigo modo de teste aberto).
  - Deploy: `firebase deploy --only firestore:rules` (requer `firebase-tools` e login na CLI), ou colar o conteúdo de `firestore.rules` em Firebase Console → Firestore → Regras.
- **Bootstrap do primeiro ADMIN**: não existe rota ou script automatizado. O primeiro admin é criado manualmente: cadastre o usuário como PROFESSIONAL ou CAREGIVER (rota `/setup`, apenas em desenvolvimento) e depois edite o campo `role` para `ADMIN` diretamente no Firebase Console.
- **Rota `/setup`**: disponível apenas quando `NODE_ENV !== 'production'`; não oferece mais a opção de criar ADMIN.
- **Variáveis de Ambiente**: Nunca commitar chaves (`*.env*` está no `.gitignore`). Use `.env.local.example` como modelo.
- **Dependências**: Manter as dependências atualizadas (`npm audit fix`).
- **Logs**: Não armazenar informações de identificação pessoal nos logs de servidor.
- **Responsabilidade**: Este protótipo não deve receber dados reais de pacientes sem revisão de segurança adicional (ver Pendências).

## Pendências (não implementado ainda)

- Proteção de rotas do dashboard é apenas client-side (sem verificação de sessão/token no servidor).
- Sem criptografia de campos sensíveis (CPF, histórico médico) — os tipos hoje não incluem CPF; se for adicionado, deve ser tratado antes de ir a produção.
- Sem fluxo de consentimento LGPD nem "direito ao esquecimento" implementados.
- Sem CI/CD ou headers de segurança (CSP, HSTS etc.).
- **Testes automatizados**: existem 259 testes (unitários com mock de Firestore
  + regras via Firebase Emulator, ver `package.json` → `test`/`test:rules`).
  **Testes E2E (navegador, ponta a ponta) não existem** — `playwright` não é
  dependência do projeto; o script `test:e2e` foi removido do `package.json`
  em vez de deixado quebrado. Pendência futura, não uma dívida oculta.
