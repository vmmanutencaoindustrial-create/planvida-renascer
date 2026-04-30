// =========================================================
// GET /api/dashboard  (auth)
// Resumo completo pro portal do cliente:
//  - dados do user
//  - assinatura ativa
//  - próximo pagamento (mais recente PENDING ou último APPROVED)
//  - histórico (últimos 12)
// =========================================================
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncH } from '../middleware/error.js';

const router = Router();

router.get('/', requireAuth, asyncH(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: {
      subscriptions: {
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 12,
      },
    },
  });
  if(!user) return res.status(404).json({ error: 'not_found' });

  const subscription = user.subscriptions.find(s => s.status === 'ACTIVE')
                    || user.subscriptions[0]
                    || null;

  const proximoPagamento =
    user.payments.find(p => p.status === 'PENDING' || p.status === 'IN_PROCESS') ||
    user.payments.find(p => p.status === 'APPROVED') ||
    null;

  res.json({
    user: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      cpf: user.cpf,
      telefone: user.telefone,
      cidade: user.cidade,
      cadastradoEm: user.createdAt,
    },
    subscription: subscription && {
      id: subscription.id,
      status: subscription.status,
      startDate: subscription.startDate,
      nextDueDate: subscription.nextDueDate,
      plan: {
        id:   subscription.plan.id,
        slug: subscription.plan.slug,
        nome: subscription.plan.nome,
        precoMensal: Number(subscription.plan.precoMensal),
        beneficios:  subscription.plan.beneficios,
      },
    },
    proximoPagamento: proximoPagamento && {
      id:        proximoPagamento.id,
      status:    proximoPagamento.status,
      method:    proximoPagamento.method,
      amount:    Number(proximoPagamento.amount),
      paidAt:    proximoPagamento.paidAt,
      createdAt: proximoPagamento.createdAt,
      mpInitPoint:    proximoPagamento.mpInitPoint,
      mpQrCode:       proximoPagamento.mpQrCode,
      mpQrCodeBase64: proximoPagamento.mpQrCodeBase64,
    },
    historicoPagamentos: user.payments.map(p => ({
      id: p.id,
      status: p.status,
      method: p.method,
      amount: Number(p.amount),
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    })),
  });
}));

export default router;
