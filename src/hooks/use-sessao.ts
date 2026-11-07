import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Sessao {
  id: string;
  nome: string;
  unidadeId: string | null;
  unidadeNome: string;
  unidadeCodigo: string | null;
  papel: "dono" | "funcionario";
}

export const sessaoQuery = queryOptions({
  queryKey: ["sessao"],
  queryFn: async (): Promise<Sessao | null> => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const [{ data: u }, { data: roles }] = await Promise.all([
      supabase.from("usuarios").select("nome, unidade_id, ativo, unidades(nome, codigo)").eq("id", auth.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", auth.user.id),
    ]);
    if (!u || !u.ativo) return null;
    const papel = roles?.some((r) => r.role === "dono") ? "dono" : "funcionario";
    return {
      id: auth.user.id,
      nome: u.nome,
      unidadeId: u.unidade_id,
      unidadeNome: (u.unidades as { nome: string } | null)?.nome ?? "",
      unidadeCodigo: (u.unidades as { codigo: string } | null)?.codigo ?? null,
      papel,
    };
  },
  staleTime: 60_000,
});

export const useSessao = () => useQuery(sessaoQuery);

export async function sair() {
  await supabase.auth.signOut();
  window.location.href = "/";
}
