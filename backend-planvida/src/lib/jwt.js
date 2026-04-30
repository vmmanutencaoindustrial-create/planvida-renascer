import jwt from 'jsonwebtoken';

const SECRET     = process.env.JWT_SECRET || 'change_me';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if(SECRET === 'change_me') {
  console.warn('[JWT] JWT_SECRET não configurado — usando default inseguro. NÃO use em produção.');
}

export function signToken(payload){
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token){
  return jwt.verify(token, SECRET);
}
