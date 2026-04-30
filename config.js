// =========================================================
// Configuração global do frontend PlanVida
// Carregue ANTES de cadastro.js / portal.js
//
// API_URL = endereço do backend Node.
//   - dev local:    http://localhost:3000
//   - produção:     https://planvida-api.onrender.com (troque após deploy)
//
// Auto-detecta se você está rodando local. Se for outro domínio
// (github.io, custom domain), usa a URL de produção abaixo.
// =========================================================
window.PLANVIDA_CONFIG = (function(){
  const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(location.hostname);

  return {
    // Troque essa URL APÓS subir no Render:
    API_URL: isLocal
      ? 'http://localhost:3000'
      : 'https://planvida-api.onrender.com',

    // Storage keys
    TOKEN_KEY: 'planvida_token',
    USER_KEY:  'planvida_user',

    // Modo demo (sem backend disponível): mantém o mock antigo.
    // Setado automaticamente se a API der erro nas chamadas iniciais.
    DEMO_MODE: false,
  };
})();
