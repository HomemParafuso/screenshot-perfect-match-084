# HASi Control Plane — API

API Node.js + TypeScript (Fastify) com PostgreSQL próprio via Docker Compose.
Sem Supabase, Firebase ou banco gerenciado. O PostgreSQL fica apenas na rede interna do Docker; o único serviço público é o Caddy (HTTPS) na frente da API.

> O fluxo gratuito/local do HASi Android e os modelos gratuitos do OpenCode **não dependem** desta API. A integração com o servidor é opcional.

## Arquitetura

```text
Internet ──443──> Caddy (HTTPS automático) ──> api:3000 ──(rede internal)──> db:5432
                                               backup ──(rede internal)──> db
```

- Senhas: Argon2id.
- Access token JWT curto (15 min). Refresh token opaco, rotacionado, salvo **apenas** como SHA-256.
- Chaves BYOK: AES-256-GCM com `BYOK_ENCRYPTION_KEY`; a API devolve só `provider`, `label` e `last4`.
- Toda sessão é revalidada no banco a cada requisição (revogação e suspensão têm efeito imediato).
- Auditoria em `audit_logs` para login, cadastro, dispositivos, chaves, planos e ações de admin.
- `usage_events`, `remote_calls` e `token_usage` já existem; tokens são registrados mas **não cobrados** (`billed=false`).
- `src/remote/provider.ts` define `RemoteExecutionProvider`. Nenhuma execução remota é implementada nesta versão.

## Instalação no Hetzner (Ubuntu 24.04)

```bash
# 1. Docker
curl -fsSL https://get.docker.com | sh
# 2. Código
sudo mkdir -p /opt/hasi && sudo chown $USER /opt/hasi
cd /opt/hasi && unzip ~/hasi-api.zip -d . && cd hasi-api
# 3. Firewall (também crie um Hetzner Cloud Firewall liberando 22, 80, 443)
sudo sh scripts/firewall.sh
# 4. Variáveis
cp .env.example .env
#   preencha: POSTGRES_PASSWORD (openssl rand -hex 24), JWT_SECRET (openssl rand -hex 48),
#   BYOK_ENCRYPTION_KEY (openssl rand -hex 32), API_DOMAIN, CORS_ORIGINS, APP_RESET_URL, SMTP_*
chmod 600 .env
# 5. DNS: registro A de API_DOMAIN apontando para o IP do servidor
# 6. Subir (migrations rodam automaticamente antes da API iniciar)
docker compose up -d --build
# 7. Primeiro administrador
docker compose exec -e ADMIN_EMAIL=voce@dominio.com -e ADMIN_PASSWORD='senha-com-12+-caracteres' api node dist/create-admin.js
# 8. Verificar
curl https://$API_DOMAIN/health
```

Depois, crie os planos e seus recursos pelo painel (tela **Planos**/**Entitlements**). Nenhum plano é criado automaticamente.

## Migrations de produção

Arquivos versionados em `migrations/NNN_nome.sql`, aplicados em ordem, cada um em transação, registrados em `schema_migrations` e protegidos por advisory lock. Rodam no start do container. Manual: `docker compose run --rm api node dist/migrate.js`. Nunca edite uma migration já aplicada; crie a próxima.

## Backup e restauração

- O serviço `backup` faz `pg_dump -Fc` a cada `BACKUP_INTERVAL_SECONDS` (padrão 24h) em `./backups`, mantendo `BACKUP_RETENTION_DAYS`.
- Copie os backups para fora do servidor (ex.: Hetzner Storage Box):
  `rsync -a /opt/hasi/hasi-api/backups/ uXXXX@uXXXX.your-storagebox.de:hasi/` via cron.
- Guarde `BYOK_ENCRYPTION_KEY` separadamente: sem ela as chaves BYOK restauradas não podem ser lidas.
- Restaurar: `sh scripts/restore.sh backups/hasi_20260101T030000Z.dump` (pede confirmação, para a API, restaura, reinicia).
- Teste a restauração periodicamente em outro servidor.

## Logs e monitoramento

- `docker compose logs -f api` (JSON, com rotação de 20MB×5; senha, tokens e chaves são redigidos).
- `GET /health` verifica a conexão com o banco (usado pelo HEALTHCHECK do Docker).
- `scripts/monitor.sh` via cron (`*/5 * * * *`) checa health, disco e idade do último backup; alerta opcional por `ALERT_WEBHOOK_URL`.

## Testes

Testes de integração com PostgreSQL real (sem mocks), incluindo isolamento entre usuários:

```bash
npm install
docker compose -f docker-compose.test.yml up -d
npm test
docker compose -f docker-compose.test.yml down
```

## Endpoints

Públicos: `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `GET /health`.

Usuário autenticado (só os próprios dados): `GET /me`, `PATCH /me/preferences`, `GET /me/entitlements`, `GET|POST /me/devices`, `DELETE /me/devices/:id`, `GET /me/skills`, `GET /me/agents`, `GET|POST /me/provider-keys`, `DELETE /me/provider-keys/:id`, `GET /me/usage`, `GET /me/remote-sessions`.

Administrador: `GET /admin/stats`, `GET|POST /admin/users`, `GET /admin/users/:id`, `POST /admin/users/:id/suspend|reactivate`, `POST /admin/users/:id/devices/:deviceId/revoke`, `PUT /admin/users/:id/subscription`, `PUT /admin/users/:id/admin`, `GET|POST /admin/plans`, `PATCH /admin/plans/:id`, `PUT /admin/plans/:id/entitlements`, `GET /admin/subscriptions`, `/admin/subscription-events`, `/admin/devices`, `/admin/provider-keys`, `/admin/skills`, `/admin/agents`, `/admin/remote-usage`, `/admin/audit-logs`.

Estados de assinatura: `trial`, `active` (liberam recursos), `past_due`, `canceled`, `suspended` (não liberam).
Recursos: `mobile_assistant`, `local_opencode`, `custom_skills`, `custom_agents`, `remote_coding`, `remote_session_limit`, `monthly_remote_calls`, `monthly_remote_tokens`.
