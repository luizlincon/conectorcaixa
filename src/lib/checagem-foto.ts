// Checagem rápida da foto do caixa: motivos possíveis e o que dizer ao barbeiro em cada um.

export const PROBLEMAS = ["nao_e_a_tela", "longe", "cortada", "reflexo", "desfocada", "escura"] as const;
export type ProblemaFoto = (typeof PROBLEMAS)[number];
export type TipoFoto = "hubbarber" | "pagbank";

export interface ChecagemFoto {
  ok: boolean;
  problema: ProblemaFoto | null;
}

export const TITULO_ERRO: Record<TipoFoto, string> = {
  hubbarber: "Não localizamos o fechamento",
  pagbank: "Não localizamos o resumo de vendas",
};

export const DICA: Record<ProblemaFoto, { motivo: string; dica: string }> = {
  nao_e_a_tela: {
    motivo: "Não encontramos os números do caixa nesta foto.",
    dica: "Confira se é a tela certa e fotografe de frente, com os valores aparecendo.",
  },
  longe: {
    motivo: "Os números ficaram pequenos demais para ler.",
    dica: "Aproxime mais o celular até a tela ocupar quase toda a foto.",
  },
  cortada: {
    motivo: "Parte dos valores ficou fora da foto.",
    dica: "Afaste um pouco e enquadre a tela inteira, de ponta a ponta.",
  },
  reflexo: {
    motivo: "Tem reflexo ou brilho cobrindo os números.",
    dica: "Incline um pouco o celular ou apague a luz atrás de você.",
  },
  desfocada: {
    motivo: "A foto ficou tremida ou fora de foco.",
    dica: "Apoie os cotovelos, toque na tela para focar e segure firme.",
  },
  escura: {
    motivo: "A foto ficou escura demais.",
    dica: "Aumente o brilho da tela fotografada ou acenda uma luz.",
  },
};

export const normalizarChecagem = (r: { ok?: unknown; problema?: unknown }): ChecagemFoto => {
  const ok = r.ok === true;
  const problema = PROBLEMAS.find((p) => p === r.problema) ?? "nao_e_a_tela";
  return { ok, problema: ok ? null : problema };
};
