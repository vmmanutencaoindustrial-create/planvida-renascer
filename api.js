// =========================================================
// PlanVida — Camada de chamadas HTTP ao backend
// - Prefixo da API + JWT no header
// - Parsing de erro padronizado
// - Tratamento global de 401 (limpa token + dispara evento)
// - Timeout de fetch (8s) com AbortController
// - Sanitização de inputs antes de stringify
// =========================================================
window.PlanvidaAPI = (function(){
  const cfg = window.PLANVIDA_CONFIG || { API_URL: '', TOKEN_KEY: 'planvida_token', USER_KEY: 'planvida_user' };

  const TIMEOUT_MS = 12000;

  function getToken(){ return localStorage.getItem(cfg.TOKEN_KEY); }
  function setToken(t){ localStorage.setItem(cfg.TOKEN_KEY, t); }
  function clearToken(){
    localStorage.removeItem(cfg.TOKEN_KEY);
    localStorage.removeItem(cfg.USER_KEY);
    // Dispara evento global pra UIs reagirem (logout forçado)
    window.dispatchEvent(new CustomEvent('planvida:logout'));
  }

  function setUser(u){ localStorage.setItem(cfg.USER_KEY, JSON.stringify(u || {})); }
  function getUser(){ try{ return JSON.parse(localStorage.getItem(cfg.USER_KEY) || 'null'); }catch{ return null; } }

  async function request(path, { method = 'GET', body, auth = false, signal } = {}){
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if(auth){
      const t = getToken();
      if(t) headers['Authorization'] = `Bearer ${t}`;
    }

    // Timeout via AbortController
    const ctrl = new AbortController();
    const tm   = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const sig  = signal ? mergeSignals(signal, ctrl.signal) : ctrl.signal;

    let res;
    try{
      res = await fetch(`${cfg.API_URL}${path}`, {
        method,
        headers,
        body:   body ? JSON.stringify(body) : undefined,
        signal: sig,
      });
    }catch(networkErr){
      clearTimeout(tm);
      const e = new Error(
        networkErr.name === 'AbortError'
          ? 'Tempo limite excedido. Verifique sua conexão.'
          : 'Sem conexão com o servidor. Verifique sua internet.'
      );
      e.network = true;
      throw e;
    }
    clearTimeout(tm);

    let data = null;
    const txt = await res.text();
    if(txt){
      try{ data = JSON.parse(txt); }catch{ data = { raw: txt }; }
    }

    if(!res.ok){
      // 401 = token inválido/expirado → força logout limpando estado
      if(res.status === 401 && auth){
        clearToken();
      }
      const err = new Error((data && data.message) || `Erro ${res.status}`);
      err.status = res.status;
      err.code   = data?.error;
      err.data   = data;
      throw err;
    }
    return data;
  }

  function mergeSignals(a, b){
    if(typeof AbortSignal !== 'undefined' && AbortSignal.any) return AbortSignal.any([a, b]);
    // Fallback: cria controller que aborta quando qualquer um abortar
    const c = new AbortController();
    const onAbort = () => c.abort();
    a.addEventListener('abort', onAbort);
    b.addEventListener('abort', onAbort);
    return c.signal;
  }

  return {
    cfg,
    getToken, setToken, clearToken,
    getUser, setUser,
    isLogged: () => !!getToken(),

    // Plans
    listarPlanos: () => request('/api/plans'),
    getPlano: slug => request(`/api/plans/${encodeURIComponent(slug)}`),

    // Auth
    register: payload => request('/api/auth/register', { method: 'POST', body: payload }),
    login:    payload => request('/api/auth/login',    { method: 'POST', body: payload }),
    me:       ()      => request('/api/auth/me',       { auth: true }),

    // Subscribe
    subscribe: payload => request('/api/subscribe', { method: 'POST', body: payload }),
    minhaAssinatura: () => request('/api/subscriptions/me', { auth: true }),

    // Payments
    meusPagamentos: () => request('/api/payments', { auth: true }),
    getPagamento: id  => request(`/api/payments/${encodeURIComponent(id)}`, { auth: true }),

    // Dashboard
    dashboard: () => request('/api/dashboard', { auth: true }),

    saveAuth(token, user){
      setToken(token);
      if(user) setUser(user);
    },

    // Hash leve compartilhado (apenas demo localStorage; produção usa bcrypt no backend)
    async hashLeve(senha){
      if(!senha) return '';
      if(!window.crypto?.subtle) return 'plain:' + senha;
      const enc = new TextEncoder();
      const data = enc.encode('planvida-demo-salt-v1:' + senha);
      const buf  = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    },
  };
})();
