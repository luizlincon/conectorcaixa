import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { CalendarDays, LineChart, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Marca } from "@/components/Marca";
import { sair, useSessao } from "@/hooks/use-sessao";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel do dono · Conferente de Caixa" },
      { name: "description", content: "Calendário de fechamentos, alertas e faturamento da unidade SCS." },
      { property: "og:title", content: "Painel do dono · Conferente de Caixa" },
      { property: "og:description", content: "Calendário de fechamentos, alertas e faturamento da unidade SCS." },
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
  useEffect(() => {
    if (!isLoading && sessao?.papel !== "dono") navigate({ to: sessao ? "/caixa" : "/" });
  }, [isLoading, sessao, navigate]);
  if (sessao?.papel !== "dono") return null;

  return (
    <div className="mx-auto min-h-screen max-w-3xl pb-28">
      <header className="flex items-center justify-between px-5 pt-6">
        <Marca subtitulo="Painel do dono · SCS" />
        <Button variant="ghost" size="icon" onClick={sair} aria-label="Sair"><LogOut /></Button>
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
