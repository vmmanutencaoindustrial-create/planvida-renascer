/* =========================================================
   PlanVida Renascer — Cadastro Funnel JS
   - Step 1: escolha do plano (carregado da API se disponível)
   - Step 2: dados pessoais (validação CPF + máscaras)
   - Step 3: confirmação + forma de pagamento + aceite
   - Step 4: POST /api/subscribe -> redireciona pro Mercado Pago
             (ou exibe mock convincente se backend off-line)
========================================================= */

(function(){

const API = window.PlanvidaAPI;
const CFG = window.PLANVIDA_CONFIG || {};

// ===========================================================
// STATE
// ===========================================================
const state = {
  step: 1,
  plano: null,
  dados: {},
  pagamento: 'pix',
  pagoOk: false,
  contratoOk: false,
  apiOnline: true,   // detectado em runtime
};

const PLANOS_FALLBACK = {
  individual: { slug: 'individual', nome: 'Plano Individual',     precoMensal: 170 },
  familiar:   { slug: 'familiar',   nome: 'Plano Familiar',       precoMensal: 290 },
  plus:       { slug: 'plus',       nome: 'Plano Família Plus',   precoMensal: 450 },
};

// ===========================================================
// DOM helpers
// ===========================================================
const $  = (s, ctx) => (ctx || document).querySelector(s);
const $$ = (s, ctx) => Array.from((ctx || document).querySelectorAll(s));

// ===========================================================
// Detecção de URL params (volta do Mercado Pago)
// ===========================================================
(function checkReturnFromMP(){
  const url = new URL(location.href);
  const status = url.searchParams.get('status');
  const pid    = url.searchParams.get('pid');
  if(!status) return;

  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:200;padding:14px 24px;border-radius:8px;font-weight:600;font-size:.95rem;box-shadow:0 12px 40px rgba(0,0,0,.18);max-width:90%;';
  if(status === 'success'){
    banner.style.background = '#2f7d32';
    banner.style.color = '#fff';
    banner.textContent = '✓ Pagamento aprovado! Verifique seu email para acessar a área do cliente.';
    setTimeout(() => location.href = 'portal.html', 4000);
  } else if(status === 'pending'){
    banner.style.background = '#d97706';
    banner.style.color = '#fff';
    banner.textContent = '⏳ Pagamento em análise. Você receberá uma confirmação em alguns minutos.';
  } else {
    banner.style.background = '#a30000';
    banner.style.color = '#fff';
    banner.textContent = '✕ Pagamento não foi concluído. Tente novamente ou escolha outra forma.';
  }
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 8000);
})();

// ===========================================================
// STEPPER + NAVEGAÇÃO ENTRE STEPS
// ===========================================================
function goStep(n){
  $$('.cad-step').forEach(s => s.classList.remove('is-active'));
  $(`.cad-step[data-step="${n}"]`)?.classList.add('is-active');

  const indicators = $$('.cad-stepper__step');
  const lines = $$('.cad-stepper__line');
  indicators.forEach(el => {
    el.classList.remove('is-active', 'is-done');
    const num = parseInt(el.dataset.step, 10);
    if(num < n) el.classList.add('is-done');
    else if(num === n) el.classList.add('is-active');
  });
  lines.forEach((line, i) => line.classList.toggle('is-done', i < (n - 1)));

  state.step = n;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$$('[data-prev]').forEach(btn => {
  btn.addEventListener('click', () => { if(state.step > 1) goStep(state.step - 1); });
});
$$('[data-go-step]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    goStep(parseInt(el.dataset.goStep, 10));
  });
});

// ===========================================================
// STEP 1 — ESCOLHA DO PLANO (sincroniza com API se possível)
// ===========================================================
async function loadPlanos(){
  if(!API) return;
  try{
    const r = await API.listarPlanos();
    if(!r?.plans?.length) return;
    // Atualiza preços/textos dos cards conforme dados da API
    r.plans.forEach(p => {
      const card = $(`.plano-card[data-plan="${p.slug}"]`);
      if(!card) return;
      card.dataset.price = String(p.precoMensal);
      const valEl = card.querySelector('.plano-card__valor');
      if(valEl) valEl.textContent = String(Math.round(p.precoMensal));
    });
    state.apiOnline = true;
  }catch(err){
    console.warn('[planvida] API offline — usando dados estáticos do site.', err.message);
    state.apiOnline = false;
  }
}
loadPlanos();

function selecionarPlano(key, autoAvance = true){
  const card = document.querySelector(`.plano-card[data-plan="${key}"]`);
  if(!card) return false;
  const preco = parseFloat(card.dataset.price);
  state.plano = { slug: key, nome: PLANOS_FALLBACK[key].nome, precoMensal: preco, preco };

  $$('.plano-card').forEach(c => c.classList.remove('is-selected'));
  card.classList.add('is-selected');
  if(autoAvance) setTimeout(() => goStep(2), 280);
  return true;
}

$$('.plano-card').forEach(card => {
  const choose = () => selecionarPlano(card.dataset.plan, true);
  card.addEventListener('click', choose);
  card.querySelector('.plano-card__btn')?.addEventListener('click', e => {
    e.stopPropagation();
    choose();
  });
});

// === Pré-seleção via ?plan=X (vindo do quiz) com 3 fallbacks ===
(function preselectFromUrl(){
  // 1) Query string (?plan=familiar)
  const params = new URLSearchParams(location.search);
  let plan = params.get('plan');

  // 2) Hash (#plan=familiar) — fallback se query for stripada
  if(!plan && location.hash){
    const m = location.hash.match(/plan=([\w-]+)/i);
    if(m) plan = m[1];
  }

  // 3) sessionStorage do quiz
  if(!plan){
    try{
      const cached = JSON.parse(sessionStorage.getItem('planvida_quiz_answers') || '{}');
      if(cached.planSlug && Date.now() - (cached.ts || 0) < 30 * 60 * 1000){
        plan = cached.planSlug;   // só usa se < 30 min
      }
    }catch{}
  }

  if(plan && PLANOS_FALLBACK[plan]){
    setTimeout(() => {
      selecionarPlano(plan, false);
      const card = document.querySelector(`.plano-card[data-plan="${plan}"]`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Avança em 1.2s pra dar tempo de ver
      setTimeout(() => goStep(2), 1200);
    }, 200);
  }
})();

// ===========================================================
// STEP 2 — DADOS PESSOAIS
// ===========================================================
const dadosForm = $('#dadosForm');

function maskCPF(v){
  return v.replace(/\D/g,'')
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d{1,2})/,'$1-$2')
    .slice(0,14);
}
function maskTel(v){
  const d = v.replace(/\D/g,'');
  if(d.length <= 10){
    return d.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{4})(\d)/,'$1-$2').slice(0,15);
  }
  return d.replace(/(\d{2})(\d{1})(\d{4})(\d)/,'($1) $2 $3-$4').slice(0,16);
}
function maskCEP(v){ return v.replace(/\D/g,'').replace(/(\d{5})(\d)/,'$1-$2').slice(0,9); }
function maskNasc(v){
  const d = v.replace(/\D/g,'').slice(0,8);
  if(d.length <= 2) return d;
  if(d.length <= 4) return d.replace(/(\d{2})(\d)/,'$1/$2');
  return d.replace(/(\d{2})(\d{2})(\d)/,'$1/$2/$3');
}

$('#fCpf')?.addEventListener('input', e => { e.target.value = maskCPF(e.target.value); });
$('#fTel')?.addEventListener('input', e => { e.target.value = maskTel(e.target.value); });
$('#fCep')?.addEventListener('input', e => { e.target.value = maskCEP(e.target.value); });
$('#fNasc')?.addEventListener('input', e => { e.target.value = maskNasc(e.target.value); });

function validaCPF(cpf){
  cpf = cpf.replace(/\D/g, '');
  if(cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let s, r;
  s = 0;
  for(let i = 0; i < 9; i++) s += parseInt(cpf.charAt(i)) * (10 - i);
  r = 11 - (s % 11);
  if(r === 10 || r === 11) r = 0;
  if(r !== parseInt(cpf.charAt(9))) return false;
  s = 0;
  for(let i = 0; i < 10; i++) s += parseInt(cpf.charAt(i)) * (11 - i);
  r = 11 - (s % 11);
  if(r === 10 || r === 11) r = 0;
  return r === parseInt(cpf.charAt(10));
}

// Adiciona campo de senha dinamicamente no form (não muda HTML)
(function injetarSenha(){
  if(!dadosForm) return;
  const grid = dadosForm.querySelector('.cad-form__grid');
  if(!grid || grid.querySelector('#fSenha')) return;
  const wrap = document.createElement('label');
  wrap.className = 'cad-field cad-field--full';
  wrap.innerHTML = `
    <span>Senha (mínimo 6 caracteres)</span>
    <input type="password" name="password" id="fSenha" required minlength="6" placeholder="••••••" autocomplete="new-password" />
  `;
  grid.appendChild(wrap);
})();

dadosForm?.addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(dadosForm);
  const dados = Object.fromEntries(fd.entries());

  const cpfInput = $('#fCpf');
  const cpfOk = validaCPF(dados.cpf);
  cpfInput.classList.toggle('is-invalid', !cpfOk);
  if(!cpfOk){ cpfInput.focus(); return; }

  if(!dados.password || dados.password.length < 6){
    const senhaInput = $('#fSenha');
    senhaInput?.classList.add('is-invalid');
    senhaInput?.focus();
    return;
  }

  state.dados = dados;
  // NUNCA persistir senha — só campos não-sensíveis pra UX (voltar ao form)
  const { password, ...nonSensitive } = dados;
  sessionStorage.setItem('planvida_cadastro', JSON.stringify({ plano: state.plano, dados: nonSensitive }));

  $('#sumPlano').textContent = state.plano.nome;
  $('#sumNome').textContent  = dados.nome;
  $('#sumCpf').textContent   = dados.cpf;
  $('#sumTel').textContent   = dados.tel;
  $('#sumEmail').textContent = dados.email;
  $('#sumValor').textContent = state.plano.preco;

  goStep(3);
});

// ===========================================================
// STEP 3 — PAGAMENTO + ACEITE
// ===========================================================
const aceiteCheck = $('#aceiteTermos');
const btnGerarPag = $('#btnGerarPagamento');

aceiteCheck?.addEventListener('change', () => {
  btnGerarPag.disabled = !aceiteCheck.checked;
});

$$('input[name="formapag"]').forEach(input => {
  input.addEventListener('change', () => { state.pagamento = input.value; });
});

btnGerarPag?.addEventListener('click', async () => {
  btnGerarPag.disabled = true;
  const original = btnGerarPag.textContent;
  btnGerarPag.textContent = 'Gerando pagamento...';

  // ---- Tenta API real primeiro ----
  if(API && state.apiOnline){
    try{
      const r = await API.subscribe({
        nome:     state.dados.nome,
        email:    state.dados.email,
        password: state.dados.password,
        cpf:      state.dados.cpf,
        telefone: state.dados.tel,
        dataNasc: state.dados.nasc,
        endereco: state.dados.endereco,
        cidade:   state.dados.cidade,
        cep:      state.dados.cep,
        planSlug: state.plano.slug,
      });

      // Salva token pra portal já reconhecer
      API.saveAuth(r.token, r.user);
      sessionStorage.setItem('planvida_payment_id', r.payment.id);

      // Redireciona pro Mercado Pago
      const target = r.paymentUrl || r.paymentUrlSandbox;
      if(target){
        window.location.href = target;
        return;
      }
      throw new Error('Backend não devolveu URL de pagamento.');
    }catch(err){
      console.error('[subscribe] erro real, ativando mock:', err);
      if(err.code === 'user_exists'){
        alert('Já existe uma conta com esse email/CPF. Faça login na área do cliente.');
        location.href = 'portal.html';
        return;
      }
      // CORS / rede / API fora -> cai no mock visual
      state.apiOnline = false;
      btnGerarPag.textContent = original;
      btnGerarPag.disabled = false;
    }
  }

  // ---- MOCK (demo / API offline) ----
  $$('.cad-pay-panel').forEach(p => p.classList.remove('is-active'));
  $(`.cad-pay-panel[data-method="${state.pagamento}"]`)?.classList.add('is-active');

  $('#pixValor').textContent = state.plano.preco.toFixed(2).replace('.', ',');
  $('#boletoValor').textContent = state.plano.preco.toFixed(2).replace('.', ',');
  $('#boletoCode').textContent = gerarLinhaBoleto(state.plano.preco);

  const due = new Date(); due.setDate(due.getDate() + 3);
  $('#boletoDue').textContent = due.toLocaleDateString('pt-BR');
  $('#pixCopyCode').textContent = gerarPixCopiaCola(state.dados.nome, state.plano.preco);

  // Persiste cliente local pra portal demo (sem senha em plain — apenas hash leve pra demo)
  const senhaHashLeve = await hashLeve(state.dados.password);
  const { password: _omit, ...dadosSemSenha } = state.dados;
  const sessionData = {
    plano: state.plano,
    dados: dadosSemSenha,
    pagamento: state.pagamento,
    cadastradoEm: new Date().toISOString(),
    senha_hash: senhaHashLeve,
    status: 'pending',
  };
  localStorage.setItem('planvida_cliente_atual', JSON.stringify(sessionData));
  const clientes = JSON.parse(localStorage.getItem('planvida_clientes') || '[]');
  clientes.push(sessionData);
  localStorage.setItem('planvida_clientes', JSON.stringify(clientes));

  goStep(4);
  btnGerarPag.textContent = original;
});

// hashLeve agora vem de window.PlanvidaAPI.hashLeve (compartilhado)
const hashLeve = (s) => window.PlanvidaAPI?.hashLeve(s) ?? Promise.resolve('');

// ===========================================================
// HELPERS — Mock PIX/Boleto realistas
// ===========================================================
function gerarPixCopiaCola(nome, valor){
  const valorStr = valor.toFixed(2);
  const nomeUpper = (nome || 'PLANVIDA RENASCER').toUpperCase().slice(0, 25);
  return `00020126360014BR.GOV.BCB.PIX0114+5582999903607520400005303986540${valorStr.length}${valorStr}5802BR59${String(nomeUpper.length).padStart(2,'0')}${nomeUpper}6006MACEIO62070503***6304ABCD`;
}
function gerarLinhaBoleto(valor){
  const v = String(Math.round(valor * 100)).padStart(10, '0');
  return `23793.38128 60082.018804 91100.401016 7 9051000${v}`;
}

// ===========================================================
// STEP 4 — Copy buttons + simulação (mock only)
// ===========================================================
function copyAndFlash(elId, btn){
  const text = $(`#${elId}`).textContent;
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = '✓ Copiado!';
    btn.style.background = '#2f7d32';
    btn.style.color = '#fff';
    btn.style.borderColor = '#2f7d32';
    setTimeout(() => {
      btn.textContent = original;
      btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = '';
    }, 1800);
  });
}
$('#btnCopyPix')?.addEventListener('click', e => copyAndFlash('pixCopyCode', e.currentTarget));
$('#btnCopyBoleto')?.addEventListener('click', e => copyAndFlash('boletoCode', e.currentTarget));

// Mock de assinatura ClickSign + pagamento (só se API offline)
$('#btnAssinarContrato')?.addEventListener('click', e => {
  e.preventDefault();
  const btn = e.currentTarget;
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="0"><animate attributeName="stroke-dashoffset" values="0;-64" dur="1.2s" repeatCount="indefinite"/></circle></svg> Abrindo contrato...';
  btn.style.pointerEvents = 'none';
  setTimeout(() => {
    state.contratoOk = true;
    marcarStatusContrato();
    btn.innerHTML = '✓ Contrato assinado';
    btn.style.background = '#2f7d32';
    btn.style.color = '#fff';
    btn.style.borderColor = '#2f7d32';
    checarConclusao();
  }, 3000);
});

(function escutarPagamento(){
  let timeout;
  const trigger = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      state.pagoOk = true;
      marcarStatusPagamento();
      checarConclusao();
    }, state.pagamento === 'pix' ? 8000 : (state.pagamento === 'boleto' ? 5000 : 4000));
  };
  $('#btnCopyPix')?.addEventListener('click', trigger);
  $('#btnCopyBoleto')?.addEventListener('click', trigger);
  $$('.cad-cartao input')[0]?.addEventListener('input', e => {
    if(e.target.value.replace(/\D/g,'').length >= 13) trigger();
  });
})();

function marcarStatusPagamento(){
  const item = $('#statusPag');
  if(!item) return;
  item.classList.add('is-done');
  item.querySelector('.cad-status__text').textContent = '✓ Pagamento confirmado.';
}
function marcarStatusContrato(){
  const item = $('#statusContrato');
  if(!item) return;
  item.classList.add('is-done');
  item.querySelector('.cad-status__text').textContent = '✓ Contrato assinado digitalmente.';
}
function checarConclusao(){
  if(state.pagoOk && state.contratoOk) finalizarCadastro();
}
function finalizarCadastro(){
  const session = JSON.parse(localStorage.getItem('planvida_cliente_atual') || '{}');
  session.status = 'active';
  session.ativadoEm = new Date().toISOString();
  session.cpf_login = state.dados.cpf;
  session.senha_inicial = state.dados.password || '123456';
  localStorage.setItem('planvida_cliente_atual', JSON.stringify(session));

  const clientes = JSON.parse(localStorage.getItem('planvida_clientes') || '[]');
  // Substitui ou adiciona
  const idx = clientes.findIndex(c => c.dados?.cpf === state.dados.cpf);
  if(idx >= 0) clientes[idx] = session; else clientes.push(session);
  localStorage.setItem('planvida_clientes', JSON.stringify(clientes));

  $('#sucPlano').textContent = state.plano.nome.replace('Plano ', '');
  $('#sucTel').textContent   = state.dados.tel;
  $('#sucEmail').textContent = state.dados.email;
  $('#cadSuccess').hidden    = false;

  setTimeout(() => {
    document.querySelector('.cad-status').style.display = 'none';
    document.querySelector('.cad-pay-stage').style.opacity = '0.5';
    document.querySelector('.cad-contrato').style.opacity  = '0.5';
  }, 800);
  setTimeout(() => $('#cadSuccess').scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
}

// ===========================================================
// RESTAURAR ESTADO se voltar pro form
// ===========================================================
(function restaurar(){
  try{
    const cached = JSON.parse(sessionStorage.getItem('planvida_cadastro') || '{}');
    if(cached.dados && cached.plano && dadosForm){
      Object.entries(cached.dados).forEach(([k, v]) => {
        const el = dadosForm.querySelector(`[name="${k}"]`);
        if(el && k !== 'password') el.value = v;
      });
    }
  }catch{}
})();

})();
