// =========================================================
// Rotas de autenticação
//   POST /api/auth/register  -> cria usuário (sem assinatura)
//   POST /api/auth/login     -> retorna JWT
//   GET  /api/auth/me        -> dados do usuário logado
// =========================================================
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncH } from '../middleware/error.js';

const router = Router();

// -----------------------------------------------------
// Schemas de validação
// -----------------------------------------------------
const registerSchema = z.object({
  nome:     z.string().min(3, 'Nome muito curto').max(120),
  email:    z.string().email('Email inválido').toLowerCase(),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres').max(72),
  cpf:      z.string().min(11, 'CPF inválido').max(14),
  telefone: z.string().min(10, 'Telefone inválido').max(20),
  dataNasc: z.string().optional(),
  endereco: z.string().optional(),
  cidade:   z.string().optional(),
  cep:      z.string().optional(),
});

const loginSchema = z.object({
  email:    z.string().email('Email inválido').toLowerCase(),
  password: z.string().min(1, 'Senha obrigatória'),
});

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------
const onlyDigits = (s = '') => String(s).replace(/\D/g, '');

function publicUser(u){
  if(!u) return null;
  return {
    id:       u.id,
    nome:     u.nome,
    email:    u.email,
    cpf:      u.cpf,
    telefone: u.telefone,
    dataNasc: u.dataNasc,
    endereco: u.endereco,
    cidade:   u.cidade,
    cep:      u.cep,
    createdAt: u.createdAt,
  };
}

// -----------------------------------------------------
// POST /api/auth/register
// -----------------------------------------------------
router.post('/register', asyncH(async (req, res) => {
  const data = registerSchema.parse(req.body);
  const cpfClean = onlyDigits(data.cpf);

  // Conflitos
  const exists = await prisma.user.findFirst({
    where: { OR: [{ email: data.email }, { cpf: cpfClean }] },
  });
  if(exists){
    const conflict = exists.email === data.email ? 'email' : 'cpf';
    return res.status(409).json({
      error: 'conflict',
      message: `${conflict === 'email' ? 'Email' : 'CPF'} já cadastrado.`,
      conflict,
    });
  }

  const hash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
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

  const token = signToken({ sub: user.id, email: user.email });
  res.status(201).json({ token, user: publicUser(user) });
}));

// -----------------------------------------------------
// POST /api/auth/login
// -----------------------------------------------------
router.post('/login', asyncH(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if(!user){
    return res.status(401).json({ error: 'invalid_credentials', message: 'Email ou senha inválidos.' });
  }

  const ok = await bcrypt.compare(password, user.password);
  if(!ok){
    return res.status(401).json({ error: 'invalid_credentials', message: 'Email ou senha inválidos.' });
  }

  const token = signToken({ sub: user.id, email: user.email });
  res.json({ token, user: publicUser(user) });
}));

// -----------------------------------------------------
// GET /api/auth/me
// -----------------------------------------------------
router.get('/me', requireAuth, asyncH(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: {
      subscriptions: {
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if(!user) return res.status(404).json({ error: 'not_found', message: 'Usuário não encontrado.' });

  res.json({
    user: publicUser(user),
    subscriptions: user.subscriptions.map(s => ({
      id: s.id,
      status: s.status,
      startDate: s.startDate,
      nextDueDate: s.nextDueDate,
      plan: {
        id: s.plan.id,
        slug: s.plan.slug,
        nome: s.plan.nome,
        precoMensal: Number(s.plan.precoMensal),
        beneficios: s.plan.beneficios,
      },
    })),
  });
}));

export default router;
