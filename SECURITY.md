# SECURITY.md

## Política de Segurança

- **Autenticação**: Firebase Authentication com email/senha. Tokens são armazenados apenas no `localStorage` e renovados automaticamente.
- **Regras do Firestore**: Cada usuário só pode ler/escrever documentos que possuam o campo `ownerId` igual ao seu UID.
- **Proteção de Dados Sensíveis**: Campos como CPF, endereço e histórico médico são criptografados antes de serem gravados usando `crypto.subtle` (Web Crypto API). Os dados são descriptografados apenas no cliente autenticado.
- **LGPD / GDPR**: Consentimento de coleta é registrado no documento `users/{uid}`. Dados podem ser apagados mediante solicitação (`right to be forgotten`).
- **Variáveis de Ambiente**: Nunca comitam chaves (`*.env*` está no `.gitignore`). Use o arquivo `.env.example` como modelo.
- **Dependências**: Manter as dependências atualizadas (`npm audit fix`).
- **Logs**: Não armazenar informações de identificação pessoal nos logs de servidor.
- **Responsabilidade**: Este protótipo não deve ser usado em produção sem revisão de segurança adicional.
