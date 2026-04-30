import { ZodError } from 'zod';

/**
 * Middleware central de erros — mapeia ZodError, Prisma e demais.
 */
export function errorHandler(err, req, res, next){
  if(res.headersSent) return next(err);

  // Validação Zod
  if(err instanceof ZodError){
    return res.status(400).json({
      error: 'validation_error',
      message: 'Dados inválidos.',
      issues: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  // Prisma — unique constraint
  if(err?.code === 'P2002'){
    const target = (err.meta?.target || []).join(', ');
    return res.status(409).json({
      error: 'conflict',
      message: `Já existe um registro com esse(s) campo(s): ${target}`,
      target,
    });
  }

  // Prisma — record not found
  if(err?.code === 'P2025'){
    return res.status(404).json({ error: 'not_found', message: 'Registro não encontrado.' });
  }

  console.error('[error]', err);
  res.status(err.status || 500).json({
    error: err.code || 'internal_error',
    message: err.publicMessage || 'Erro interno. Tente novamente.',
  });
}

/**
 * Atalho para rotas async — encaminha erros pro errorHandler.
 */
export const asyncH = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
