import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusSelo } from "@/components/StatusSelo";
import { brl, dataBR, dataHoraSP, DIAS, parseBRL } from "@/lib/formato";
import { avaliar, diaSemana, type LeituraHub, type LeituraPag } from "@/lib/regras";
import { feriadosQuery, unidadeQuery } from "@/lib/dados-dono";
import { corrigirLeitura, lerNovamente, reabrirFechamento } from "@/lib/caixa.functions";
import { useSessao } from "@/hooks/use-sessao";

export const Route = createFileRoute("/_authenticated/painel/dia/$data")({ component: Detalhe });

function Detalhe() {
  const { data: dia } = Route.useParams();
  const qc = useQueryClient();
  const { data: sessao } = useSessao();
  const { data: feriados = [] } = useQuery(feriadosQuery);
  const { data: unidade } = useQuery(unidadeQuery);
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState(false);

  const q = useQuery({
    queryKey: ["dia", dia],
    queryFn: async () => {
      const { data: f } = await supabase.from("fechamentos").select("*").eq("data", dia).maybeSingle();
      if (!f) return null;
      const [{ data: fotos }, { data: alertas }] = await Promise.all([
        supabase.from("fotos").select("*").eq("fechamento_id", f.id).order("created_at", { ascending: false }),
        supabase.from("alertas").select("*").eq("fechamento_id", f.id).order("nivel", { ascending: false }),
      ]);
      const urls: Record<string, string> = {};
      for (const ft of fotos ?? []) {
        const { data } = await supabase.storage.from("fotos-caixa").createSignedUrl(ft.path, 3600);
        if (data) urls[ft.id] = data.signedUrl;
      }
      return { f, fotos: fotos ?? [], alertas: alertas ?? [], urls };
    },
  });

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["dia", dia] });
    qc.invalidateQueries({ queryKey: ["fechamentos"] });
  };
  const acao = async (fn: () => Promise<unknown>, ok: string) => {
    setOcupado(true);
    try { await fn(); toast.success(ok); atualizar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setOcupado(false); }
  };

  const cab = (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" asChild><Link to="/painel" aria-label="Voltar"><ChevronLeft /></Link></Button>
      <div>
        <h1 className="text-2xl font-bold tabular">{dataBR(dia)}</h1>
        <p className="text-sm capitalize text-muted-foreground">{DIAS[diaSemana(dia)]}</p>
      </div>
    </div>
  );

  if (q.isLoading) return cab;
  if (!q.data) return <div className="space-y-6">{cab}<p className="rounded-2xl border bg-pending-soft p-6 text-center">Nenhum fechamento enviado neste dia.</p></div>;

  const { f, fotos, alertas, urls } = q.data;
  const hub = (f.leitura_hub as LeituraHub | null) ?? null;
  const pag = (f.leitura_pag as LeituraPag | null) ?? null;
  const r = avaliar({
    data: f.data, maquina: Number(f.valor_maquina), assinatura: Number(f.valor_assinatura), dinheiro: Number(f.valor_dinheiro),
    hub, pag, feriados: feriados.map((x) => x.data), dataInicioAssinatura: unidade?.data_inicio_assinatura ?? "2026-11-09",
  });
  const abertos = alertas.filter((a) => !a.resolvido);
  const status = f.status !== "enviado" ? null : abertos.some((a) => a.nivel === "vermelho") ? "vermelho" : abertos.length ? "amarelo" : "verde";
  const ent = hub?.entradas ?? {};
  const saidasDin = (hub?.saidas ?? []).filter((s) => (s.forma ?? "").toLowerCase().includes("dinheiro")).reduce((a, s) => a + (s.valor ?? 0), 0);
  const cartoes = ent.credito == null && ent.debito == null && ent.pix == null ? null : (ent.credito ?? 0) + (ent.debito ?? 0) + (ent.pix ?? 0);
  const ultFotos = ["hubbarber", "pagbank"].map((t) => fotos.find((x) => x.tipo === t)).filter(Boolean) as typeof fotos;
  const versoes = (f.versoes as unknown[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">{cab}{status ? <StatusSelo status={status} /> : <span className="rounded-full bg-warn-soft px-3 py-1 text-xs font-semibold">Reaberto</span>}</div>

      <p className="text-sm text-muted-foreground">
        Enviado por <b className="text-foreground">{f.enviado_por_nome}</b> em {f.enviado_em ? dataHoraSP(f.enviado_em) : "—"}
        {f.corrigido_por_nome && <> · Leitura corrigida por <b className="text-foreground">{f.corrigido_por_nome}</b> em {dataHoraSP(f.corrigido_em!)}</>}
        {versoes.length > 0 && <> · {versoes.length} versão(ões) anterior(es) guardada(s)</>}
      </p>

      {f.leitura_status !== "lido" && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-warn/50 bg-warn-soft p-4 text-sm">
          <span>{f.leitura_status === "erro" ? "A leitura das fotos falhou." : "Leitura das fotos pendente."}</span>
          <Button size="sm" disabled={ocupado} onClick={() => acao(() => lerNovamente({ data: { id: f.id } }), "Fotos lidas novamente")}>Ler fotos</Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {ultFotos.map((ft) => (
          <button key={ft.id} onClick={() => setAmpliada(urls[ft.id])} className="overflow-hidden rounded-xl border bg-card text-left">
            {urls[ft.id] && <img src={urls[ft.id]} alt={ft.tipo} className="aspect-[3/4] w-full object-cover" />}
            <p className="px-3 py-2 text-xs text-muted-foreground">{ft.tipo === "hubbarber" ? "HubBarber" : "PagBank"} · capturada {ft.capturada_em ? dataHoraSP(ft.capturada_em) : "—"}</p>
          </button>
        ))}
      </div>

      <section className="rounded-2xl border bg-card shadow-card">
        <h2 className="border-b px-4 py-3 text-lg font-bold">Digitado × lido</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-4 py-2">Item</th><th className="px-2 py-2 text-right">Digitado</th><th className="px-4 py-2 text-right">Lido</th></tr></thead>
          <tbody className="divide-y tabular">
            <Linha item="Máquina" dig={Number(f.valor_maquina)} lido={`PagBank ${brl(pag?.total_vendido)} (${pag?.quantidade_vendas ?? "?"} vendas) · Hub ${brl(cartoes)}`} ok={r.maquinaConferida} />
            <Linha item="Dinheiro" dig={Number(f.valor_dinheiro)} lido={`${brl(ent.dinheiro)} − saídas ${brl(saidasDin)}`} ok={r.dinheiroConferido} />
            <Linha item="Assinatura" dig={Number(f.valor_assinatura)} lido={brl(r.assinaturaLida)} ok={r.assinaturaLida !== null && Math.round(r.assinaturaLida * 100) === Math.round(Number(f.valor_assinatura) * 100)} />
          </tbody>
        </table>
        <div className="grid grid-cols-3 border-t text-center">
          <Mini rotulo="Serviços do plano" valor={r.servicosPlano ?? "—"} />
          <Mini rotulo="Ilimitados" valor={r.ilimitados ?? "—"} />
          <Mini rotulo="Avulso" valor={brl(r.avulso)} />
        </div>
      </section>

      {hub && (
        <section className="rounded-2xl border bg-card p-4 text-sm shadow-card">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Leitura do HubBarber</h2>
            <Button size="sm" variant="outline" onClick={() => setEditando(true)}>Corrigir valores</Button></div>
          <p className="mt-1 text-muted-foreground">Caixa {hub.numero_caixa ?? "não identificado"} · {hub.status ?? "—"} · abertura {hub.abertura ?? "não identificado"} · fechamento {hub.fechamento ?? "não identificado"}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 tabular">
            {([["Dinheiro", ent.dinheiro], ["Crédito", ent.credito], ["Débito", ent.debito], ["PIX", ent.pix], ["Assinatura", ent.assinatura], ["Outro", ent.outro], ["Valor inicial", hub.valor_inicial], ["Total", hub.total]] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd>{brl(v)}</dd></div>
            ))}
          </dl>
          {(hub.saidas?.length ?? 0) > 0 && (<><h3 className="mt-4 font-semibold">Saídas</h3>
            {hub.saidas!.map((s, i) => <p key={i} className="flex justify-between"><span>{s.forma ?? "?"} · {s.descricao ?? <i className="text-warn">sem descrição</i>}</span><span className="tabular">{brl(s.valor)}</span></p>)}</>)}
          {(hub.lancamentos?.length ?? 0) > 0 && (<><h3 className="mt-4 font-semibold">Lançamentos ({hub.lancamentos!.length})</h3>
            <div className="mt-1 max-h-56 space-y-0.5 overflow-auto">{hub.lancamentos!.map((l, i) => <p key={i} className="flex justify-between gap-2 text-xs"><span className="truncate">{l.hora} · #{l.comanda} · {l.cliente} · {l.forma}</span><span className="tabular">{brl(l.valor)}</span></p>)}</div></>)}
          {(hub.nao_identificados?.length ?? 0) > 0 && <p className="mt-3 text-xs text-muted-foreground">Não identificado: {hub.nao_identificados!.join(", ")}</p>}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Alertas</h2>
        {alertas.length === 0 && <p className="rounded-xl bg-ok-soft p-4 text-sm text-ok">Nenhum alerta. Tudo conferido.</p>}
        {alertas.map((a) => <AlertaItem key={a.id} a={a} nome={sessao?.nome ?? "Dono"} onFeito={atualizar} />)}
      </section>

      {f.status === "enviado" && (
        <Button variant="outline" className="w-full" disabled={ocupado}
          onClick={() => confirm("Reabrir o fechamento? O funcionário poderá enviar de novo (somente no mesmo dia) e a versão atual fica guardada.") && acao(() => reabrirFechamento({ data: { id: f.id } }), "Fechamento reaberto")}>
          Reabrir fechamento
        </Button>
      )}

      <Dialog open={!!ampliada} onOpenChange={() => setAmpliada(null)}>
        <DialogContent className="max-w-3xl p-2"><DialogHeader className="sr-only"><DialogTitle>Foto</DialogTitle></DialogHeader>{ampliada && <img src={ampliada} alt="Foto ampliada" className="max-h-[85vh] w-full object-contain" />}</DialogContent>
      </Dialog>
      {editando && <Correcao id={f.id} hub={hub} pag={pag} onFechar={() => setEditando(false)} onSalvo={atualizar} />}
    </div>
  );
}

function Linha({ item, dig, lido, ok }: { item: string; dig: number; lido: string; ok: boolean }) {
  return (
    <tr>
      <td className="px-4 py-3 font-medium"><span className="inline-flex items-center gap-1.5">{ok ? <Check className="size-4 text-ok" /> : <X className="size-4 text-danger" />}{item}</span></td>
      <td className="px-2 py-3 text-right font-semibold">{brl(dig)}</td>
      <td className="px-4 py-3 text-right text-xs text-muted-foreground">{lido}</td>
    </tr>
  );
}
function Mini({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return <div className="px-2 py-3"><p className="font-display text-xl font-bold tabular">{valor}</p><p className="text-[11px] uppercase tracking-wider text-muted-foreground">{rotulo}</p></div>;
}

function AlertaItem({ a, nome, onFeito }: { a: { id: string; nivel: string; mensagem: string; resolvido: boolean; observacao: string | null; resolvido_por_nome: string | null; resolvido_em: string | null }; nome: string; onFeito: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [obs, setObs] = useState("");
  const resolver = async () => {
    const { error } = await supabase.from("alertas").update({ resolvido: true, observacao: obs || null, resolvido_por_nome: nome, resolvido_em: new Date().toISOString() }).eq("id", a.id);
    if (error) return toast.error("Erro ao resolver");
    toast.success("Alerta resolvido");
    onFeito();
  };
  const cor = a.nivel === "vermelho" ? "border-danger/40 bg-danger-soft" : "border-warn/50 bg-warn-soft";
  return (
    <div className={`rounded-xl border p-4 text-sm ${a.resolvido ? "bg-card opacity-60" : cor}`}>
      <p className={a.resolvido ? "line-through" : ""}>{a.mensagem}</p>
      {a.resolvido ? (
        <p className="mt-2 text-xs text-muted-foreground">Resolvido por {a.resolvido_por_nome} em {a.resolvido_em && dataHoraSP(a.resolvido_em)}{a.observacao && ` — “${a.observacao}”`}</p>
      ) : aberto ? (
        <div className="mt-3 space-y-2">
          <Textarea placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} className="bg-card" />
          <div className="flex gap-2"><Button size="sm" onClick={resolver}>Confirmar</Button><Button size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button></div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="mt-3 bg-card" onClick={() => setAberto(true)}>Resolver</Button>
      )}
    </div>
  );
}

function Correcao({ id, hub, pag, onFechar, onSalvo }: { id: string; hub: LeituraHub | null; pag: LeituraPag | null; onFechar: () => void; onSalvo: () => void }) {
  const e = hub?.entradas ?? {};
  const s = (v: number | null | undefined) => (v == null ? "" : String(v).replace(".", ","));
  const [v, setV] = useState({
    dinheiro: s(e.dinheiro), credito: s(e.credito), debito: s(e.debito), pix: s(e.pix), assinatura: s(e.assinatura), outro: s(e.outro),
    pag_total: s(pag?.total_vendido), pag_qtd: pag?.quantidade_vendas == null ? "" : String(pag.quantidade_vendas),
  });
  const [salvando, setSalvando] = useState(false);
  const campos: [keyof typeof v, string][] = [["dinheiro", "Dinheiro"], ["credito", "Crédito"], ["debito", "Débito"], ["pix", "PIX"], ["assinatura", "Assinatura"], ["outro", "Outro"], ["pag_total", "PagBank total"], ["pag_qtd", "PagBank qtd. vendas"]];
  const salvar = async () => {
    setSalvando(true);
    try {
      await corrigirLeitura({ data: {
        id,
        entradas: { dinheiro: parseBRL(v.dinheiro), credito: parseBRL(v.credito), debito: parseBRL(v.debito), pix: parseBRL(v.pix), assinatura: parseBRL(v.assinatura), outro: parseBRL(v.outro) },
        pag_total: parseBRL(v.pag_total), pag_qtd: v.pag_qtd ? parseInt(v.pag_qtd) : null,
      } });
      toast.success("Valores corrigidos e alertas recalculados");
      onSalvo(); onFechar();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro"); }
    finally { setSalvando(false); }
  };
  return (
    <Dialog open onOpenChange={onFechar}>
      <DialogContent>
        <DialogHeader><DialogTitle>Corrigir valores lidos</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {campos.map(([k, l]) => (
            <label key={k} className="space-y-1 text-sm"><span className="text-muted-foreground">{l}</span>
              <Input inputMode="decimal" value={v[k]} placeholder="não identificado" onChange={(ev) => setV({ ...v, [k]: ev.target.value })} /></label>
          ))}
        </div>
        <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar e recalcular"}</Button>
      </DialogContent>
    </Dialog>
  );
}
