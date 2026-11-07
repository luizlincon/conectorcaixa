import { describe, expect, it } from "vitest";
import { avaliar, decomporAssinatura, statusDoDia, type EntradaRegras } from "@/lib/regras";

const aceite: EntradaRegras = {
  data: "2026-11-04",
  maquina: 445,
  assinatura: 35.04,
  dinheiro: 95,
  hub: {
    abertura: "2026-11-04T08:00",
    fechamento: "2026-11-04T19:30",
    entradas: { dinheiro: 95, credito: 155, debito: 235, pix: 55, outro: 35.04 },
    saidas: [],
    lancamentos: [],
  },
  pag: { total_vendido: 445, quantidade_vendas: 6 },
  feriados: [],
  dataInicioAssinatura: "2026-11-09",
};

describe("teste de aceite 04/11/2026", () => {
  const r = avaliar(aceite);
  it("1 serviço do plano e 4 ilimitados", () => {
    expect(r.servicosPlano).toBe(1);
    expect(r.ilimitados).toBe(4);
  });
  it("avulso R$ 540,00", () => expect(r.avulso).toBe(540));
  it("máquina conferida", () => expect(r.maquinaConferida).toBe(true));
  it("status verde", () => {
    expect(r.alertas).toEqual([]);
    expect(r.status).toBe("verde");
  });
});

describe("regras", () => {
  it("máquina diferente do PagBank é vermelho", () => {
    const r = avaliar({ ...aceite, maquina: 440 });
    expect(r.alertas.some((a) => a.regra === 3 && a.nivel === "vermelho")).toBe(true);
  });
  it("dinheiro desconta saídas em dinheiro", () => {
    const r = avaliar({
      ...aceite,
      dinheiro: 75,
      hub: { ...aceite.hub!, saidas: [{ forma: "Dinheiro", descricao: "Café", valor: 20 }] },
    });
    expect(r.alertas.find((a) => a.regra === 4)).toBeUndefined();
  });
  it("'Outro' a partir de 09/11/2026 é amarelo", () => {
    const r = avaliar({ ...aceite, data: "2026-11-09" });
    expect(r.alertas.some((a) => a.regra === 5 && a.nivel === "amarelo")).toBe(true);
  });
  it("sobra de assinatura não múltipla de 35", () => {
    expect(decomporAssinatura(40.02)).toEqual({ servicos: 1, ilimitados: 2, sobraReais: 5 });
  });
  it("ilimitado em quinta é amarelo", () => {
    const r = avaliar({ ...aceite, data: "2026-11-05" });
    expect(r.alertas.some((a) => a.regra === 7)).toBe(true);
  });
  it("avulso não múltiplo de R$ 5 é amarelo", () => {
    const r = avaliar({ ...aceite, dinheiro: 93, hub: { ...aceite.hub!, entradas: { ...aceite.hub!.entradas, dinheiro: 93 } } });
    expect(r.alertas.some((a) => a.regra === 8)).toBe(true);
  });
  it("sábado é amarelo", () => {
    const r = avaliar({ ...aceite, data: "2026-11-07" });
    expect(r.alertas.some((a) => a.regra === 1)).toBe(true);
  });
  it("saída em dinheiro maior que entrada é vermelho", () => {
    const r = avaliar({ ...aceite, hub: { ...aceite.hub!, saidas: [{ forma: "Dinheiro", descricao: "x", valor: 100 }] } });
    expect(r.alertas.some((a) => a.regra === 10 && a.nivel === "vermelho")).toBe(true);
  });
  it("foto do HubBarber de outro dia é vermelho", () => {
    const r = avaliar({ ...aceite, hub: { ...aceite.hub!, abertura: "2026-11-03T08:00", fechamento: "2026-11-03T19:30" } });
    expect(r.alertas.some((a) => a.regra === 2 && a.nivel === "vermelho")).toBe(true);
    expect(r.status).toBe("vermelho");
  });
  it("foto do HubBarber sem data (quadro 'Entradas por forma') não gera alerta", () => {
    const r = avaliar({ ...aceite, hub: { ...aceite.hub!, abertura: null, fechamento: null } });
    expect(r.alertas.find((a) => a.regra === 2)).toBeUndefined();
    expect(r.status).toBe("verde");
  });
  it("não enviado após horário limite em dia útil", () => {
    const base = { data: "2026-11-04", hoje: "2026-11-04", horarioLimite: "20:00", feriados: [], enviado: false, niveisAbertos: [] };
    expect(statusDoDia({ ...base, agoraHHMM: "20:30" })).toBe("nao_enviado");
    expect(statusDoDia({ ...base, agoraHHMM: "19:00" })).toBe("futuro");
  });
});
