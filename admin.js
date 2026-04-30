/* =========================================================
   PlanVida Admin — Painel administrativo
   - Login (API real ou mock se backend offline)
   - Dashboard / Clientes / Pagamentos / Assinaturas
   - Exportar CSV
   - Logout automático em 401
========================================================= */

(function(){

// Logout global em 401 do admin
window.addEventListener('planvida:logout', () => {
  localStorage.removeItem('planvida_admin_token');
});

const $  = (s, ctx) => (ctx || document).querySelector(s);
const $$ = (s, ctx) => Array.from((ctx || document).querySelectorAll(s));

const API = window.PlanvidaAPI;
const CFG = window.PLANVIDA_CONFIG || {};
const ADMIN_TOKEN_KEY = 'planvida_admin_token';

// ===========================================================
// MOCK DATA — fallback quando API offline
// ===========================================================
const MOCK = {
  stats: {
    totalClientes: 287,
    clientesUltimos30d: 42,
    assinaturas: { ativas: 261, pendentes: 18, canceladas: 8 },
    pagamentos: { aprovados: 1842, pendentes: 23 },
    receita: { mesAtual: 73420.50, total: 845210.00 },
    porPlano: [
      { planSlug: 'familiar',   planNome: 'Plano Familiar',     total: 178 },
      { planSlug: 'plus',       planNome: 'Plano Família Plus', total: 56  },
      { planSlug: 'individual', planNome: 'Plano Individual',   total: 27  },
    ],
  },
};

function mockClientes(){
  // Mock + clientes reais cadastrados via cadastro.js no localStorage
  const reais = JSON.parse(localStorage.getItem('planvida_clientes') || '[]');
  const reaisMapped = reais.map((c, i) => ({
    id: `local-${i}`,
    nome:     c.dados?.nome || '—',
    email:    c.dados?.email || '—',
    cpf:      c.dados?.cpf || '—',
    telefone: c.dados?.tel || '—',
    cidade:   c.dados?.cidade || 'Maceió',
    createdAt: c.cadastradoEm || new Date().toISOString(),
    plano:    c.plano,
    statusAssinatura: c.status === 'active' ? 'ACTIVE' : 'PENDING',
    proximoVencimento: addDays(new Date(), 7),
    isLocal: true,
  }));

  const fakes = [
    { nome: 'Maria Helena Silva',  cpf: '123.456.789-00', email: 'maria.h@example.com',     telefone: '(82) 9 9990-1122', plano: { slug: 'familiar', nome: 'Plano Familiar', precoMensal: 290 }, statusAssinatura: 'ACTIVE',  cidade: 'Maceió',     dias: -1450 },
    { nome: 'Roberto Carlos Mendes', cpf: '987.654.321-00', email: 'roberto.m@example.com',  telefone: '(82) 9 9881-3344', plano: { slug: 'plus',     nome: 'Plano Família Plus', precoMensal: 450 }, statusAssinatura: 'ACTIVE',  cidade: 'Arapiraca',  dias: -890 },
    { nome: 'Antônio Pereira Lima', cpf: '111.222.333-44', email: 'antonio.l@example.com',   telefone: '(82) 9 9772-5566', plano: { slug: 'individual', nome: 'Plano Individual', precoMensal: 170 }, statusAssinatura: 'ACTIVE', cidade: 'Maceió',  dias: -540 },
    { nome: 'Cecília Santos',       cpf: '555.666.777-88', email: 'cecilia.s@example.com',   telefone: '(82) 9 9663-7788', plano: { slug: 'familiar', nome: 'Plano Familiar', precoMensal: 290 }, statusAssinatura: 'PENDING', cidade: 'Maceió',     dias: -2 },
    { nome: 'João Barbosa',         cpf: '999.888.777-66', email: 'joao.b@example.com',      telefone: '(82) 9 9554-9900', plano: { slug: 'familiar', nome: 'Plano Familiar', precoMensal: 290 }, statusAssinatura: 'ACTIVE',  cidade: 'Penedo',     dias: -210 },
    { nome: 'Patrícia Lopes',       cpf: '444.555.666-77', email: 'patricia.l@example.com',  telefone: '(82) 9 9445-1212', plano: { slug: 'plus',     nome: 'Plano Família Plus', precoMensal: 450 }, statusAssinatura: 'ACTIVE',  cidade: 'Maceió',  dias: -67 },
    { nome: 'Eduardo Nascimento',   cpf: '333.222.111-00', email: 'eduardo.n@example.com',   telefone: '(82) 9 9336-3434', plano: { slug: 'individual', nome: 'Plano Individual', precoMensal: 170 }, statusAssinatura: 'PAST_DUE', cidade: 'Marechal Deodoro', dias: -380 },
    { nome: 'Luciana Albuquerque',  cpf: '222.111.000-99', email: 'luciana.a@example.com',   telefone: '(82) 9 9227-5656', plano: { slug: 'familiar', nome: 'Plano Familiar', precoMensal: 290 }, statusAssinatura: 'ACTIVE',  cidade: 'Maceió',     dias: -45 },
    { nome: 'Marcelo Tavares',      cpf: '888.777.666-55', email: 'marcelo.t@example.com',   telefone: '(82) 9 9118-7878', plano: { slug: 'plus',     nome: 'Plano Família Plus', precoMensal: 450 }, statusAssinatura: 'CANCELED', cidade: 'Arapiraca',   dias: -120 },
    { nome: 'Helena Cristina',      cpf: '777.666.555-44', email: 'helena.c@example.com',    telefone: '(82) 9 9009-9090', plano: { slug: 'familiar', nome: 'Plano Familiar', precoMensal: 290 }, statusAssinatura: 'ACTIVE',  cidade: 'Maceió',     dias: -730 },
  ].map((c, i) => ({
    id: `mock-${i+1}`,
    ...c,
    createdAt: addDays(new Date(), c.dias).toISOString(),
    proximoVencimento: addDays(new Date(), 7),
  }));

  return [...reaisMapped, ...fakes];
}

function mockPagamentos(){
  const clientes = mockClientes();
  const pagamentos = [];
  const metodos = ['PIX', 'BOLETO', 'CREDIT_CARD'];
  const statuses = ['APPROVED', 'APPROVED', 'APPROVED', 'APPROVED', 'PENDING', 'REJECTED'];

  clientes.forEach((c, ci) => {
    if(!c.plano) return;
    // 5 pagamentos mensais por cliente
    for(let m = 0; m < 5; m++){
      const isLast = m === 0;
      const status = isLast ? (c.statusAssinatura === 'PAST_DUE' ? 'PENDING' : (c.statusAssinatura === 'CANCELED' ? 'CANCELED' : 'APPROVED')) : statuses[(ci + m) % statuses.length];
      const data = addDays(new Date(), -(m * 30 + (ci % 5)));
      pagamentos.push({
        id: `pay-${c.id}-${m}`,
        cliente: { id: c.id, nome: c.nome, email: c.email, cpf: c.cpf },
        plano: { slug: c.plano.slug, nome: c.plano.nome },
        method: metodos[(ci + m) % 3],
        amount: c.plano.precoMensal,
        status,
        paidAt: status === 'APPROVED' ? data.toISOString() : null,
        createdAt: data.toISOString(),
      });
    }
  });
  return pagamentos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function mockAssinaturas(){
  return mockClientes().filter(c => c.plano).map(c => ({
    id: `sub-${c.id}`,
    cliente: { id: c.id, nome: c.nome, email: c.email, cpf: c.cpf },
    plan: c.plano,
    status: c.statusAssinatura,
    startDate: c.createdAt,
    nextDueDate: c.proximoVencimento,
  }));
}

function addDays(date, n){
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// ===========================================================
// HTTP wrapper específico do admin (token separado)
// ===========================================================
async function adminFetch(path, opts = {}){
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if(token) headers.Authorization = `Bearer ${token}`;

  const r = await fetch(`${CFG.API_URL}${path}`, {
    method: opts.method || 'GET',
    headers,
    body:   opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = null;
  const txt = await r.text();
  if(txt){ try{ data = JSON.parse(txt); }catch{ data = { raw: txt }; } }
  if(!r.ok){
    const err = new Error((data && data.message) || `Erro ${r.status}`);
    err.status = r.status; err.code = data?.error; err.data = data;
    throw err;
  }
  return data;
}

// ===========================================================
// LOGIN
// ===========================================================
const loginForm = $('#loginForm');

loginForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const email    = $('#loginEmail').value.trim();
  const password = $('#loginPassword').value;
  if(!email || !password) return;

  // Tenta API real
  try{
    const r = await adminFetch('/api/admin/login', { method: 'POST', body: { email, password } });
    localStorage.setItem(ADMIN_TOKEN_KEY, r.token);
    abrirShell(r.admin?.email || email);
    return;
  }catch(err){
    if(err.status === 401){ erroLogin('Email ou senha inválidos.'); return; }
    if(err.status === 503){ erroLogin('Login admin não configurado no servidor.'); return; }
    if(err.status === 429){ erroLogin('Muitas tentativas. Aguarde alguns minutos.'); return; }
    // Se for erro de rede (API offline), cai no mock
    console.warn('[admin] API offline, fallback mock:', err);
  }

  // FALLBACK MOCK — apenas pra demo
  const okMock = (email.toLowerCase() === 'admin@planvida.com' && password === 'admin123');
  if(!okMock){
    erroLogin('Email ou senha inválidos.');
    return;
  }
  // Token mock genérico — valido só no front pra liberar UI
  localStorage.setItem(ADMIN_TOKEN_KEY, 'mock_admin_token');
  abrirShell(email);
});

function erroLogin(msg){
  let err = $('#loginErro');
  if(!err){
    err = document.createElement('div');
    err.id = 'loginErro';
    err.style.cssText = 'background:#ffeeee;color:#a00;padding:12px 16px;border-radius:4px;font-size:.88rem;margin-top:14px;border-left:3px solid #a00;';
    loginForm.appendChild(err);
  }
  err.textContent = msg;
}

function abrirShell(email){
  $('#admEmail').textContent = email;
  $('#loginSection').hidden = true;
  $('#adminShell').hidden   = false;
  loadDashboard();
}

// ===========================================================
// LOGOUT
// ===========================================================
$('#btnLogout')?.addEventListener('click', () => {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  location.reload();
});

// ===========================================================
// TABS NAV
// ===========================================================
$$('.adm-nav__btn').forEach(btn => {
  btn.addEventListener('click', () => trocarTab(btn.dataset.tab));
});
$$('[data-go-tab]').forEach(el => el.addEventListener('click', e => {
  e.preventDefault();
  trocarTab(el.dataset.goTab);
}));

const tabLoaders = {};
function trocarTab(tab){
  $$('.adm-nav__btn').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
  $$('.adm-tab').forEach(s => s.classList.toggle('is-active', s.dataset.tab === tab));
  if(tabLoaders[tab]) tabLoaders[tab]();
}

// ===========================================================
// DASHBOARD
// ===========================================================
tabLoaders.dashboard = loadDashboard;
async function loadDashboard(){
  let stats;
  try{
    stats = await adminFetch('/api/admin/stats');
  }catch(err){
    if(err.status === 401){ logoutForced(); return; }
    console.warn('[stats] mock fallback:', err);
    stats = MOCK.stats;
  }

  // KPIs
  $('#kpiReceitaMes').textContent  = fmtMoney(stats.receita.mesAtual);
  $('#kpiReceitaTotal').textContent = fmtMoney(stats.receita.total);
  $('#kpiClientesAtivos').textContent = stats.assinaturas.ativas;
  $('#kpiNovos30d').textContent      = stats.clientesUltimos30d;
  $('#kpiAssAtivas').textContent     = stats.assinaturas.ativas;
  $('#kpiAssPendentes').textContent  = stats.assinaturas.pendentes;
  $('#kpiAssCanceladas').textContent = stats.assinaturas.canceladas;
  $('#kpiPagPendentes').textContent  = stats.pagamentos.pendentes;
  $('#kpiMesAtual').textContent      = mesAtualLabel();

  // Badges
  $('#navBadgeClientes').textContent     = stats.totalClientes;
  $('#navBadgePagamentos').textContent   = stats.pagamentos.aprovados + stats.pagamentos.pendentes;
  $('#navBadgeAssinaturas').textContent  = stats.assinaturas.ativas + stats.assinaturas.pendentes;

  // Distribuição por plano
  const total = stats.porPlano.reduce((acc, p) => acc + p.total, 0) || 1;
  const dist = $('#planoDist');
  dist.innerHTML = stats.porPlano.length
    ? stats.porPlano.map(p => `
        <div class="adm-pd">
          <div class="adm-pd__nome">${p.planNome || p.planSlug}</div>
          <div class="adm-pd__bar"><div class="adm-pd__bar-fill" style="width:${(p.total/total*100).toFixed(1)}%"></div></div>
          <div class="adm-pd__count">${p.total}</div>
        </div>
      `).join('')
    : '<p class="adm-empty">Sem dados ainda.</p>';

  $('#dashLastUpdate').textContent = `Atualizado em ${new Date().toLocaleString('pt-BR')}`;
}

function logoutForced(){
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  location.reload();
}

function mesAtualLabel(){
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return meses[new Date().getMonth()];
}
function fmtMoney(v){
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d){
  if(!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}
function statusLabel(s){
  const map = {
    ACTIVE: 'Ativo', PENDING: 'Pendente', PAST_DUE: 'Atrasado',
    CANCELED: 'Cancelado', SUSPENDED: 'Suspenso', SEM_PLANO: 'Sem plano',
    APPROVED: 'Aprovado', IN_PROCESS: 'Processando', REJECTED: 'Recusado', REFUNDED: 'Reembolsado',
  };
  return map[s] || s;
}
function methodLabel(m){
  return ({ PIX: 'PIX', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão', DEBIT_CARD: 'Débito', OTHER: '—' })[m] || m;
}
function initials(name){
  return (name || '').split(' ').filter(Boolean).map(p => p[0]).slice(0,2).join('').toUpperCase() || '—';
}

// ===========================================================
// CLIENTES
// ===========================================================
const cliState = { page: 1, perPage: 20, total: 0, q: '', plano: '', status: '' };
tabLoaders.clientes = loadClientes;

['#cliSearch'].forEach(sel => $(sel)?.addEventListener('input', debounce(() => { cliState.page = 1; loadClientes(); }, 300)));
['#cliPlano','#cliStatus'].forEach(sel => $(sel)?.addEventListener('change', () => { cliState.page = 1; loadClientes(); }));

async function loadClientes(){
  const tbody = $('#cliTbody');
  tbody.innerHTML = '<tr><td colspan="7" class="adm-empty">Carregando...</td></tr>';

  cliState.q      = $('#cliSearch').value.trim();
  cliState.plano  = $('#cliPlano').value;
  cliState.status = $('#cliStatus').value;

  const params = new URLSearchParams({
    q: cliState.q, plano: cliState.plano, status: cliState.status,
    page: cliState.page, perPage: cliState.perPage,
  }).toString();

  let res;
  try{
    res = await adminFetch(`/api/admin/clientes?${params}`);
  }catch(err){
    if(err.status === 401){ logoutForced(); return; }
    console.warn('[clientes] mock fallback:', err);
    let lista = mockClientes();
    if(cliState.q){
      const q = cliState.q.toLowerCase();
      lista = lista.filter(c =>
        (c.nome  || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.cpf   || '').includes(q.replace(/\D/g,''))
      );
    }
    if(cliState.plano)  lista = lista.filter(c => c.plano?.slug === cliState.plano);
    if(cliState.status) lista = lista.filter(c => c.statusAssinatura === cliState.status);
    res = {
      total: lista.length, page: cliState.page, perPage: cliState.perPage,
      totalPages: Math.ceil(lista.length / cliState.perPage),
      clientes: lista.slice((cliState.page - 1) * cliState.perPage, cliState.page * cliState.perPage),
    };
  }

  cliState.total = res.total;
  if(!res.clientes.length){
    tbody.innerHTML = '<tr><td colspan="7" class="adm-empty">Nenhum cliente encontrado.</td></tr>';
    $('#cliPagi').innerHTML = '';
    return;
  }

  tbody.innerHTML = res.clientes.map(c => `
    <tr>
      <td>
        <div class="adm-cli-cell">
          <span class="adm-cli-avatar">${initials(c.nome)}</span>
          <div class="adm-cli-info">
            <strong>${escapeHtml(c.nome)}</strong>
            <small>${escapeHtml(c.email)}</small>
          </div>
        </div>
      </td>
      <td>${escapeHtml(c.cpf || '—')}</td>
      <td>${escapeHtml(c.telefone || '—')}</td>
      <td>${c.plano ? escapeHtml(c.plano.nome) : '—'}</td>
      <td><span class="adm-status adm-status--${(c.statusAssinatura || 'sem_plano').toLowerCase()}">${statusLabel(c.statusAssinatura)}</span></td>
      <td>${fmtDate(c.createdAt)}</td>
      <td><button class="adm-row-action" data-cli-id="${c.id}">Ver</button></td>
    </tr>
  `).join('');

  // bind click ver
  tbody.querySelectorAll('[data-cli-id]').forEach(btn => {
    btn.onclick = () => abrirCliente(btn.dataset.cliId);
  });

  renderPagi('cliPagi', res, cliState, () => loadClientes());
}

// ===========================================================
// PAGAMENTOS
// ===========================================================
const pagState = { page: 1, perPage: 30, total: 0, q: '', status: '', method: '' };
tabLoaders.pagamentos = loadPagamentos;

['#pagSearch'].forEach(sel => $(sel)?.addEventListener('input', debounce(() => { pagState.page = 1; loadPagamentos(); }, 300)));
['#pagStatus','#pagMethod'].forEach(sel => $(sel)?.addEventListener('change', () => { pagState.page = 1; loadPagamentos(); }));

async function loadPagamentos(){
  const tbody = $('#pagTbody');
  tbody.innerHTML = '<tr><td colspan="7" class="adm-empty">Carregando...</td></tr>';

  pagState.q      = $('#pagSearch').value.trim();
  pagState.status = $('#pagStatus').value;
  pagState.method = $('#pagMethod').value;

  const params = new URLSearchParams({
    q: pagState.q, status: pagState.status, method: pagState.method,
    page: pagState.page, perPage: pagState.perPage,
  }).toString();

  let res;
  try{
    res = await adminFetch(`/api/admin/pagamentos?${params}`);
  }catch(err){
    if(err.status === 401){ logoutForced(); return; }
    console.warn('[pagamentos] mock fallback:', err);
    let lista = mockPagamentos();
    if(pagState.q){
      const q = pagState.q.toLowerCase();
      lista = lista.filter(p =>
        (p.cliente?.nome  || '').toLowerCase().includes(q) ||
        (p.cliente?.email || '').toLowerCase().includes(q) ||
        (p.cliente?.cpf   || '').includes(q.replace(/\D/g,''))
      );
    }
    if(pagState.status) lista = lista.filter(p => p.status === pagState.status);
    if(pagState.method) lista = lista.filter(p => p.method === pagState.method);
    res = {
      total: lista.length, page: pagState.page, perPage: pagState.perPage,
      totalPages: Math.ceil(lista.length / pagState.perPage),
      pagamentos: lista.slice((pagState.page - 1) * pagState.perPage, pagState.page * pagState.perPage),
    };
  }

  pagState.total = res.total;
  if(!res.pagamentos.length){
    tbody.innerHTML = '<tr><td colspan="7" class="adm-empty">Nenhum pagamento encontrado.</td></tr>';
    $('#pagPagi').innerHTML = '';
    return;
  }

  tbody.innerHTML = res.pagamentos.map(p => `
    <tr>
      <td>${fmtDate(p.paidAt || p.createdAt)}</td>
      <td>
        <div class="adm-cli-cell">
          <span class="adm-cli-avatar">${initials(p.cliente?.nome)}</span>
          <div class="adm-cli-info">
            <strong>${escapeHtml(p.cliente?.nome || '—')}</strong>
            <small>${escapeHtml(p.cliente?.cpf || '—')}</small>
          </div>
        </div>
      </td>
      <td>${escapeHtml(p.plano?.nome || '—')}</td>
      <td>${methodLabel(p.method)}</td>
      <td><strong>R$ ${fmtMoney(p.amount)}</strong></td>
      <td><span class="adm-status adm-status--${(p.status || '').toLowerCase()}">${statusLabel(p.status)}</span></td>
      <td>${p.cliente?.id ? `<button class="adm-row-action" data-cli-id="${p.cliente.id}">Cliente</button>` : ''}</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-cli-id]').forEach(btn => {
    btn.onclick = () => abrirCliente(btn.dataset.cliId);
  });

  renderPagi('pagPagi', res, pagState, () => loadPagamentos());
}

// ===========================================================
// ASSINATURAS
// ===========================================================
const assState = { page: 1, perPage: 30, total: 0, status: '' };
tabLoaders.assinaturas = loadAssinaturas;

$('#assStatus')?.addEventListener('change', () => { assState.page = 1; loadAssinaturas(); });

async function loadAssinaturas(){
  const tbody = $('#assTbody');
  tbody.innerHTML = '<tr><td colspan="7" class="adm-empty">Carregando...</td></tr>';

  assState.status = $('#assStatus').value;
  const params = new URLSearchParams({
    status: assState.status, page: assState.page, perPage: assState.perPage,
  }).toString();

  let res;
  try{
    res = await adminFetch(`/api/admin/assinaturas?${params}`);
  }catch(err){
    if(err.status === 401){ logoutForced(); return; }
    console.warn('[assinaturas] mock fallback:', err);
    let lista = mockAssinaturas();
    if(assState.status) lista = lista.filter(a => a.status === assState.status);
    res = {
      total: lista.length, page: assState.page, perPage: assState.perPage,
      totalPages: Math.ceil(lista.length / assState.perPage),
      assinaturas: lista.slice((assState.page - 1) * assState.perPage, assState.page * assState.perPage),
    };
  }

  assState.total = res.total;
  if(!res.assinaturas.length){
    tbody.innerHTML = '<tr><td colspan="7" class="adm-empty">Nenhuma assinatura encontrada.</td></tr>';
    $('#assPagi').innerHTML = '';
    return;
  }

  tbody.innerHTML = res.assinaturas.map(a => `
    <tr>
      <td>
        <div class="adm-cli-cell">
          <span class="adm-cli-avatar">${initials(a.cliente?.nome)}</span>
          <div class="adm-cli-info">
            <strong>${escapeHtml(a.cliente?.nome || '—')}</strong>
            <small>${escapeHtml(a.cliente?.email || '—')}</small>
          </div>
        </div>
      </td>
      <td>${escapeHtml(a.plan?.nome || '—')}</td>
      <td><strong>R$ ${fmtMoney(a.plan?.precoMensal)}</strong></td>
      <td><span class="adm-status adm-status--${(a.status || '').toLowerCase()}">${statusLabel(a.status)}</span></td>
      <td>${fmtDate(a.startDate || a.createdAt)}</td>
      <td>${fmtDate(a.nextDueDate)}</td>
      <td>${a.status !== 'CANCELED' ? `<button class="adm-row-action" data-cancel-ass="${a.id}">Cancelar</button>` : ''}</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-cancel-ass]').forEach(btn => {
    btn.onclick = async () => {
      if(!confirm('Cancelar essa assinatura? Esta ação não pode ser desfeita.')) return;
      btn.textContent = 'Cancelando...';
      btn.disabled = true;
      try{
        await adminFetch(`/api/admin/assinaturas/${btn.dataset.cancelAss}/cancelar`, { method: 'PATCH' });
      }catch(err){
        // mock — simula cancelamento
        await new Promise(r => setTimeout(r, 700));
      }
      loadAssinaturas();
    };
  });

  renderPagi('assPagi', res, assState, () => loadAssinaturas());
}

// ===========================================================
// PAGINAÇÃO genérica
// ===========================================================
function renderPagi(elId, res, state, reload){
  const el = $('#' + elId);
  if(!el || res.totalPages <= 1){ el.innerHTML = ''; return; }
  const inicio = ((state.page - 1) * state.perPage) + 1;
  const fim    = Math.min(state.page * state.perPage, res.total);

  let buttons = '';
  for(let i = 1; i <= res.totalPages; i++){
    if(i === 1 || i === res.totalPages || Math.abs(i - state.page) <= 2){
      buttons += `<button class="${i === state.page ? 'is-active' : ''}" data-page="${i}">${i}</button>`;
    } else if(Math.abs(i - state.page) === 3){
      buttons += `<span style="color:var(--text-muted);padding:0 4px;">…</span>`;
    }
  }

  el.innerHTML = `
    <span>Mostrando ${inicio}–${fim} de ${res.total}</span>
    <div class="adm-pagi-btns">
      <button data-page="${Math.max(1, state.page - 1)}" ${state.page === 1 ? 'disabled' : ''}>‹</button>
      ${buttons}
      <button data-page="${Math.min(res.totalPages, state.page + 1)}" ${state.page === res.totalPages ? 'disabled' : ''}>›</button>
    </div>
  `;
  el.querySelectorAll('[data-page]').forEach(btn => {
    btn.onclick = () => {
      state.page = parseInt(btn.dataset.page, 10);
      reload();
    };
  });
}

// ===========================================================
// MODAL DETALHE CLIENTE
// ===========================================================
$$('[data-close-modal]').forEach(el => el.addEventListener('click', () => $('#modalCliente').hidden = true));
document.addEventListener('keydown', e => { if(e.key === 'Escape') $('#modalCliente').hidden = true; });

async function abrirCliente(id){
  const modal = $('#modalCliente');
  const body  = $('#modalClienteBody');
  body.innerHTML = '<p class="adm-empty">Carregando...</p>';
  modal.hidden = false;

  let detail;
  try{
    if(id.startsWith('mock-') || id.startsWith('local-')){
      throw new Error('mock_id');
    }
    detail = await adminFetch(`/api/admin/clientes/${id}`);
  }catch(err){
    // Mock
    const lista = mockClientes();
    const c = lista.find(x => x.id === id);
    if(!c){ body.innerHTML = '<p class="adm-empty">Cliente não encontrado.</p>'; return; }
    const pags = mockPagamentos().filter(p => p.cliente?.id === id);
    detail = {
      cliente: c,
      assinaturas: c.plano ? [{ id: 'sub-' + c.id, status: c.statusAssinatura, plan: c.plano, startDate: c.createdAt, nextDueDate: c.proximoVencimento }] : [],
      pagamentos: pags,
    };
  }

  const c = detail.cliente;
  const assAtual = detail.assinaturas[0];

  body.innerHTML = `
    <h2>${escapeHtml(c.nome)}</h2>
    <div class="modal-meta">
      <span>📧 ${escapeHtml(c.email)}</span>
      <span>📞 ${escapeHtml(c.telefone || '—')}</span>
      <span>📍 ${escapeHtml(c.cidade || '—')}</span>
    </div>

    <h3>Dados pessoais</h3>
    <div class="modal-row"><span>CPF</span><strong>${escapeHtml(c.cpf || '—')}</strong></div>
    <div class="modal-row"><span>Data nasc.</span><strong>${escapeHtml(c.dataNasc || '—')}</strong></div>
    <div class="modal-row"><span>Endereço</span><strong>${escapeHtml(c.endereco || '—')}</strong></div>
    <div class="modal-row"><span>CEP</span><strong>${escapeHtml(c.cep || '—')}</strong></div>
    <div class="modal-row"><span>Cadastrado em</span><strong>${fmtDate(c.createdAt)}</strong></div>

    <h3>Plano contratado</h3>
    ${assAtual ? `
      <div class="modal-row"><span>Plano</span><strong>${escapeHtml(assAtual.plan?.nome || '—')}</strong></div>
      <div class="modal-row"><span>Status</span><strong><span class="adm-status adm-status--${(assAtual.status || '').toLowerCase()}">${statusLabel(assAtual.status)}</span></strong></div>
      <div class="modal-row"><span>Início</span><strong>${fmtDate(assAtual.startDate || assAtual.createdAt)}</strong></div>
      <div class="modal-row"><span>Próx. cobrança</span><strong>${fmtDate(assAtual.nextDueDate)}</strong></div>
    ` : '<p style="color:var(--text-muted);">Sem plano contratado.</p>'}

    <h3>Pagamentos (${detail.pagamentos.length})</h3>
    ${detail.pagamentos.length ? `
      <table class="adm-table" style="margin:0;">
        <thead><tr><th>Data</th><th>Método</th><th>Valor</th><th>Status</th></tr></thead>
        <tbody>
          ${detail.pagamentos.slice(0, 12).map(p => `
            <tr>
              <td>${fmtDate(p.paidAt || p.createdAt)}</td>
              <td>${methodLabel(p.method)}</td>
              <td><strong>R$ ${fmtMoney(p.amount)}</strong></td>
              <td><span class="adm-status adm-status--${(p.status || '').toLowerCase()}">${statusLabel(p.status)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p style="color:var(--text-muted);">Nenhum pagamento ainda.</p>'}
  `;
}

// ===========================================================
// EXPORTAR CSV
// ===========================================================
async function exportarCSV(tipo){
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const url   = `${CFG.API_URL}/api/admin/export/${tipo}.csv`;

  // Tenta API real (download autenticado via fetch + blob)
  try{
    const r = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if(!r.ok) throw new Error('http_' + r.status);
    const blob = await r.blob();
    triggerDownload(blob, `planvida_${tipo}_${new Date().toISOString().slice(0,10)}.csv`);
    return;
  }catch(err){
    console.warn('[export] mock fallback:', err);
  }

  // Mock fallback — gera CSV no front
  let csv;
  if(tipo === 'clientes'){
    const head = ['nome','email','cpf','telefone','cidade','plano','status','criadoEm'];
    const rows = mockClientes().map(c => [
      c.nome, c.email, c.cpf, c.telefone, c.cidade,
      c.plano?.nome || '', c.statusAssinatura, c.createdAt,
    ]);
    csv = [head, ...rows].map(r => r.map(toCSV).join(';')).join('\n');
  } else {
    const head = ['data','cliente','cpf','plano','metodo','valor','status'];
    const rows = mockPagamentos().map(p => [
      p.paidAt || p.createdAt, p.cliente?.nome, p.cliente?.cpf,
      p.plano?.nome, p.method, p.amount.toFixed(2), p.status,
    ]);
    csv = [head, ...rows].map(r => r.map(toCSV).join(';')).join('\n');
  }
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `planvida_${tipo}_${new Date().toISOString().slice(0,10)}.csv`);
}

function triggerDownload(blob, name){
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(u), 2000);
}
function toCSV(v){
  if(v === null || v === undefined) return '';
  const s = String(v).replace(/"/g, '""');
  return /[;\n"]/.test(s) ? `"${s}"` : s;
}

['#btnExportClientes', '#btnExportClientes2'].forEach(sel => {
  $(sel)?.addEventListener('click', e => { e.preventDefault(); exportarCSV('clientes'); });
});
['#btnExportPagamentos', '#btnExportPagamentos2'].forEach(sel => {
  $(sel)?.addEventListener('click', e => { e.preventDefault(); exportarCSV('pagamentos'); });
});

// ===========================================================
// HELPERS
// ===========================================================
function escapeHtml(s){
  return String(s || '').replace(/[&<>"]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m]));
}
function debounce(fn, ms){
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ===========================================================
// AUTO-LOGIN
// ===========================================================
(async function autoLogin(){
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if(!token) return;
  if(token === 'mock_admin_token'){
    abrirShell('admin@planvida.com');
    return;
  }
  // Valida token via /stats
  try{
    await adminFetch('/api/admin/stats');
    abrirShell('admin@planvida.com');
  }catch(err){
    if(err.status === 401) localStorage.removeItem(ADMIN_TOKEN_KEY);
  }
})();

})();
