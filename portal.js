/* =========================================================
   PlanVida Renascer — Portal Cliente JS
   - Login real via API /api/auth/login
   - Dashboard via /api/dashboard (com Bearer token)
   - Fallback mock se API offline (mantém demo funcional)
   - Logout automático em 401 (evento planvida:logout)
========================================================= */

(function(){

// Logout global — disparado por api.js quando recebe 401
window.addEventListener('planvida:logout', () => {
  sessionStorage.removeItem('planvida_logado_cpf');
  if(!document.querySelector('#dashSection')?.hidden){
    location.reload();
  }
});

const $  = (s, ctx) => (ctx || document).querySelector(s);
const $$ = (s, ctx) => Array.from((ctx || document).querySelectorAll(s));

const API = window.PlanvidaAPI;

// ===========================================================
// MOCK CLIENTES (fallback demo)
// ===========================================================
const MOCK_CLIENTES = {
  '12345678900': {
    nome: 'Maria Helena Silva',
    cpf: '123.456.789-00',
    email: 'maria.demo@planvida.com',
    senha: '123456',
    plano: { key: 'familiar', nome: 'Plano Familiar', preco: 290, slug: 'familiar' },
    cadastradoEm: '2018-03-15T00:00:00.000Z',
    dependentes: 3,
    carteiraNumero: '00012457-001',
    proxVencimento: getNextDay(7),
  },
  '98765432100': {
    nome: 'Roberto Carlos Mendes',
    cpf: '987.654.321-00',
    email: 'roberto.demo@planvida.com',
    senha: '123456',
    plano: { key: 'plus', nome: 'Plano Família Plus', preco: 450, slug: 'plus' },
    cadastradoEm: '2020-08-22T00:00:00.000Z',
    dependentes: 5,
    carteiraNumero: '00018932-001',
    proxVencimento: getNextDay(12),
  },
};

function getNextDay(daysAhead){
  const d = new Date(); d.setDate(d.getDate() + daysAhead);
  return d;
}

// ===========================================================
// LOGIN — tenta API, cai no mock se offline
// ===========================================================
const loginForm  = $('#loginForm');
const loginCpfEl = $('#loginCpf');

function maskCPF(v){
  return v.replace(/\D/g,'')
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d{1,2})/,'$1-$2')
    .slice(0,14);
}
loginCpfEl?.addEventListener('input', e => { e.target.value = maskCPF(e.target.value); });

// Substitui label "CPF" -> "Email ou CPF" e tira maxlength pra aceitar email
(function ajustarLogin(){
  const span = loginCpfEl?.parentElement?.querySelector('span');
  if(span) span.textContent = 'Email ou CPF';
  loginCpfEl?.removeAttribute('maxlength');
  loginCpfEl?.setAttribute('placeholder', 'seu@email.com ou 000.000.000-00');
  loginCpfEl?.setAttribute('inputmode', 'text');
  // Mascara CPF só se digitarem dígitos
  loginCpfEl?.addEventListener('input', e => {
    const v = e.target.value;
    if(/^[\d.\-\s]+$/.test(v)) e.target.value = maskCPF(v);
  });
})();

// Demo banner: mostra em localhost OU quando URL tem ?demo=1
// Quando ?demo=1, também pré-preenche os campos para apresentação rápida
(function showDemoIfLocal(){
  const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(location.hostname);
  const params = new URLSearchParams(location.search);
  const isDemoParam = params.get('demo') === '1' || params.get('demo') === 'true';

  if(isLocal || isDemoParam){
    const banner = document.getElementById('demoBanner');
    if(banner) banner.hidden = false;
  }

  // Auto-preenche credenciais demo quando ?demo=1 na URL
  if(isDemoParam){
    const cpfField   = document.getElementById('loginCpf');
    const senhaField = document.getElementById('loginSenha');
    if(cpfField)   cpfField.value   = '123.456.789-00';
    if(senhaField) senhaField.value = '123456';
  }
})();

loginForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const idInput = loginCpfEl.value.trim();
  const senha   = $('#loginSenha').value;
  if(!idInput || !senha) return;

  // Detecta se é email ou CPF
  const isEmail = idInput.includes('@');
  const cpfDigits = idInput.replace(/\D/g, '');

  // ---- TENTA API REAL ----
  if(API){
    try{
      // Se for CPF e API não suportar login por CPF, busca email primeiro via mock storage
      let emailLogin = idInput;
      if(!isEmail){
        // Tenta achar email pelo CPF nos clientes locais (já cadastrados no site)
        const localClientes = JSON.parse(localStorage.getItem('planvida_clientes') || '[]');
        const c = localClientes.find(x => (x.dados?.cpf || '').replace(/\D/g,'') === cpfDigits);
        if(c?.dados?.email) emailLogin = c.dados.email;
      }

      const r = await API.login({ email: emailLogin, password: senha });
      API.saveAuth(r.token, r.user);
      await entrarPortalReal();
      return;
    }catch(err){
      if(err.network){
        console.warn('[login] API offline, tentando mock.');
      } else {
        // erro de credencial REAL — não cai no mock pra evitar bypass
        if(err.code === 'invalid_credentials'){
          erroLogin('Email/CPF ou senha inválidos.');
          return;
        }
        if(err.status === 429){
          erroLogin('Muitas tentativas. Aguarde alguns minutos.');
          return;
        }
        console.warn('[login] erro API, fallback:', err);
      }
    }
  }

  // ---- FALLBACK MOCK ----
  let cliente = MOCK_CLIENTES[cpfDigits];
  let senhaValida = false;
  if(cliente){
    senhaValida = senha === cliente.senha; // mocks built-in: senha plain
  } else {
    const clientes = JSON.parse(localStorage.getItem('planvida_clientes') || '[]');
    const c = clientes.find(x => {
      const cpf = (x.dados?.cpf || '').replace(/\D/g,'');
      const email = x.dados?.email || '';
      return cpf === cpfDigits || email === idInput.toLowerCase();
    });
    if(c){
      // Compara hash leve (compatível com cadastro novo)
      const hashTry = await (window.PlanvidaAPI?.hashLeve ? window.PlanvidaAPI.hashLeve(senha) : senha);
      senhaValida = c.senha_hash === hashTry || c.senha_inicial === senha;
      if(senhaValida){
        cliente = {
          nome: c.dados.nome,
          cpf: c.dados.cpf,
          email: c.dados.email,
          plano: c.plano,
          cadastradoEm: c.cadastradoEm,
          dependentes: c.plano?.slug === 'plus' ? 5 : (c.plano?.slug === 'familiar' ? 3 : 0),
          carteiraNumero: '0' + (Math.floor(Math.random() * 90000) + 10000) + '-001',
          proxVencimento: getNextDay(7),
          tel: c.dados.tel,
        };
      }
    }
  }

  // Erro genérico anti-enumeração — mesmo erro pra "não existe" e "senha errada"
  if(!cliente || !senhaValida){
    erroLogin('Email/CPF ou senha inválidos.');
    return;
  }

  sessionStorage.setItem('planvida_logado_cpf', cpfDigits || (cliente.cpf || '').replace(/\D/g,''));
  entrarPortal(cliente);
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

// ===========================================================
// ENTRAR PORTAL — versão API
// ===========================================================
async function entrarPortalReal(){
  try{
    const data = await API.dashboard();
    showDash();
    populateDashFromAPI(data);
  }catch(err){
    console.error('[dashboard] erro:', err);
    if(err.status === 401){
      API.clearToken();
      erroLogin('Sessão expirada. Faça login novamente.');
      return;
    }
    erroLogin('Não foi possível carregar dados. Tente novamente.');
  }
}

function showDash(){
  $('#loginSection').hidden = true;
  $('#dashSection').hidden  = false;
  $('#btnLogout').hidden    = false;
  window.scrollTo(0,0);
  $('#dashSection').animate(
    [{opacity:0, transform:'translateY(20px)'}, {opacity:1, transform:'translateY(0)'}],
    {duration: 600, easing: 'cubic-bezier(.22,.61,.36,1)'}
  );
}

// ===========================================================
// LOGOUT
// ===========================================================
$('#btnLogout')?.addEventListener('click', () => {
  if(API) API.clearToken();
  sessionStorage.removeItem('planvida_logado_cpf');
  location.reload();
});

// ===========================================================
// POPULATE — a partir da API real
// ===========================================================
function populateDashFromAPI(data){
  const u = data.user || {};
  const sub = data.subscription;
  const px  = data.proximoPagamento;

  const firstName = (u.nome || '').split(' ')[0] || 'Cliente';
  $('#dashName').textContent  = firstName;
  $('#dashPlano').textContent = (sub?.plan?.nome || '—').replace('Plano ', '');

  if(u.cadastradoEm){
    $('#dashSince').textContent = new Date(u.cadastradoEm).getFullYear();
  }

  // Próximo pagamento
  const valor = sub?.plan?.precoMensal ?? px?.amount ?? 0;
  $('#dashValor').textContent = Number(valor).toFixed(2).replace('.', ',');

  let venceData = sub?.nextDueDate ? new Date(sub.nextDueDate) : (px?.createdAt ? new Date(px.createdAt) : new Date());
  if(!sub?.nextDueDate && px?.createdAt){
    venceData = new Date(px.createdAt); venceData.setDate(venceData.getDate() + 30);
  }
  const diff = Math.ceil((venceData - new Date()) / (1000*60*60*24));
  $('#dashVence').textContent = diff <= 0
    ? `Vence hoje${diff < 0 ? ' (em atraso)' : ''}`
    : `Vence em ${diff} dia${diff !== 1 ? 's' : ''}`;
  $('#dashVenceData').textContent = venceData.toLocaleDateString('pt-BR');

  // PIX / Boleto: usa dados reais do MP se vieram, senão mock visual
  $('#dashPixCode').textContent    = px?.mpQrCode || gerarPixCopiaCola(u.nome, valor);
  $('#dashBoletoCode').textContent = gerarLinhaBoleto(valor);
  $('#dashBoletoValor').textContent = Number(valor).toFixed(2).replace('.', ',');
  $('#dashBoletoDue').textContent   = venceData.toLocaleDateString('pt-BR');
  const proxCart = new Date(venceData); proxCart.setDate(proxCart.getDate() + 30);
  $('#dashCartaoData').textContent = proxCart.toLocaleDateString('pt-BR');

  // Carteirinha
  $('#cartTag').textContent  = (sub?.plan?.nome || 'PLANO').replace('Plano ', '').toUpperCase();
  $('#cartNome').textContent = (u.nome || '').toUpperCase();
  $('#cartCpf').textContent  = formatCPF(u.cpf);
  $('#cartNum').textContent  = '0' + (u.id?.slice(-5) || '0001') + '-001';
  $('#cartVig').textContent  = 'VITALÍCIA';

  // Dependentes
  $('#dashDependentes').textContent = sub?.plan?.slug === 'plus' ? 5 : (sub?.plan?.slug === 'familiar' ? 3 : 0);
  ajustarDependentes({ plano: sub?.plan });

  // Histórico
  popularHistoricoFromAPI(data.historicoPagamentos || [], { proxVencimento: venceData, plano: sub?.plan, valor });

  // Mostra link pra pagar se tiver pendente
  if(px?.status === 'PENDING' && px?.mpInitPoint){
    addBannerPagamentoPendente(px.mpInitPoint);
  }

  bindTabs();
  bindCopyButtons();
}

function addBannerPagamentoPendente(url){
  if($('#bannerPagPendente')) return;
  const banner = document.createElement('div');
  banner.id = 'bannerPagPendente';
  banner.style.cssText = 'max-width:1200px;margin:18px auto 0;padding:0 24px;';
  banner.innerHTML = `
    <div style="background:#FFFEF5;border:1.5px solid var(--gold,#FFE600);border-radius:4px;padding:16px 22px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;">
      <div>
        <strong style="color:var(--navy-deep,#2B33A0);">⚠️ Pagamento pendente</strong>
        <p style="color:var(--text-muted,#7A7A7A);font-size:.92rem;margin-top:4px;">Sua assinatura ainda não foi confirmada. Clique para pagar.</p>
      </div>
      <a href="${url}" target="_blank" rel="noopener" class="btn btn--gold">Pagar agora →</a>
    </div>`;
  document.querySelector('.portal-grid')?.prepend(banner);
}

function formatCPF(cpf){
  const d = (cpf || '').replace(/\D/g,'');
  if(d.length !== 11) return cpf || '—';
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

// ===========================================================
// POPULATE — versão MOCK (fallback)
// ===========================================================
function entrarPortal(cliente){
  showDash();
  populateDashMock(cliente);
}

function populateDashMock(cliente){
  const firstName = cliente.nome.split(' ')[0];
  $('#dashName').textContent  = firstName;
  $('#dashPlano').textContent = cliente.plano.nome.replace('Plano ', '');
  $('#dashSince').textContent = new Date(cliente.cadastradoEm).getFullYear();

  const preco = cliente.plano.precoMensal || cliente.plano.preco || 0;
  $('#dashValor').textContent = preco.toFixed(2).replace('.', ',');
  const venc = cliente.proxVencimento;
  const diff = Math.ceil((venc - new Date()) / (1000*60*60*24));
  $('#dashVence').textContent = `Vence em ${diff} dia${diff !== 1 ? 's' : ''}`;
  $('#dashVenceData').textContent = venc.toLocaleDateString('pt-BR');

  $('#dashPixCode').textContent = gerarPixCopiaCola(cliente.nome, preco);
  $('#dashBoletoValor').textContent = preco.toFixed(2).replace('.', ',');
  $('#dashBoletoDue').textContent = venc.toLocaleDateString('pt-BR');
  $('#dashBoletoCode').textContent = gerarLinhaBoleto(preco);

  const proxCart = new Date(venc); proxCart.setDate(proxCart.getDate() + 30);
  $('#dashCartaoData').textContent = proxCart.toLocaleDateString('pt-BR');

  $('#cartTag').textContent = cliente.plano.nome.replace('Plano ', '').toUpperCase();
  $('#cartNome').textContent = cliente.nome.toUpperCase();
  $('#cartCpf').textContent = cliente.cpf;
  $('#cartNum').textContent = cliente.carteiraNumero;
  $('#cartVig').textContent = 'VITALÍCIA';

  $('#dashDependentes').textContent = cliente.dependentes;
  ajustarDependentes(cliente);

  popularHistoricoMock(cliente);
  bindTabs();
  bindCopyButtons();
}

function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
}

function ajustarDependentes(cliente){
  const list = $('#dependentesList');
  if(!list) return;
  const slug = cliente.plano?.slug || cliente.plano?.key;

  let deps = [];
  if(slug === 'individual'){ deps = []; }
  else if(slug === 'familiar'){
    deps = [
      { nome: 'João Silva', tipo: 'Cônjuge', idade: 58 },
      { nome: 'Pedro Silva', tipo: 'Filho', idade: 19 },
      { nome: 'Ana Silva', tipo: 'Filha', idade: 15 },
    ];
  } else if(slug === 'plus'){
    deps = [
      { nome: 'João Silva', tipo: 'Cônjuge', idade: 58 },
      { nome: 'Pedro Silva', tipo: 'Filho', idade: 19 },
      { nome: 'Ana Silva', tipo: 'Filha', idade: 15 },
      { nome: 'Antônio Silva', tipo: 'Pai', idade: 78 },
      { nome: 'Cecília Silva', tipo: 'Mãe', idade: 75 },
    ];
  }

  if(deps.length === 0){
    list.innerHTML = '<p style="color:var(--text-muted); padding:18px; text-align:center;">Plano Individual: sem dependentes vinculados.</p>';
    return;
  }
  list.innerHTML = deps.map(d => {
    const initials = (d.nome || '').split(' ').map(p => p[0]).slice(0,2).join('');
    return `
      <div class="dependente">
        <div class="dependente__avatar">${escapeHtml(initials)}</div>
        <div class="dependente__info">
          <strong>${escapeHtml(d.nome)}</strong>
          <small>${escapeHtml(d.tipo)} · ${escapeHtml(d.idade)} anos · CPF ***.***.***-**</small>
        </div>
        <span class="badge-portal badge-portal--ok">Ativo</span>
      </div>`;
  }).join('');
}

function popularHistoricoFromAPI(pagamentos, ctx){
  const list = $('#historicoList');
  if(!list) return;
  let html = '';
  pagamentos.forEach(p => {
    const data = p.paidAt ? new Date(p.paidAt) : new Date(p.createdAt);
    const isPago = p.status === 'APPROVED';
    const isPend = p.status === 'PENDING' || p.status === 'IN_PROCESS';
    html += `
      <div class="hist-item">
        <span class="hist-item__data">${data.toLocaleDateString('pt-BR')}</span>
        <span class="hist-item__desc">Mensalidade · ${escapeHtml(ctx.plano?.nome || 'Plano')}</span>
        <span class="hist-item__forma">${escapeHtml(methodLabel(p.method))}</span>
        <span class="hist-item__valor">R$ ${Number(p.amount).toFixed(2).replace('.',',')}</span>
        <span class="hist-item__status ${isPago ? 'is-pago' : (isPend ? 'is-pendente' : 'is-pendente')}">${escapeHtml(statusLabel(p.status))}</span>
      </div>`;
  });
  if(!pagamentos.length){
    html = '<p style="color:var(--text-muted); padding:18px; text-align:center;">Nenhum pagamento registrado ainda.</p>';
  }
  list.innerHTML = html;
}

function methodLabel(m){
  const map = { PIX: 'PIX', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão', DEBIT_CARD: 'Débito', OTHER: '—' };
  return map[m] || '—';
}
function statusLabel(s){
  const map = { APPROVED: 'Pago', PENDING: 'Pendente', IN_PROCESS: 'Processando', REJECTED: 'Recusado', REFUNDED: 'Reembolsado', CANCELED: 'Cancelado' };
  return map[s] || s;
}

function popularHistoricoMock(cliente){
  const list = $('#historicoList');
  if(!list) return;
  const today = new Date();
  const formas = ['PIX', 'Boleto', 'Cartão'];
  const preco = cliente.plano.precoMensal || cliente.plano.preco;
  let html = `
    <div class="hist-item">
      <span class="hist-item__data">${cliente.proxVencimento.toLocaleDateString('pt-BR')}</span>
      <span class="hist-item__desc">Mensalidade · ${cliente.plano.nome}</span>
      <span class="hist-item__forma">—</span>
      <span class="hist-item__valor">R$ ${preco.toFixed(2).replace('.',',')}</span>
      <span class="hist-item__status is-pendente">Pendente</span>
    </div>`;
  for(let i = 0; i < 6; i++){
    const d = new Date(today); d.setMonth(d.getMonth() - (i + 1)); d.setDate(5);
    html += `
      <div class="hist-item">
        <span class="hist-item__data">${d.toLocaleDateString('pt-BR')}</span>
        <span class="hist-item__desc">Mensalidade · ${cliente.plano.nome}</span>
        <span class="hist-item__forma">${formas[i % 3]}</span>
        <span class="hist-item__valor">R$ ${preco.toFixed(2).replace('.',',')}</span>
        <span class="hist-item__status is-pago">Pago</span>
      </div>`;
  }
  list.innerHTML = html;
}

// ===========================================================
// TABS / COPY
// ===========================================================
function bindTabs(){
  $$('.portal-pgto__tabs button').forEach(btn => {
    btn.onclick = () => {
      const tab = btn.dataset.tab;
      $$('.portal-pgto__tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.portal-pgto__panel').forEach(p => p.classList.remove('is-active'));
      $(`.portal-pgto__panel--${tab}`)?.classList.add('is-active');
    };
  });
}
function bindCopyButtons(){
  const copy = (codeId, btn) => {
    const text = $(`#${codeId}`).textContent;
    navigator.clipboard.writeText(text).then(() => {
      const original = btn.textContent;
      btn.textContent = '✓ Copiado!';
      btn.style.background = '#2f7d32'; btn.style.color = '#fff';
      setTimeout(() => { btn.textContent = original; btn.style.background = ''; btn.style.color = ''; }, 1800);
    });
  };
  $('#btnCopyPixDash')?.addEventListener('click', e => copy('dashPixCode', e.currentTarget));
  $('#btnCopyBoletoDash')?.addEventListener('click', e => copy('dashBoletoCode', e.currentTarget));
}

// ===========================================================
// HELPERS — Mock PIX/Boleto
// ===========================================================
function gerarPixCopiaCola(nome, valor){
  const v = Number(valor || 0);
  const valorStr = v.toFixed(2);
  const nomeUpper = (nome || 'PLANVIDA').toUpperCase().slice(0, 25);
  return `00020126360014BR.GOV.BCB.PIX0114+5582999903607520400005303986540${valorStr.length}${valorStr}5802BR59${String(nomeUpper.length).padStart(2,'0')}${nomeUpper}6006MACEIO62070503***6304ABCD`;
}
function gerarLinhaBoleto(valor){
  const v = String(Math.round(Number(valor || 0) * 100)).padStart(10, '0');
  return `23793.38128 60082.018804 91100.401016 7 9051000${v}`;
}

// ===========================================================
// AUTO-LOGIN — checa token salvo
// ===========================================================
(async function autoLogin(){
  if(API && API.isLogged()){
    try{
      const data = await API.dashboard();
      showDash();
      populateDashFromAPI(data);
      return;
    }catch(err){
      if(err.status === 401){
        API.clearToken();
      } else if(!err.network){
        console.warn('[autoLogin] erro:', err);
      }
    }
  }

  // Fallback mock auto-login
  const cpfLogado = sessionStorage.getItem('planvida_logado_cpf');
  if(!cpfLogado) return;
  let cliente = MOCK_CLIENTES[cpfLogado];
  if(!cliente){
    const clientes = JSON.parse(localStorage.getItem('planvida_clientes') || '[]');
    const c = clientes.find(x => (x.dados?.cpf || '').replace(/\D/g,'') === cpfLogado);
    if(c){
      cliente = {
        nome: c.dados.nome,
        cpf: c.dados.cpf,
        email: c.dados.email,
        senha: c.senha_inicial || '123456',
        plano: c.plano,
        cadastradoEm: c.cadastradoEm,
        dependentes: c.plano?.slug === 'plus' ? 5 : (c.plano?.slug === 'familiar' ? 3 : 0),
        carteiraNumero: '0' + (Math.floor(Math.random() * 90000) + 10000) + '-001',
        proxVencimento: getNextDay(7),
      };
    }
  }
  if(cliente) entrarPortal(cliente);
})();

})();
