import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Marca } from "@/components/Marca";
import { criarPrimeiroDono } from "@/lib/caixa.functions";
import { formatarTelefone, pinValido } from "@/lib/auth-utils";

export const Route = createFileRoute("/configuracao-inicial")({
  head: () => ({
    meta: [
      { title: "Configuração inicial · Conferente de Caixa" },
      { name: "description", content: "Cadastre o dono da barbearia no primeiro acesso." },
      { property: "og:title", content: "Configuração inicial · Conferente de Caixa" },
      { property: "og:description", content: "Cadastre o dono da barbearia no primeiro acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Config,
});

function Config() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [pin, setPin] = useState("");
  const [salvando, setSalvando] = useState(false);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinValido(pin)) return void toast.error("O PIN deve ter 4 dígitos.");
    setSalvando(true);
    try {
      await criarPrimeiroDono({ data: { nome, telefone: tel, pin } });
      toast.success("Dono cadastrado. Agora é só entrar.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-md space-y-8 px-6 py-10">
      <Marca />
      <div>
        <h1 className="text-3xl font-bold">Primeiro acesso</h1>
        <p className="mt-2 text-muted-foreground">Cadastre o dono. Depois disso, esta tela deixa de funcionar.</p>
      </div>
      <form onSubmit={salvar} className="space-y-4">
        <div className="space-y-2"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-12" /></div>
        <div className="space-y-2"><Label>Telefone</Label><Input inputMode="tel" value={tel} onChange={(e) => setTel(formatarTelefone(e.target.value))} className="h-12" /></div>
        <div className="space-y-2"><Label>PIN (4 dígitos)</Label><Input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} className="h-12 tracking-[0.5em]" /></div>
        <Button type="submit" size="lg" className="h-12 w-full" disabled={salvando}>{salvando ? "Salvando…" : "Cadastrar dono"}</Button>
      </form>
    </main>
  );
}
