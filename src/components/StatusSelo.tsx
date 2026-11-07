import type { StatusDia } from "@/lib/regras";

export type StatusCal = StatusDia | "futuro" | "sem_expediente";

export const statusInfo: Record<StatusCal, { rotulo: string; cls: string; dot: string }> = {
  verde: { rotulo: "Conferido", cls: "bg-ok-soft text-ok border-ok/30", dot: "bg-ok" },
  amarelo: { rotulo: "Atenção", cls: "bg-warn-soft text-foreground border-warn/50", dot: "bg-warn" },
  vermelho: { rotulo: "Possível perda", cls: "bg-danger-soft text-danger border-danger/30", dot: "bg-danger" },
  nao_enviado: { rotulo: "Não enviado", cls: "bg-pending-soft text-muted-foreground border-pending/40", dot: "bg-pending" },
  futuro: { rotulo: "Aguardando", cls: "bg-card text-muted-foreground border-border", dot: "bg-border" },
  sem_expediente: { rotulo: "Sem expediente", cls: "bg-muted/50 text-muted-foreground/60 border-transparent", dot: "bg-transparent" },
};

export function StatusSelo({ status }: { status: StatusCal }) {
  const i = statusInfo[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${i.cls}`}>
      <span className={`size-2 rounded-full ${i.dot}`} />
      {i.rotulo}
    </span>
  );
}
