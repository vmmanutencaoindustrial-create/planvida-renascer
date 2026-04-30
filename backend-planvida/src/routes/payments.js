// =========================================================
// Pagamentos
//
//   GET  /api/payments        (auth)  histórico do logado
//   GET  /api/payments/:id    (auth)  detalhe (precisa ser dono)
//   POST /api/payments/webhook         Mercado Pago notifica aqui
// =========================================================
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { buscarPagamento } from '../lib/mercadopago.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncH } from '../middleware/error.js';

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
  if(s === 'bolbradesco' || s === 'pagofacil' || s === 'bolboleto' || s.includes('boleto')) return 'BOLETO';
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
// GET /api/payments/:id — detalhe
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
// O MP manda chamadas pra essa URL com vários formatos.
// Aqui tratamos o "payment" topic (mais comum).
// Payload típico: { type: 'payment', data: { id: '12345' } }
// ou query string: ?topic=payment&id=12345
// -----------------------------------------------------
router.post('/webhook', asyncH(async (req, res) => {
  // MP exige resposta rápida (200) — registramos e processamos.
  // Sempre devolver 200 mesmo em erro pra MP não reenviar infinitamente.

  const topic =
    req.body?.type ||
    req.body?.topic ||
    req.query?.type ||
    req.query?.topic;

  const mpPaymentId =
    req.body?.data?.id ||
    req.body?.id ||
    req.query?.id ||
    req.query?.['data.id'];

  console.log('[webhook] received', { topic, mpPaymentId, body: req.body });

  if(topic !== 'payment' || !mpPaymentId){
    // Outros topics: merchant_order, etc — ignora por enquanto
    return res.status(200).json({ received: true, ignored: true });
  }

  try{
    // 1. Busca o pagamento no MP
    const mpPayment = await buscarPagamento(mpPaymentId);

    // external_reference = "pid:xxx|sub:yyy|user:zzz"
    const ref = mpPayment.external_reference || '';
    const parts = Object.fromEntries(
      ref.split('|').map(p => {
        const [k, v] = p.split(':');
        return [k, v];
      }).filter(([k,v]) => k && v)
    );
    const paymentId = parts.pid;

    if(!paymentId){
      console.warn('[webhook] external_reference sem pid', ref);
      return res.status(200).json({ received: true, error: 'no_pid' });
    }

    const localPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { subscription: true },
    });
    if(!localPayment){
      console.warn('[webhook] payment local não encontrado', paymentId);
      return res.status(200).json({ received: true, error: 'payment_not_found' });
    }

    const newStatus = mapMPStatus(mpPayment.status);
    const method    = mapMPMethod(mpPayment.payment_method_id);

    // QR PIX (se aplicável)
    const pix = mpPayment.point_of_interaction?.transaction_data || {};

    await prisma.payment.update({
      where: { id: localPayment.id },
      data: {
        mpPaymentId: String(mpPayment.id),
        status: newStatus,
        method,
        paidAt: newStatus === 'APPROVED' ? new Date() : null,
        mpQrCode: pix.qr_code || localPayment.mpQrCode,
        mpQrCodeBase64: pix.qr_code_base64 || localPayment.mpQrCodeBase64,
        mpPayload: mpPayment,
      },
    });

    // Ativa assinatura se aprovado
    if(newStatus === 'APPROVED' && localPayment.subscription){
      const startDate   = new Date();
      const nextDueDate = new Date();
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);

      await prisma.subscription.update({
        where: { id: localPayment.subscription.id },
        data: { status: 'ACTIVE', startDate, nextDueDate },
      });
      console.log(`[webhook] subscription ${localPayment.subscription.id} ATIVADA`);
    }

    res.status(200).json({ received: true, processed: true, status: newStatus });
  }catch(err){
    console.error('[webhook] erro processando:', err?.message || err);
    res.status(200).json({ received: true, error: 'processing_failed' });
  }
}));

// Webhook GET (alguns sistemas testam com GET)
router.get('/webhook', (req, res) => res.status(200).send('OK'));

export default router;
