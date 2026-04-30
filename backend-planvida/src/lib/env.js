// =========================================================
// Validação de variáveis de ambiente — falha fast no startup
// se algo crítico estiver mal configurado em produção.
// =========================================================

const REQUIRED_PROD = [
  'DATABASE_URL',
  'JWT_SECRET',
  'BACKEND_URL',
  'FRONTEND_URL',
  'MP_ACCESS_TOKEN',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
];

const isProd = process.env.NODE_ENV === 'production';

function fatal(msg){
  console.error(`\n❌ [config] ${msg}\n`);
  process.exit(1);
}

function warn(msg){
  console.warn(`⚠️  [config] ${msg}`);
}

export function validateEnv(){
  const missing = [];

  if(isProd){
    for(const key of REQUIRED_PROD){
      if(!process.env[key] || process.env[key].trim() === ''){
        missing.push(key);
      }
    }
    if(missing.length){
      fatal(`As seguintes variáveis são OBRIGATÓRIAS em produção: ${missing.join(', ')}`);
    }

    // JWT_SECRET fraco
    if(process.env.JWT_SECRET === 'change_me' ||
       (process.env.JWT_SECRET || '').length < 32){
      fatal('JWT_SECRET inseguro. Gere com: openssl rand -base64 48');
    }

    // ADMIN_PASSWORD fraco
    if((process.env.ADMIN_PASSWORD || '').length < 12){
      fatal('ADMIN_PASSWORD muito curto. Mínimo 12 caracteres em produção.');
    }

    // BACKEND_URL precisa ser HTTPS em prod
    if(!/^https:\/\//i.test(process.env.BACKEND_URL || '')){
      fatal('BACKEND_URL precisa ser HTTPS em produção.');
    }
    if(!/^https:\/\//i.test(process.env.FRONTEND_URL || '')){
      fatal('FRONTEND_URL precisa ser HTTPS em produção.');
    }

    // MP_ACCESS_TOKEN não pode ser TEST em produção
    if((process.env.MP_ACCESS_TOKEN || '').startsWith('TEST-')){
      fatal('MP_ACCESS_TOKEN está em modo TEST/sandbox em produção. Use credenciais APP_USR-.');
    }
  } else {
    // Dev: avisa se faltar alguma coisa, mas não mata
    for(const key of REQUIRED_PROD){
      if(!process.env[key]){
        warn(`${key} não configurado (dev) — algumas features podem não funcionar.`);
      }
    }
  }
}
