# PlanVida Renascer — Backend API

Backend Node.js + Express + Prisma + PostgreSQL + Mercado Pago + JWT.
Conversa com o site estático (`/Sites/Funeraria-Demo/`) hospedado em GitHub Pages, via `fetch()`.

---

## 📁 Estrutura

```
backend-planvida/
├── package.json
├── render.yaml              ← deploy 1-clique no Render
├── .env.example             ← copie pra .env
├── prisma/
│   ├── schema.prisma        ← User, Plan, Subscription, Payment
│   └── seed.js              ← popula os 3 planos
└── src/
    ├── server.js            ← express + cors + helmet + rate limit
    ├── lib/
    │   ├── prisma.js        ← Prisma Client singleton
    │   ├── jwt.js           ← sign/verify JWT
    │   └── mercadopago.js   ← cliente MP + criar preference
    ├── middleware/
    │   ├── auth.js          ← requireAuth (Bearer token)
    │   └── error.js         ← Zod / Prisma / fallback
    └── routes/
        ├── auth.js          ← /register, /login, /me
        ├── plans.js         ← GET /plans, GET /plans/:slug
        ├── subscriptions.js ← POST /subscribe + GET /subscriptions/me
        ├── payments.js      ← /payments, /payments/:id, /payments/webhook
        └── dashboard.js     ← GET /dashboard
```

---

## 🚀 Rodar localmente (dev)

### 1. Pré-requisitos

- Node.js 20+ (`node -v`)
- PostgreSQL rodando local OU uma URL de Postgres (Render free, Supabase, Neon, etc)
- Conta no Mercado Pago: https://www.mercadopago.com.br/developers

### 2. Instalar e configurar

```bash
cd backend-planvida
npm install
cp .env.example .env
```

Edite `.env`:

```dotenv
NODE_ENV=development
PORT=3000

DATABASE_URL="postgresql://USUARIO:SENHA@localhost:5432/planvida?schema=public"

JWT_SECRET=$(openssl rand -base64 48)   # gera uma string aleatória
JWT_EXPIRES_IN=7d

ALLOWED_ORIGINS=http://localhost:5500,http://127.0.0.1:5500,https://vmmanutencaoindustrial-create.github.io
FRONTEND_URL=http://localhost:5500
BACKEND_URL=http://localhost:3000

MP_ACCESS_TOKEN=TEST-...    # painel.mercadopago.com.br > Suas integrações > Credenciais
MP_PUBLIC_KEY=TEST-...
```

### 3. Subir o banco e popular planos

```bash
npx prisma migrate dev --name init
npm run db:seed
```

Conferir os planos:

```bash
npm run db:studio
# abre Prisma Studio em http://localhost:5555
```

### 4. Subir a API

```bash
npm run dev
```

A API agora responde em `http://localhost:3000`. Teste:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/plans
```

---

## ☁️ Deploy no Render (free tier — 5 min)

### Caminho A — Blueprint (1 clique)

1. Suba este diretório `backend-planvida/` para um repositório no GitHub
   (pode ser dentro do mesmo repo `planvida-renascer/` num subfolder, ou um repo separado).
2. Acesse https://dashboard.render.com/blueprints
3. Clique **"New Blueprint Instance"** → conecte seu GitHub → escolha o repo
4. O Render lê o `render.yaml` e cria automaticamente:
   - Web Service `planvida-api` (Node)
   - Postgres `planvida-db`
5. Quando perguntar variáveis sem valor, preencha:
   - **`MP_ACCESS_TOKEN`** → cole o Access Token do Mercado Pago
   - **`MP_PUBLIC_KEY`** → cole a Public Key
   - **`BACKEND_URL`** → deixe em branco no primeiro deploy. Após subir, copie a URL do próprio serviço (algo como `https://planvida-api.onrender.com`) e edite essa variável no painel; redeploy.

### Caminho B — Manual

1. **Postgres** → New + → PostgreSQL → Free → copie `Internal Database URL`.
2. **Web Service** → New + → Web Service → conecte o repo:
   - Build command: `npm install && npx prisma generate && npx prisma migrate deploy && npm run db:seed`
   - Start command: `node src/server.js`
   - Health check path: `/health`
   - Env vars (todas do `.env.example`); `DATABASE_URL` = a URL interna do Postgres acima.

### Após deploy

- Pegue a URL pública (ex: `https://planvida-api.onrender.com`)
- No frontend, edite `Sites/Funeraria-Demo/config.js` e troque a `API_URL`
- No painel do Mercado Pago, configure o webhook:
  - **URL**: `https://planvida-api.onrender.com/api/payments/webhook`
  - **Eventos**: `payment` (created, updated)

---

## 📡 Endpoints

| Método | Rota                      | Auth | O que faz                                          |
|--------|---------------------------|------|----------------------------------------------------|
| GET    | `/health`                 | —    | Healthcheck (Render usa)                           |
| GET    | `/api/plans`              | —    | Lista os 3 planos ativos                           |
| GET    | `/api/plans/:slug`        | —    | Detalhe de 1 plano                                 |
| POST   | `/api/auth/register`      | —    | Cria usuário (sem assinar plano). Devolve JWT.     |
| POST   | `/api/auth/login`         | —    | Login. Devolve JWT.                                |
| GET    | `/api/auth/me`            | JWT  | Dados do logado (+ assinaturas)                    |
| POST   | `/api/subscribe`          | —    | Cadastra **user + subscription + payment + MP**. Devolve `paymentUrl`. |
| GET    | `/api/subscriptions/me`   | JWT  | Última assinatura do logado                        |
| GET    | `/api/payments`           | JWT  | Histórico de pagamentos do logado                  |
| GET    | `/api/payments/:id`       | JWT  | Detalhe de 1 pagamento (precisa ser dono)          |
| POST   | `/api/payments/webhook`   | —    | Mercado Pago notifica aqui (ativa subscription)    |
| GET    | `/api/dashboard`          | JWT  | Resumo completo pra área do cliente                |

### Exemplo: `POST /api/subscribe`

**Request**
```json
{
  "nome": "Maria Helena Silva",
  "email": "maria@example.com",
  "password": "minhasenha123",
  "cpf": "123.456.789-00",
  "telefone": "(82) 9 9999-9999",
  "dataNasc": "15/08/1965",
  "endereco": "Rua A, 100",
  "cidade": "Maceió",
  "cep": "57020-250",
  "planSlug": "familiar"
}
```

**Response 201**
```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": "ckxx", "nome": "Maria...", "email": "...", "cpf": "..." },
  "subscription": { "id": "ckyy", "status": "PENDING", "plan": { "slug": "familiar", "nome": "...", "precoMensal": 290 } },
  "payment": { "id": "ckzz", "status": "PENDING", "amount": 290, "method": "PIX" },
  "paymentUrl": "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=...",
  "preferenceId": "1234-abc"
}
```

→ **Frontend redireciona** o usuário pra `paymentUrl`. Após pagar, o MP redireciona de volta pro `FRONTEND_URL/cadastro.html?status=success`.
→ Em paralelo, o MP chama `/api/payments/webhook` que **ativa** a subscription e marca o payment como `APPROVED`.
→ O cliente faz login no portal com `email + password` que ele cadastrou.

---

## 🔐 Como o frontend deve consumir

Depois do `subscribe`, salve o `token` no `localStorage` e use em chamadas autenticadas:

```js
const token = localStorage.getItem('planvida_token');

const r = await fetch(`${API_URL}/api/dashboard`, {
  headers: { 'Authorization': `Bearer ${token}` },
});
const data = await r.json();
```

Veja `Sites/Funeraria-Demo/cadastro.js` e `portal.js` (já adaptados).

---

## 🧪 Teste end-to-end (sandbox MP)

1. Use credenciais **TEST-...** no `MP_ACCESS_TOKEN`.
2. Use cartões de teste do MP:
   https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/test-credentials
   - Mastercard: `5031 4332 1540 6351` · CVV `123` · Validade `11/30` · Aprovado
3. Faça `POST /api/subscribe` → abra `paymentUrl` → pague com o cartão de teste.
4. O MP chama o webhook. A subscription deve ir pra `ACTIVE`. Confira:
   ```bash
   npx prisma studio
   ```
5. Faça login (`POST /api/auth/login`) e chame `GET /api/dashboard` com o token.

---

## 🔧 Troubleshooting

**`prisma migrate deploy` falha no Render?** Confirme `DATABASE_URL` linkado ao Postgres. Render gera automaticamente quando você usa o blueprint.

**CORS bloqueia o frontend?** Cheque `ALLOWED_ORIGINS` — separe domínios por vírgula sem espaço.

**Webhook não chega?** O Render free dorme após 15min sem requests. Use um cron externo (UptimeRobot) pingando `/health` a cada 10min, ou suba pro plano Starter.

**MP devolve `invalid_token`?** Você está usando token de outra conta ou em ambiente errado (PROD vs SANDBOX).

---

## ✅ Checklist de produção

- [ ] `JWT_SECRET` setado com 48+ caracteres aleatórios
- [ ] `MP_ACCESS_TOKEN` é credencial **APP_USR** (não TEST)
- [ ] `BACKEND_URL` aponta pro Render
- [ ] `FRONTEND_URL` aponta pro GitHub Pages
- [ ] Webhook configurado no painel MP → `/api/payments/webhook`
- [ ] `ALLOWED_ORIGINS` contém o domínio do GitHub Pages
- [ ] Postgres não está no plano free se precisa de uptime garantido
- [ ] Logs do Render acessíveis (`Logs` no painel)
