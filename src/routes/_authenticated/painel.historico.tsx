import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, dataBR, hojeSP, MESES } from "@/lib/formato";
import { fechamentosPeriodoQuery } from "@/lib/dados-dono";
import { useUnidadeAtual } from "@/lib/unidades";

export const Route = createFileRoute("/_authenticated/painel/historico")({
  head: () => ({ meta: [
    { title: "Histórico de faturamento · Conferente de Caixa" },
    { name: "description", content: "Faturamento por dia, semana e mês de cada unidade da Navalha da Corte." },
    { property: "og:title", content: "Histórico de faturamento · Conferente de Caixa" },
    { property: "og:description", content: "Faturamento por dia, semana e mês de cada unidade da Navalha da Corte." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Historico,
});

type Agrup = "dia" | "semana" | "mes";

function inicioSemana(d: string) {
  const [y = 0, m = 1, dd = 1] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd));
  const dow = (dt.getUTCDay() + 6) % 7; // segunda = 0
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}

function Historico() {
  const hoje = hojeSP();
  const [agrup, setAgrup] = useState<Agrup>("dia");
  const de = (() => { const [y = 0, m = 1] = hoje.split("-").map(Number); const d = new Date(Date.UTC(y, m - 12, 1)); return d.toISOString().slice(0, 10); })();
  const { unidade } = useUnidadeAtual();
  const { data } = useQuery(fechamentosPeriodoQuery(unidade?.id, de, hoje));
  const enviados = (data?.fechamentos ?? []).filter((f) => f.status === "enviado");

  const grupos = new Map<string, { avulso: number; assinatura: number; dias: number }>();
  for (const f of enviados) {
    const k = agrup === "dia" ? f.data : agrup === "semana" ? inicioSemana(f.data) : f.data.slice(0, 7);
    const g = grupos.get(k) ?? { avulso: 0, assinatura: 0, dias: 0 };
    g.avulso += Number(f.valor_maquina) + Number(f.valor_dinheiro);
    g.assinatura += Number(f.valor_assinatura);
    g.dias++;
    grupos.set(k, g);
  }
  const linhas = [...grupos.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const max = Math.max(1, ...linhas.map(([, g]) => g.avulso + g.assinatura));
  const rotulo = (k: string) => agrup === "dia" ? dataBR(k) : agrup === "semana" ? `Semana de ${dataBR(k)}` : `${MESES[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Histórico de faturamento</h1>
      <Tabs value={agrup} onValueChange={(v) => setAgrup(v as Agrup)}>
        <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="dia">Dia</TabsTrigger><TabsTrigger value="semana">Semana</TabsTrigger><TabsTrigger value="mes">Mês</TabsTrigger></TabsList>
      </Tabs>
      {linhas.length === 0 && <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">Ainda não há fechamentos enviados.</p>}
      <div className="space-y-2">
        {linhas.map(([k, g]) => {
          const total = g.avulso + g.assinatura;
          return (
            <div key={k} className="rounded-xl border bg-card p-4 shadow-card">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold capitalize">{rotulo(k)}</span>
                <span className="font-display text-lg font-bold tabular">{brl(total)}</span>
              </div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted" style={{ width: `${(total / max) * 100}%` }}>
                <div className="bg-primary" style={{ width: `${total ? (g.avulso / total) * 100 : 0}%` }} />
                <div className="bg-accent flex-1" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground tabular">Avulso {brl(g.avulso)} · Assinatura {brl(g.assinatura)}{agrup !== "dia" && ` · ${g.dias} dia(s)`}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
