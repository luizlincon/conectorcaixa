// Unidades da barbearia: lista (dono), unidade escolhida no painel e busca pública pelo código do endereço.
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Unidade = Tables<"unidades">;
export type UnidadePublica = { id: string; nome: string; codigo: string };

/** Códigos que não podem virar endereço de unidade porque já são páginas do app. */
export const CODIGOS_RESERVADOS = ["caixa", "painel", "configuracao-inicial", "api", "assets", "login", "sair"];

export function codigoValido(codigo: string) {
  return /^[a-z0-9-]{2,30}$/.test(codigo) && !CODIGOS_RESERVADOS.includes(codigo);
}

/** Todas as unidades (o banco só devolve todas para o dono; o funcionário vê só a dele). */
export const unidadesQuery = queryOptions({
  queryKey: ["unidades"],
  queryFn: async () => {
    const { data, error } = await supabase.from("unidades").select("*").order("nome");
    if (error) throw error;
    return data;
  },
});

/** Busca pública (antes do login) pela função do banco: só id, nome e código de unidade ativa. */
export const unidadePorCodigoQuery = (codigo: string) =>
  queryOptions({
    queryKey: ["unidade-codigo", codigo],
    queryFn: async (): Promise<UnidadePublica | null> => {
      const { data, error } = await supabase.rpc("unidade_por_codigo", { _codigo: codigo });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    staleTime: 5 * 60_000,
  });

/* ---------- Unidade escolhida no painel do dono (lembrada neste aparelho) ---------- */

const CHAVE = "painel-unidade";
const ouvintes = new Set<() => void>();
let memoria: string | null = null;

function lerCodigo(): string | null {
  try {
    return window.localStorage.getItem(CHAVE) ?? memoria;
  } catch {
    return memoria;
  }
}

export function escolherUnidade(codigo: string) {
  memoria = codigo;
  try {
    window.localStorage.setItem(CHAVE, codigo);
  } catch {
    /* navegador sem armazenamento: fica só na memória */
  }
  ouvintes.forEach((f) => f());
}

const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
};

/** Unidade que o dono está vendo no painel. Padrão: SCS, ou a primeira da lista. */
export function useUnidadeAtual() {
  const codigo = useSyncExternalStore(assinar, lerCodigo, () => null);
  const q = useQuery(unidadesQuery);
  const unidades = q.data ?? [];
  const unidade = unidades.find((u) => u.codigo === codigo) ?? unidades.find((u) => u.codigo === "scs") ?? unidades[0] ?? null;
  return { unidades, unidade, isLoading: q.isLoading, escolher: escolherUnidade };
}
