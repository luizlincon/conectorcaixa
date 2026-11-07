import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { feriadosQuery, unidadeQuery } from "@/lib/dados-dono";
import { dataBR } from "@/lib/formato";
import { formatarTelefone, pinValido } from "@/lib/auth-utils";
import { atualizarUsuario, criarUsuario, recalcularAlertas } from "@/lib/caixa.functions";

export const Route = createFileRoute("/_authenticated/painel/config")({
  head: () => ({ meta: [
    { title: "Ajustes da unidade SCS · Conferente de Caixa" },
    { name: "description", content: "Usuários, parâmetros e feriados nacionais e de Brasília da unidade SCS." },
    { property: "og:title", content: "Ajustes da unidade SCS · Conferente de Caixa" },
    { property: "og:description", content: "Usuários, parâmetros e feriados nacionais e de Brasília da unidade SCS." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Config,
});

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-card"><h2 className="text-lg font-bold">{titulo}</h2>{children}</section>;
}

function Config() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Ajustes</h1>
      <Parametros />
      <Usuarios />
      <Feriados />
    </div>
  );
}

function Parametros() {
  const qc = useQueryClient();
  const { data: u } = useQuery(unidadeQuery);
  const [hora, setHora] = useState("");
  const [inicio, setInicio] = useState("");
  useEffect(() => { if (u) { setHora(u.horario_limite.slice(0, 5)); setInicio(u.data_inicio_assinatura); } }, [u]);
  const salvar = async () => {
    if (!u) return;
    const { error } = await supabase.from("unidades").update({ horario_limite: hora, data_inicio_assinatura: inicio }).eq("id", u.id);
    if (error) return void toast.error("Erro ao salvar");
    toast.success("Parâmetros salvos");
    qc.invalidateQueries({ queryKey: ["unidade"] });
  };
  return (
    <Secao titulo="Parâmetros da unidade SCS">
      <label className="block space-y-1 text-sm"><span className="text-muted-foreground">Horário limite para enviar o fechamento</span><Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></label>
      <label className="block space-y-1 text-sm"><span className="text-muted-foreground">Início da forma "Assinatura" no HubBarber</span><Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
      <Button onClick={salvar} disabled={!u}>Salvar</Button>
    </Secao>
  );
}

function Usuarios() {
  const qc = useQueryClient();
  const { data: lista = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const [{ data: us }, { data: roles }] = await Promise.all([
        supabase.from("usuarios").select("*").order("nome"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (us ?? []).map((x) => ({ ...x, dono: roles?.some((r) => r.user_id === x.id && r.role === "dono") }));
    },
  });
  const [novo, setNovo] = useState({ nome: "", telefone: "", pin: "", papel: "funcionario" as "funcionario" | "dono" });
  const [salvando, setSalvando] = useState(false);

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinValido(novo.pin)) return void toast.error("PIN deve ter 4 dígitos");
    setSalvando(true);
    try {
      await criarUsuario({ data: novo });
      toast.success("Usuário criado");
      setNovo({ nome: "", telefone: "", pin: "", papel: "funcionario" });
      qc.invalidateQueries({ queryKey: ["usuarios"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro"); }
    finally { setSalvando(false); }
  };
  const alterar = async (id: string, d: { ativo?: boolean; pin?: string }) => {
    try { await atualizarUsuario({ data: { id, ...d } }); toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["usuarios"] }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro"); }
  };

  return (
    <Secao titulo="Usuários">
      <ul className="divide-y">
        {lista.map((x) => (
          <li key={x.id} className="flex items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{x.nome} {x.dono && <span className="ml-1 rounded bg-accent/30 px-1.5 text-xs">dono</span>}</p>
              <p className="text-xs text-muted-foreground tabular">{formatarTelefone(x.telefone)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => { const p = prompt(`Novo PIN de ${x.nome} (4 dígitos)`); if (p && pinValido(p)) alterar(x.id, { pin: p }); else if (p) toast.error("PIN inválido"); }}>PIN</Button>
              <Switch checked={x.ativo} onCheckedChange={(v) => alterar(x.id, { ativo: v })} aria-label="Ativo" />
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={adicionar} className="grid gap-2 border-t pt-3 sm:grid-cols-2">
        <Input placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} required />
        <Input placeholder="Telefone" inputMode="tel" value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: formatarTelefone(e.target.value) })} required />
        <Input placeholder="PIN (4 dígitos)" inputMode="numeric" maxLength={4} value={novo.pin} onChange={(e) => setNovo({ ...novo, pin: e.target.value.replace(/\D/g, "") })} required />
        <select className="h-9 rounded-md border border-input bg-card px-3 text-sm" value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value as "funcionario" | "dono" })}>
          <option value="funcionario">Funcionário</option><option value="dono">Dono</option>
        </select>
        <Button type="submit" disabled={salvando} className="sm:col-span-2">{salvando ? "Criando…" : "Adicionar usuário"}</Button>
      </form>
    </Secao>
  );
}

function Feriados() {
  const qc = useQueryClient();
  const { data: lista = [] } = useQuery(feriadosQuery);
  const [data, setData] = useState("");
  const [desc, setDesc] = useState("");
  const recalcularDia = async (d: string) => {
    const { data: f } = await supabase.from("fechamentos").select("id").eq("data", d).maybeSingle();
    if (f) await recalcularAlertas({ data: { id: f.id } });
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("feriados").insert({ data, descricao: desc });
    if (error) return void toast.error(error.code === "23505" ? "Feriado já cadastrado" : "Erro");
    await recalcularDia(data);
    setData(""); setDesc("");
    qc.invalidateQueries({ queryKey: ["feriados"] });
  };
  const del = async (id: string, d: string) => {
    await supabase.from("feriados").delete().eq("id", id);
    await recalcularDia(d);
    qc.invalidateQueries({ queryKey: ["feriados"] });
  };
  return (
    <Secao titulo="Feriados">
      {lista.length === 0 && <p className="text-sm text-muted-foreground">Nenhum feriado cadastrado.</p>}
      <ul className="divide-y">
        {lista.map((f) => (
          <li key={f.id} className="flex items-center justify-between py-2 text-sm">
            <span><b className="tabular">{dataBR(f.data)}</b> · {f.descricao}</span>
            <Button size="icon" variant="ghost" onClick={() => del(f.id, f.data)} aria-label="Remover"><Trash2 className="size-4" /></Button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex flex-wrap gap-2 border-t pt-3">
        <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required className="w-auto" />
        <Input placeholder="Descrição" value={desc} onChange={(e) => setDesc(e.target.value)} className="min-w-0 flex-1" />
        <Button type="submit">Adicionar</Button>
      </form>
    </Secao>
  );
}
