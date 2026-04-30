// =========================================================
// Validação de CPF — algoritmo oficial dos dois dígitos verificadores
// =========================================================

/**
 * Limpa CPF — só dígitos.
 */
export function onlyDigitsCPF(cpf){
  return String(cpf || '').replace(/\D/g, '');
}

/**
 * Valida CPF pelo algoritmo dos DVs.
 * @param {string} cpf — pode estar formatado ou só dígitos
 * @returns {boolean}
 */
export function validaCPF(cpf){
  const d = onlyDigitsCPF(cpf);
  if(d.length !== 11) return false;
  // Rejeita CPFs sequenciais (000.000.000-00, 111.111.111-11, etc.)
  if(/^(\d)\1{10}$/.test(d)) return false;

  let s, r;
  s = 0;
  for(let i = 0; i < 9; i++) s += parseInt(d.charAt(i), 10) * (10 - i);
  r = 11 - (s % 11);
  if(r === 10 || r === 11) r = 0;
  if(r !== parseInt(d.charAt(9), 10)) return false;

  s = 0;
  for(let i = 0; i < 10; i++) s += parseInt(d.charAt(i), 10) * (11 - i);
  r = 11 - (s % 11);
  if(r === 10 || r === 11) r = 0;
  return r === parseInt(d.charAt(10), 10);
}
