# ✅ Checklist Manual de Validação — PlanVida Renascer

Use isso pra validar manualmente antes de mostrar pro cliente / antes de produção.
Marque cada item após testar. Tempo total estimado: **20 minutos**.

> URL pública: https://vmmanutencaoindustrial-create.github.io/planvida-renascer/
> Lembre de **Cmd+Shift+R** (Mac) ou **Ctrl+Shift+R** (Win) pra forçar reload.

---

## 🟢 1. SITE PÚBLICO — `/index.html`

- [ ] Abre sem erro no console (F12 → Console deve estar limpo)
- [ ] Hero carrega com logo + CTA "Contratar plano"
- [ ] Nav mostra "Sou cliente" e "Contratar plano"
- [ ] Scroll até "Calculadora" — botão "Garantir minha vaga agora →" leva pra `/cadastro.html`
- [ ] FAQ expande/contrai ao clicar
- [ ] Footer tem link "Admin" discreto
- [ ] Mobile (Cmd+Opt+M no Chrome): layout responsivo OK

---

## 🟡 2. CADASTRO — `/cadastro.html`

### Step 1 — Plano
- [ ] 3 cards aparecem: Individual R$170, Familiar R$290 (destaque), Plus R$450
- [ ] Click em "Mais escolhido" → seleciona Familiar e avança pro step 2
- [ ] Botão "Voltar" funciona

### Step 2 — Dados
- [ ] CPF aplica máscara `000.000.000-00`
- [ ] Telefone aplica máscara `(00) 0 0000-0000`
- [ ] CEP aplica máscara `00000-000`
- [ ] Data nasc aplica máscara `DD/MM/AAAA`
- [ ] **Tentar CPF inválido** (ex: `111.111.111-11`) → não deixa avançar (input fica vermelho)
- [ ] **Senha < 6 chars** → não deixa avançar
- [ ] CPF válido + dados preenchidos → avança pro step 3

### Step 3 — Confirmação
- [ ] Resumo mostra plano correto e valores
- [ ] Link "Editar dados →" volta pro step 2 com dados preservados (mas SENHA vazia — isso é proposital!)
- [ ] 3 opções de pagamento (PIX/Boleto/Cartão) — selecionar
- [ ] Botão "Gerar pagamento" só ativa após marcar checkbox de aceite
- [ ] Click → vai pro step 4

### Step 4 — Pagamento
- [ ] **Modo demo (sem backend):** mostra QR mock + linha boleto → copiar código → status muda pra "✓ Pago" após ~8s → botão "Acessar área do cliente →" aparece
- [ ] **Com backend real:** redireciona pro Mercado Pago

### Volta do MP (após pagar)
- [ ] URL `?status=success` mostra banner verde "Pagamento aprovado!"
- [ ] URL `?status=failure` mostra banner vermelho
- [ ] URL `?status=pending` mostra banner laranja

---

## 🟢 3. PORTAL CLIENTE — `/portal.html`

### Login
- [ ] Tela de login abre (campo "Email ou CPF" + Senha)
- [ ] **Credencial inválida** → mostra "Email/CPF ou senha inválidos." (mensagem genérica — sem vazar enumeração)
- [ ] **Demo:** `123.456.789-00` / `123456` → entra na dashboard
- [ ] **Cliente que acabou de cadastrar:** email + senha cadastrada → entra
- [ ] Botão "Sair" volta pro login + limpa token

### Dashboard
- [ ] Header "Olá, [primeiro nome]" + plano + status "Ativo" + ano cadastro
- [ ] Card "Próximo pagamento" mostra valor + dias até vencer
- [ ] Tabs PIX/Boleto/Cartão alternam corretamente
- [ ] Botão "Copiar" no PIX → copia + mostra "✓ Copiado!" por 1.8s
- [ ] Atalhos (carteirinha, dependentes, ambulatorial, etc) hover dourado
- [ ] **Carteirinha**: nome em maiúsculo + CPF + carteira + Vigência VITALÍCIA
- [ ] **Dependentes:** lista correta por plano (3 se Familiar, 5 se Plus, 0 se Individual)
- [ ] **Histórico:** primeiro item PENDENTE + 6 PAGOS
- [ ] **Documentos:** 3 cards (contrato/apólice/manual)
- [ ] **Suporte:** 4 cards de contato

---

## 🔵 4. PAINEL ADMIN — `/admin.html`

### Login
- [ ] Tela escura (`#0d1230`) com logo + "PAINEL ADMINISTRATIVO"
- [ ] **Credencial errada** → mostra "Email ou senha inválidos."
- [ ] Demo: `admin@planvida.com` / `admin123` → entra

### Dashboard
- [ ] 4 KPIs (Receita do mês primary dourado · Clientes Ativos · Assinaturas Ativas · Pagamentos Pendentes)
- [ ] Distribuição por plano com barra horizontal dourada
- [ ] Card "Receita acumulada" enorme R$ X
- [ ] 3 botões de ações rápidas
- [ ] Sidebar com 4 itens + badges com totais
- [ ] Sidebar mostra avatar "A" + email logado + botão Sair
- [ ] Mobile: sidebar vira bottom nav

### Clientes
- [ ] Tabela carrega 10+ clientes mock
- [ ] **Busca:** digitar "Maria" → filtra em tempo real
- [ ] **Filtro plano:** Familiar → mostra só Familiar
- [ ] **Filtro status:** ATIVO → só ativos
- [ ] Click "Ver" → modal com detalhe completo (dados, plano, pagamentos)
- [ ] Modal fecha com X, ESC ou click fora
- [ ] Paginação funciona se houver mais de 20

### Pagamentos
- [ ] Tabela carrega ~50 pagamentos mock
- [ ] Filtros funcionam (status + método + busca)
- [ ] Click "Cliente" → abre modal do cliente

### Assinaturas
- [ ] Filtro por status
- [ ] Botão "Cancelar" → confirma → assinatura vira CANCELED

### Exportar
- [ ] Click "Exportar clientes" → baixa `planvida_clientes_2026-04-30.csv` real
- [ ] Click "Exportar pagamentos" → baixa CSV
- [ ] Abrir CSV em Excel/Numbers → encoding UTF-8 com acento OK

### Logout
- [ ] Click "Sair" → volta pro login + limpa token

---

## 🔐 5. SEGURANÇA (BACKEND ONLINE)

> Roda só com backend deployado. Use `curl` ou Postman.

### Auth
- [ ] `POST /api/auth/register` com CPF inválido → 400 `validation_error` + issues
- [ ] `POST /api/auth/login` com credencial errada → 401 (e demora ~350ms — anti-timing)
- [ ] `POST /api/auth/login` com email não cadastrado → 401 (mesma mensagem, mesmo tempo)
- [ ] `GET /api/auth/me` sem token → 401 `token_missing`
- [ ] `GET /api/auth/me` com token expirado → 401 `token_invalid`

### Subscribe
- [ ] `POST /api/subscribe` com mesmo CPF + senha errada → 409 `account_exists` (mensagem genérica, **não diz** se é email ou CPF)
- [ ] `POST /api/subscribe` com plano inválido → 404
- [ ] Sem `MP_ACCESS_TOKEN` → erro 502 + Payment marcado como REJECTED

### Webhook
- [ ] `POST /api/payments/webhook` **sem header x-signature** em produção → 401 `invalid_signature`
- [ ] Webhook com timestamp velho (> 5 min) → 401 (anti-replay)
- [ ] Webhook com payload de outro merchant → ignorado (external_reference não bate)
- [ ] Mesmo webhook recebido 2x → segundo retorna `idempotent: true` sem reprocessar

### Admin
- [ ] `POST /api/admin/login` com password errado → 401 (delay 600ms)
- [ ] `GET /api/admin/clientes` sem token admin → 401
- [ ] `GET /api/admin/clientes` com token de USER (não admin) → 403 `forbidden`

### Rate limit
- [ ] 31 tentativas seguidas de `/api/auth/login` em 15 min → 429 `rate_limited`
- [ ] 121 GETs em 1 min em qualquer rota api → 429

### CORS
- [ ] Request de origem desconhecida → bloqueado pelo CORS
- [ ] Request de `*.github.io` → permitido

### Health
- [ ] `GET /health` → `{ ok: true, ts: ... }`
- [ ] `GET /health/db` → `{ ok: true, db: "up" }` (ou `503` se DB caído)

---

## 🧪 6. TESTE DE ERRO E EDGE CASES

- [ ] Tentar cadastrar com **email já existente** + senha diferente → 409 anti-enum
- [ ] Mesmo email + senha CORRETA → atualiza dados (não cria novo) e retorna sucesso
- [ ] CPF `00000000000` → recusado (sequencial bloqueado)
- [ ] CPF `12345678909` → válido (DV bate)
- [ ] **Token JWT alterado/forjado** → 401 + logout automático no frontend
- [ ] **API offline** durante login → frontend mostra "Sem conexão" + tenta mock
- [ ] **API offline** durante cadastro → segue no modo demo (sem cobrar)
- [ ] **Timeout** > 12s → erro "Tempo limite excedido"

---

## 📝 7. CHECKLIST DE PRODUÇÃO (antes do go-live)

- [ ] `MP_ACCESS_TOKEN` é APP_USR (não TEST)
- [ ] `MP_WEBHOOK_SECRET` configurado e webhook ativo no painel MP
- [ ] `JWT_SECRET` gerado com `openssl rand -base64 48`
- [ ] `ADMIN_PASSWORD` com 12+ chars + único (não reusar)
- [ ] `BACKEND_URL` é HTTPS (Render auto)
- [ ] `FRONTEND_URL` aponta pro domínio final (não github.io de teste)
- [ ] `ALLOWED_ORIGINS` contém o domínio do frontend
- [ ] No `config.js` do frontend, `API_URL` aponta pro Render
- [ ] DB Postgres NÃO está no plano free se precisa uptime garantido (Render free dorme em 15min)
- [ ] Backup automático do DB ativado no Render
- [ ] Pelo menos 1 teste end-to-end com cartão real de R$ 1
- [ ] Política de privacidade publicada (LGPD)
- [ ] Termos de uso publicados
- [ ] Email transacional configurado (Sendgrid/Resend) — pendente

---

## 🚨 8. PLANOS DE CONTINGÊNCIA

**Se webhook MP não chegar:**
- Verificar `MP_WEBHOOK_SECRET` no Render
- Painel MP → Webhooks → ver últimas tentativas + erros
- `GET /health` → API tá no ar?
- Render free dorme em 15min — adicionar ping do UptimeRobot a cada 10min

**Se DB cair:**
- `GET /health/db` retorna 503
- Subir replica de leitura ou restaurar backup do dia
- Render dashboard → Postgres → "Restore"

**Se sistema for atacado:**
- Rotacionar `JWT_SECRET` → todos os tokens existentes ficam inválidos
- Rotacionar `MP_WEBHOOK_SECRET` → reconfigurar no painel MP
- Rotacionar `ADMIN_PASSWORD`
- Verificar logs estruturados pra origem do ataque

---

**Última atualização:** 30/04/2026
**Próxima auditoria sugerida:** após primeiros 100 cadastros reais
