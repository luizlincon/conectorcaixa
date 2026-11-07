import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const unidadeQuery = queryOptions({
  queryKey: ["unidade"],
  queryFn: async () => {
    const { data, error } = await supabase.from("unidades").select("*").eq("nome", "SCS").single();
    if (error) throw error;
    return data;
  },
});

export const feriadosQuery = queryOptions({
  queryKey: ["feriados"],
  queryFn: async () => {
    const { data } = await supabase.from("feriados").select("*").order("data");
    return data ?? [];
  },
});

export const fechamentosPeriodoQuery = (de: string, ate: string) =>
  queryOptions({
    queryKey: ["fechamentos", de, ate],
    queryFn: async () => {
      const [{ data: f }, { data: a }] = await Promise.all([
        supabase.from("fechamentos").select("id, data, status, valor_maquina, valor_assinatura, valor_dinheiro, enviado_em").gte("data", de).lte("data", ate).order("data"),
        supabase.from("alertas").select("id, data, nivel, resolvido").gte("data", de).lte("data", ate),
      ]);
      return { fechamentos: f ?? [], alertas: a ?? [] };
    },
  });

export const ultimoDiaMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
export const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
