export function podeOperarCaixa(papel: string | null | undefined): boolean {
  return papel === "dono" || papel === "funcionario";
}

export function podeVerMeses(papel: string | null | undefined): boolean {
  return papel === "dono";
}

export function podeAcessarDia(papel: string | null | undefined, data: string, hoje: string): boolean {
  return podeVerMeses(papel) || (papel === "funcionario" && data === hoje);
}