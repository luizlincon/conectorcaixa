export const TZ = "America/Sao_Paulo";

export const brl = (v: number | null | undefined) =>
  v === null || v === undefined ? "não identificado" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function partes(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return { data: `${g("year")}-${g("month")}-${g("day")}`, hora: `${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}` };
}

export const hojeSP = () => partes().data;
export const agoraHHMM = () => partes().hora;
export const horaSP = (iso: string) => partes(new Date(iso)).hora;
export const dataHoraSP = (iso: string) => {
  const p = partes(new Date(iso));
  return `${dataBR(p.data)} ${p.hora}`;
};
export const dataBR = (d: string) => {
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
};

export const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Converte "1.234,56" / "1234.56" em número. */
export function parseBRL(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}
