export function podeOperarCaixa(papel: string | null | undefined): boolean {
  return papel === "dono" || papel === "funcionario";
}

export function podeVerMeses(papel: string | null | undefined): boolean {
  return papel === "dono";
}

export function podeAcessarDia(papel: string | null | undefined, data: string, hoje: string): boolean {
  return podeVerMeses(papel) || (papel === "funcionario" && data === hoje);
}

/** De qual unidade é o caixa: funcionário só a dele; dono a pedida (ou a dele). */
export function unidadeDoCaixa(papel: string | null, unidadeDoUsuario: string | null, pedida: string | undefined): string {
  if (papel === "dono") {
    const id = pedida ?? unidadeDoUsuario;
    if (!id) throw new Error("Escolha a unidade do caixa.");
    return id;
  }
  if (!unidadeDoUsuario) throw new Error("Usuário sem unidade. Fale com o dono.");
  if (pedida && pedida !== unidadeDoUsuario) throw new Error("Você não tem acesso a esta unidade.");
  return unidadeDoUsuario;
}
