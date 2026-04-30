// =========================================================
// Rotas públicas de planos
//   GET /api/plans       -> lista todos os ativos
//   GET /api/plans/:slug -> detalhe de 1 plano
// =========================================================
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncH } from '../middleware/error.js';

const router = Router();

function toPublic(p){
  return {
    id:          p.id,
    slug:        p.slug,
    nome:        p.nome,
    descricao:   p.descricao,
    precoMensal: Number(p.precoMensal),
    beneficios:  p.beneficios,
    destaque:    p.destaque,
    ordem:       p.ordem,
  };
}

router.get('/', asyncH(async (req, res) => {
  const plans = await prisma.plan.findMany({
    where: { ativo: true },
    orderBy: { ordem: 'asc' },
  });
  res.json({ plans: plans.map(toPublic) });
}));

router.get('/:slug', asyncH(async (req, res) => {
  const plan = await prisma.plan.findUnique({ where: { slug: req.params.slug } });
  if(!plan || !plan.ativo){
    return res.status(404).json({ error: 'not_found', message: 'Plano não encontrado.' });
  }
  res.json({ plan: toPublic(plan) });
}));

export default router;
