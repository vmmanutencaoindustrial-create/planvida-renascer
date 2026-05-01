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

// Stepper indicators clicáveis (navegação livre entre steps)
$$('.cad-stepper__step').forEach(el => {
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `Ir para o passo ${el.dataset.step}`);
  const target = parseInt(el.dataset.step, 10);
  const navigate = () => {
    if(!isNaN(target) && target >= 1 && target <= 4) goStep(target);
  };
  el.addEventListener('click', navigate);
  el.addEventListener('keydown', e => {
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); navigate(); }
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

// =============================================================
// QUIZ INLINE PERSUASIVO (.cqz) — abre no botão "quiz de 30 seg"
// Ajuda a DECIDIR entre os 3 planos (Individual / Familiar / Plus)
// =============================================================
(function quizInlineSetup(){
  const quiz = $('#quizInline');
  if(!quiz) return;

  const cqzState = { answers: {}, current: 1 };

  // Catálogo (mesmo do site, mas com economia/comparativo)
  const PLAN_CATALOG = {
    individual: {
      slug: 'individual',
      nome: 'Plano Individual',
      preco: 170,
      desc: 'Cobertura completa pra você, sem peso pra família. Em emergência custaria R$ 18 mil — você protege por R$ 170/mês.',
      bullets: [
        'Cobre 1 titular',
        'Velório, urna, translado, documentação',
        'Cremação OU sepultamento (sua escolha)',
        'Atendimento 24h em todo o Brasil',
      ],
      economy: 'economiza R$ 16.040 vs emergência',
    },
    familiar: {
      slug: 'familiar',
      nome: 'Plano Familiar',
      preco: 290,
      desc: '7 em cada 10 famílias escolhem este. Cobre 6 pessoas — família inteira protegida por menos que um plano de saúde.',
      bullets: [
        'Cobre titular + cônjuge + 4 filhos',
        'Tudo do plano Individual incluso',
        'Floricultura Renascer + Ambulatorial',
        'Suporte familiar pós-perda',
      ],
      economy: 'economiza até R$ 14.620 vs emergência',
    },
    plus: {
      slug: 'plus',
      nome: 'Plano Família Plus',
      preco: 450,
      desc: 'Único plano que cobre 3 gerações no mesmo contrato. Inclui pais, sogros e até odontologia.',
      bullets: [
        'Até 6 dependentes (incluindo pais e sogros)',
        'Tudo do Familiar incluso',
        'Clínica odontológica gratuita',
        'Cobertura imediata por acidente',
      ],
      economy: 'economiza até R$ 14.470 vs emergência',
    },
  };

  // Mensagens empáticas (entre as perguntas)
  const EMPATHY = {
    1: {
      solo:     'Cuidar de si primeiro é sabedoria. A maioria esquece disso.',
      couple:   'Esse vínculo merece proteção dos dois lados.',
      family:   'Filhos primeiro, sempre. Estamos com você.',
      extended: 'Quem te criou, você quer retribuir. Bonito.',
    },
    2: {
      ready:    'Você está à frente de 90% das famílias. Continuemos.',
      partial:  'Já avançou bastante. Vamos terminar o que começou.',
      never:    'É natural empurrar — mas o cuidado é mostrado em silêncio também.',
      avoid:    'Eu te entendo. É exatamente quem mais precisa de uma rede de apoio.',
    },
    3: {
      lt5:      'É exatamente pra isso que o plano existe. Você não vai carregar isso sozinho(a).',
      '5to15':  'Aperto na hora errada multiplica a dor. Existe um caminho mais leve.',
      '15to30': 'Você fez a parte do dinheiro. Falta a parte do cuidado organizar.',
      ready:    'Vamos mostrar por que vale a pena comparar.',
    },
  };

  // Diagnóstico personalizado (combinação Q2 + Q3)
  function buildDiagnosis(a){
    const notReady = a.q2 === 'never' || a.q2 === 'avoid' || a.q2 === 'partial';
    const lowFunds = a.q3 === 'lt5' || a.q3 === '5to15';
    const hasPlan  = a.q3 === 'ready';

    if(notReady && lowFunds){
      return {
        title: 'Sua família precisa de <em>uma rede agora.</em>',
        text:  'Sem plano + sem reserva = 32 decisões em 24h, sob choque. <em>Por menos de R$ 6/dia, isso não acontece.</em>',
        urgency: 'Vagas limitadas neste mês',
      };
    }
    if(notReady && !lowFunds && !hasPlan){
      return {
        title: 'Você tem o dinheiro. <em>Falta a direção.</em>',
        text:  'No momento da dor, ninguém quer decidir caixão, traslado, papel — quer chorar com quem ama. <em>O plano resolve em 2 minutos.</em>',
        urgency: 'Promoção · 1ª mensalidade R$ 1',
      };
    }
    if(hasPlan){
      return {
        title: 'Você já cuida. <em>Vale comparar.</em>',
        text:  'Hoje, R$ 290/mês cobre o que você paga em outro lugar por R$ 380. <em>Sem multa pra trocar.</em>',
        urgency: 'Migração sem custo',
      };
    }
    return {
      title: 'Você sabe o que quer. <em>Falta só formalizar.</em>',
      text:  'Tudo conversado é metade do caminho. <em>O outro 50% é fechar a proteção. 2 minutos.</em>',
      urgency: 'Promoção · 1ª mensalidade R$ 1',
    };
  }

  // Recomenda o plano com base na Q1 (tamanho da família)
  function recommendSlug(a){
    if(a.q1 === 'solo')     return 'individual';
    if(a.q1 === 'extended') return 'plus';
    return 'familiar'; // couple + family
  }

  // ============= ABRIR / FECHAR =============
  function openQuiz(){
    cqzState.answers = {};
    cqzState.current = 1;
    quiz.hidden = false;
    quiz.classList.add('is-open');
    document.body.classList.add('cqz-open');
    showStep(1);
  }
  function closeQuiz(){
    quiz.classList.remove('is-open');
    document.body.classList.remove('cqz-open');
    setTimeout(() => quiz.hidden = true, 200);
  }

  $('#abrirQuizInline')?.addEventListener('click', e => {
    e.preventDefault();
    openQuiz();
  });
  $$('[data-cqz-close]', quiz).forEach(el => el.addEventListener('click', closeQuiz));
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && !quiz.hidden) closeQuiz();
  });

  // ============= STEPS — transição suave (slide+fade) =============
  function showStep(n){
    const current = $(`.cqz__step.is-active`, quiz);
    const next = $(`.cqz__step[data-cqz-step="${n}"]`, quiz);
    if(!next) return;
    if(current === next) return;

    // Fade-out atual com slide-left
    if(current){
      current.classList.add('is-leaving');
      setTimeout(() => {
        current.classList.remove('is-active', 'is-leaving');
      }, 350);
    }
    // Fade-in novo
    setTimeout(() => {
      next.classList.add('is-active');
    }, current ? 350 : 0);

    cqzState.current = n;
    // Progress (animação smooth via CSS transition)
    const totalSteps = 4;
    const idx = n === 'result' ? 4 : parseInt(n, 10);
    const pct = (idx / totalSteps) * 100;
    $('#cqzProgress').style.width = pct + '%';
  }

  // Mensagem empática — fade in 600ms, lê por 2400ms, fade out 500ms = 3.5s total
  function showEmpathy(message){
    return new Promise(resolve => {
      const stage = quiz.querySelector('.cqz__stage');
      const bubble = document.createElement('div');
      bubble.className = 'cqz__empathy';
      bubble.innerHTML = `
        <div class="cqz__empathy-icon">
          <svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </div>
        <p class="cqz__empathy-text">${message}</p>
      `;
      stage.appendChild(bubble);
      // Força reflow + adiciona class no próximo tick (mais confiável que rAF)
      void bubble.offsetWidth;
      setTimeout(() => bubble.classList.add('is-visible'), 16);
      // 2600ms visível pra ler com calma
      setTimeout(() => {
        bubble.classList.add('is-leaving');
        bubble.classList.remove('is-visible');
        // 500ms fade-out
        setTimeout(() => { bubble.remove(); resolve(); }, 500);
      }, 2600);
    });
  }

  // ============= CLICK NAS OPÇÕES =============
  $$('.cqz__opt', quiz).forEach(btn => {
    btn.addEventListener('click', async () => {
      const q = btn.dataset.cqzQ;
      const v = btn.dataset.cqzV;
      cqzState.answers['q' + q] = v;

      // visual feedback
      const stepEl = btn.closest('.cqz__step');
      $$('.cqz__opt', stepEl).forEach(b => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');

      // Mensagem empática
      const msg = EMPATHY[q]?.[v];
      if(msg) await showEmpathy(msg);

      // Avançar
      const next = parseInt(q, 10) + 1;
      if(next <= 3){
        showStep(next);
      } else {
        renderResult();
        showStep('result');
      }
    });
  });

  // ============= RESULTADO =============
  function renderResult(){
    const a = cqzState.answers;
    const slug = recommendSlug(a);
    const plan = PLAN_CATALOG[slug];
    const diag = buildDiagnosis(a);

    $('#cqzDiagTitle').innerHTML = diag.title;
    $('#cqzDiagText').innerHTML  = diag.text;
    $('#cqzUrgency').textContent = diag.urgency;

    $('#cqzPlanName').textContent = plan.nome;
    $('#cqzPlanDesc').textContent = plan.desc;
    $('#cqzPlanValor').textContent = plan.preco;
    $('#cqzPlanEconomy').textContent = plan.economy;
    $('#cqzPlanBullets').innerHTML = plan.bullets.map(b => `<li>${b}</li>`).join('');

    // Soft CTA contextual
    const softMsgs = {
      individual: 'Você está a 4 cliques de tirar esse peso das suas costas.',
      familiar:   'Você está a 4 cliques de proteger sua família inteira.',
      plus:       'Você está a 4 cliques de proteger 3 gerações de uma vez.',
    };
    $('#cqzCtaSoft').textContent = softMsgs[slug];

    // Guarda slug pro CTA usar
    quiz.dataset.recommendedSlug = slug;
  }

  // ============= CTA "Contratar" =============
  $('#cqzContratar')?.addEventListener('click', () => {
    const slug = quiz.dataset.recommendedSlug || 'familiar';
    closeQuiz();
    // Seleciona o card do plano + avança step 2
    setTimeout(() => {
      if(typeof selecionarPlano === 'function'){
        selecionarPlano(slug, false);
        const card = document.querySelector(`.plano-card[data-plan="${slug}"]`);
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => goStep(2), 1100);
      }
    }, 250);
  });

  // ============= REFAZER =============
  $$('[data-cqz-restart]', quiz).forEach(el => {
    el.addEventListener('click', () => {
      cqzState.answers = {};
      cqzState.current = 1;
      $$('.cqz__opt.is-selected', quiz).forEach(b => b.classList.remove('is-selected'));
      showStep(1);
    });
  });
})();

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
