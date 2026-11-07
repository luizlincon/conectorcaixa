import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { statusInfo, StatusSelo, type StatusCal } from "@/components/StatusSelo";
import { agoraHHMM, brl, dataBR, hojeSP, MESES } from "@/lib/formato";
import { fechamentosPeriodoQuery, feriadosQuery, iso, ultimoDiaMes, unidadeQuery } from "@/lib/dados-dono";
import { diaSemana, statusDoDia, type Nivel } from "@/lib/regras";

export const Route = createFileRoute("/_authenticated/painel/")({ component: Calendario });

function Calendario() {
  const hoje = hojeSP();
  const [ano, setAno] = useState(Number(hoje.slice(0, 4)));
  const [mes, setMes] = useState(Number(hoje.slice(5, 7)) - 1);
  const ult = ultimoDiaMes(ano, mes);
  const de = iso(ano, mes, 1), ate = iso(ano, mes, ult);
  const { data } = useQuery(fechamentosPeriodoQuery(de, ate));
  const { data: feriados = [] } = useQuery(feriadosQuery);
  const { data: unidade } = useQuery(unidadeQuery);
  const listaFeriados = feriados.map((f) => f.data);

  const mudar = (d: number) => {
    const m = mes + d;
    setAno(ano + Math.floor(m / 12));
    setMes(((m % 12) + 12) % 12);
  };

  const dias = Array.from({ length: ult }, (_, i) => {
    const d = iso(ano, mes, i + 1);
    const f = data?.fechamentos.find((x) => x.data === d && x.status === "enviado");
    const niveis = (data?.alertas ?? []).filter((a) => a.data === d && !a.resolvido).map((a) => a.nivel as Nivel);
    const status = statusDoDia({
      data: d, hoje, agoraHHMM: agoraHHMM(), horarioLimite: unidade?.horario_limite ?? "20:00",
      feriados: listaFeriados, enviado: !!f, niveisAbertos: niveis,
    }) as StatusCal;
    return { d, dia: i + 1, status, f };
  });

  const enviados = data?.fechamentos.filter((f) => f.status === "enviado") ?? [];
  const avulso = enviados.reduce((s, f) => s + Number(f.valor_maquina) + Number(f.valor_dinheiro), 0);
  const assinatura = enviados.reduce((s, f) => s + Number(f.valor_assinatura), 0);
  const abertos = (data?.alertas ?? []).filter((a) => !a.resolvido);
  const vermelhos = abertos.filter((a) => a.nivel === "vermelho").length;
  const naoEnviados = dias.filter((d) => d.status === "nao_enviado").length;
  const offset = diaSemana(de);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => mudar(-1)} aria-label="Mês anterior"><ChevronLeft /></Button>
        <h1 className="text-2xl font-bold capitalize">{MESES[mes]} <span className="text-muted-foreground">{ano}</span></h1>
        <Button variant="ghost" size="icon" onClick={() => mudar(1)} aria-label="Próximo mês"><ChevronRight /></Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi rotulo="Faturamento" valor={brl(avulso + assinatura)} destaque />
        <Kpi rotulo="Avulso" valor={brl(avulso)} />
        <Kpi rotulo="Assinatura" valor={brl(assinatura)} />
        <Kpi rotulo="Alertas abertos" valor={`${abertos.length}`} extra={vermelhos ? `${vermelhos} vermelho(s)` : naoEnviados ? `${naoEnviados} dia(s) sem envio` : undefined} />
      </div>

      <div className="rounded-2xl border bg-card p-3 shadow-card">
        <div className="grid grid-cols-7 pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((l, i) => <span key={i}>{l}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: offset }).map((_, i) => <div key={`v${i}`} />)}
          {dias.map(({ d, dia, status }) => {
            const info = statusInfo[status];
            const conteudo = (
              <>
                <span className={`text-sm font-semibold tabular ${d === hoje ? "underline decoration-accent decoration-2 underline-offset-4" : ""}`}>{dia}</span>
                <span className={`mt-1 size-2 rounded-full ${info.dot}`} />
              </>
            );
            const cls = `flex aspect-square flex-col items-center justify-center rounded-xl border ${info.cls}`;
            return status === "sem_expediente" || status === "futuro" ? (
              <div key={d} className={cls} title={info.rotulo}>{conteudo}</div>
            ) : (
              <Link key={d} to="/painel/dia/$data" params={{ data: d }} className={`${cls} transition-transform active:scale-95`} title={info.rotulo}>{conteudo}</Link>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["verde", "amarelo", "vermelho", "nao_enviado"] as const).map((s) => <StatusSelo key={s} status={s} />)}
        </div>
      </div>

      {abertos.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-bold">Dias com alerta</h2>
          {dias.filter((x) => x.status === "vermelho" || x.status === "amarelo").map((x) => (
            <Link key={x.d} to="/painel/dia/$data" params={{ data: x.d }} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
              <span className="font-semibold tabular">{dataBR(x.d)}</span>
              <StatusSelo status={x.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({ rotulo, valor, destaque, extra }: { rotulo: string; valor: string; destaque?: boolean; extra?: string | undefined }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-card ${destaque ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <p className={`text-xs uppercase tracking-wider ${destaque ? "opacity-70" : "text-muted-foreground"}`}>{rotulo}</p>
      <p className="mt-1 font-display text-xl font-bold tabular">{valor}</p>
      {extra && <p className="mt-0.5 text-xs text-danger">{extra}</p>}
    </div>
  );
}
