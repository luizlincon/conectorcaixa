// Login por telefone + PIN: o telefone vira um e-mail interno e o PIN uma senha derivada.
export const soDigitos = (t: string) => t.replace(/\D/g, "");
export const emailDoTelefone = (tel: string) => `${soDigitos(tel)}@func.navalhadacorte.app`;
export const senhaDoPin = (pin: string) => `ndc-${pin}-scs`;
export const pinValido = (pin: string) => /^\d{4}$/.test(pin);

export function formatarTelefone(t: string) {
  const d = soDigitos(t).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
