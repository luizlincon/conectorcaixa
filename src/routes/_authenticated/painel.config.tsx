import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { feriadosQuery } from "@/lib/dados-dono";
import { codigoValido, CODIGOS_RESERVADOS, useUnidadeAtual, type Unidade } from "@/lib/unidades";
import { dataBR, DIAS, parseBRL } from "@/lib/formato";
import { formatarTelefone, pinValido } from "@/lib/auth-utils";
import { atualizarUsuario, criarUsuario, recalcularAlertas } from "@/lib/caixa.functions";

export const Route = createFileRoute("/_authenticated/painel/config")({
  head: () => ({ meta: [
    { title: "Ajustes · Conferente de Caixa" },
    { name: "description", content: "Unidades, regras, usuários e feriados nacionais e de Brasília." },
    { property: "og:title", content: "Ajustes · Conferente de Caixa" },
    { property: "og:description", content: "Unidades, regras, usuários e feriados nacionais e de Brasília." },
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
      <NovaUnidade />
      <Usuarios />
      <Feriados />
    </div>
  );
}

/** Linha de 7 botões (dom a sáb) para escolher dias da semana. */
function SeletorDias({ valor, onChange, rotulo }: { valor: number[]; onChange: (d: number[]) => void; rotulo: string }) {
  const alternar = (d: number) => onChange(valor.includes(d) ? valor.filter((x) => x !== d) : [...valor, d].sort((a, b) => a - b));
  return (
    <fieldset className="space-y-1 text-sm">
      <legend className="text-muted-foreground">{rotulo}</legend>
      <div className="grid grid-cols-7 gap-1.5 pt-1">
        {DIAS.map((nome, d) => (
          <button key={d} type="button" onClick={() => alternar(d)} aria-pressed={valor.includes(d)} aria-label={nome}
            className={`h-10 rounded-lg border text-sm font-semibold capitalize ${valor.includes(d) ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>
            {nome.slice(0, 3)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

type Form = { nome: string; hora: string; inicio: string; plano: string; multiplo: string; dias: number[]; ilimitado: number[]; ativa: boolean };
const paraForm = (u: Unidade): Form => ({
  nome: u.nome, hora: u.horario_limite.slice(0, 5), inicio: u.data_inicio_assinatura,
  plano: String(u.valor_plano).replace(".", ","), multiplo: String(u.multiplo_avulso).replace(".", ","),
  dias: u.dias_funcionamento, ilimitado: u.dias_ilimitado, ativa: u.ativa,
});

function Parametros() {
  const qc = useQueryClient();
  const { unidade: u } = useUnidadeAtual();
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  // Recarrega o formulário só ao trocar de unidade, para não apagar o que o dono está digitando
  // quando os dados são atualizados em segundo plano (ex.: ao voltar para a aba).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (u) setForm(paraForm(u)); }, [u?.id]);
  if (!u || !form) return null;
  const link = typeof window === "undefined" ? `/${u.codigo}` : `${window.location.origin}/${u.codigo}`;

  const salvar = async () => {
    const plano = parseBRL(form.plano), multiplo = parseBRL(form.multiplo);
    if (!form.nome.trim()) return void toast.error("Informe o nome da unidade.");
    if (!plano || !multiplo) return void toast.error("Valor do plano e múltiplo do avulso precisam ser maiores que zero.");
    if (!form.dias.length) return void toast.error("Escolha pelo menos um dia de funcionamento.");
    setSalvando(true);
    const { error } = await supabase.from("unidades").update({
      nome: form.nome.trim(), horario_limite: form.hora, data_inicio_assinatura: form.inicio,
      valor_plano: plano, multiplo_avulso: multiplo, dias_funcionamento: form.dias, dias_ilimitado: form.ilimitado, ativa: form.ativa,
    }).eq("id", u.id);
    setSalvando(false);
    if (error) return void toast.error("Erro ao salvar");
    toast.success(`Regras da ${form.nome.trim()} salvas`, { description: "Valem para os próximos fechamentos e recálculos." });
    qc.invalidateQueries({ queryKey: ["unidades"] });
  };
  const copiar = () => navigator.clipboard?.writeText(link).then(() => toast.success("Link copiado"));

  return (
    <Secao titulo={`Unidade ${u.nome}`}>
      <div className="flex items-center gap-2 rounded-xl bg-muted/60 p-3 text-sm">
        <span className="min-w-0 flex-1 truncate">Link do caixa: <b className="tabular">{link}</b></span>
        <Button size="sm" variant="ghost" onClick={copiar} aria-label="Copiar link"><Copy className="size-4" /></Button>
      </div>
      <label className="block space-y-1 text-sm"><span className="text-muted-foreground">Nome</span><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></label>
      <div className="grid grid-cols-2 gap-3">
        <CampoReais rotulo="Valor do plano (por serviço)" valor={form.plano} onChange={(plano) => setForm({ ...form, plano })} />
        <CampoReais rotulo="Avulso deve ser múltiplo de" valor={form.multiplo} onChange={(multiplo) => setForm({ ...form, multiplo })} />
      </div>
      <SeletorDias rotulo="Dias de funcionamento" valor={form.dias} onChange={(dias) => setForm({ ...form, dias })} />
      <SeletorDias rotulo="Dias em que o ilimitado (R$ 0,01) vale" valor={form.ilimitado} onChange={(ilimitado) => setForm({ ...form, ilimitado })} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1 text-sm"><span className="text-muted-foreground">Horário limite do envio</span><Input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} /></label>
        <label className="block space-y-1 text-sm"><span className="text-muted-foreground">Início da forma "Assinatura"</span><Input type="date" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} /></label>
      </div>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Unidade ativa<span className="block text-xs text-muted-foreground">Inativa: o link do caixa para de funcionar.</span></span>
        <Switch checked={form.ativa} onCheckedChange={(ativa) => setForm({ ...form, ativa })} aria-label="Unidade ativa" />
      </label>
      <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar regras"}</Button>
    </Secao>
  );
}

function CampoReais({ rotulo, valor, onChange }: { rotulo: string; valor: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
        <Input inputMode="decimal" className="pl-9" value={valor} onChange={(e) => onChange(e.target.value.replace(/[^\d,.]/g, ""))} />
      </div>
    </label>
  );
}

function NovaUnidade() {
  const qc = useQueryClient();
  const { escolher } = useUnidadeAtual();
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoValido(codigo)) {
      return void toast.error(CODIGOS_RESERVADOS.includes(codigo) ? "Esse código já é usado pelo app. Escolha outro." : "Código: 2 a 30 letras minúsculas, números ou hífen.");
    }
    const { error } = await supabase.from("unidades").insert({ nome: nome.trim(), codigo });
    if (error) return void toast.error(error.code === "23505" ? "Já existe uma unidade com esse código ou nome." : "Erro ao criar a unidade");
    toast.success(`Unidade ${nome.trim()} criada`, { description: "Começa com as regras padrão; ajuste acima." });
    await qc.invalidateQueries({ queryKey: ["unidades"] });
    escolher(codigo);
    setNome(""); setCodigo("");
  };
  return (
    <Secao titulo="Nova unidade">
      <form onSubmit={criar} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input placeholder="Nome (ex.: Studio 302)" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <Input placeholder="Código do link (ex.: studio302)" value={codigo} onChange={(e) => setCodigo(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} required />
        <Button type="submit">Criar</Button>
      </form>
      <p className="text-xs text-muted-foreground">O código vira o endereço do caixa: /{codigo || "codigo"}</p>
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
  const { unidades, unidade: atual } = useUnidadeAtual();
  const [novo, setNovo] = useState({ nome: "", telefone: "", pin: "", papel: "funcionario" as "funcionario" | "dono", unidade_id: "" });
  const unidadeNova = novo.unidade_id || atual?.id || "";
  const nomeUnidade = (id: string | null) => unidades.find((x) => x.id === id)?.nome ?? "sem unidade";
  const [salvando, setSalvando] = useState(false);

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinValido(novo.pin)) return void toast.error("PIN deve ter 4 dígitos");
    setSalvando(true);
    try {
      await criarUsuario({ data: { nome: novo.nome, telefone: novo.telefone, pin: novo.pin, papel: novo.papel, ...(unidadeNova ? { unidade_id: unidadeNova } : {}) } });
      toast.success(`Usuário criado na unidade ${nomeUnidade(unidadeNova)}`);
      setNovo({ nome: "", telefone: "", pin: "", papel: "funcionario", unidade_id: "" });
      qc.invalidateQueries({ queryKey: ["usuarios"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro"); }
    finally { setSalvando(false); }
  };
  const alterar = async (id: string, d: { ativo?: boolean; pin?: string; unidade_id?: string }) => {
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
              <select aria-label={`Unidade de ${x.nome}`} value={x.unidade_id ?? ""} onChange={(e) => e.target.value && alterar(x.id, { unidade_id: e.target.value })}
                className="mt-1 h-7 rounded-md border border-input bg-card px-2 text-xs">
                {!x.unidade_id && <option value="">sem unidade</option>}
                {unidades.map((un) => <option key={un.id} value={un.id}>{un.nome}</option>)}
              </select>
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
        <Input placeholder="Telefone" type="tel" inputMode="tel" maxLength={20} value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: formatarTelefone(e.target.value) })} required />
        <Input placeholder="PIN (4 dígitos)" inputMode="numeric" maxLength={4} value={novo.pin} onChange={(e) => setNovo({ ...novo, pin: e.target.value.replace(/\D/g, "") })} required />
        <select className="h-9 rounded-md border border-input bg-card px-3 text-sm" value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value as "funcionario" | "dono" })}>
          <option value="funcionario">Funcionário</option><option value="dono">Dono</option>
        </select>
        <select aria-label="Unidade do novo usuário" className="h-9 rounded-md border border-input bg-card px-3 text-sm sm:col-span-2" value={unidadeNova} onChange={(e) => setNovo({ ...novo, unidade_id: e.target.value })}>
          {unidades.map((un) => <option key={un.id} value={un.id}>Unidade {un.nome}</option>)}
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
    // Um feriado vale para todas as unidades: recalcula os fechamentos de todas naquele dia.
    const { data: fs } = await supabase.from("fechamentos").select("id").eq("data", d);
    await Promise.all((fs ?? []).map((f) => recalcularAlertas({ data: { id: f.id } })));
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
