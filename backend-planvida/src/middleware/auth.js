import { verifyToken } from '../lib/jwt.js';

/**
 * Middleware: exige Authorization: Bearer <token> válido.
 * Coloca req.userId, req.userEmail.
 */
export function requireAuth(req, res, next){
  const header = req.headers.authorization || req.headers.Authorization;
  if(!header || !header.startsWith('Bearer ')){
    return res.status(401).json({ error: 'token_missing', message: 'Token de autenticação ausente.' });
  }
  const token = header.slice(7).trim();
  try{
    const payload = verifyToken(token);
    req.userId    = payload.sub;
    req.userEmail = payload.email;
    next();
  }catch(err){
    return res.status(401).json({ error: 'token_invalid', message: 'Token inválido ou expirado.' });
  }
}
