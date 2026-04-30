// =========================================================
// JWT — sign / verify
// Em PRODUÇÃO falha fast se SECRET estiver inseguro (validateEnv).
// =========================================================
import jwt from 'jsonwebtoken';

const SECRET     = process.env.JWT_SECRET || 'change_me_dev_only';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const isProd     = process.env.NODE_ENV === 'production';

if(isProd && (SECRET === 'change_me_dev_only' || SECRET.length < 32)){
  // Em prod, env.js já valida — esse é fallback de defesa em camadas
  console.error('[JWT] FATAL: JWT_SECRET inseguro em produção.');
  process.exit(1);
}
if(!isProd && SECRET === 'change_me_dev_only'){
  console.warn('[JWT] Dev: usando secret default. Configure JWT_SECRET no .env.');
}

export function signToken(payload){
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token){
  return jwt.verify(token, SECRET);
}
