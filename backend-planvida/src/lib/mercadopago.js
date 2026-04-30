// =========================================================
// Cliente Mercado Pago — preference creation + payment fetch
// Docs: https://www.mercadopago.com.br/developers/pt/reference
// =========================================================
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
