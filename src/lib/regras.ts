// Motor de regras do Conferente de Caixa. Funções puras, valores em centavos.

export type Nivel = "vermelho" | "amarelo";
export type StatusDia = "verde" | "amarelo" | "vermelho" | "nao_enviado";

export interface LeituraHub {
  numero_caixa?: string | null;
  status?: string | null;
  abertura?: string | null; // "YYYY-MM-DDTHH:MM"
  fechamento?: string | null;
  entradas?: {
    dinheiro?: number | null;
    credito?: number | null;
    debito?: number | null;
    pix?: number | null;
    assinatura?: number | null;
    outro?: number | null;
  } | null;
  saidas?: Array<{ forma?: string | null; descricao?: string | null; valor?: number | null }> | null;
  valor_inicial?: number | null;
  total?: number | null;
  lancamentos?: Array<{
    hora?: string | null;
    comanda?: string | null;
    cliente?: string | null;
    forma?: string | null;
    valor?: number | null;
  }> | null;
  nao_identificados?: string[] | null;
}

export interface LeituraPag {
  total_vendido?: number | null;
  quantidade_vendas?: number | null;
  nao_identificados?: string[] | null;
}

export interface EntradaRegras {
  data: string; // YYYY-MM-DD do fechamento
  maquina: number; // digitado (reais)
  assinatura: number;
  dinheiro: number;
  hub: LeituraHub | null;
  pag: LeituraPag | null;
  feriados: string[];
  dataInicioAssinatura: string; // YYYY-MM-DD
}

export interface AlertaGerado {
  regra: number;
  nivel: Nivel;
  mensagem: string;
}

export interface ResultadoRegras {
  alertas: AlertaGerado[];
  servicosPlano: number | null;
  ilimitados: number | null;
  sobraAssinatura: number | null; // reais
  avulso: number; // reais
  maquinaConferida: boolean;
  dinheiroConferido: boolean;
  assinaturaLida: number | null;
  status: Exclude<StatusDia, "nao_enviado">;
}

export const VALOR_PLANO_CENTAVOS = 3500;

export const c = (v: number | null | undefined): number | null =>
  v === null || v === undefined || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 100);

const brl = (cent: number) =>
  (cent / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** 0 = domingo ... 6 = sábado, calculado sobre a data civil (sem fuso). */
export function diaSemana(data: string): number {
  const [y = 0, m = 1, d = 1] = data.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function ehDiaUtil(data: string, feriados: string[]): boolean {
  const dow = diaSemana(data);
  return dow >= 1 && dow <= 5 && !feriados.includes(data);
}

/** Decompõe o valor de assinatura: R$ 35,00 por serviço do plano + R$ 0,01 por ilimitado. */
export function decomporAssinatura(valor: number) {
  const cent = c(valor) ?? 0;
  const inteiroReais = Math.floor(cent / 100);
  const ilimitados = cent % 100;
  const servicos = Math.floor(inteiroReais / 35);
  const sobra = inteiroReais % 35;
  return { servicos, ilimitados, sobraReais: sobra };
}

export function avaliar(e: EntradaRegras): ResultadoRegras {
  const alertas: AlertaGerado[] = [];
  const add = (regra: number, nivel: Nivel, mensagem: string) => alertas.push({ regra, nivel, mensagem });
  const hub = e.hub;
  const ent = hub?.entradas ?? {};
  const saidas = hub?.saidas ?? [];
  const lanc = hub?.lancamentos ?? [];
  const dow = diaSemana(e.data);

  // 1. Dias de funcionamento
  if (dow === 0 || dow === 6) add(1, "amarelo", "Lançamento em fim de semana (unidade funciona de segunda a sexta).");
  else if (e.feriados.includes(e.data)) add(1, "amarelo", "Lançamento em feriado.");

  // 2. Abrir e fechar no mesmo dia — e a foto tem que ser do fechamento deste dia
  const dAb = hub?.abertura?.slice(0, 10);
  const dFe = hub?.fechamento?.slice(0, 10);
  if (hub && !dFe) add(2, "amarelo", "A foto do HubBarber não mostra a data de fechamento — o caixa pode não ter sido fechado.");
  else if (dFe && dFe !== e.data) add(2, "vermelho", `A foto do HubBarber é do fechamento de ${fmtData(dFe)}, não de ${fmtData(e.data)}.`);
  if (dAb && dFe && dFe > dAb) add(2, "amarelo", `Caixa aberto em ${fmtData(dAb)} e fechado em ${fmtData(dFe)}.`);

  // 3. Máquina
  const maq = c(e.maquina)!;
  const pagTotal = c(e.pag?.total_vendido);
  const cr = c(ent.credito), db = c(ent.debito), px = c(ent.pix);
  const hubCartoes = cr === null && db === null && px === null ? null : (cr ?? 0) + (db ?? 0) + (px ?? 0);
  let maquinaConferida = false;
  if (pagTotal === null || hubCartoes === null) {
    add(3, "amarelo", "Não foi possível conferir a máquina: valor não identificado nas fotos.");
  } else if (maq === pagTotal && pagTotal === hubCartoes) {
    maquinaConferida = true;
  } else {
    add(
      3,
      "vermelho",
      `Máquina não confere. Digitado ${brl(maq)} · PagBank ${brl(pagTotal)} · HubBarber (crédito+débito+PIX) ${brl(hubCartoes)}.`,
    );
  }

  // 4. Dinheiro
  const din = c(e.dinheiro)!;
  const hubDin = c(ent.dinheiro);
  const saidasDin = saidas
    .filter((s) => (s.forma ?? "").toLowerCase().includes("dinheiro"))
    .reduce((a, s) => a + (c(s.valor) ?? 0), 0);
  let dinheiroConferido = false;
  if (hubDin === null) {
    add(4, "amarelo", "Não foi possível conferir o dinheiro: valor não identificado no HubBarber.");
  } else {
    const esperado = hubDin - saidasDin;
    if (esperado === din) dinheiroConferido = true;
    else add(4, "vermelho", `Dinheiro não confere. Digitado ${brl(din)} · esperado ${brl(esperado)} (entradas ${brl(hubDin)} − saídas ${brl(saidasDin)}).`);
  }

  // 5. Forma "Assinatura" x "Outro"
  const assin = c(ent.assinatura);
  const outro = c(ent.outro);
  const novaRegra = e.data >= e.dataInicioAssinatura;
  if (novaRegra && (outro ?? 0) > 0) add(5, "amarelo", `Valor de ${brl(outro!)} lançado em "Outro". Desde ${fmtData(e.dataInicioAssinatura)} use a forma "Assinatura".`);
  const assinLidaC = assin === null && outro === null ? null : novaRegra ? assin ?? 0 : (assin ?? 0) + (outro ?? 0);

  // 6. Composição da assinatura
  let servicosPlano: number | null = null, ilimitados: number | null = null, sobra: number | null = null;
  if (assinLidaC !== null) {
    const d = decomporAssinatura(assinLidaC / 100);
    servicosPlano = d.servicos; ilimitados = d.ilimitados; sobra = d.sobraReais;
    if (d.sobraReais !== 0) add(6, "amarelo", `Assinatura não é múltiplo de R$ 35,00: sobram ${brl(d.sobraReais * 100)}.`);
    const dig = c(e.assinatura)!;
    if (dig !== assinLidaC) add(6, "amarelo", `Assinatura digitada ${brl(dig)} difere da lida no HubBarber ${brl(assinLidaC)}.`);
  } else {
    add(6, "amarelo", "Não foi possível conferir a assinatura: valor não identificado.");
  }

  // 7. Ilimitado só seg-qua
  if (dow === 4 || dow === 5) {
    const temCentavo = lanc.some((l) => c(l.valor) === 1) || (ilimitados ?? 0) > 0;
    if (temCentavo) add(7, "amarelo", "Atendimento ilimitado (R$ 0,01) em quinta ou sexta — só vale de segunda a quarta.");
  }

  // 8. Avulso múltiplo de R$ 5
  const avulsoC = maq + din;
  if (avulsoC % 500 !== 0) add(8, "amarelo", `Receita avulsa ${brl(avulsoC)} não é múltiplo de R$ 5,00 — possível desconto ou erro.`);

  // 9. Saída sem descrição
  const semDesc = saidas.filter((s) => !(s.descricao ?? "").trim() || s.descricao === "não identificado");
  if (semDesc.length) add(9, "amarelo", `${semDesc.length} saída(s) sem descrição.`);

  // 10. Saída em dinheiro maior que entradas em dinheiro
  if (hubDin !== null && saidasDin > hubDin) add(10, "vermelho", `Saídas em dinheiro (${brl(saidasDin)}) maiores que o dinheiro que entrou (${brl(hubDin)}).`);

  const status = alertas.some((a) => a.nivel === "vermelho") ? "vermelho" : alertas.length ? "amarelo" : "verde";
  return {
    alertas,
    servicosPlano,
    ilimitados,
    sobraAssinatura: sobra,
    avulso: avulsoC / 100,
    maquinaConferida,
    dinheiroConferido,
    assinaturaLida: assinLidaC === null ? null : assinLidaC / 100,
    status,
  };
}

/** Regra 11 + status do dia a partir dos alertas abertos. */
export function statusDoDia(opts: {
  data: string;
  hoje: string;
  agoraHHMM: string;
  horarioLimite: string; // HH:MM
  feriados: string[];
  enviado: boolean;
  niveisAbertos: Nivel[];
}): StatusDia | "futuro" | "sem_expediente" {
  if (!opts.enviado) {
    if (!ehDiaUtil(opts.data, opts.feriados)) return "sem_expediente";
    if (opts.data > opts.hoje) return "futuro";
    if (opts.data === opts.hoje && opts.agoraHHMM < opts.horarioLimite.slice(0, 5)) return "futuro";
    return "nao_enviado";
  }
  if (opts.niveisAbertos.includes("vermelho")) return "vermelho";
  if (opts.niveisAbertos.length) return "amarelo";
  return "verde";
}

function fmtData(d: string) {
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}
