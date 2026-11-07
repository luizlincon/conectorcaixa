// Login por telefone + PIN: o telefone vira um e-mail interno e o PIN uma senha derivada.
export const soDigitos = (t: string) => t.replace(/\D/g, "");

/** Só os dígitos com DDD: tira o código do país (+55) e o 0 de discagem, como o celular costuma autopreencher. */
export function normalizarTelefone(t: string) {
  let d = soDigitos(t);
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 11);
}

export const emailDoTelefone = (tel: string) => `${normalizarTelefone(tel)}@func.navalhadacorte.app`;
export const senhaDoPin = (pin: string) => `ndc-${pin}-scs`;
export const pinValido = (pin: string) => /^\d{4}$/.test(pin);

export function formatarTelefone(t: string) {
  const d = normalizarTelefone(t);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
