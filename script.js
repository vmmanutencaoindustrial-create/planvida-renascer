/* =========================================================
   PlanVida Renascer — Storytelling Cinematográfico
   COM ANIMAÇÕES EM TODA PARTE
========================================================= */

// =============================================
// 🌤️ INTRO CINEMATOGRÁFICA — descendo do céu
// =============================================
const intro = document.getElementById('intro');
const introSkip = document.getElementById('introSkip');
const INTRO_DURATION = 6500;  // 6.5s total

function endIntro() {
  if (!intro || intro.classList.contains('is-done')) return;
  intro.classList.add('is-finishing');
  setTimeout(() => {
    intro.classList.add('is-done');
    document.body.classList.remove('intro-active');
    setTimeout(() => intro.remove(), 1200);
  }, 600);
}

if (intro) {
  document.body.classList.add('intro-active');
  // Auto-finish após duração
  setTimeout(endIntro, INTRO_DURATION);
  // Skip
  introSkip?.addEventListener('click', endIntro);
  // ESC pula
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !intro.classList.contains('is-done')) endIntro();
  }, { once: true });
}

// ===== Lenis Smooth Scroll (pattern oficial Lenis + GSAP) =====
gsap.registerPlugin(ScrollTrigger);

const lenis = new Lenis({
  duration: 1.4,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  smoothTouch: false,
});

// Sincroniza Lenis com ScrollTrigger
lenis.on("scroll", ScrollTrigger.update);

// Usa o ticker do GSAP como rAF (NÃO usar requestAnimationFrame separado)
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (e) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (target) { e.preventDefault(); lenis.scrollTo(target, { offset: -80, duration: 1.5 }); }
  });
});

// ===== Navbar =====
ScrollTrigger.create({
  start: "top -80",
  end: 99999,
  toggleClass: { className: "is-scrolled", targets: "#nav" },
});

// =============================================
// ✨ PARTÍCULAS DOURADAS FLUTUANDO NO HERO
// =============================================
function createParticles() {
  const hero = document.querySelector('.screen-1');
  if (!hero) return;

  const particlesContainer = document.createElement('div');
  particlesContainer.className = 'hero-particles';
  hero.appendChild(particlesContainer);

  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 6 + 's';
    particle.style.animationDuration = (8 + Math.random() * 8) + 's';
    particle.style.opacity = (0.3 + Math.random() * 0.5);
    particle.style.width = particle.style.height = (2 + Math.random() * 4) + 'px';
    particlesContainer.appendChild(particle);
  }
}
createParticles();

// =============================================
// 🌅 TRANSIÇÃO HERO → CENA 2
// O céu "abre" e revela a família no jardim
// =============================================
const heroTransition = gsap.timeline({
  scrollTrigger: {
    trigger: ".screen-1",
    start: "top top",
    end: "bottom bottom",
    scrub: 1.4,
  }
});

heroTransition
  // Fase 1 (0-30%): Céu original ainda visível, hint some
  .to(".screen__hint", { opacity: 0, duration: 0.2 }, 0)

  // Fase 2 (20-60%): Texto do hero sobe e some + nuvens fecham/abrem mais
  .to(".screen-1 .screen__text", {
    y: -100,
    opacity: 0,
    scale: 0.9,
    duration: 0.4,
    ease: "power2.in"
  }, 0.2)

  // Fase 3 (30-70%): Logo PlanVida grande sobe e desaparece (você atravessa ela)
  .to(".hero-logo-bg", {
    scale: 2.5,
    opacity: 0,
    y: -200,
    duration: 0.5,
    ease: "power2.in"
  }, 0.3)

  // Fase 4 (40-80%): Céu se afasta (zoom in / atravessar)
  .to(".hero-sky img", {
    scale: 1.6,
    opacity: 0,
    duration: 0.5,
    ease: "power2.in"
  }, 0.4)

  // Fase 5 (50-90%): Raios e glow somem
  .to([".hero-rays", ".hero-glow"], {
    opacity: 0,
    scale: 1.5,
    duration: 0.4,
    ease: "power2.in"
  }, 0.5)

  // Fase 6 (60-100%): Veil dark fica mais escuro (transição)
  .to(".hero-veil-dark", {
    opacity: 0.85,
    duration: 0.4
  }, 0.5)

  // Fase 7 (50-100%): PRÉVIA da família emerge de baixo
  .to(".hero-next-preview", {
    opacity: 1,
    scale: 1,
    duration: 0.6,
    ease: "power2.out"
  }, 0.5)

  // Fase 8 (70-100%): Texto da transição aparece
  .to(".hero-transition-text", {
    opacity: 1,
    y: 0,
    duration: 0.4,
    ease: "power2.out"
  }, 0.7)

  // Fase 9 (80-100%): Veil escurece menos pra mostrar a família
  .to(".hero-next-veil", {
    opacity: 0.7,
    duration: 0.3
  }, 0.7);

// =============================================
// 🕊️ POMBA BRANCA — VOA PELA TELA TODA
// =============================================
const dove = document.getElementById('dove');

if (dove) {
  // Estado 0 — invisível, no centro do hero
  gsap.set(dove, {
    x: window.innerWidth * 0.50 - 120,
    y: window.innerHeight * 0.40,
    scale: 0.3,
    opacity: 0,
    rotation: 0,
    transformOrigin: "center center"
  });

  // ===== APARIÇÃO INICIAL — pomba sai do céu durante a transição =====
  gsap.timeline({
    scrollTrigger: {
      trigger: ".screen-1",
      start: "top top",
      end: "bottom bottom",
      scrub: 1.4
    }
  })
  // Fase 1: aparece centralizada
  .to(dove, {
    opacity: 1,
    scale: 1.2,
    duration: 0.3,
    ease: "power2.out"
  }, 0.15)
  // Fase 2: voa em curva pelo céu (descendo)
  .to(dove, {
    x: window.innerWidth * 0.10,
    y: window.innerHeight * 0.15,
    rotation: -10,
    scale: 1.0,
    duration: 0.4,
    ease: "none"
  }, 0.4)
  // Fase 3: atravessa pra direita já na cena 2
  .to(dove, {
    x: window.innerWidth * 0.65,
    y: window.innerHeight * 0.25,
    rotation: 10,
    scale: 0.9,
    duration: 0.4,
    ease: "none"
  }, 0.7);

  // ===== CENA 2 — voa em curva do alto pra direita =====
  gsap.timeline({
    scrollTrigger: {
      trigger: ".cine-2",
      start: "top bottom",
      end: "bottom top",
      scrub: 1.2
    }
  })
  .to(dove, {
    x: window.innerWidth * 0.45,
    y: window.innerHeight * 0.05,
    rotation: 0,
    scale: 1.15,
    ease: "none"
  })
  .to(dove, {
    x: window.innerWidth * 0.80,
    y: window.innerHeight * 0.18,
    rotation: 12,
    scale: 1.0,
    ease: "none"
  });

  // ===== CENA 3 — desce e atravessa pra esquerda =====
  gsap.timeline({
    scrollTrigger: {
      trigger: ".cine-3",
      start: "top bottom",
      end: "bottom top",
      scrub: 1.2
    }
  })
  .to(dove, {
    x: window.innerWidth * 0.55,
    y: window.innerHeight * 0.30,
    rotation: -8,
    scale: 1.1,
    ease: "none"
  })
  .to(dove, {
    x: window.innerWidth * 0.10,
    y: window.innerHeight * 0.45,
    rotation: -18,
    scale: 1.2,
    ease: "none"
  });

  // ===== CENA 4 — sobe alto, símbolo de esperança =====
  gsap.timeline({
    scrollTrigger: {
      trigger: ".cine-4",
      start: "top bottom",
      end: "bottom top",
      scrub: 1.2
    }
  })
  .to(dove, {
    x: window.innerWidth * 0.30,
    y: window.innerHeight * 0.20,
    rotation: 5,
    scale: 1.15,
    ease: "none"
  })
  .to(dove, {
    x: window.innerWidth * 0.70,
    y: -window.innerHeight * 0.05,
    rotation: 15,
    scale: 1.3,
    ease: "none"
  });

  // ===== SERVIÇOS — pousa no centro =====
  gsap.to(dove, {
    x: window.innerWidth * 0.50 - 120,
    y: -window.innerHeight * 0.20,
    rotation: 0,
    scale: 0.8,
    ease: "power2.inOut",
    scrollTrigger: {
      trigger: ".services",
      start: "top bottom",
      end: "top center",
      scrub: 1.5
    }
  });

  // ===== FINAL — ascende ao topo =====
  gsap.to(dove, {
    x: window.innerWidth * 0.50 - 120,
    y: -window.innerHeight * 0.45,
    rotation: 0,
    scale: 1.5,
    ease: "power2.inOut",
    scrollTrigger: {
      trigger: ".final",
      start: "top bottom",
      end: "top center",
      scrub: 1.5
    }
  });

  // ===== FOOTER — encolhe e some =====
  gsap.to(dove, {
    scale: 0.1,
    opacity: 0,
    rotation: 0,
    ease: "power2.in",
    scrollTrigger: {
      trigger: ".rodape",
      start: "top bottom",
      end: "top 70%",
      scrub: 1
    }
  });

  // Recalibra ao redimensionar
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => ScrollTrigger.refresh(), 200);
  });
}

// =============================================
// 🎬 KEN BURNS + MOVIMENTO DE CÂMERA NAS CENAS
// =============================================
gsap.utils.toArray('.cine').forEach((cine, i) => {
  const img = cine.querySelector('.cine__img');
  const text = cine.querySelector('.cine__text');
  const step = cine.querySelector('.cine__step');
  const heading = cine.querySelector('h2');
  const sub = cine.querySelector('.cine__sub');

  // KEN BURNS — câmera com zoom + pan dramático
  gsap.fromTo(img,
    {
      yPercent: -15,
      scale: 1.3,
    },
    {
      yPercent: 15,
      scale: 1.05,
      ease: "none",
      scrollTrigger: {
        trigger: cine,
        start: "top bottom",
        end: "bottom top",
        scrub: 0.8
      }
    }
  );

  // Texto reveal animado — entra dramático
  gsap.timeline({
    scrollTrigger: {
      trigger: cine,
      start: "top 60%",
      end: "center 30%",
      scrub: 1.5
    }
  })
  .fromTo(step,
    { opacity: 0, y: 40 },
    { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }
  )
  .fromTo(heading,
    { opacity: 0, y: 80, scale: 0.92 },
    { opacity: 1, y: 0, scale: 1, duration: 1.2, ease: "power3.out" },
    0.2
  )
  .fromTo(sub,
    { opacity: 0, y: 30 },
    { opacity: 1, y: 0, duration: 1, ease: "power3.out" },
    0.4
  );

  // Texto sai com fade quando passa
  gsap.to(text, {
    opacity: 0,
    y: -60,
    ease: "power2.in",
    scrollTrigger: {
      trigger: cine,
      start: "bottom 50%",
      end: "bottom top",
      scrub: 1.5
    }
  });
});

// =============================================
// SERVIÇOS — Cards com entrada dramática
// =============================================
gsap.from(".services__intro", {
  opacity: 0,
  y: 60,
  duration: 1.4,
  ease: "power3.out",
  scrollTrigger: { trigger: ".services", start: "top 75%" }
});

// Trigger UNIFICADO — anima todos os cards de uma vez quando a grid entra no viewport
// Usa fromTo (estados explícitos) pra evitar travamento em opacity 0
ScrollTrigger.create({
  trigger: ".services__grid",
  start: "top 85%",
  once: true,
  onEnter: () => {
    document.querySelectorAll('.serv').forEach(s => s.classList.add('is-revealed'));
    gsap.fromTo('.serv',
      { opacity: 0, y: 80, scale: 0.92 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 1.2,
        stagger: 0.18,
        ease: "back.out(1.2)",
        clearProps: "transform,opacity"   // garante volta ao estado natural
      }
    );
  }
});

// 3D tilt no hover dos cards
document.querySelectorAll('.serv').forEach((card) => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / 20 * -1;
    const rotateY = (x - centerX) / 20;
    gsap.to(card, {
      rotateX: rotateX,
      rotateY: rotateY,
      duration: 0.4,
      transformPerspective: 1000,
      ease: "power2.out"
    });
  });
  card.addEventListener('mouseleave', () => {
    gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.6, ease: "power2.out" });
  });
});

// =============================================
// FINAL — Reveal cinematográfico
// =============================================
gsap.from(".final h2", {
  opacity: 0,
  scale: 0.8,
  y: 60,
  duration: 1.8,
  ease: "back.out(1.4)",
  scrollTrigger: { trigger: ".final", start: "top 70%" }
});

gsap.from(".final__sub, .final__contact, .final__addr", {
  opacity: 0,
  y: 40,
  duration: 1.2,
  stagger: 0.2,
  ease: "power3.out",
  scrollTrigger: { trigger: ".final", start: "top 65%" }
});

gsap.from(".final .eyebrow", {
  opacity: 0,
  letterSpacing: "0.5em",
  duration: 1.2,
  ease: "power2.out",
  scrollTrigger: { trigger: ".final", start: "top 75%" }
});

// =============================================
// FOOTER reveal
// =============================================
gsap.from(".rodape__logo, .rodape__msg, .rodape__menu, .rodape__inner small", {
  opacity: 0,
  y: 30,
  duration: 1,
  stagger: 0.1,
  ease: "power2.out",
  scrollTrigger: { trigger: ".rodape", start: "top 85%" }
});

// =============================================
// 🎬 JOURNEY — Horizontal scroll com 4 painéis
// Scroll vertical → track desliza horizontalmente
// + Ken Burns nas imagens + indicadores ativos
// =============================================
const journeyEl = document.querySelector('.journey');
const journeyTrack = document.getElementById('journeyTrack');
if (journeyEl && journeyTrack) {
  const panels = document.querySelectorAll('.jpanel');
  const indicators = document.querySelectorAll('.jind');
  const totalPanels = panels.length;

  // Horizontal scroll principal
  const horizontalTl = gsap.to(journeyTrack, {
    x: () => `-${(totalPanels - 1) * 100}vw`,
    ease: "none",
    scrollTrigger: {
      trigger: ".journey",
      start: "top top",
      end: "bottom bottom",
      scrub: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        // Atualiza indicadores
        const idx = Math.min(Math.floor(self.progress * totalPanels), totalPanels - 1);
        indicators.forEach((ind, i) => {
          ind.classList.toggle('jind--active', i === idx);
        });
        // Esconde hint depois do primeiro painel
        const hint = document.querySelector('.journey__hint');
        if (hint) hint.style.opacity = self.progress < 0.05 ? '1' : '0';
      }
    }
  });

  // Ken Burns: cada imagem de fundo zooma suavemente
  panels.forEach((panel) => {
    const img = panel.querySelector('.jpanel__bg img');
    if (!img) return;
    gsap.fromTo(img,
      { scale: 1.0, x: 0 },
      {
        scale: 1.18,
        x: -40,
        ease: "none",
        scrollTrigger: {
          trigger: panel,
          containerAnimation: horizontalTl,
          start: "left right",
          end: "right left",
          scrub: 1
        }
      }
    );
  });

  // Reveal interno: texto entra com fade+slide quando o painel aparece
  panels.forEach((panel) => {
    const content = panel.querySelector('.jpanel__content');
    if (!content) return;
    gsap.from(content.children, {
      opacity: 0,
      y: 50,
      duration: 1,
      stagger: 0.15,
      ease: "power3.out",
      scrollTrigger: {
        trigger: panel,
        containerAnimation: horizontalTl,
        start: "left center",
        toggleActions: "play none none reverse"
      }
    });
  });

  // ===== PAINEL 3 — Sequência cinematográfica:
  // 1) começa TUDO escuro
  // 2) chama nasce (scale 0 → 1)
  // 3) halo cresce, ilumina o ambiente
  // 4) overlay escuro fade-out → imagem de fundo aparece
  // 5) texto entra em sequência
  const panel3 = document.querySelector('.jpanel--3');
  if (panel3) {
    const flame = panel3.querySelector('.jpanel__flame');
    const halo = panel3.querySelector('.jpanel__halo');
    const darkness = panel3.querySelector('.jpanel__darkness');
    const bg = panel3.querySelector('.jpanel__bg');
    const content = panel3.querySelector('.jpanel__content');

    // Estado inicial: chama escondida, halo escondido, escuro total
    gsap.set(flame, { opacity: 0, scale: 0, transformOrigin: "50% 100%" });
    gsap.set(halo, { opacity: 0, scale: 0 });
    gsap.set(darkness, { opacity: 1 });
    gsap.set(bg, { opacity: 0.18 });

    // Timeline com scrub que progride conforme você "passa pelo painel 3"
    gsap.timeline({
      scrollTrigger: {
        trigger: panel3,
        containerAnimation: horizontalTl,
        start: "left 80%",
        end: "right 60%",
        scrub: 1.2,
        invalidateOnRefresh: true,
      }
    })
    // Fase 1 (0-30%): chama nasce
    .to(flame, {
      opacity: 1,
      scale: 1,
      duration: 0.3,
      ease: "back.out(1.4)"
    }, 0)

    // Fase 2 (20-60%): halo cresce e ilumina
    .to(halo, {
      opacity: 1,
      scale: 1,
      duration: 0.4,
      ease: "power2.out"
    }, 0.2)

    // Fase 3 (40-80%): escuridão se dissolve, fundo aparece
    .to(darkness, {
      opacity: 0,
      duration: 0.4,
      ease: "power2.inOut"
    }, 0.4)
    .to(bg, {
      opacity: 1,
      duration: 0.4,
      ease: "power2.inOut"
    }, 0.4)

    // Fase 4 (60-100%): texto aparece
    .to(content.children, {
      opacity: 1,
      y: 0,
      duration: 0.3,
      stagger: 0.1,
      ease: "power3.out"
    }, 0.6);

    // Estado inicial dos textos
    gsap.set(content.children, { y: 40 });
  }
}

// =============================================
// ⚡ AWAKENING — Cada stat desliza do lado
// =============================================
gsap.from('.awakening__head > *', {
  opacity: 0,
  y: 40,
  duration: 1,
  stagger: 0.15,
  ease: "power3.out",
  scrollTrigger: { trigger: ".awakening", start: "top 75%" }
});

gsap.utils.toArray('.awak-stat').forEach((stat) => {
  const fromLeft = stat.classList.contains('awak-stat--from-left');
  const num = stat.querySelector('strong[data-counter]');

  // Card desliza do lado + revela imagem
  gsap.from(stat, {
    opacity: 0,
    x: fromLeft ? -120 : 120,
    duration: 1.4,
    ease: "power3.out",
    scrollTrigger: {
      trigger: stat,
      start: "top 80%",
      once: true,
      onEnter: () => stat.classList.add('is-revealed')
    }
  });

  // Número anima COM GLITCH EFFECT (embaralha antes de chegar)
  if (num) {
    const target = parseInt(num.dataset.counter, 10);
    const isCurrency = num.dataset.counterFormat === 'currency';
    ScrollTrigger.create({
      trigger: stat,
      start: "top 75%",
      once: true,
      onEnter: () => {
        // FASE 1 (0-0.6s): GLITCH — números aleatórios
        const glitchDuration = 600;
        const glitchInterval = 60;
        const glitchSteps = glitchDuration / glitchInterval;
        let step = 0;
        const glitchTimer = setInterval(() => {
          step++;
          const fakeVal = Math.floor(Math.random() * target * 1.4);
          if (isCurrency || target >= 1000) {
            num.textContent = fakeVal.toLocaleString('pt-BR');
          } else {
            num.textContent = fakeVal;
          }
          // Adiciona class CSS pra "tremer"
          num.classList.add('is-glitching');
          if (step >= glitchSteps) {
            clearInterval(glitchTimer);
            num.classList.remove('is-glitching');
            // FASE 2 (0.6-2.4s): Anima suavemente até o target
            const obj = { val: 0 };
            gsap.to(obj, {
              val: target,
              duration: 1.8,
              ease: "power3.out",
              onUpdate: () => {
                const v = Math.round(obj.val);
                if (isCurrency || target >= 1000) {
                  num.textContent = v.toLocaleString('pt-BR');
                } else {
                  num.textContent = v;
                }
              },
              onComplete: () => {
                num.classList.add('is-locked');
              }
            });
          }
        }, glitchInterval);
      }
    });
  }
});

gsap.from('.awakening__foot > *', {
  opacity: 0,
  y: 30,
  duration: 1,
  stagger: 0.15,
  ease: "power3.out",
  scrollTrigger: { trigger: ".awakening__foot", start: "top 85%" }
});

// =============================================
// 🎯 QUIZ — Lógica do quiz interativo
// =============================================
const quizState = {
  step: 1,
  answers: {},
};

const quizSteps = document.querySelectorAll('.quiz__step');
const progressBar = document.getElementById('quizProgress');

function updateProgress() {
  if (!progressBar) return;
  const totalSteps = 4; // 3 perguntas + resultado
  const pct = (quizState.step / totalSteps) * 100;
  progressBar.style.width = pct + '%';
}

function goToStep(step) {
  quizSteps.forEach(s => s.classList.remove('is-active'));
  const target = document.querySelector(`.quiz__step[data-step="${step}"]`);
  if (target) {
    target.classList.add('is-active');
    quizState.step = step === 'result' ? 4 : parseInt(step);
    updateProgress();
  }
}

function generateDiagnosis() {
  const a = quizState.answers;
  const titleEl = document.getElementById('diagnosisTitle');
  const textEl = document.getElementById('diagnosisText');
  const planEl = document.getElementById('recPlan');
  const descEl = document.getElementById('recDesc');

  let title = '';
  let text = '';
  let plan = '';
  let desc = '';

  // Análise simples baseada nas respostas
  const isSolo = a.q1 === 'solo';
  const isCouple = a.q1 === 'couple';
  const isFamily = a.q1 === 'family' || a.q1 === 'extended';
  const notReady = a.q2 === 'never' || a.q2 === 'avoid' || a.q2 === 'partial';
  const lowFunds = a.q3 === 'lt5' || a.q3 === '5to15';

  if (notReady && lowFunds) {
    title = 'Sua família está vulnerável.';
    text = 'Pelas suas respostas, sua família teria que tomar 32 decisões em 24 horas, com pouco dinheiro disponível e sem saber o que você gostaria. <em>Existe um caminho mais sereno.</em>';
  } else if (notReady && !lowFunds) {
    title = 'Sua família tem recurso, mas não tem direção.';
    text = 'Vocês teriam o dinheiro, mas no momento da dor, ninguém sabe o que você gostaria. <em>Um plano não é só dinheiro — é o cuidado de já ter conversado.</em>';
  } else if (a.q2 === 'ready' && a.q3 === 'ready') {
    title = 'Você está bem preparado(a).';
    text = 'Parabéns. Você já cuidou de algo que poucas famílias cuidam. <em>Vamos garantir que está tudo atualizado e na PlanVida.</em>';
  } else {
    title = 'Você está no caminho — falta só formalizar.';
    text = 'Você já pensou no assunto, mas ainda não tem proteção formal. <em>O passo final é o mais importante.</em>';
  }

  // Recomendação de plano
  if (isSolo) {
    plan = 'Plano Individual — a partir de R$ 170/mês';
    desc = 'Cobertura completa para você. Sem complicação. Sem peso pra ninguém da família.';
  } else if (isCouple) {
    plan = 'Plano Casal — a partir de R$ 230/mês';
    desc = 'Você e seu(sua) parceiro(a) protegidos. O que um sente, o outro não precisa carregar sozinho.';
  } else if (a.q1 === 'extended') {
    plan = 'Plano Família Plus — a partir de R$ 390/mês';
    desc = 'Cobre até 6 dependentes incluindo pais e sogros. Tradição de 28 anos cuidando de gerações.';
  } else {
    plan = 'Plano Familiar — a partir de R$ 290/mês';
    desc = 'Cobre cônjuge e filhos. Para que os pais possam cuidar do que mais importa: estar junto.';
  }

  if (titleEl) titleEl.innerHTML = title;
  if (textEl) textEl.innerHTML = text;
  if (planEl) planEl.textContent = plan;
  if (descEl) descEl.textContent = desc;
}

// Mensagens empáticas por resposta
const empathicResponses = {
  q1: {
    solo: "Cuidar de si é um ato de amor. Continuemos.",
    couple: "Vocês cuidam um do outro. Bonito.",
    family: "Família é tudo. Vamos proteger eles.",
    extended: "Cuidar de várias gerações é um presente. Continuemos."
  },
  q2: {
    ready: "Que coragem ter essa conversa! Continuemos.",
    partial: "Conversar sobre isso é difícil. Vamos te ajudar.",
    never: "É natural evitar. Mas o cuidado começa agora.",
    avoid: "Entendemos. Mas vamos fazer juntos."
  },
  q3: {
    lt5: "É exatamente pra isso que o plano existe.",
    "5to15": "Ainda assim, não é hora de improvisar.",
    "15to30": "Você se preparou. Vamos otimizar isso.",
    ready: "Você já cuida. Vamos garantir que está atualizado."
  }
};

function showEmpathicResponse(step, value) {
  const message = empathicResponses['q' + step]?.[value];
  if (!message) return Promise.resolve();

  const stepEl = document.querySelector(`.quiz__step[data-step="${step}"]`);
  let bubble = document.createElement('div');
  bubble.className = 'quiz__empathic';
  bubble.textContent = message;
  stepEl.appendChild(bubble);

  return new Promise(resolve => {
    requestAnimationFrame(() => bubble.classList.add('is-visible'));
    setTimeout(() => {
      bubble.classList.remove('is-visible');
      setTimeout(() => {
        bubble.remove();
        resolve();
      }, 400);
    }, 1200);
  });
}

document.querySelectorAll('.quiz__opt').forEach(btn => {
  btn.addEventListener('click', async () => {
    const stepEl = btn.closest('.quiz__step');
    const step = stepEl.dataset.step;
    const value = btn.dataset.value;

    // Marca visual
    stepEl.querySelectorAll('.quiz__opt').forEach(b => b.classList.remove('is-selected'));
    btn.classList.add('is-selected');

    // Salva resposta
    quizState.answers['q' + step] = value;

    // Mostra mensagem empática
    await showEmpathicResponse(step, value);

    // Avança
    const next = parseInt(step) + 1;
    if (next <= 3) {
      goToStep(next);
    } else {
      generateDiagnosis();
      goToStep('result');
    }
  });
});

// Submit do quiz
function enviarQuiz() {
  const nome = document.getElementById('quizNome').value.trim();
  const tel = document.getElementById('quizTel').value.trim();
  if (!nome || !tel) return;

  const a = quizState.answers;
  const recPlan = document.getElementById('recPlan')?.textContent || '';

  const msg = `Olá, sou ${nome}. Fiz o quiz no site e quero a proposta.\n\n` +
    `📋 Minhas respostas:\n` +
    `• Quem depende: ${a.q1 || '—'}\n` +
    `• Família sabe: ${a.q2 || '—'}\n` +
    `• Recursos em 24h: ${a.q3 || '—'}\n\n` +
    `💡 Recomendação: ${recPlan}\n\n` +
    `📞 WhatsApp: ${tel}`;

  const url = `https://wa.me/5582999903607?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

document.getElementById('quizCaptureForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  enviarQuiz();
});

// Reveal do quiz
gsap.from('.quiz__title, .quiz__sub, .quiz__progress', {
  opacity: 0,
  y: 40,
  duration: 1.2,
  stagger: 0.15,
  ease: "power3.out",
  scrollTrigger: { trigger: ".quiz", start: "top 75%" }
});

// =============================================
// 💰 CALCULADORA — Contagem dos números
// =============================================
gsap.utils.toArray('[data-counter-currency]').forEach(el => {
  const target = parseInt(el.dataset.counterCurrency, 10);
  ScrollTrigger.create({
    trigger: el,
    start: "top 85%",
    once: true,
    onEnter: () => {
      const obj = { val: 0 };
      gsap.to(obj, {
        val: target,
        duration: 2.2,
        ease: "power2.out",
        onUpdate: () => {
          const v = Math.round(obj.val);
          el.textContent = 'R$ ' + v.toLocaleString('pt-BR');
        }
      });
    }
  });
});

// Contador da economia + EXPLOSÃO DE PARTÍCULAS DOURADAS
const econNum = document.querySelector('.calc__economy-num[data-counter]');
const econBox = document.querySelector('.calc__economy');
if (econNum && econBox) {
  const target = parseInt(econNum.dataset.counter, 10);

  // Cria container de partículas
  const particles = document.createElement('div');
  particles.className = 'calc__particles';
  econBox.appendChild(particles);

  ScrollTrigger.create({
    trigger: econNum,
    start: "top 85%",
    once: true,
    onEnter: () => {
      // GLITCH antes de chegar no valor final
      let step = 0;
      const glitchTimer = setInterval(() => {
        step++;
        const fake = Math.floor(Math.random() * target * 1.4);
        econNum.textContent = 'R$ ' + fake.toLocaleString('pt-BR');
        econNum.classList.add('is-glitching');
        if (step >= 10) {
          clearInterval(glitchTimer);
          econNum.classList.remove('is-glitching');
          // Animação suave
          const obj = { val: 0 };
          gsap.to(obj, {
            val: target,
            duration: 2.2,
            ease: "power3.out",
            onUpdate: () => {
              econNum.textContent = 'R$ ' + Math.round(obj.val).toLocaleString('pt-BR');
            },
            onComplete: () => {
              econNum.classList.add('is-locked');
              // EXPLOSÃO DE PARTÍCULAS DOURADAS
              for (let i = 0; i < 40; i++) {
                const p = document.createElement('span');
                p.className = 'calc__particle';
                const angle = (Math.PI * 2 * i) / 40;
                const distance = 200 + Math.random() * 250;
                const tx = Math.cos(angle) * distance;
                const ty = Math.sin(angle) * distance - 80;
                const size = 4 + Math.random() * 8;
                p.style.cssText = `
                  --tx: ${tx}px;
                  --ty: ${ty}px;
                  width: ${size}px;
                  height: ${size}px;
                  animation-delay: ${Math.random() * 0.2}s;
                `;
                particles.appendChild(p);
                setTimeout(() => p.remove(), 2400);
              }
            }
          });
        }
      }, 60);
    }
  });
}

// Reveal das colunas da calculadora — vêm DOS LADOS opostos
gsap.utils.toArray('.calc__col').forEach((col, i) => {
  const isLeft = col.classList.contains('calc__col--bad');
  gsap.from(col, {
    opacity: 0,
    x: isLeft ? -120 : 120,
    scale: 0.94,
    duration: 1.4,
    ease: "power3.out",
    scrollTrigger: {
      trigger: ".calc__grid",
      start: "top 80%",
      once: true
    }
  });
});

// Items dentro da lista da calc também aparecem em sequência
gsap.utils.toArray('.calc__list li').forEach((li, i) => {
  gsap.from(li, {
    opacity: 0,
    x: li.closest('.calc__col--bad') ? -20 : 20,
    duration: 0.6,
    delay: 0.4 + (i % 7) * 0.08,
    ease: "power2.out",
    scrollTrigger: {
      trigger: ".calc__grid",
      start: "top 75%",
      once: true
    }
  });
});

gsap.from('.calc__title, .calc__sub', {
  opacity: 0,
  y: 40,
  duration: 1.2,
  stagger: 0.15,
  ease: "power3.out",
  scrollTrigger: { trigger: ".calc", start: "top 75%" }
});

gsap.from('.calc__economy', {
  opacity: 0,
  y: 80,
  scale: 0.94,
  duration: 1.4,
  ease: "back.out(1.2)",
  scrollTrigger: { trigger: ".calc__economy", start: "top 80%", once: true }
});

// =============================================
// 🕯️ MEMORIAL — Vela acendendo
// =============================================
const candleWrap = document.getElementById('candleWrap');
const candleCount = document.getElementById('candleCount');
const memorialForm = document.getElementById('memorialForm');
const memorialDedicated = document.getElementById('memorialDedicated');

if (candleWrap) {
  candleWrap.addEventListener('click', () => {
    if (candleWrap.classList.contains('is-lit')) return;
    candleWrap.classList.add('is-lit');

    // Som sutil de fósforo (simulado com vibração / som via web audio se disponível)
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'triangle';
      o.frequency.setValueAtTime(400, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + .25);
      g.gain.setValueAtTime(0.05, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + .35);
      o.start(); o.stop(ctx.currentTime + .35);
    } catch(e) { /* silent */ }

    // Incrementa contador
    if (candleCount) {
      let current = parseInt(candleCount.textContent.replace(/\./g, ''), 10) || 0;
      const obj = { val: current };
      gsap.to(obj, {
        val: current + 1,
        duration: .8,
        ease: "power2.out",
        onUpdate: () => {
          candleCount.textContent = Math.floor(obj.val).toLocaleString('pt-BR');
        }
      });
    }

    // Mostra form de dedicar
    setTimeout(() => {
      if (memorialForm) {
        memorialForm.hidden = false;
        gsap.from(memorialForm, { opacity: 0, y: 20, duration: .8, ease: "power3.out" });
      }
    }, 1200);
  });
}

function dedicarVela() {
  const nameInput = document.getElementById('memName');
  const dedicatedNameEl = document.getElementById('dedicatedName');
  if (!nameInput || !nameInput.value.trim()) return;

  if (dedicatedNameEl) dedicatedNameEl.textContent = nameInput.value.trim();
  if (memorialForm) memorialForm.hidden = true;
  if (memorialDedicated) memorialDedicated.hidden = false;
}

document.getElementById('btnDedicar')?.addEventListener('click', dedicarVela);

// Follow-up: compartilhar memorial via WhatsApp
document.getElementById('memShareWa')?.addEventListener('click', () => {
  const name = document.getElementById('dedicatedName')?.textContent || 'alguém especial';
  const msg = `Acendi uma vela em memória de ${name} no Memorial PlanVida Renascer 🕯️\n\nUm gesto de amor e lembrança: https://vmmanutencaoindustrial-create.github.io/planvida-renascer/#memorial`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
});

// Follow-up: lembrança anual
document.getElementById('memReminder')?.addEventListener('click', () => {
  const name = document.getElementById('dedicatedName')?.textContent || 'esta pessoa';
  alert(`📅 Lembrete agendado!\n\nVamos te lembrar de acender uma vela por ${name} nesta data, todos os anos.\n\n(Em breve enviaremos pelo WhatsApp na data.)`);
});
document.getElementById('memName')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    dedicarVela();
  }
});

// Reveal do memorial
gsap.from('.memorial__title, .memorial__sub, .candle-wrap, .memorial__count', {
  opacity: 0,
  y: 40,
  duration: 1.2,
  stagger: 0.18,
  ease: "power3.out",
  scrollTrigger: { trigger: ".memorial", start: "top 75%" }
});

// =============================================
// ✨ PROVA SOCIAL — Contadores grandes
// =============================================
gsap.utils.toArray('.proof-item').forEach((item, i) => {
  const num = item.querySelector('strong[data-counter]');
  if (!num) return;
  const target = parseInt(num.dataset.counter, 10);

  gsap.from(item, {
    opacity: 0,
    y: 40,
    duration: 1.2,
    delay: i * 0.12,
    ease: "power3.out",
    scrollTrigger: { trigger: ".proof-grid", start: "top 80%", once: true }
  });

  ScrollTrigger.create({
    trigger: item,
    start: "top 85%",
    once: true,
    onEnter: () => {
      const obj = { val: 0 };
      gsap.to(obj, {
        val: target,
        duration: 2.4,
        ease: "power2.out",
        onUpdate: () => {
          const v = Math.round(obj.val);
          num.textContent = v.toLocaleString('pt-BR');
        }
      });
    }
  });
});

gsap.from('.social-proof__title, .trust-mark', {
  opacity: 0,
  y: 40,
  duration: 1.2,
  stagger: 0.15,
  ease: "power3.out",
  scrollTrigger: { trigger: ".social-proof", start: "top 75%" }
});

// =============================================
// 💬 DEPOIMENTOS — Reveal em zigzag dos lados
// =============================================
gsap.utils.toArray('.testi__card').forEach((card, i) => {
  const directions = [-100, 0, 100]; // esquerda, cima, direita
  const fromX = directions[i % 3];
  const fromY = i % 3 === 1 ? 80 : 0;

  gsap.from(card, {
    opacity: 0,
    x: fromX,
    y: fromY,
    scale: 0.94,
    duration: 1.3,
    delay: i * 0.15,
    ease: "power3.out",
    scrollTrigger: { trigger: ".testi__grid", start: "top 82%", once: true }
  });
});

gsap.from('.testi__title', {
  opacity: 0,
  y: 40,
  duration: 1.2,
  ease: "power3.out",
  scrollTrigger: { trigger: ".testi", start: "top 75%" }
});

// =============================================
// 📩 LEAD MAGNET — Popup
// =============================================
const leadMagnet = document.getElementById('leadMagnet');
let leadMagnetShown = false;

function abrirLeadMagnet() {
  if (leadMagnetShown || !leadMagnet) return;
  leadMagnetShown = true;
  leadMagnet.classList.add('is-open');
  leadMagnet.setAttribute('aria-hidden', 'false');
}

function fecharLeadMagnet() {
  if (!leadMagnet) return;
  leadMagnet.classList.remove('is-open');
  leadMagnet.setAttribute('aria-hidden', 'true');
}

function enviarLeadMagnet() {
  const nome = document.getElementById('lmNome').value.trim();
  const email = document.getElementById('lmEmail').value.trim();
  if (!nome || !email) return;

  const msg = `Olá! Sou ${nome} (${email}). Quero receber o modelo "Carta para Quem Eu Amo".`;
  const url = `https://wa.me/5582999903607?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
  fecharLeadMagnet();
}

document.querySelectorAll('[data-close-magnet]').forEach(el => {
  el.addEventListener('click', fecharLeadMagnet);
});

document.getElementById('leadMagnetForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  enviarLeadMagnet();
});

// Trigger inteligente — só abre se: (scroll >75%) E (tempo >40s) E (não está em form/quiz)
let scrollTriggered = false;
const startTime = Date.now();

function isUserInteracting() {
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return true;
  // Não abrir durante quiz, calc, memorial form
  const inForm = document.querySelector('.quiz__capture:focus-within, .memorial__sharer:focus-within');
  if (inForm) return true;
  return false;
}

function checkLeadMagnet() {
  if (scrollTriggered || leadMagnetShown) return;
  if (isUserInteracting()) return;
  const scrolled = (window.scrollY + window.innerHeight) / document.body.scrollHeight;
  const elapsed = (Date.now() - startTime) / 1000;
  // Só abre se scroll alto E tempo razoável
  if (scrolled >= 0.75 && elapsed >= 40) {
    scrollTriggered = true;
    setTimeout(abrirLeadMagnet, 1200);
  }
}
window.addEventListener('scroll', checkLeadMagnet, { passive: true });
// Check periódico de tempo
setInterval(checkLeadMagnet, 5000);

// Fallback: abre depois de 90s se ainda não abriu
setTimeout(() => {
  if (!leadMagnetShown && !scrollTriggered && !isUserInteracting()) {
    abrirLeadMagnet();
  }
}, 90000);

// =============================================
// 📈 LIVE COUNTER — famílias atendidas
// Incrementa a cada poucos segundos pra dar sensação real-time
// =============================================
const liveFamilies = document.getElementById('liveFamilies');
const lastTimeEl = document.getElementById('lastTime');
const reviewCount = document.getElementById('reviewCount');
let liveCount = 60847;
let lastMinutes = 12;

if (liveFamilies) {
  // Anima counter inicial quando entra no viewport
  ScrollTrigger.create({
    trigger: '.final__live',
    start: 'top 90%',
    once: true,
    onEnter: () => {
      const obj = { val: 60000 };
      gsap.to(obj, {
        val: liveCount,
        duration: 2.5,
        ease: 'power2.out',
        onUpdate: () => {
          liveFamilies.textContent = Math.round(obj.val).toLocaleString('pt-BR');
        }
      });
    }
  });

  // A cada 8-25 segundos, incrementa
  function incrementLive(){
    liveCount += 1;
    liveFamilies.textContent = liveCount.toLocaleString('pt-BR');
    lastMinutes = Math.floor(Math.random() * 30) + 1;
    if (lastTimeEl) lastTimeEl.textContent = `${lastMinutes} minuto${lastMinutes>1?'s':''}`;
    // Pisca o número quando incrementa
    liveFamilies.classList.add('is-flashing');
    setTimeout(() => liveFamilies.classList.remove('is-flashing'), 600);
    setTimeout(incrementLive, 8000 + Math.random() * 17000);
  }
  setTimeout(incrementLive, 12000);
}

// Review count na seção testimonials (animação)
if (reviewCount) {
  ScrollTrigger.create({
    trigger: '.testi__google',
    start: 'top 85%',
    once: true,
    onEnter: () => {
      const obj = { val: 0 };
      gsap.to(obj, {
        val: 8742,
        duration: 2,
        ease: 'power2.out',
        onUpdate: () => {
          reviewCount.textContent = Math.round(obj.val).toLocaleString('pt-BR');
        }
      });
    }
  });
}

// Click nos vídeos de depoimento — feedback "vídeo em breve"
document.querySelectorAll('.testi__play').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const card = btn.closest('.testi__card--video');
    const name = card?.querySelector('.testi__author strong')?.textContent || 'Cliente';
    const overlay = document.createElement('div');
    overlay.className = 'video-modal';
    overlay.innerHTML = `
      <div class="video-modal__inner">
        <button class="video-modal__close" aria-label="Fechar">×</button>
        <div class="video-modal__placeholder">
          <div class="video-modal__icon">🎬</div>
          <h3>Depoimento de ${name}</h3>
          <p>Os vídeos completos estarão disponíveis em breve.</p>
          <p class="video-modal__sub">Por enquanto, leia o depoimento completo abaixo do card.</p>
          <button class="video-modal__btn">Entendi</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    const close = () => {
      overlay.classList.remove('is-open');
      setTimeout(() => overlay.remove(), 400);
    };
    overlay.querySelector('.video-modal__close').addEventListener('click', close);
    overlay.querySelector('.video-modal__btn').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  });
});

// =============================================
// ⏰ TIMER DE URGÊNCIA — Calc
// =============================================
const calcTimer = document.getElementById('calcTimer');
if (calcTimer) {
  // Termina daqui a 2 dias, 14h, 37min (relativo ao primeiro load)
  const end = Date.now() + (2 * 24 * 60 * 60 * 1000) + (14 * 60 * 60 * 1000) + (37 * 60 * 1000);
  const elDays = document.getElementById('calcDays');
  const elHours = document.getElementById('calcHours');
  const elMins = document.getElementById('calcMins');
  const elSecs = document.getElementById('calcSecs');

  const updateTimer = () => {
    const now = Date.now();
    const diff = Math.max(0, end - now);
    const days = Math.floor(diff / (24*60*60*1000));
    const hours = Math.floor((diff % (24*60*60*1000)) / (60*60*1000));
    const mins = Math.floor((diff % (60*60*1000)) / (60*1000));
    const secs = Math.floor((diff % (60*1000)) / 1000);
    elDays.textContent = String(days).padStart(2, '0');
    elHours.textContent = String(hours).padStart(2, '0');
    elMins.textContent = String(mins).padStart(2, '0');
    elSecs.textContent = String(secs).padStart(2, '0');
  };
  updateTimer();
  setInterval(updateTimer, 1000);
}

// =============================================
// 📊 BARRA DE PROGRESSO DE SCROLL
// =============================================
const scrollBar = document.getElementById('scrollProgressBar');
if (scrollBar) {
  const updateScrollBar = () => {
    const max = document.body.scrollHeight - window.innerHeight;
    const pct = (window.scrollY / max) * 100;
    scrollBar.style.width = Math.min(100, Math.max(0, pct)) + '%';
  };
  window.addEventListener('scroll', updateScrollBar, { passive: true });
  updateScrollBar();
}

// =============================================
// ❓ FAQ — accordion com fechamento automático
// =============================================
document.querySelectorAll('.faq__item').forEach(item => {
  item.addEventListener('toggle', (e) => {
    if (item.open) {
      // Fecha os outros (single open accordion)
      document.querySelectorAll('.faq__item[open]').forEach(other => {
        if (other !== item) other.open = false;
      });
    }
  });
});

// Reveal FAQ quando entra no viewport
gsap.from('.faq__head > *', {
  opacity: 0,
  y: 30,
  duration: 1,
  stagger: 0.12,
  ease: "power3.out",
  scrollTrigger: { trigger: ".faq", start: "top 80%" }
});
gsap.from('.faq__item', {
  opacity: 0,
  y: 20,
  duration: 0.8,
  stagger: 0.06,
  ease: "power2.out",
  scrollTrigger: { trigger: ".faq__list", start: "top 80%" }
});

// Fechar com ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && leadMagnet?.classList.contains('is-open')) {
    fecharLeadMagnet();
  }
});

window.addEventListener("load", () => ScrollTrigger.refresh());

console.log(
  "%cPlanVida Renascer %c· Cuidando de cada detalhe com respeito",
  "font-family:Cormorant Garamond,serif;font-size:18px;color:#FFE600;background:#3D45B8;padding:6px 14px;",
  "color:#3D45B8;font-size:13px;margin-left:8px;"
);
