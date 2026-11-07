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
  /** Regras da unidade; sem isso valem as regras originais da SCS. */
  config?: ConfigUnidade;
}

/** Regras que mudam de uma unidade para outra (vêm da tabela `unidades`). */
export interface ConfigUnidade {
  valorPlano: number; // reais por serviço do plano de assinatura
  diasFuncionamento: number[]; // 0 = domingo ... 6 = sábado
  diasIlimitado: number[]; // dias em que o ilimitado (R$ 0,01) vale
  multiploAvulso: number; // reais
}

/** Regras originais da SCS: plano R$ 35, seg–sex, ilimitado seg–qua, avulso múltiplo de R$ 5. */
export const CONFIG_PADRAO: ConfigUnidade = {
  valorPlano: 35,
  diasFuncionamento: [1, 2, 3, 4, 5],
  diasIlimitado: [1, 2, 3],
  multiploAvulso: 5,
};

/** Converte uma linha de `unidades` (ou parte dela) na configuração das regras. */
export function configDaUnidade(u?: {
  valor_plano?: number | string | null;
  dias_funcionamento?: number[] | null;
  dias_ilimitado?: number[] | null;
  multiplo_avulso?: number | string | null;
} | null): ConfigUnidade {
  const num = (v: unknown, padrao: number) => (Number(v) > 0 ? Number(v) : padrao);
  return {
    valorPlano: num(u?.valor_plano, CONFIG_PADRAO.valorPlano),
    diasFuncionamento: u?.dias_funcionamento ?? CONFIG_PADRAO.diasFuncionamento,
    diasIlimitado: u?.dias_ilimitado ?? CONFIG_PADRAO.diasIlimitado,
    multiploAvulso: num(u?.multiplo_avulso, CONFIG_PADRAO.multiploAvulso),
  };
}

const NOMES_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "segunda a sexta", "segunda, quarta e sábado", "nenhum dia". */
export function descreverDias(dias: number[]): string {
  const d = [...new Set(dias)].sort((a, b) => a - b);
  if (!d.length) return "nenhum dia";
  const seguidos = d.length > 2 && d.every((x, i) => i === 0 || x === d[i - 1]! + 1);
  if (seguidos) return `${NOMES_DIAS[d[0]!]} a ${NOMES_DIAS[d[d.length - 1]!]}`;
  const nomes = d.map((x) => NOMES_DIAS[x]!);
  return nomes.length === 1 ? nomes[0]! : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
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


export const c = (v: number | null | undefined): number | null =>
  v === null || v === undefined || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 100);

const brl = (cent: number) =>
  (cent / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** 0 = domingo ... 6 = sábado, calculado sobre a data civil (sem fuso). */
export function diaSemana(data: string): number {
  const [y = 0, m = 1, d = 1] = data.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function ehDiaUtil(data: string, feriados: string[], diasFuncionamento = CONFIG_PADRAO.diasFuncionamento): boolean {
  return diasFuncionamento.includes(diaSemana(data)) && !feriados.includes(data);
}

/** Decompõe o valor de assinatura: valor do plano por serviço (R$ 35,00 na SCS) + R$ 0,01 por ilimitado. */
export function decomporAssinatura(valor: number, valorPlano = CONFIG_PADRAO.valorPlano) {
  const cent = c(valor) ?? 0;
  const planoC = c(valorPlano) ?? 3500;
  const ilimitados = cent % 100;
  const inteiroC = cent - ilimitados;
  const servicos = Math.floor(inteiroC / planoC);
  const sobraC = inteiroC - servicos * planoC;
  return { servicos, ilimitados, sobraReais: sobraC / 100 };
}

export function avaliar(e: EntradaRegras): ResultadoRegras {
  const alertas: AlertaGerado[] = [];
  const add = (regra: number, nivel: Nivel, mensagem: string) => alertas.push({ regra, nivel, mensagem });
  const hub = e.hub;
  const ent = hub?.entradas ?? {};
  const saidas = hub?.saidas ?? [];
  const lanc = hub?.lancamentos ?? [];
  const dow = diaSemana(e.data);
  const cfg = e.config ?? CONFIG_PADRAO;

  // 1. Dias de funcionamento (da unidade)
  if (!cfg.diasFuncionamento.includes(dow)) add(1, "amarelo", `Lançamento em ${NOMES_DIAS[dow]} (a unidade funciona de ${descreverDias(cfg.diasFuncionamento)}).`);
  else if (e.feriados.includes(e.data)) add(1, "amarelo", "Lançamento em feriado.");

  // 2. Abrir e fechar no mesmo dia — e, quando a foto mostra a data, ela tem que ser deste dia
  // (a tela usada, "Entradas por forma", normalmente não mostra data: sem data não é alerta)
  const dAb = hub?.abertura?.slice(0, 10);
  const dFe = hub?.fechamento?.slice(0, 10);
  if (dFe && dFe !== e.data) add(2, "vermelho", `A foto do HubBarber é do fechamento de ${fmtData(dFe)}, não de ${fmtData(e.data)}.`);
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
    const d = decomporAssinatura(assinLidaC / 100, cfg.valorPlano);
    servicosPlano = d.servicos; ilimitados = d.ilimitados; sobra = d.sobraReais;
    if (d.sobraReais !== 0) add(6, "amarelo", `Assinatura não é múltiplo de ${brl(c(cfg.valorPlano)!)}: sobram ${brl(Math.round(d.sobraReais * 100))}.`);
    const dig = c(e.assinatura)!;
    if (dig !== assinLidaC) add(6, "amarelo", `Assinatura digitada ${brl(dig)} difere da lida no HubBarber ${brl(assinLidaC)}.`);
  } else {
    add(6, "amarelo", "Não foi possível conferir a assinatura: valor não identificado.");
  }

  // 7. Ilimitado só nos dias permitidos da unidade (SCS: seg–qua). Dia sem expediente já cai na regra 1.
  if (cfg.diasFuncionamento.includes(dow) && !cfg.diasIlimitado.includes(dow)) {
    const temCentavo = lanc.some((l) => c(l.valor) === 1) || (ilimitados ?? 0) > 0;
    if (temCentavo) add(7, "amarelo", `Atendimento ilimitado (R$ 0,01) em ${NOMES_DIAS[dow]} — só vale de ${descreverDias(cfg.diasIlimitado)}.`);
  }

  // 8. Avulso múltiplo do valor da unidade (SCS: R$ 5)
  const avulsoC = maq + din;
  const multC = c(cfg.multiploAvulso) ?? 500;
  if (avulsoC % multC !== 0) add(8, "amarelo", `Receita avulsa ${brl(avulsoC)} não é múltiplo de ${brl(multC)} — possível desconto ou erro.`);

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
  diasFuncionamento?: number[] | undefined;
}): StatusDia | "futuro" | "sem_expediente" {
  if (!opts.enviado) {
    if (!ehDiaUtil(opts.data, opts.feriados, opts.diasFuncionamento)) return "sem_expediente";
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
