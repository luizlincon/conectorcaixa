export function podeOperarCaixa(papel: string | null | undefined): boolean {
  return papel === "dono";
}

export const podeVerMeses = podeOperarCaixa;