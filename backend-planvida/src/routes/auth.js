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
import { validaCPF, onlyDigitsCPF } from '../lib/cpf.js';

const router = Router();

// -----------------------------------------------------
// Schemas (com validação de CPF pelo algoritmo)
// -----------------------------------------------------
const cpfField = z.string()
  .min(11, 'CPF inválido')
  .max(14, 'CPF inválido')
  .refine(v => validaCPF(v), 'CPF inválido (dígitos verificadores não conferem)');

const registerSchema = z.object({
  nome:     z.string().trim().min(3, 'Nome muito curto').max(120),
  email:    z.string().trim().email('Email inválido').toLowerCase(),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres').max(72),
  cpf:      cpfField,
  telefone: z.string().trim().min(10, 'Telefone inválido').max(20),
  dataNasc: z.string().trim().optional(),
  endereco: z.string().trim().optional(),
  cidade:   z.string().trim().optional(),
  cep:      z.string().trim().optional(),
});

const loginSchema = z.object({
  email:    z.string().trim().email('Email inválido').toLowerCase(),
  password: z.string().min(1, 'Senha obrigatória'),
});

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------
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

// Anti-timing: garante delay mínimo em respostas de erro de auth
async function constantDelay(ms = 350){
  return new Promise(r => setTimeout(r, ms));
}

// -----------------------------------------------------
// POST /api/auth/register
// Anti-enumeração: erro genérico em conflito (não diz se é email/CPF)
// -----------------------------------------------------
router.post('/register', asyncH(async (req, res) => {
  const data = registerSchema.parse(req.body);
  const cpfClean = onlyDigitsCPF(data.cpf);

  const exists = await prisma.user.findFirst({
    where: { OR: [{ email: data.email }, { cpf: cpfClean }] },
    select: { id: true },
  });
  if(exists){
    await constantDelay();
    return res.status(409).json({
      error: 'conflict',
      message: 'Não foi possível criar a conta. Verifique os dados ou tente fazer login.',
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
// Anti-timing: hash dummy + delay constante mesmo se usuário não existe
// -----------------------------------------------------
const DUMMY_HASH = '$2a$10$abcdefghijklmnopqrstuuJzU5N1k5O0Wm1qj1jL5K0s8/3kkk7lPa';

router.post('/login', asyncH(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });

  // Sempre roda bcrypt.compare (mesmo com dummy) pra evitar timing oracle
  const targetHash = user?.password || DUMMY_HASH;
  const ok = await bcrypt.compare(password, targetHash);

  if(!user || !ok){
    await constantDelay();
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
