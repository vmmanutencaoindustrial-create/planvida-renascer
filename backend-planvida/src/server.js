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

import authRoutes         from './routes/auth.js';
import plansRoutes        from './routes/plans.js';
import subscriptionRoutes from './routes/subscriptions.js';
import paymentsRoutes     from './routes/payments.js';
import dashboardRoutes    from './routes/dashboard.js';
import adminRoutes        from './routes/admin.js';
import { errorHandler }   from './middleware/error.js';

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
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// -----------------------------------------------------
// CORS
// -----------------------------------------------------
const corsOptions = {
  origin(origin, callback){
    // Permite ferramentas (Postman/curl), localhost na dev, e a lista
    if(!origin) return callback(null, true);
    if(ALLOWED_ORIGINS.length === 0) return callback(null, true);
    if(ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // Permite previews do GitHub Pages do mesmo dono
    if(/^https:\/\/[a-z0-9-]+\.github\.io$/i.test(origin)) return callback(null, true);
    return callback(new Error('CORS bloqueado para esse domínio: ' + origin));
  },
  credentials: false,
};
app.use(cors(corsOptions));

// -----------------------------------------------------
// Rate limit (anti abuso)
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

// -----------------------------------------------------
// Healthcheck (Render usa pra ping)
// -----------------------------------------------------
app.get('/', (req, res) => res.json({ ok: true, name: 'planvida-api' }));
app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// -----------------------------------------------------
// Rotas públicas
// -----------------------------------------------------
app.use('/api/auth',        authLimiter, authRoutes);
app.use('/api/plans',       apiLimiter,  plansRoutes);
app.use('/api',             apiLimiter,  subscriptionRoutes); // /api/subscribe + /api/subscriptions/me
app.use('/api/payments',    apiLimiter,  paymentsRoutes);     // inclui /webhook
app.use('/api/dashboard',   apiLimiter,  dashboardRoutes);
app.use('/api/admin',       authLimiter, adminRoutes);

// -----------------------------------------------------
// 404 + erros
// -----------------------------------------------------
app.use((req, res) => res.status(404).json({ error: 'not_found', message: 'Rota não encontrada.' }));
app.use(errorHandler);

// -----------------------------------------------------
// Start
// -----------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 PlanVida API rodando na porta ${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   CORS allowed: ${ALLOWED_ORIGINS.join(', ') || '(nenhum — liberado)'}`);
});
