# Sprint 1 — Autenticação, Perfis e Estrutura Base

## Objetivo

Implementar a fundação do sistema PueriCare: autenticação via Firebase Auth, controle de acesso por perfil, páginas de login e recuperação de senha, layout do dashboard e design system base.

---

## Arquitetura de Autenticação

```
Usuário                 Firebase Auth           Firestore
  │                          │                      │
  │── login (email/senha) ──►│                      │
  │                          │── valida ────────────►│
  │                          │◄─ UserCredential ─────│
  │                          │                      │
  │◄── user.uid ─────────────│                      │
  │                          │                      │
  │── getUserProfile(uid) ───────────────────────►  │
  │◄── UserProfile { role, displayName, ... } ─── ──│
  │                          │                      │
  │── redireciona por role ──►                      │
```

### Perfis de Acesso

| Role | Acesso | Rota padrão |
|------|--------|-------------|
| `ADMIN` | Configurações, base científica, usuários | `/admin/dashboard` |
| `PROFESSIONAL` | Pacientes próprios, consultas, relatórios | `/dashboard` |
| `CAREGIVER` | Crianças vinculadas (visualização) | `/responsavel/dashboard` |

---

## Fluxo de Dados

### Login
1. Usuário preenche e-mail + senha
2. `signIn()` chama `signInWithEmailAndPassword` do Firebase Auth
3. Em caso de sucesso, `getUserProfile(uid)` busca o perfil no Firestore
4. `AuthProvider` atualiza `user` e `userProfile` no contexto React
5. Usuário é redirecionado com base no `role`

### Estado de autenticação
- `AuthProvider` ouve `onAuthStateChanged` — persiste entre reloads
- Firebase usa `browserLocalPersistence` → sessão mantida no localStorage
- Logout: `signOut()` → `onAuthStateChanged` dispara com `null` → contexto limpa

### Guard de rotas
- `(dashboard)/layout.tsx` verifica `user` do contexto
- Se `loading = true`: exibe spinner
- Se `user = null`: redireciona para `/login`

---

## Estrutura de Arquivos

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx          ← Guard de autenticação + Sidebar + Header
│   │   └── dashboard/
│   │       └── page.tsx        ← Página inicial do profissional
│   ├── login/
│   │   ├── layout.tsx          ← Layout centralizado (logo + card)
│   │   └── page.tsx            ← Formulário de login
│   ├── esqueci-senha/
│   │   ├── layout.tsx          ← Mesmo layout do login
│   │   └── page.tsx            ← Recuperação de senha
│   ├── globals.css             ← Design tokens CSS
│   ├── layout.tsx              ← Root layout (AuthProvider)
│   └── page.tsx                ← Redirect → /login
├── components/
│   ├── layout/
│   │   ├── Header.tsx          ← Avatar, nome, logout
│   │   └── Sidebar.tsx         ← Navegação por módulo
│   └── ui/
│       ├── Alert.tsx           ← Feedbacks visuais
│       ├── Button.tsx          ← Botão com variantes e loading
│       ├── Card.tsx            ← Container de conteúdo
│       └── Input.tsx           ← Input com erro e acessibilidade
├── lib/
│   ├── auth/
│   │   └── AuthProvider.tsx    ← Contexto de autenticação + perfil
│   ├── firebase/
│   │   ├── auth.ts             ← signIn, signOut, resetPassword
│   │   ├── client.ts           ← Firebase App + Auth
│   │   └── firestore.ts        ← Firestore db
│   └── types/
│       ├── child.ts            ← Interface Child + PerinatalData
│       ├── user.ts             ← Interface UserProfile + UserRole
│       └── index.ts            ← Re-exportações
├── middleware.ts               ← Proteção de rotas no edge
└── services/
    └── userService.ts          ← CRUD de perfis no Firestore
```

---

## Como Manter

### Adicionar um novo perfil de usuário
1. Adicionar o valor ao tipo `UserRole` em `src/lib/types/user.ts`
2. Adicionar o rótulo em `Header.tsx` (`roleLabel`)
3. Adicionar o redirecionamento em `login/page.tsx` (`onSubmit`)
4. Criar a rota e layout correspondentes

### Adicionar um item ao menu lateral
1. Adicionar um objeto `{ label, href, icon }` ao array `navItems` em `Sidebar.tsx`
2. Criar a pasta e `page.tsx` correspondentes em `src/app/(dashboard)/`

### Tratar novos erros do Firebase Auth
- Adicionar o código e a mensagem no objeto `messages` de `login/page.tsx`
- Referência: https://firebase.google.com/docs/auth/admin/errors

---

## Segurança

- Senhas nunca transitam pelo frontend além da chamada do Firebase Auth SDK
- Perfis são lidos do Firestore com regras de segurança (a configurar no console Firebase)
- A recuperação de senha não revela se o e-mail existe (prevenção de enumeração)
- Variáveis de ambiente sensíveis em `.env.local` (não versionado)
