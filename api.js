// =========================================================
// PlanVida — Camada de chamadas HTTP ao backend
// Cuida de: prefixo da API, JWT no header, parsing de erro,
//           e fallback de DEMO_MODE quando a API está fora.
// =========================================================
window.PlanvidaAPI = (function(){
  const cfg = window.PLANVIDA_CONFIG || { API_URL: '', TOKEN_KEY: 'planvida_token', USER_KEY: 'planvida_user' };

  function getToken(){ return localStorage.getItem(cfg.TOKEN_KEY); }
  function setToken(t){ localStorage.setItem(cfg.TOKEN_KEY, t); }
  function clearToken(){ localStorage.removeItem(cfg.TOKEN_KEY); localStorage.removeItem(cfg.USER_KEY); }

  function setUser(u){ localStorage.setItem(cfg.USER_KEY, JSON.stringify(u || {})); }
  function getUser(){ try{ return JSON.parse(localStorage.getItem(cfg.USER_KEY) || 'null'); }catch{ return null; } }

  async function request(path, { method = 'GET', body, auth = false, signal } = {}){
    const headers = { 'Content-Type': 'application/json' };
    if(auth){
      const t = getToken();
      if(t) headers['Authorization'] = `Bearer ${t}`;
    }

    let res;
    try{
      res = await fetch(`${cfg.API_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });
    }catch(networkErr){
      const e = new Error('Sem conexão com o servidor. Verifique sua internet ou tente novamente.');
      e.network = true;
      throw e;
    }

    let data = null;
    const txt = await res.text();
    if(txt){
      try{ data = JSON.parse(txt); }catch{ data = { raw: txt }; }
    }

    if(!res.ok){
      const err = new Error((data && data.message) || `Erro ${res.status}`);
      err.status = res.status;
      err.code   = data?.error;
      err.data   = data;
      throw err;
    }
    return data;
  }

  // --------- Endpoints ---------
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

    // Subscribe (cadastro + plano + pagamento numa chamada só)
    subscribe: payload => request('/api/subscribe', { method: 'POST', body: payload }),
    minhaAssinatura: () => request('/api/subscriptions/me', { auth: true }),

    // Payments
    meusPagamentos: () => request('/api/payments', { auth: true }),
    getPagamento: id  => request(`/api/payments/${encodeURIComponent(id)}`, { auth: true }),

    // Dashboard
    dashboard: () => request('/api/dashboard', { auth: true }),

    // Helpers
    saveAuth(token, user){
      setToken(token);
      if(user) setUser(user);
    },
  };
})();
