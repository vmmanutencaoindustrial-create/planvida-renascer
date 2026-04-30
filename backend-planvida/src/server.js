// =========================================================
// PlanVida Renascer — API
//   Node 20 + Express + Prisma + Mercado Pago + JWT
// =========================================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { validateEnv } from './lib/env.js';
import { log }        from './lib/logger.js';
import { prisma }     from './lib/prisma.js';

import authRoutes         from './routes/auth.js';
import plansRoutes        from './routes/plans.js';
import subscriptionRoutes from './routes/subscriptions.js';
import paymentsRoutes     from './routes/payments.js';
import dashboardRoutes    from './routes/dashboard.js';
import adminRoutes        from './routes/admin.js';
import { errorHandler }   from './middleware/error.js';

// === Valida env vars ANTES de iniciar Express ===
validateEnv();

const PORT = parseInt(process.env.PORT || '3000', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const app = express();

// -----------------------------------------------------
// Segurança e parsing
// -----------------------------------------------------
app.disable('x-powered-by');
app.set('trust proxy', 1); // Render/Railway ficam atrás de proxy

app.use(helmet({
  // API pura — sem HTML servido — CSP estrito
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
  hsts: process.env.NODE_ENV === 'production' ? { maxAge: 15552000, includeSubDomains: true } : false,
  referrerPolicy: { policy: 'no-referrer' },
}));

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

// Morgan: stream pro logger estruturado
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined', {
  skip: (req) => req.path === '/health',
}));

// -----------------------------------------------------
// CORS
// -----------------------------------------------------
const corsOptions = {
  origin(origin, callback){
    if(!origin) return callback(null, true);
    if(ALLOWED_ORIGINS.length === 0) return callback(null, true);
    if(ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    if(/^https:\/\/[a-z0-9-]+\.github\.io$/i.test(origin)) return callback(null, true);
    return callback(new Error('CORS bloqueado para esse domínio: ' + origin));
  },
  credentials: false,
  maxAge: 86400,
};
app.use(cors(corsOptions));

// -----------------------------------------------------
// Rate limit
// -----------------------------------------------------
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Muitas requisições. Tente em alguns segundos.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Muitas tentativas de autenticação. Aguarde 15 minutos.' },
});
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,            // MP pode mandar muitos eventos legítimos
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

// -----------------------------------------------------
// Healthcheck (Render usa pra ping)
//   /health: leve, só 200
//   /health/db: profundo, faz SELECT 1 no Postgres
// -----------------------------------------------------
app.get('/', (req, res) => res.json({ ok: true, name: 'planvida-api', version: '1.0.0' }));
app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get('/health/db', async (req, res) => {
  try{
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: 'up', ts: new Date().toISOString() });
  }catch(err){
    res.status(503).json({ ok: false, db: 'down', err: err.message });
  }
});

// -----------------------------------------------------
// Rotas
// -----------------------------------------------------
app.use('/api/auth',           authLimiter,    authRoutes);
app.use('/api/plans',          apiLimiter,     plansRoutes);
app.use('/api',                apiLimiter,     subscriptionRoutes);  // /api/subscribe + /api/subscriptions/me
app.use('/api/payments/webhook', webhookLimiter); // limit dedicado pro webhook
app.use('/api/payments',       apiLimiter,     paymentsRoutes);
app.use('/api/dashboard',      apiLimiter,     dashboardRoutes);
app.use('/api/admin',          authLimiter,    adminRoutes);

// -----------------------------------------------------
// 404 + erros
// -----------------------------------------------------
app.use((req, res) => res.status(404).json({ error: 'not_found', message: 'Rota não encontrada.' }));
app.use(errorHandler);

// -----------------------------------------------------
// Start + graceful shutdown
// -----------------------------------------------------
const server = app.listen(PORT, () => {
  log.info('api_started', {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    corsAllowed: ALLOWED_ORIGINS,
  });
});

function shutdown(signal){
  log.info('shutdown_initiated', { signal });
  server.close(async () => {
    try{ await prisma.$disconnect(); }catch{}
    process.exit(0);
  });
  // Hard exit se demorar mais de 10s
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => log.error('unhandled_rejection', { reason: String(reason) }));
process.on('uncaughtException',  (err)    => { log.error('uncaught_exception', { err: err.message }); process.exit(1); });
