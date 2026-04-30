// =========================================================
// Rotas Admin — login + KPIs + listagens + export CSV
//
//   POST /api/admin/login           ← email + senha (env)
//   GET  /api/admin/stats           ← KPIs do dashboard
//   GET  /api/admin/clientes        ← lista users (filtros: q, plano, status, page, perPage)
//   GET  /api/admin/clientes/:id    ← detalhe + assinatura + pagamentos
//   GET  /api/admin/pagamentos      ← lista pagamentos (filtros)
//   GET  /api/admin/assinaturas     ← lista assinaturas
//   PATCH /api/admin/assinaturas/:id/cancelar
//   GET  /api/admin/export/clientes.csv
//   GET  /api/admin/export/pagamentos.csv
// =========================================================
import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { requireAdmin } from '../middleware/admin.js';
import { asyncH } from '../middleware/error.js';

const router = Router();

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@planvida.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

if(!ADMIN_PASSWORD){
  console.warn('[admin] ADMIN_PASSWORD não configurado — login admin desabilitado.');
}

// -----------------------------------------------------
// POST /api/admin/login
// -----------------------------------------------------
const loginSchema = z.object({
  email:    z.string().email().toLowerCase(),
  password: z.string().min(1),
});

router.post('/login', asyncH(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  if(!ADMIN_PASSWORD){
    return res.status(503).json({ error: 'admin_disabled', message: 'Login admin não configurado no servidor.' });
  }

  // Comparação em tempo constante — anti timing-attack
  const emailOk = timingSafeEqualStr(email, ADMIN_EMAIL.toLowerCase());
  const passOk  = timingSafeEqualStr(password, ADMIN_PASSWORD);
  const ok      = emailOk && passOk;

  if(!ok){
    await new Promise(r => setTimeout(r, 600));
    return res.status(401).json({ error: 'invalid_credentials', message: 'Email ou senha inválidos.' });
  }

  const token = signToken({ sub: 'admin', email, role: 'admin' });
  res.json({ token, admin: { email, role: 'admin' } });
}));

// -----------------------------------------------------
// GET /api/admin/me — valida token + retorna dados admin
// -----------------------------------------------------
router.get('/me', requireAdmin, asyncH(async (req, res) => {
  res.json({ admin: { email: req.adminEmail, role: 'admin' } });
}));

// Comparação string em tempo constante (string -> Buffer)
function timingSafeEqualStr(a, b){
  const A = Buffer.from(String(a || ''), 'utf8');
  const B = Buffer.from(String(b || ''), 'utf8');
  if(A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

// -----------------------------------------------------
// GET /api/admin/stats — KPIs
// -----------------------------------------------------
router.get('/stats', requireAdmin, asyncH(async (req, res) => {
  const [
    totalClientes,
    clientesUltimos30d,
    assinaturasAtivas,
    assinaturasPendentes,
    assinaturasCanceladas,
    pagamentosAprovados,
    pagamentosPendentes,
    receitaMesAtual,
    receitaTotal,
    porPlano,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: daysAgo(30) } } }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: 'PENDING' } }),
    prisma.subscription.count({ where: { status: 'CANCELED' } }),
    prisma.payment.count({ where: { status: 'APPROVED' } }),
    prisma.payment.count({ where: { status: 'PENDING' } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'APPROVED', paidAt: { gte: startOfMonth() } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'APPROVED' },
    }),
    prisma.subscription.groupBy({
      by: ['planId'],
      where: { status: 'ACTIVE' },
      _count: true,
    }),
  ]);

  // Resolve nomes dos planos para o porPlano
  const planIds = porPlano.map(p => p.planId);
  const planos  = planIds.length ? await prisma.plan.findMany({ where: { id: { in: planIds } } }) : [];
  const porPlanoNomes = porPlano.map(p => {
    const plano = planos.find(x => x.id === p.planId);
    return {
      planSlug: plano?.slug,
      planNome: plano?.nome,
      total:    p._count,
    };
  });

  res.json({
    totalClientes,
    clientesUltimos30d,
    assinaturas: {
      ativas:      assinaturasAtivas,
      pendentes:   assinaturasPendentes,
      canceladas:  assinaturasCanceladas,
    },
    pagamentos: {
      aprovados: pagamentosAprovados,
      pendentes: pagamentosPendentes,
    },
    receita: {
      mesAtual: Number(receitaMesAtual._sum.amount || 0),
      total:    Number(receitaTotal._sum.amount    || 0),
    },
    porPlano: porPlanoNomes,
  });
}));

// -----------------------------------------------------
// GET /api/admin/clientes — lista paginada com filtros
// -----------------------------------------------------
router.get('/clientes', requireAdmin, asyncH(async (req, res) => {
  const q       = (req.query.q || '').toString().trim();
  const plano   = (req.query.plano || '').toString().trim();
  const status  = (req.query.status || '').toString().trim();
  const page    = Math.max(1, parseInt(req.query.page || '1', 10));
  const perPage = Math.min(100, Math.max(10, parseInt(req.query.perPage || '20', 10)));

  const where = {};
  if(q){
    where.OR = [
      { nome:     { contains: q, mode: 'insensitive' } },
      { email:    { contains: q, mode: 'insensitive' } },
      { cpf:      { contains: q.replace(/\D/g,'') } },
      { telefone: { contains: q } },
    ];
  }
  if(plano || status){
    where.subscriptions = {
      some: {
        ...(plano  ? { plan: { slug: plano } } : {}),
        ...(status ? { status }                 : {}),
      },
    };
  }

  const [total, clientes] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
      },
    }),
  ]);

  res.json({
    page,
    perPage,
    total,
    totalPages: Math.ceil(total / perPage),
    clientes: clientes.map(u => {
      const sub = u.subscriptions[0];
      return {
        id:        u.id,
        nome:      u.nome,
        email:     u.email,
        cpf:       u.cpf,
        telefone:  u.telefone,
        cidade:    u.cidade,
        createdAt: u.createdAt,
        plano:     sub?.plan ? { slug: sub.plan.slug, nome: sub.plan.nome, precoMensal: Number(sub.plan.precoMensal) } : null,
        statusAssinatura: sub?.status || 'SEM_PLANO',
        proximoVencimento: sub?.nextDueDate || null,
      };
    }),
  });
}));

// -----------------------------------------------------
// GET /api/admin/clientes/:id — detalhe completo
// -----------------------------------------------------
router.get('/clientes/:id', requireAdmin, asyncH(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' } },
      payments:      { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
  if(!user) return res.status(404).json({ error: 'not_found', message: 'Cliente não encontrado.' });

  res.json({
    cliente: {
      id: user.id, nome: user.nome, email: user.email, cpf: user.cpf,
      telefone: user.telefone, dataNasc: user.dataNasc, endereco: user.endereco,
      cidade: user.cidade, cep: user.cep, createdAt: user.createdAt,
    },
    assinaturas: user.subscriptions.map(s => ({
      id: s.id, status: s.status, startDate: s.startDate, nextDueDate: s.nextDueDate,
      canceledAt: s.canceledAt, createdAt: s.createdAt,
      plan: { slug: s.plan.slug, nome: s.plan.nome, precoMensal: Number(s.plan.precoMensal) },
    })),
    pagamentos: user.payments.map(p => ({
      id: p.id, status: p.status, method: p.method, amount: Number(p.amount),
      paidAt: p.paidAt, createdAt: p.createdAt, mpPaymentId: p.mpPaymentId, mpInitPoint: p.mpInitPoint,
    })),
  });
}));

// -----------------------------------------------------
// GET /api/admin/pagamentos — lista paginada
// -----------------------------------------------------
router.get('/pagamentos', requireAdmin, asyncH(async (req, res) => {
  const status  = (req.query.status || '').toString().trim();
  const method  = (req.query.method || '').toString().trim();
  const q       = (req.query.q || '').toString().trim();
  const page    = Math.max(1, parseInt(req.query.page || '1', 10));
  const perPage = Math.min(100, Math.max(10, parseInt(req.query.perPage || '30', 10)));

  const where = {};
  if(status) where.status = status;
  if(method) where.method = method;
  if(q){
    where.user = {
      OR: [
        { nome:  { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { cpf:   { contains: q.replace(/\D/g,'') } },
      ],
    };
  }

  const [total, pagamentos] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        user: { select: { id: true, nome: true, email: true, cpf: true } },
        subscription: { include: { plan: { select: { slug: true, nome: true } } } },
      },
    }),
  ]);

  res.json({
    page, perPage, total, totalPages: Math.ceil(total / perPage),
    pagamentos: pagamentos.map(p => ({
      id: p.id, status: p.status, method: p.method, amount: Number(p.amount),
      paidAt: p.paidAt, createdAt: p.createdAt,
      mpPaymentId: p.mpPaymentId, mpInitPoint: p.mpInitPoint,
      cliente: p.user,
      plano: p.subscription?.plan || null,
    })),
  });
}));

// -----------------------------------------------------
// GET /api/admin/assinaturas — lista
// -----------------------------------------------------
router.get('/assinaturas', requireAdmin, asyncH(async (req, res) => {
  const status  = (req.query.status || '').toString().trim();
  const page    = Math.max(1, parseInt(req.query.page || '1', 10));
  const perPage = Math.min(100, Math.max(10, parseInt(req.query.perPage || '30', 10)));

  const where = {};
  if(status) where.status = status;

  const [total, assinaturas] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        user: { select: { id: true, nome: true, email: true, cpf: true } },
        plan: { select: { slug: true, nome: true, precoMensal: true } },
      },
    }),
  ]);

  res.json({
    page, perPage, total, totalPages: Math.ceil(total / perPage),
    assinaturas: assinaturas.map(s => ({
      id: s.id, status: s.status, startDate: s.startDate, nextDueDate: s.nextDueDate,
      canceledAt: s.canceledAt, createdAt: s.createdAt,
      cliente: s.user,
      plan:    s.plan && { slug: s.plan.slug, nome: s.plan.nome, precoMensal: Number(s.plan.precoMensal) },
    })),
  });
}));

// -----------------------------------------------------
// PATCH /api/admin/assinaturas/:id/cancelar
// -----------------------------------------------------
router.patch('/assinaturas/:id/cancelar', requireAdmin, asyncH(async (req, res) => {
  const sub = await prisma.subscription.update({
    where: { id: req.params.id },
    data:  { status: 'CANCELED', canceledAt: new Date() },
  });
  res.json({ assinatura: sub });
}));

// -----------------------------------------------------
// GET /api/admin/export/clientes.csv
// -----------------------------------------------------
router.get('/export/clientes.csv', requireAdmin, asyncH(async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { plan: true } } },
  });
  const rows = [
    ['id','nome','email','cpf','telefone','cidade','plano','status','criadoEm'],
    ...users.map(u => {
      const s = u.subscriptions[0];
      return [
        u.id, u.nome, u.email, u.cpf, u.telefone, u.cidade || '',
        s?.plan?.nome || '', s?.status || '',
        u.createdAt.toISOString(),
      ];
    }),
  ];
  const csv = rows.map(r => r.map(toCSV).join(';')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="planvida_clientes_${todayTag()}.csv"`);
  res.send('﻿' + csv);
}));

// -----------------------------------------------------
// GET /api/admin/export/pagamentos.csv
// -----------------------------------------------------
router.get('/export/pagamentos.csv', requireAdmin, asyncH(async (req, res) => {
  const pagamentos = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: true, subscription: { include: { plan: true } } },
  });
  const rows = [
    ['id','cliente','cpf','plano','metodo','valor','status','pagoEm','criadoEm','mpPaymentId'],
    ...pagamentos.map(p => [
      p.id,
      p.user?.nome || '',
      p.user?.cpf  || '',
      p.subscription?.plan?.nome || '',
      p.method,
      Number(p.amount).toFixed(2),
      p.status,
      p.paidAt ? p.paidAt.toISOString() : '',
      p.createdAt.toISOString(),
      p.mpPaymentId || '',
    ]),
  ];
  const csv = rows.map(r => r.map(toCSV).join(';')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="planvida_pagamentos_${todayTag()}.csv"`);
  res.send('﻿' + csv);
}));

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------
function daysAgo(n){ const d = new Date(); d.setDate(d.getDate() - n); return d; }
function startOfMonth(){ const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; }
function todayTag(){ return new Date().toISOString().slice(0,10); }
function toCSV(v){
  if(v === null || v === undefined) return '';
  const s = String(v).replace(/"/g, '""');
  return /[;\n"]/.test(s) ? `"${s}"` : s;
}

export default router;
