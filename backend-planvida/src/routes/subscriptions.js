// =========================================================
// Cadastro + Contratação em UMA chamada
//
// POST /api/subscribe
//   Body: { nome, email, password, cpf, telefone, dataNasc, endereco, cidade, cep, planSlug }
//   - Cria o User (se não existir) ou loga o existente
//   - Cria a Subscription com status PENDING
//   - Cria a Payment com status PENDING
//   - Cria a Preference no Mercado Pago
//   - Retorna: { token, paymentUrl, paymentId, subscriptionId }
//
// GET /api/subscriptions/me   (auth)
//   Última assinatura do usuário logado
// =========================================================
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { criarPreferenciaPagamento } from '../lib/mercadopago.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncH } from '../middleware/error.js';
import { validaCPF, onlyDigitsCPF } from '../lib/cpf.js';
import { log } from '../lib/logger.js';

const router = Router();

const subscribeSchema = z.object({
  nome:     z.string().trim().min(3).max(120),
  email:    z.string().trim().email().toLowerCase(),
  password: z.string().min(6).max(72),
  cpf:      z.string().min(11).max(14).refine(v => validaCPF(v), 'CPF inválido (DVs)'),
  telefone: z.string().trim().min(10).max(20),
  dataNasc: z.string().trim().optional(),
  endereco: z.string().trim().optional(),
  cidade:   z.string().trim().optional(),
  cep:      z.string().trim().optional(),
  planSlug: z.enum(['individual', 'familiar', 'plus']),
});

router.post('/subscribe', asyncH(async (req, res) => {
  const data = subscribeSchema.parse(req.body);
  const cpfClean = onlyDigitsCPF(data.cpf);

  // 1. Plano existe?
  const plan = await prisma.plan.findUnique({ where: { slug: data.planSlug } });
  if(!plan || !plan.ativo){
    return res.status(404).json({ error: 'plan_not_found', message: 'Plano não encontrado ou inativo.' });
  }

  // 2. User: cria ou reusa
  let user = await prisma.user.findFirst({
    where: { OR: [{ email: data.email }, { cpf: cpfClean }] },
  });

  if(user){
    // Já existe — exige senha correta pra evitar sequestro de conta.
    // Erro genérico (anti-enumeração).
    const ok = await bcrypt.compare(data.password, user.password);
    if(!ok){
      await new Promise(r => setTimeout(r, 350));
      return res.status(409).json({
        error: 'account_exists',
        message: 'Já existe conta com esses dados. Faça login para contratar um novo plano.',
      });
    }
    // Atualiza dados que possam ter vindo novos
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        nome: data.nome,
        telefone: data.telefone,
        dataNasc: data.dataNasc ?? user.dataNasc,
        endereco: data.endereco ?? user.endereco,
        cidade:   data.cidade   ?? user.cidade,
        cep:      data.cep      ?? user.cep,
      },
    });
  }else{
    const hash = await bcrypt.hash(data.password, 10);
    user = await prisma.user.create({
      data: {
        nome: data.nome,
        email: data.email,
        password: hash,
        cpf: cpfClean,
        telefone: data.telefone,
        dataNasc: data.dataNasc,
        endereco: data.endereco,
        cidade:   data.cidade,
        cep:      data.cep,
      },
    });
  }

  // 3. Cria Subscription PENDING
  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      planId: plan.id,
      status: 'PENDING',
    },
  });

  // 4. Cria Payment PENDING (placeholder — atualizado após criar preference)
  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      subscriptionId: subscription.id,
      amount: plan.precoMensal,
      status: 'PENDING',
      method: 'PIX',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // 5. Cria Preference no Mercado Pago
  let preference;
  try{
    preference = await criarPreferenciaPagamento({
      userId: user.id,
      subscriptionId: subscription.id,
      paymentId: payment.id,
      planNome: plan.nome,
      amount: Number(plan.precoMensal),
      payer: { name: user.nome, email: user.email, cpf: user.cpf },
      backendUrl: process.env.BACKEND_URL,
      frontendUrl: process.env.FRONTEND_URL,
    });
  }catch(err){
    log.error('subscribe_mp_preference_failed', {
      userId: user.id, subscriptionId: subscription.id, paymentId: payment.id,
      err: err?.message,
    });
    // Marca pagamento como rejeitado pra não ficar lixo
    await prisma.payment.update({
      where: { id: payment.id },
      data:  { status: 'REJECTED' },
    }).catch(() => {});
    return res.status(502).json({
      error: 'mp_error',
      message: 'Não foi possível gerar o link de pagamento. Tente novamente em instantes.',
    });
  }
  if(!preference?.init_point){
    log.error('subscribe_mp_no_init_point', { paymentId: payment.id, preference });
    return res.status(502).json({ error: 'mp_error', message: 'Resposta inválida do gateway de pagamento.' });
  }

  // 6. Atualiza payment com dados do MP
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      mpPreferenceId: preference.id,
      mpInitPoint:    preference.init_point,
      mpPayload:      preference,
    },
  });

  // 7. Token JWT pra logar o cara automaticamente após pagar
  const token = signToken({ sub: user.id, email: user.email });

  res.status(201).json({
    token,
    user: {
      id: user.id, nome: user.nome, email: user.email, cpf: user.cpf, telefone: user.telefone,
    },
    subscription: {
      id: subscription.id,
      status: subscription.status,
      plan: { slug: plan.slug, nome: plan.nome, precoMensal: Number(plan.precoMensal) },
    },
    payment: {
      id: payment.id,
      status: payment.status,
      amount: Number(payment.amount),
      method: payment.method,
    },
    paymentUrl:        preference.init_point,
    paymentUrlSandbox: preference.sandbox_init_point,
    preferenceId:      preference.id,
  });
}));

// -----------------------------------------------------
// GET /api/subscriptions/me — última assinatura do logado
// -----------------------------------------------------
router.get('/subscriptions/me', requireAuth, asyncH(async (req, res) => {
  const sub = await prisma.subscription.findFirst({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    include: { plan: true },
  });
  if(!sub) return res.json({ subscription: null });

  res.json({
    subscription: {
      id: sub.id,
      status: sub.status,
      startDate: sub.startDate,
      nextDueDate: sub.nextDueDate,
      canceledAt: sub.canceledAt,
      plan: {
        id: sub.plan.id,
        slug: sub.plan.slug,
        nome: sub.plan.nome,
        precoMensal: Number(sub.plan.precoMensal),
        beneficios: sub.plan.beneficios,
      },
    },
  });
}));

export default router;
