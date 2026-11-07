export function Marca({ subtitulo }: { subtitulo?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-2.5 rounded-full barber-stripe shadow-sm" aria-hidden />
      <div className="leading-tight">
        <p className="font-display text-lg font-bold">Navalha da Corte</p>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{subtitulo ?? "Conferente de Caixa"}</p>
      </div>
    </div>
  );
}
