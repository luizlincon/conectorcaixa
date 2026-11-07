import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Building2, CalendarDays, LineChart, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Marca } from "@/components/Marca";
import { sair, useSessao } from "@/hooks/use-sessao";
import { podeVerMeses } from "@/lib/permissoes";
import { useUnidadeAtual } from "@/lib/unidades";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel do dono · Conferente de Caixa" },
      { name: "description", content: "Calendário de fechamentos, alertas e faturamento de cada unidade." },
      { property: "og:title", content: "Painel do dono · Conferente de Caixa" },
      { property: "og:description", content: "Calendário de fechamentos, alertas e faturamento de cada unidade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

const abas = [
  { to: "/painel", rotulo: "Calendário", icone: CalendarDays, exact: true },
  { to: "/painel/historico", rotulo: "Histórico", icone: LineChart, exact: false },
  { to: "/painel/config", rotulo: "Ajustes", icone: Settings, exact: false },
] as const;

function Painel() {
  const { data: sessao, isLoading } = useSessao();
  const navigate = useNavigate();
  const { unidades, unidade, escolher } = useUnidadeAtual();
  useEffect(() => {
    if (!isLoading && !podeVerMeses(sessao?.papel)) navigate({ to: sessao ? "/caixa" : "/" });
  }, [isLoading, sessao, navigate]);
  if (!podeVerMeses(sessao?.papel)) return null;

  return (
    <div className="mx-auto min-h-screen max-w-3xl pb-28">
      <header className="space-y-4 px-5 pt-6">
        <div className="flex items-center justify-between">
          <Marca subtitulo="Painel do dono" />
          <Button variant="ghost" size="icon" onClick={sair} aria-label="Sair"><LogOut /></Button>
        </div>
        <label className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2 shadow-card">
          <Building2 className="size-5 shrink-0 text-muted-foreground" />
          <span className="sr-only">Unidade</span>
          <select aria-label="Unidade" value={unidade?.codigo ?? ""} onChange={(e) => escolher(e.target.value)}
            className="h-9 w-full bg-transparent text-base font-semibold outline-none">
            {unidades.map((u) => <option key={u.id} value={u.codigo}>{u.nome}{u.ativa ? "" : " (inativa)"}</option>)}
          </select>
        </label>
      </header>
      <main className="px-5 pt-6"><Outlet /></main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-3">
          {abas.map((a) => (
            <Link key={a.to} to={a.to} activeOptions={{ exact: a.exact }}
              className="flex flex-col items-center gap-1 py-3 text-xs font-semibold text-muted-foreground data-[status=active]:text-foreground">
              <a.icone className="size-5" />{a.rotulo}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
