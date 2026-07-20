# SECURITY.md

## Política de Segurança

Este documento descreve o que **está de fato implementado**. Itens que ainda
não existem estão listados em "Pendências", não aqui.

## Escopo do produto

O PueriCare é uma **ferramenta de apoio ao diagnóstico e à avaliação
clínica** — não é o prontuário oficial do paciente. O profissional mantém o
registro legal em outro lugar (papel ou sistema certificado); o PueriCare é
complementar. Essa distinção fica visível na própria interface (layout de
login/cadastro e rodapé do PDF do relatório clínico).

Isso muda a análise regulatória: as exigências do CFM para prontuário
eletrônico (certificação SBIS/CFM, nível NGS2, assinatura digital, guarda
de ~20 anos) valem para sistemas que **são** o registro legal — como o
PueriCare não reivindica esse papel, essa camada específica não bloqueia o
uso. **Isso não dispensa a LGPD**: dado de saúde de paciente processado
pelo sistema é dado pessoal sensível (Art. 5º, II e Art. 11) independente
do status do documento. Base legal de tratamento, direitos do titular, DPO
e retenção continuam sendo decisões que exigem orientação jurídica antes de
dados reais de pacientes entrarem no sistema.

- **Autenticação**: Firebase Authentication com email/senha. Tokens são armazenados apenas no `localStorage` e renovados automaticamente.
- **Sessão server-side**: `proxy.ts` verifica um cookie httpOnly (o próprio ID token) antes de servir qualquer rota protegida, via REST (Identity Toolkit `accounts:lookup` — não usa o Admin SDK, que não empacota de forma confiável no ambiente de middleware serverless da Vercel; ver histórico de commits para o incidente que motivou essa escolha). Complementa, não substitui, as Firestore Security Rules.
- **Regras do Firestore** (`firestore.rules`, versionado no repo): acesso por papel (`ADMIN`, `PROFESSIONAL`, `CAREGIVER`), não por `ownerId`.
  - **Bloqueio de contas**: toda operação em dados clínicos exige `users/{uid}.active == true` (função `isActiveUser()` nas regras). Uma conta desativada por um ADMIN perde acesso imediatamente, inclusive via SDK/API direto — e o app detecta o bloqueio em tempo real (listener no documento do perfil) e exibe tela de conta desativada. O usuário bloqueado só mantém a leitura do próprio documento em `/users/{uid}` (necessária para o app detectar o bloqueio).
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

## Produção

- **URL**: https://puericare.vercel.app (Vercel, projeto `puericare`, org `claudios-projects-d188f4f1`).
- **Deploy automático**: conectado ao GitHub (`ctorres4564/puericare`, branch `master`) — todo push gera um novo deploy de produção automaticamente. **O deploy não espera o CI terminar nem depende do resultado dele** — são dois pipelines paralelos e independentes (ver Pendências). Firestore Rules continuam exigindo `firebase deploy --only firestore:rules` explicitamente, separado do deploy do app.
- **CI** (`.github/workflows/ci.yml`): a cada push/PR na `master`, roda typecheck, lint, testes unitários, testes de regras (Firestore Emulator, requer Java 21 — `actions/setup-java`) e build. Secrets `NEXT_PUBLIC_FIREBASE_*` configurados no repo GitHub (mesmos valores já públicos no bundle de produção).
- **Headers de segurança** (`next.config.mjs`): CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy — validados em produção.
- **Variáveis de ambiente**: as 6 chaves `NEXT_PUBLIC_FIREBASE_*` estão configuradas na Vercel para os ambientes Production e Preview (fora do repositório, como devem estar).
- **O que isso NÃO significa**: a aplicação estar acessível publicamente não substitui os itens da lista de Pendências abaixo — em especial, o CI existir não impede um push com erro de ir ao ar (ver acima), não há LGPD implementado, e a app **continua sem estar pronta para dados reais de pacientes**.

## Pendências (não implementado ainda)

- **Deploy não é bloqueado pelo CI**: hoje são dois pipelines paralelos (Vercel deploya no push; GitHub Actions testa no push) — um push com erro só é detectado depois de já estar no ar. Fechar isso exige desligar o deploy automático da Vercel via git e disparar o deploy explicitamente como último passo do CI (mudança de infraestrutura ainda não feita).
- Sem criptografia de campos sensíveis (CPF, histórico médico) — os tipos hoje não incluem CPF; se for adicionado, deve ser tratado antes de ir a produção.
- Sem fluxo de consentimento LGPD nem "direito ao esquecimento" implementados — ver "Escopo do produto" acima.
- **Testes automatizados**: existem 370 testes (unitários com mock de Firestore
  + regras via Firebase Emulator, ver `package.json` → `test`/`test:rules`).
  **Testes E2E (navegador, ponta a ponta) não existem** — `playwright` não é
  dependência do projeto; o script `test:e2e` foi removido do `package.json`
  em vez de deixado quebrado. Pendência futura, não uma dívida oculta.
