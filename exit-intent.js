/* =========================================================
   PlanVida — Exit-Intent
   Quando o usuário tenta sair (fechar tab, voltar, mouse pro topo),
   mostra um modal emocional perguntando se ele tem certeza.
========================================================= */

(function(){

// Não rodar em páginas internas ondeo usuário JÁ ESTÁ contratando
const onCadastro = /\/cadastro\.html(\?|$|#)/.test(location.pathname + location.search);
const onPortal   = /\/portal\.html/.test(location.pathname);
const onAdmin    = /\/admin\.html/.test(location.pathname);

// Em portal/admin não distrai com modal. Em cadastro mostra alert nativo se tem dados preenchidos.
const showCustomModal = !onPortal && !onAdmin;

// Estado
let modalShown   = false;     // já apareceu uma vez? só uma vez por sessão
let userBlocked  = false;     // usuário escolheu ficar
const STORAGE_KEY = 'planvida_exit_seen';

// Se já viu hoje, não mostra de novo (24h)
function jaViu(){
  try{
    const ts = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    return ts && (Date.now() - ts) < 24 * 60 * 60 * 1000;
  }catch{ return false; }
}
function marcarComoVisto(){
  try{ localStorage.setItem(STORAGE_KEY, String(Date.now())); }catch{}
}

// =========================================================
// MODAL CUSTOMIZADO (mouse intent)
// =========================================================
function buildModal(){
  if(document.getElementById('exitIntentModal')) return;

  const wrap = document.createElement('div');
  wrap.id = 'exitIntentModal';
  wrap.className = 'exit-modal';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-labelledby', 'exitTitle');
  wrap.innerHTML = `
    <div class="exit-modal__overlay" data-exit-close></div>
    <div class="exit-modal__card">
      <button type="button" class="exit-modal__close" data-exit-close aria-label="Fechar">×</button>

      <div class="exit-modal__icon" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="64" height="64">
          <defs>
            <linearGradient id="exitHeartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"  stop-color="#FFE600"/>
              <stop offset="100%" stop-color="#c9a200"/>
            </linearGradient>
          </defs>
          <path d="M32 56C18 46 6 36 6 22c0-7 5-12 12-12 4 0 8 2 14 8 6-6 10-8 14-8 7 0 12 5 12 12 0 14-12 24-26 34z"
                fill="url(#exitHeartGrad)"/>
        </svg>
      </div>

      <p class="exit-modal__eyebrow">Espera um momento</p>
      <h2 id="exitTitle" class="exit-modal__title">
        Sua família<br/><em>precisa de você.</em>
      </h2>
      <p class="exit-modal__text">
        Em 30 segundos você descobre o plano ideal pra família —
        antes que a vida faça a pergunta por você.
      </p>

      <div class="exit-modal__actions">
        <button type="button" class="btn btn--gold btn--lg" data-exit-stay>
          Continuar e proteger minha família
        </button>
        <button type="button" class="exit-modal__leave" data-exit-leave>
          Vou pensar e voltar depois
        </button>
      </div>

      <p class="exit-modal__trust">
        <svg class="i"><use href="assets/icons.svg#i-clock"/></svg> 30 seg ·
        <svg class="i"><use href="assets/icons.svg#i-shield"/></svg> Sem compromisso ·
        <svg class="i"><use href="assets/icons.svg#i-scroll"/></svg> Regulamentado SUSEP
      </p>
    </div>
  `;
  document.body.appendChild(wrap);

  // Listeners de fechar
  wrap.querySelectorAll('[data-exit-close], [data-exit-leave]').forEach(el => {
    el.addEventListener('click', () => closeModal(/*manter*/false));
  });
  wrap.querySelector('[data-exit-stay]')?.addEventListener('click', () => {
    closeModal(/*manter*/true);
    // Scroll suave pro quiz se estiver na home
    const target = document.querySelector('#quiz, #cadastro, .quiz, .cad-step.is-active');
    if(target){ target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else if(!onCadastro) location.href = 'cadastro.html';
  });

  // ESC fecha
  document.addEventListener('keydown', escClose);
}

function escClose(e){
  if(e.key === 'Escape' && document.body.classList.contains('exit-modal-open')){
    closeModal(false);
  }
}

function openModal(){
  if(modalShown || userBlocked || jaViu()) return;
  modalShown = true;
  buildModal();
  document.body.classList.add('exit-modal-open');
  document.getElementById('exitIntentModal')?.classList.add('is-visible');
  marcarComoVisto();
}

function closeModal(stayed){
  document.body.classList.remove('exit-modal-open');
  document.getElementById('exitIntentModal')?.remove();
  document.removeEventListener('keydown', escClose);
  if(stayed) userBlocked = true;
}

// =========================================================
// TRIGGERS
// =========================================================

// 1. mouseleave pelo topo (intenção de fechar tab/aba)
function onMouseLeave(e){
  if(e.clientY <= 5 && !userBlocked) openModal();
}

// 2. mobile: scroll up rápido após scroll down (intenção de voltar)
let lastScrollY = window.scrollY;
let lastScrollT = Date.now();
function onScrollMobile(){
  const dy = lastScrollY - window.scrollY;
  const dt = Date.now() - lastScrollT;
  if(dy > 80 && dt < 250 && window.scrollY < 300 && !userBlocked){
    openModal();
  }
  lastScrollY = window.scrollY;
  lastScrollT = Date.now();
}

// 3. beforeunload — fallback nativo (browser controla o texto)
function onBeforeUnload(e){
  if(userBlocked) return;     // já decidiu ficar
  if(!modalShown){            // só se ainda não viu o modal
    e.preventDefault();
    e.returnValue = 'Sua família precisa de você. Tem certeza que deseja sair sem proteger?';
    return e.returnValue;
  }
}

// =========================================================
// SETUP
// =========================================================
if(showCustomModal){
  // Mouse intent (desktop)
  document.addEventListener('mouseleave', onMouseLeave);
  // Mobile scroll-up (limit a páginas que valem)
  if(matchMedia('(max-width: 720px)').matches){
    window.addEventListener('scroll', onScrollMobile, { passive: true });
  }
}

// beforeunload em cadastro.html: aviso nativo se já preencheu campos
if(onCadastro){
  window.addEventListener('beforeunload', e => {
    const dadosForm = document.querySelector('#dadosForm');
    if(!dadosForm) return;
    const fd = new FormData(dadosForm);
    const algumPreenchido = ['nome','email','cpf','tel'].some(k => (fd.get(k) || '').toString().trim().length > 2);
    if(algumPreenchido && !userBlocked){
      e.preventDefault();
      e.returnValue = 'Sua família precisa de você. Tem certeza que deseja sair sem proteger?';
      return e.returnValue;
    }
  });
}

})();
