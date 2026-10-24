# HASi Control Plane

Painel administrativo e API do HASi. O app Android continua usando o OpenCode local
gratuitamente; a integração com este servidor é opcional e cuida de contas, assinaturas,
dispositivos, skills, agentes, chaves BYOK, auditoria e do registro de uso remoto futuro.

## Estrutura

| Pasta       | Conteúdo                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| `src/`      | Painel administrativo (React 19 + TanStack Start/Router + Tailwind + shadcn/ui)                              |
| `hasi-api/` | API Node.js + TypeScript (Fastify) com PostgreSQL, migrations, Docker Compose, Caddy, backup e monitoramento |

Não há Supabase, Firebase ou banco gerenciado. O PostgreSQL roda em rede interna do Docker
e não é publicado; somente a API acessa o banco.

## Painel

Telas implementadas:

- Login, cadastro, recuperação e redefinição de senha
- Dashboard com métricas (usuários, assinaturas, MRR, dispositivos, uso remoto)
- Usuários: criar, buscar, suspender/reativar, detalhar
- Detalhes do usuário: conta, papéis, assinatura, dispositivos (revogar), chaves BYOK
  mascaradas, skills, agentes, uso, sessões remotas e auditoria do usuário
- Planos: criar/editar e configurar entitlements
- Entitlements por plano
- Assinaturas: filtro por estado e histórico de eventos
- Chaves BYOK de todos os usuários (somente provedor, rótulo e últimos 4 caracteres)
- Skills, agentes, dispositivos e uso remoto
- Auditoria global

O acesso ao painel exige papel `admin`. Um usuário comum autenticado vê apenas os próprios
dados na API e é bloqueado no painel.

## Rodando localmente

Pré-requisitos: Node.js 22+, npm e Docker (ou um PostgreSQL 16 acessível).

```bash
# 1. Frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:3000
npm run dev                 # http://localhost:8080

# 2. Banco de teste (Postgres efêmero em 127.0.0.1:55432)
cd hasi-api
docker compose -f docker-compose.test.yml up -d

# 3. API
npm install
cp .env.example .env
# preencha DATABASE_URL=postgres://hasi:hasi_test@localhost:55432/hasi_test,
# JWT_SECRET, BYOK_ENCRYPTION_KEY, APP_RESET_URL e CORS_ORIGINS=http://localhost:8080
npm run migrate
ADMIN_EMAIL=voce@local.test ADMIN_PASSWORD='senha-com-12+-caracteres' npm run create-admin
npm run dev                 # http://localhost:3000
```

Depois entre em `http://localhost:8080/login` com o administrador criado, cadastre planos e
configure os entitlements. Nenhum plano ou dado fictício é criado automaticamente.

## API

Endpoints públicos: `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`,
`/auth/forgot-password`, `/auth/reset-password`, `GET /health`.

Usuário autenticado (apenas os próprios dados): `GET /me`, `PATCH /me/preferences`,
`GET /me/entitlements`, `GET|POST /me/devices`, `DELETE /me/devices/:id`, `GET /me/skills`,
`GET /me/agents`, `GET|POST /me/provider-keys`, `DELETE /me/provider-keys/:id`,
`GET /me/usage`, `GET /me/remote-sessions`.

Administrador: usuários, suspensão/reativação, revogação de dispositivos, assinaturas,
papéis, planos, entitlements, chaves BYOK (mascaradas), skills, agentes, uso remoto,
eventos de assinatura e auditoria em `/admin/*`.

Detalhes de instalação em produção (Hetzner, Caddy/HTTPS, firewall, backup, restauração,
monitoramento e variáveis de ambiente) estão em [`hasi-api/README.md`](hasi-api/README.md).

## Segurança

- Senhas com Argon2id; access token JWT curto + refresh token opaco rotacionado e salvo
  somente como SHA-256.
- Sessão revalidada no banco a cada requisição: suspensão e revogação têm efeito imediato.
- Chaves BYOK cifradas com AES-256-GCM (`BYOK_ENCRYPTION_KEY`); a API devolve apenas
  `provider`, `label` e `last4`. O valor completo nunca retorna ao frontend.
- Toda ação sensível é registrada em `audit_logs`.
- PostgreSQL sem porta publicada, API atrás de Caddy com HTTPS.

## Testes

```bash
# API — testes de integração com PostgreSQL real (sem mocks), incluindo isolamento entre usuários
cd hasi-api
docker compose -f docker-compose.test.yml up -d
npm test
docker compose -f docker-compose.test.yml down

# Frontend — testes de roteamento
npm test
```

## Escopo desta versão

O worker remoto do OpenCode não está implementado. Existe apenas a interface
`RemoteExecutionProvider` (`hasi-api/src/remote/provider.ts`), sem mocks ou dados fictícios.
`usage_events`, `remote_calls` e `token_usage` já são registrados, mas tokens não são cobrados
(`billed = false`). Não há carteira de créditos nem recargas.
