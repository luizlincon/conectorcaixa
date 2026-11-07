import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Marca } from "@/components/Marca";
import { emailDoTelefone, formatarTelefone, pinValido, senhaDoPin } from "@/lib/auth-utils";
import { sessaoQuery } from "@/hooks/use-sessao";
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
  const [tel, setTel] = useState("");
  const [pin, setPin] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [semDono, setSemDono] = useState(false);

  const irPara = async () => {
    const s = await qc.fetchQuery(sessaoQuery);
    if (!s) {
      await supabase.auth.signOut();
      toast.error("Usuário inativo ou sem cadastro.");
      return;
    }
    navigate({ to: s.papel === "dono" ? "/painel" : "/caixa" });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && irPara());
    existeDono().then((r) => setSemDono(!r.existe)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinValido(pin)) return void toast.error("O PIN tem 4 dígitos.");
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: emailDoTelefone(tel), password: senhaDoPin(pin) });
    if (error) {
      setCarregando(false);
      return void toast.error("Telefone ou PIN incorretos.");
    }
    qc.removeQueries({ queryKey: ["sessao"] });
    await irPara();
    setCarregando(false);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-between px-6 py-10">
      <Marca subtitulo="Unidade SCS" />
      <form onSubmit={entrar} className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold">Hora de fechar<br />o caixa.</h1>
          <p className="mt-2 text-muted-foreground">Entre com seu telefone e PIN.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tel">Telefone</Label>
          <Input id="tel" type="tel" inputMode="tel" autoComplete="tel" maxLength={16} placeholder="(61) 90000-0000" value={tel}
            onChange={(e) => setTel(formatarTelefone(e.target.value))} className="h-14 text-lg" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pin">PIN</Label>
          <Input id="pin" type="password" inputMode="numeric" maxLength={4} placeholder="••••" value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="h-14 text-center text-2xl tracking-[0.6em]" />
        </div>
        <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={carregando}>
          {carregando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
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
