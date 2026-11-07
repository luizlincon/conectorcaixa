import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const feriadosQuery = queryOptions({
  queryKey: ["feriados"],
  queryFn: async () => {
    const { data } = await supabase.from("feriados").select("*").order("data");
    return data ?? [];
  },
});

/** Fechamentos e alertas de UMA unidade no período (o dono escolhe a unidade no painel). */
export const fechamentosPeriodoQuery = (unidadeId: string | undefined, de: string, ate: string) =>
  queryOptions({
    queryKey: ["fechamentos", unidadeId, de, ate],
    enabled: !!unidadeId,
    queryFn: async () => {
      const [{ data: f }, { data: a }] = await Promise.all([
        supabase.from("fechamentos").select("id, data, status, valor_maquina, valor_assinatura, valor_dinheiro, enviado_em").eq("unidade_id", unidadeId!).gte("data", de).lte("data", ate).order("data"),
        supabase.from("alertas").select("id, data, nivel, resolvido").eq("unidade_id", unidadeId!).gte("data", de).lte("data", ate),
      ]);
      return { fechamentos: f ?? [], alertas: a ?? [] };
    },
  });

export const ultimoDiaMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
export const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
