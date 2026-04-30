// =========================================================
// Cliente Mercado Pago — preference creation + payment fetch
//                       + verificação de assinatura de webhook
// Docs: https://www.mercadopago.com.br/developers/pt/reference
// Webhook signature: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
// =========================================================
import crypto from 'node:crypto';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

const accessToken = process.env.MP_ACCESS_TOKEN;
if(!accessToken) {
  console.warn('[MP] MP_ACCESS_TOKEN não configurado — chamadas vão falhar.');
}

const client = new MercadoPagoConfig({
  accessToken: accessToken || 'TEST',
  options: { timeout: 10000 },
});

export const preferenceClient = new Preference(client);
export const paymentClient    = new Payment(client);

// -----------------------------------------------------
// VERIFICAÇÃO DE ASSINATURA DO WEBHOOK
// MP envia headers: x-signature: "ts=123,v1=hash"   x-request-id: "..."
// HMAC SHA-256 do template: "id:<dataId>;request-id:<requestId>;ts:<ts>;"
// chave: MP_WEBHOOK_SECRET (gerado no painel MP > Webhooks)
// -----------------------------------------------------
/**
 * Verifica assinatura do webhook do Mercado Pago.
 * Retorna { valid: boolean, reason?: string }.
 *
 * Em DEV (sem secret configurado), aceita tudo mas loga warning.
 */
export function verifyWebhookSignature({ headers, query, body }){
  const secret = process.env.MP_WEBHOOK_SECRET;

  // DEV-only bypass: se não tem secret, aceita mas avisa
  if(!secret){
    if(process.env.NODE_ENV === 'production'){
      return { valid: false, reason: 'MP_WEBHOOK_SECRET não configurado (obrigatório em produção)' };
    }
    return { valid: true, devBypass: true };
  }

  const xSig = headers['x-signature'] || headers['X-Signature'];
  const xReq = headers['x-request-id'] || headers['X-Request-Id'];
  if(!xSig || !xReq){
    return { valid: false, reason: 'headers x-signature/x-request-id ausentes' };
  }

  // x-signature = "ts=1234,v1=abcdef..."
  const parts = String(xSig).split(',').reduce((acc, kv) => {
    const [k, v] = kv.split('=').map(s => s.trim());
    if(k && v) acc[k] = v;
    return acc;
  }, {});
  const ts = parts.ts;
  const v1 = parts.v1;
  if(!ts || !v1) return { valid: false, reason: 'x-signature mal formado' };

  // Tolerância anti-replay: 5 minutos
  const now = Date.now();
  const tsMs = parseInt(ts, 10) * (String(ts).length <= 10 ? 1000 : 1);
  if(Math.abs(now - tsMs) > 5 * 60 * 1000){
    return { valid: false, reason: 'timestamp expirado (replay attack?)' };
  }

  const dataId = body?.data?.id || query?.['data.id'] || query?.id;
  if(!dataId) return { valid: false, reason: 'data.id ausente no payload' };

  const template = `id:${dataId};request-id:${xReq};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(template).digest('hex');

  // Comparação em tempo constante
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(v1, 'hex');
  if(a.length !== b.length) return { valid: false, reason: 'tamanho de hash diferente' };
  const ok = crypto.timingSafeEqual(a, b);
  return ok ? { valid: true } : { valid: false, reason: 'hash não confere' };
}

/**
 * Cria uma preferência de pagamento no Mercado Pago.
 *
 * @param {Object} args
 * @param {string} args.userId
 * @param {string} args.subscriptionId
 * @param {string} args.planNome
 * @param {number} args.amount        valor em R$
 * @param {{ name:string, email:string, cpf:string }} args.payer
 * @param {string} args.backendUrl    URL pública do backend (pra webhook)
 * @param {string} args.frontendUrl   URL pública do frontend (pra back_urls)
 * @returns {Promise<{ id, init_point, sandbox_init_point }>}
 */
export async function criarPreferenciaPagamento({
  userId,
  subscriptionId,
  paymentId,
  planNome,
  amount,
  payer,
  backendUrl,
  frontendUrl,
}){
  // CPF como string só com dígitos
  const cpfDigits = (payer.cpf || '').replace(/\D/g, '');

  const body = {
    items: [{
      id: subscriptionId,
      title: `${planNome} — PlanVida Renascer`,
      description: `Mensalidade ${planNome}`,
      category_id: 'services',
      quantity: 1,
      currency_id: 'BRL',
      unit_price: Number(Number(amount).toFixed(2)),
    }],
    payer: {
      email: payer.email,
      name: payer.name?.split(' ')[0] || payer.name,
      surname: payer.name?.split(' ').slice(1).join(' ') || '',
      identification: cpfDigits ? { type: 'CPF', number: cpfDigits } : undefined,
    },
    payment_methods: {
      // Permite tudo: cartão, boleto, pix
      excluded_payment_methods: [],
      excluded_payment_types: [],
      installments: 1,
    },
    back_urls: {
      success: `${frontendUrl}/cadastro.html?status=success&pid=${paymentId}`,
      failure: `${frontendUrl}/cadastro.html?status=failure&pid=${paymentId}`,
      pending: `${frontendUrl}/cadastro.html?status=pending&pid=${paymentId}`,
    },
    auto_return: 'approved',
    external_reference: `pid:${paymentId}|sub:${subscriptionId}|user:${userId}`,
    statement_descriptor: 'PLANVIDA',
    notification_url: `${backendUrl}/api/payments/webhook`,
    metadata: { userId, subscriptionId, paymentId },
  };

  const result = await preferenceClient.create({ body });
  return result;
}

/**
 * Busca um pagamento no MP pelo ID.
 */
export async function buscarPagamento(paymentId){
  return paymentClient.get({ id: paymentId });
}
