import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Marca } from "@/components/Marca";
import { FormLogin } from "@/components/FormLogin";
import { sessaoQuery, type Sessao } from "@/hooks/use-sessao";
import { existeDono } from "@/lib/caixa.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar · Conferente de Caixa" },
      { name: "description", content: "Entre com telefone e PIN para fechar o caixa da Navalha da Corte." },
      { property: "og:title", content: "Entrar · Conferente de Caixa" },
      { property: "og:description", content: "Entre com telefone e PIN para fechar o caixa da Navalha da Corte." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [semDono, setSemDono] = useState(false);

  /** Dono vai para o painel; funcionário para o endereço da unidade dele (/scs, /studio302…). */
  const irPara = (s: Sessao) => {
    if (s.papel === "dono") return navigate({ to: "/painel" });
    if (s.unidadeCodigo) return navigate({ to: "/$unidade", params: { unidade: s.unidadeCodigo } });
    return navigate({ to: "/caixa" });
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const s = await qc.fetchQuery(sessaoQuery);
      if (s) irPara(s);
    });
    existeDono().then((r) => setSemDono(!r.existe)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-between px-6 py-10">
      <Marca />
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold">Hora de fechar<br />o caixa.</h1>
          <p className="mt-2 text-muted-foreground">Entre com seu telefone e PIN.</p>
        </div>
        <FormLogin aoEntrar={irPara} />
      </div>
      <div className="text-center text-sm text-muted-foreground">
        {semDono ? (
          <Link to="/configuracao-inicial" className="font-semibold text-foreground underline underline-offset-4">
            Primeiro acesso: cadastrar o dono
          </Link>
        ) : (
          "Esqueceu o PIN? Fale com o dono."
        )}
      </div>
    </main>
  );
}
