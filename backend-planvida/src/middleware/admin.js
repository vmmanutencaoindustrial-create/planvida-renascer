// =========================================================
// requireAdmin — valida JWT com claim role: 'admin'
// =========================================================
import { verifyToken } from '../lib/jwt.js';

export function requireAdmin(req, res, next){
  const header = req.headers.authorization || req.headers.Authorization;
  if(!header || !header.startsWith('Bearer ')){
    return res.status(401).json({ error: 'token_missing', message: 'Acesso restrito.' });
  }
  const token = header.slice(7).trim();
  try{
    const payload = verifyToken(token);
    if(payload.role !== 'admin'){
      return res.status(403).json({ error: 'forbidden', message: 'Não autorizado.' });
    }
    req.adminId    = payload.sub;
    req.adminEmail = payload.email;
    next();
  }catch(err){
    return res.status(401).json({ error: 'token_invalid', message: 'Sessão expirada. Faça login novamente.' });
  }
}
