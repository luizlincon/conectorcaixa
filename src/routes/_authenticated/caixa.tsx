import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Check, ChevronLeft, Loader2, LogOut, RotateCcw, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DICA, TITULO_ERRO, type ChecagemFoto, type TipoFoto } from "@/lib/checagem-foto";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Marca } from "@/components/Marca";
import { sair, useSessao } from "@/hooks/use-sessao";
import { brl, dataBR, DIAS, hojeSP, horaSP, parseBRL } from "@/lib/formato";
import { diaSemana } from "@/lib/regras";
import { comprimirFoto } from "@/lib/imagem";
import { conferirFoto, enviarFechamento } from "@/lib/caixa.functions";
import { podeOperarCaixa, podeVerMeses } from "@/lib/permissoes";
import { useUnidadeAtual, type UnidadePublica } from "@/lib/unidades";

export const Route = createFileRoute("/_authenticated/caixa")({
  head: () => ({
    meta: [
      { title: "Fechar caixa · Conferente de Caixa" },
      { name: "description", content: "Envie as fotos e os valores do fechamento do dia." },
      { property: "og:title", content: "Fechar caixa · Conferente de Caixa" },
      { property: "og:description", content: "Envie as fotos e os valores do fechamento do dia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IrParaCaixa,
});

/** O caixa agora fica no endereço da unidade (/scs, /studio302…): /caixa só redireciona. */
function IrParaCaixa() {
  const { data: sessao, isLoading } = useSessao();
  const { unidade: escolhida, isLoading: carregandoUnidades } = useUnidadeAtual();
  const navigate = useNavigate();
  const codigo = sessao?.papel === "dono" ? escolhida?.codigo : sessao?.unidadeCodigo;
  useEffect(() => {
    if (isLoading || carregandoUnidades) return;
    if (codigo) navigate({ to: "/$unidade", params: { unidade: codigo }, replace: true });
  }, [isLoading, carregandoUnidades, codigo, navigate]);
  if (!isLoading && !carregandoUnidades && !codigo) return (
    <main className="mx-auto min-h-screen max-w-md space-y-6 px-5 py-6">
      <Marca />
      <h1 className="text-2xl font-bold">Sem unidade</h1>
      <p className="text-muted-foreground">Seu usuário ainda não está ligado a nenhuma unidade. Fale com o dono.</p>
      <Button variant="outline" onClick={sair}><LogOut /> Sair</Button>
    </main>
  );
  return null;
}

type Foto = { blob: Blob; preview: string; capturadaEm: string; checagem?: ChecagemFoto | "conferindo" | "indisponivel" };
type Etapa = "inicio" | "hub" | "pag" | "valores" | "revisar";

export function Caixa({ unidade }: { unidade: UnidadePublica }) {
  const { data: sessao } = useSessao();
  const qc = useQueryClient();
  const hoje = hojeSP();
  const [etapa, setEtapa] = useState<Etapa>("inicio");
  const [hub, setHub] = useState<Foto | null>(null);
  const [pag, setPag] = useState<Foto | null>(null);
  const [vals, setVals] = useState({ maquina: "", assinatura: "", dinheiro: "" });
  const [enviando, setEnviando] = useState(false);

  const { data: fechamento, isLoading } = useQuery({
    queryKey: ["fechamento-hoje", unidade.id, hoje],
    enabled: podeOperarCaixa(sessao?.papel),
    queryFn: async () => {
      const { data } = await supabase.from("fechamentos").select("status, enviado_em, enviado_por_nome")
        .eq("unidade_id", unidade.id).eq("data", hoje).maybeSingle();
      return data;
    },
  });

  const bloqueado = fechamento && fechamento.status !== "reaberto";

  const enviar = async () => {
    if (!podeOperarCaixa(sessao?.papel)) return void toast.error("Seu usuário não pode fechar o caixa.");
    if (!hub || !pag) return void toast.error("Tire as duas fotos antes de enviar.");
    const maquina = parseBRL(vals.maquina), assinatura = parseBRL(vals.assinatura), dinheiro = parseBRL(vals.dinheiro);
    if (maquina === null || assinatura === null || dinheiro === null) return void toast.error("Preencha os três valores (zero é permitido).");
    setEnviando(true);
    try {
      const fotos = [];
      for (const [tipo, f] of [["hubbarber", hub], ["pagbank", pag]] as const) {
        const path = `${unidade.id}/${hoje}/${tipo}-${Date.now()}.jpg`;
        const { error } = await supabase.storage.from("fotos-caixa").upload(path, f.blob, { contentType: "image/jpeg" });
        if (error) throw new Error("Falha ao enviar a foto. Verifique a internet.");
        fotos.push({ tipo, path, capturada_em: f.capturadaEm });
      }
      await enviarFechamento({
        data: {
          maquina, assinatura, dinheiro, fotos, unidade_id: unidade.id,
        },
      });
      toast.success("Fechamento enviado!");
      await qc.invalidateQueries({ queryKey: ["fechamento-hoje"] });
      setEtapa("inicio");
      setHub(null); setPag(null); setVals({ maquina: "", assinatura: "", dinheiro: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setEnviando(false);
    }
  };

  const voltar: Record<Etapa, Etapa | null> = { inicio: null, hub: "inicio", pag: "hub", valores: "pag", revisar: "valores" };
  const passo = { inicio: 0, hub: 1, pag: 2, valores: 3, revisar: 4 }[etapa];

  if (sessao && !podeOperarCaixa(sessao.papel)) return (
    <main className="mx-auto min-h-screen max-w-md space-y-8 px-5 py-6">
      <header className="flex items-center justify-between"><Marca subtitulo={`Unidade ${unidade.nome}`} /><Button variant="ghost" size="icon" onClick={() => sair(`/${unidade.codigo}`)} aria-label="Sair"><LogOut /></Button></header>
      <h1 className="text-2xl font-bold">Acesso restrito</h1>
      <p className="text-muted-foreground">Seu usuário não tem permissão para operar o caixa.</p>
    </main>
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-8 pt-6">
      <header className="flex items-center justify-between">
        {voltar[etapa] ? (
          <Button variant="ghost" size="sm" onClick={() => { const anterior = voltar[etapa]; if (anterior) setEtapa(anterior); }} className="-ml-2"><ChevronLeft /> Voltar</Button>
        ) : (
          <Marca subtitulo={`Unidade ${unidade.nome}`} />
        )}
        {etapa === "inicio" && (podeVerMeses(sessao?.papel)
          ? <Button variant="ghost" size="icon" asChild><Link to="/painel" aria-label="Voltar ao painel"><ChevronLeft /></Link></Button>
          : <Button variant="ghost" size="icon" onClick={() => sair(`/${unidade.codigo}`)} aria-label="Sair"><LogOut /></Button>)}
        {etapa !== "inicio" && <span className="text-sm text-muted-foreground">Passo {passo} de 4</span>}
      </header>
      {etapa !== "inicio" && (
        <div className="mt-4 grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((i) => <div key={i} className={`h-1.5 rounded-full ${i <= passo ? "bg-accent" : "bg-muted"}`} />)}
        </div>
      )}

      <section className="flex flex-1 flex-col pt-8">
        {etapa === "inicio" && (
          <div className="flex flex-1 flex-col justify-between gap-8">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Olá, {sessao?.nome.split(" ")[0] ?? ""}</p>
              <h1 className="mt-2 text-4xl font-bold capitalize">{DIAS[diaSemana(hoje)]}</h1>
              <p className="text-2xl text-muted-foreground tabular">{dataBR(hoje)}</p>
            </div>
            {isLoading ? null : bloqueado ? (
              <div className="rounded-2xl border border-ok/40 bg-ok-soft p-6 shadow-card">
                <div className="flex items-center gap-3 text-ok"><Check className="size-7" /><span className="font-display text-2xl font-bold">Caixa enviado</span></div>
                <p className="mt-3 text-lg">Enviado às <b className="tabular">{fechamento.enviado_em ? horaSP(fechamento.enviado_em) : "—"}</b> por <b>{fechamento.enviado_por_nome}</b>.</p>
                <p className="mt-2 text-sm text-muted-foreground">Só o dono pode reabrir este fechamento.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {fechamento?.status === "reaberto" && <p className="rounded-xl bg-warn-soft p-3 text-sm">O dono reabriu o fechamento de hoje. Envie novamente.</p>}
                <Button size="lg" className="h-20 w-full text-xl" onClick={() => setEtapa("hub")}>Fechar caixa de hoje</Button>
              </div>
            )}
          </div>
        )}

        {etapa === "hub" && (
          <EtapaFoto tipo="hubbarber" titulo="Foto do HubBarber" dica={'Fotografe o quadro "Entradas por forma" do caixa, com todos os valores legíveis.'}
            foto={hub} setFoto={setHub} onUsar={() => setEtapa("pag")} />
        )}
        {etapa === "pag" && (
          <EtapaFoto tipo="pagbank" titulo="Foto da PagBank" dica="Fotografe o resumo de vendas do dia, mostrando o total e a quantidade."
            foto={pag} setFoto={setPag} onUsar={() => setEtapa("valores")} />
        )}

        {etapa === "valores" && (
          <form className="flex flex-1 flex-col justify-between gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (Object.values(vals).some((v) => parseBRL(v) === null)) { toast.error("Preencha os três valores (zero é permitido)."); return; }
              setEtapa("revisar");
            }}>
            <div className="space-y-6">
              <h1 className="text-3xl font-bold">Valores do dia</h1>
              <CampoValor label="Qual o valor da máquina?" value={vals.maquina} onChange={(v) => setVals({ ...vals, maquina: v })} />
              <CampoValor label="Qual o valor de assinatura?" value={vals.assinatura} onChange={(v) => setVals({ ...vals, assinatura: v })} />
              <CampoValor label="Quanto tem em dinheiro em espécie?" value={vals.dinheiro} onChange={(v) => setVals({ ...vals, dinheiro: v })} />
            </div>
            <Button type="submit" size="lg" className="h-14 w-full text-base">Revisar</Button>
          </form>
        )}

        {etapa === "revisar" && hub && pag && (
          <div className="flex flex-1 flex-col justify-between gap-6">
            <div className="space-y-5">
              <h1 className="text-3xl font-bold">Revisar e enviar</h1>
              <div className="grid grid-cols-2 gap-3">
                {[["HubBarber", hub], ["PagBank", pag]].map(([n, f]) => (
                  <figure key={n as string} className="overflow-hidden rounded-xl border bg-card">
                    <img src={(f as Foto).preview} alt={`Foto ${n}`} className="aspect-[3/4] w-full object-cover" />
                    <figcaption className="px-3 py-2 text-xs text-muted-foreground">{n as string} · {horaSP((f as Foto).capturadaEm)}</figcaption>
                  </figure>
                ))}
              </div>
              <dl className="divide-y rounded-xl border bg-card">
                {[["Máquina", vals.maquina], ["Assinatura", vals.assinatura], ["Dinheiro", vals.dinheiro]].map(([k, v]) => (
                  <div key={k} className="flex justify-between px-4 py-3"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold tabular">{brl(parseBRL(v ?? ""))}</dd></div>
                ))}
              </dl>
              <p className="text-sm text-muted-foreground">Depois de enviar, o fechamento fica bloqueado.</p>
            </div>
            <Button size="lg" className="h-14 w-full text-base" onClick={enviar} disabled={enviando}>
              {enviando ? "Enviando e conferindo…" : "Enviar fechamento"}
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}

function CampoValor({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-2">
      <span className="font-medium">{label}</span>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
        <Input inputMode="decimal" placeholder="0,00" value={value} required
          onChange={(e) => onChange(e.target.value.replace(/[^\d,.]/g, ""))} className="h-14 pl-12 text-xl tabular" />
      </div>
    </label>
  );
}

function blobParaBase64(blob: Blob) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

const DICAS_FOTO = ["Fotografe de frente, com a tela ocupando quase toda a foto", "Evite reflexo de luz em cima dos números", "Segure firme e toque na tela do celular para focar"];

export function EtapaFoto({ tipo, titulo, dica, foto, setFoto, onUsar }: {
  tipo: TipoFoto; titulo: string; dica: string; foto: Foto | null;
  setFoto: React.Dispatch<React.SetStateAction<Foto | null>>; onUsar: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const tentativa = useRef(0);
  const [processando, setProcessando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const preview = foto?.preview;
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const abrir = () => { setModalAberto(false); if (ref.current) { ref.current.value = ""; ref.current.click(); } };

  const conferir = async (blob: Blob, id: number) => {
    let checagem: Foto["checagem"];
    try {
      checagem = await conferirFoto({ data: { tipo, imagem: await blobParaBase64(blob) } });
    } catch {
      checagem = "indisponivel";
    }
    if (id !== tentativa.current) return; // já tirou outra foto
    setFoto((f) => (f ? { ...f, checagem } : f));
    if (checagem !== "indisponivel" && !checagem.ok) setModalAberto(true);
  };

  const aoCapturar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const capturadaEm = new Date().toISOString();
    const id = ++tentativa.current;
    setProcessando(true);
    try {
      const blob = await comprimirFoto(file);
      // Só a foto do HubBarber passa pela checagem; a da PagBank segue direto.
      const confere = tipo === "hubbarber";
      setFoto({ blob, preview: URL.createObjectURL(blob), capturadaEm, ...(confere ? { checagem: "conferindo" as const } : {}) });
      if (confere) void conferir(blob, id);
    } catch {
      toast.error("Não foi possível processar a foto. Tente de novo.");
    } finally {
      setProcessando(false);
    }
  };

  const checagem = foto?.checagem;
  const erro = checagem && typeof checagem === "object" && !checagem.ok && checagem.problema ? DICA[checagem.problema] : null;

  return (
    <div className="flex flex-1 flex-col justify-between gap-6">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">{titulo}</h1>
        <p className="text-muted-foreground">{dica}</p>
        {/* capture="environment" abre direto a câmera traseira, sem galeria */}
        <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={aoCapturar} />
        {foto ? (
          <>
            <img src={foto.preview} alt={titulo} className="max-h-[50vh] w-full rounded-2xl border object-contain bg-card shadow-card" />
            <StatusChecagem checagem={checagem} tipo={tipo} onVerDica={() => setModalAberto(true)} />
          </>
        ) : (
          <>
            <button type="button" onClick={abrir} disabled={processando}
              className="flex aspect-[3/4] max-h-[45vh] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-input bg-card text-muted-foreground">
              <Camera className="size-12" />
              <span className="font-semibold">{processando ? "Processando…" : "Abrir câmera"}</span>
            </button>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {DICAS_FOTO.map((d) => <li key={d} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ok" />{d}</li>)}
            </ul>
          </>
        )}
      </div>
      {foto && (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" size="lg" className="h-14" onClick={abrir}><RotateCcw /> Tirar de novo</Button>
          <Button size="lg" className="h-14" onClick={onUsar} disabled={checagem === "conferindo"}>
            {checagem === "conferindo" ? <><Loader2 className="animate-spin" /> Conferindo…</> : <><Check /> Usar foto</>}
          </Button>
        </div>
      )}

      <Dialog open={modalAberto && !!erro} onOpenChange={setModalAberto}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-2xl">
          <DialogHeader className="items-center text-center sm:text-center">
            <div className="mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive"><XCircle className="size-8" /></div>
            <DialogTitle className="text-xl">{TITULO_ERRO[tipo]}</DialogTitle>
            <DialogDescription className="text-base">{erro?.motivo}</DialogDescription>
          </DialogHeader>
          <p className="rounded-xl bg-warn-soft p-3 text-sm"><b>Dica:</b> {erro?.dica}</p>
          <DialogFooter className="gap-2 sm:flex-col sm:space-x-0">
            <Button size="lg" className="h-12 w-full" onClick={abrir}><Camera /> Tirar outra foto</Button>
            <Button variant="ghost" size="lg" className="h-12 w-full" onClick={() => { setModalAberto(false); onUsar(); }}>Usar assim mesmo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusChecagem({ checagem, tipo, onVerDica }: { checagem: Foto["checagem"]; tipo: TipoFoto; onVerDica: () => void }) {
  if (checagem === "conferindo") return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Conferindo se dá para ler os números…</p>;
  if (checagem === "indisponivel") return <p className="text-sm text-muted-foreground">Não deu para conferir a foto agora. Confira se os números estão nítidos antes de usar.</p>;
  if (checagem?.ok) return <p className="flex items-center gap-2 text-sm font-medium text-ok"><Check className="size-4" /> Números encontrados. Foto boa!</p>;
  if (checagem) return (
    <button type="button" onClick={onVerDica} className="flex w-full items-center gap-2 rounded-xl bg-destructive/10 p-3 text-left text-sm font-medium text-destructive">
      <XCircle className="size-4 shrink-0" /> {TITULO_ERRO[tipo]}. Toque para ver a dica.
    </button>
  );
  return null;
}
