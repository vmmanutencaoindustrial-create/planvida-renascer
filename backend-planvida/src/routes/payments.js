// =========================================================
// Pagamentos
//
//   GET  /api/payments        (auth)  histórico do logado
//   GET  /api/payments/:id    (auth)  detalhe (precisa ser dono)
//   POST /api/payments/webhook         Mercado Pago notifica aqui
//                                      (validação x-signature + idempotência)
// =========================================================
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { buscarPagamento, verifyWebhookSignature } from '../lib/mercadopago.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncH } from '../middleware/error.js';
import { log } from '../lib/logger.js';

const router = Router();

// -----------------------------------------------------
// Mapper status MP -> nosso enum
// -----------------------------------------------------
function mapMPStatus(s){
  switch(s){
    case 'approved':       return 'APPROVED';
    case 'pending':        return 'PENDING';
    case 'in_process':     return 'IN_PROCESS';
    case 'rejected':       return 'REJECTED';
    case 'refunded':       return 'REFUNDED';
    case 'charged_back':   return 'REFUNDED';
    case 'cancelled':      return 'CANCELED';
    default:               return 'PENDING';
  }
}

function mapMPMethod(s){
  if(!s) return 'OTHER';
  if(s === 'pix')          return 'PIX';
  if(s === 'bolbradesco' || s === 'pagofacil' || s === 'bolboleto' || String(s).includes('boleto')) return 'BOLETO';
  if(s === 'credit_card')  return 'CREDIT_CARD';
  if(s === 'debit_card')   return 'DEBIT_CARD';
  return 'OTHER';
}

// -----------------------------------------------------
// GET /api/payments — histórico do logado
// -----------------------------------------------------
router.get('/', requireAuth, asyncH(async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({
    payments: payments.map(p => ({
      id:        p.id,
      status:    p.status,
      method:    p.method,
      amount:    Number(p.amount),
      paidAt:    p.paidAt,
      createdAt: p.createdAt,
      mpPaymentId:    p.mpPaymentId,
      mpInitPoint:    p.mpInitPoint,
      mpQrCode:       p.mpQrCode,
      mpQrCodeBase64: p.mpQrCodeBase64,
    })),
  });
}));

// -----------------------------------------------------
// GET /api/payments/:id — detalhe (autorização: dono)
// -----------------------------------------------------
router.get('/:id', requireAuth, asyncH(async (req, res) => {
  const p = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if(!p || p.userId !== req.userId){
    return res.status(404).json({ error: 'not_found', message: 'Pagamento não encontrado.' });
  }
  res.json({ payment: {
    id:        p.id,
    status:    p.status,
    method:    p.method,
    amount:    Number(p.amount),
    paidAt:    p.paidAt,
    createdAt: p.createdAt,
    mpPaymentId:    p.mpPaymentId,
    mpInitPoint:    p.mpInitPoint,
    mpQrCode:       p.mpQrCode,
    mpQrCodeBase64: p.mpQrCodeBase64,
  } });
}));

// -----------------------------------------------------
// POST /api/payments/webhook — notificação do Mercado Pago
//
// SEGURANÇA:
//   1. Valida x-signature HMAC SHA-256 (anti-forge)
//   2. Verifica timestamp pra evitar replay attacks (5 min)
//   3. Idempotência via mpPaymentId @unique no DB
//   4. Confere external_reference local antes de ativar nada
//
// CONVENÇÃO MP:
//   Devolve 200 quando processou OK (ou ignorou intencionalmente).
//   Devolve 5xx APENAS em erro transitório (DB fora) — MP reenvia.
// -----------------------------------------------------
router.post('/webhook', asyncH(async (req, res) => {
  // === 1. VALIDAÇÃO DE ASSINATURA ===
  const sig = verifyWebhookSignature({ headers: req.headers, query: req.query, body: req.body });
  if(!sig.valid){
    log.warn('webhook_signature_invalid', { reason: sig.reason, ip: req.ip });
    return res.status(401).json({ error: 'invalid_signature' });
  }
  if(sig.devBypass){
    log.warn('webhook_signature_dev_bypass');
  }

  // === 2. EXTRAI tipo + ID ===
  const topic =
    req.body?.type ||
    req.body?.topic ||
    req.query?.type ||
    req.query?.topic;

  const mpPaymentId = String(
    req.body?.data?.id ||
    req.body?.id ||
    req.query?.id ||
    req.query?.['data.id'] ||
    ''
  );

  log.info('webhook_received', { topic, mpPaymentId });

  if(topic !== 'payment' || !mpPaymentId){
    return res.status(200).json({ received: true, ignored: true, reason: 'topic_or_id_missing' });
  }

  // === 3. IDEMPOTÊNCIA: já processamos esse mpPaymentId? ===
  // Se já existe Payment com esse mpPaymentId E status final, retorna 200 sem reprocessar.
  const existing = await prisma.payment.findUnique({ where: { mpPaymentId } }).catch(() => null);
  if(existing && ['APPROVED', 'REFUNDED', 'CANCELED', 'REJECTED'].includes(existing.status)){
    log.info('webhook_idempotent_skip', { mpPaymentId, status: existing.status });
    return res.status(200).json({ received: true, idempotent: true });
  }

  // === 4. BUSCA PAGAMENTO NO MP ===
  let mpPayment;
  try{
    mpPayment = await buscarPagamento(mpPaymentId);
  }catch(err){
    log.error('webhook_mp_fetch_failed', { mpPaymentId, err: err?.message });
    // 5xx pra MP reenviar
    return res.status(503).json({ error: 'mp_fetch_failed' });
  }

  // === 5. EXTERNAL_REFERENCE deve apontar pro nosso payment ===
  const ref = mpPayment.external_reference || '';
  const parts = Object.fromEntries(
    ref.split('|').map(p => {
      const [k, v] = p.split(':');
      return [k, v];
    }).filter(([k,v]) => k && v)
  );
  const localPaymentId = parts.pid;

  if(!localPaymentId){
    log.warn('webhook_no_external_ref', { ref, mpPaymentId });
    return res.status(200).json({ received: true, ignored: true, reason: 'no_external_ref' });
  }

  const localPayment = await prisma.payment.findUnique({
    where: { id: localPaymentId },
    include: { subscription: true, user: { select: { id: true, email: true } } },
  });

  if(!localPayment){
    log.warn('webhook_local_not_found', { localPaymentId, mpPaymentId });
    return res.status(200).json({ received: true, ignored: true, reason: 'local_not_found' });
  }

  // === 6. VALIDA QUE O VALOR BATE (anti-tampering) ===
  const expectedAmount = Number(localPayment.amount);
  const mpAmount = Number(mpPayment.transaction_amount);
  if(Math.abs(expectedAmount - mpAmount) > 0.01){
    log.warn('webhook_amount_mismatch', {
      localPaymentId, mpPaymentId, expectedAmount, mpAmount,
    });
    return res.status(200).json({ received: true, ignored: true, reason: 'amount_mismatch' });
  }

  // === 7. ATUALIZA EM TRANSAÇÃO ATÔMICA ===
  const newStatus = mapMPStatus(mpPayment.status);
  const method    = mapMPMethod(mpPayment.payment_method_id);
  const pix       = mpPayment.point_of_interaction?.transaction_data || {};

  try{
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: localPayment.id },
        data: {
          mpPaymentId,
          status: newStatus,
          method,
          paidAt: newStatus === 'APPROVED' ? new Date() : null,
          mpQrCode: pix.qr_code || localPayment.mpQrCode,
          mpQrCodeBase64: pix.qr_code_base64 || localPayment.mpQrCodeBase64,
          mpPayload: mpPayment,
        },
      });

      if(newStatus === 'APPROVED' && localPayment.subscription){
        const startDate   = localPayment.subscription.startDate || new Date();
        const nextDueDate = new Date();
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);

        await tx.subscription.update({
          where: { id: localPayment.subscription.id },
          data:  { status: 'ACTIVE', startDate, nextDueDate },
        });
      }

      if((newStatus === 'REFUNDED' || newStatus === 'CANCELED') && localPayment.subscription){
        // Se primeiro pagamento foi reembolsado → suspende
        if(localPayment.subscription.status === 'PENDING'){
          await tx.subscription.update({
            where: { id: localPayment.subscription.id },
            data:  { status: 'CANCELED', canceledAt: new Date() },
          });
        }
      }
    });

    log.info('webhook_processed', {
      localPaymentId,
      mpPaymentId,
      status: newStatus,
      userId: localPayment.userId,
      subscriptionId: localPayment.subscriptionId,
    });

    res.status(200).json({ received: true, processed: true, status: newStatus });
  }catch(err){
    log.error('webhook_db_failed', { localPaymentId, mpPaymentId, err: err?.message });
    // 5xx pra MP reenviar
    res.status(503).json({ error: 'db_failed' });
  }
}));

// Webhook GET (alguns sistemas testam com GET)
router.get('/webhook', (req, res) => res.status(200).send('OK'));

export default router;
