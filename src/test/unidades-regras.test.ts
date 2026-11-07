import { describe, expect, it, vi } from "vitest";
import { avaliar, CONFIG_PADRAO, configDaUnidade, decomporAssinatura, descreverDias, statusDoDia, type EntradaRegras } from "@/lib/regras";
import { unidadeDoCaixa } from "@/lib/permissoes";
import { codigoValido } from "@/lib/unidades";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => () => ({ useParams: () => ({}) }), Link: () => null }));
vi.mock("@/routes/_authenticated/caixa", () => ({ Caixa: () => null }));
vi.mock("@/lib/caixa.functions", () => ({}));

import { acessoAUnidade } from "@/routes/$unidade";

const base: EntradaRegras = {
  data: "2026-11-04", // quarta
  maquina: 445,
  assinatura: 35.04,
  dinheiro: 95,
  hub: { abertura: "2026-11-04T08:00", fechamento: "2026-11-04T19:30", entradas: { dinheiro: 95, credito: 155, debito: 235, pix: 55, outro: 35.04 }, saidas: [], lancamentos: [] },
  pag: { total_vendido: 445, quantidade_vendas: 6 },
  feriados: [],
  dataInicioAssinatura: "2026-11-09",
};

describe("regras por unidade", () => {
  it("sem config continua igual à SCS (dia de aceite verde)", () => {
    expect(avaliar(base).status).toBe("verde");
    expect(avaliar({ ...base, config: CONFIG_PADRAO }).status).toBe("verde");
  });

  it("unidade que abre sábado não alerta lançamento de sábado", () => {
    const sabado = { ...base, data: "2026-11-07", hub: { ...base.hub!, abertura: null, fechamento: null } };
    expect(avaliar(sabado).alertas.some((a) => a.regra === 1)).toBe(true);
    const abreSabado = configDaUnidade({ dias_funcionamento: [1, 2, 3, 4, 5, 6] });
    expect(avaliar({ ...sabado, config: abreSabado }).alertas.some((a) => a.regra === 1)).toBe(false);
  });

  it("mensagem da regra 1 cita os dias da unidade", () => {
    const r = avaliar({ ...base, data: "2026-11-08", hub: { ...base.hub!, fechamento: null }, config: configDaUnidade({ dias_funcionamento: [2, 3, 4, 5, 6] }) });
    expect(r.alertas.find((a) => a.regra === 1)?.mensagem).toContain("terça a sábado");
  });

  it("valor do plano da unidade: R$ 40 por serviço", () => {
    const cfg = configDaUnidade({ valor_plano: 40 });
    const r = avaliar({ ...base, assinatura: 80.02, hub: { ...base.hub!, entradas: { ...base.hub!.entradas, outro: 80.02 } }, config: cfg });
    expect(r.servicosPlano).toBe(2);
    expect(r.ilimitados).toBe(2);
    expect(r.alertas.some((a) => a.regra === 6)).toBe(false);
    // R$ 80,02 com plano de R$ 35 sobra R$ 10
    expect(avaliar({ ...base, assinatura: 80.02, hub: { ...base.hub!, entradas: { ...base.hub!.entradas, outro: 80.02 } } }).alertas.find((a) => a.regra === 6)?.mensagem).toMatch(/R\$\s35,00/);
    expect(decomporAssinatura(80.02, 40)).toEqual({ servicos: 2, ilimitados: 2, sobraReais: 0 });
  });

  it("ilimitado: quinta alerta na SCS, mas não em unidade que libera seg–sex", () => {
    const quinta = { ...base, data: "2026-11-05", hub: { ...base.hub!, abertura: null, fechamento: null } };
    expect(avaliar(quinta).alertas.some((a) => a.regra === 7)).toBe(true);
    expect(avaliar({ ...quinta, config: configDaUnidade({ dias_ilimitado: [1, 2, 3, 4, 5] }) }).alertas.some((a) => a.regra === 7)).toBe(false);
  });

  it("múltiplo do avulso da unidade: R$ 10", () => {
    // avulso = 445 + 95 = 540: múltiplo de 5 e de 10
    expect(avaliar({ ...base, config: configDaUnidade({ multiplo_avulso: 10 }) }).alertas.some((a) => a.regra === 8)).toBe(false);
    const r = avaliar({ ...base, dinheiro: 100, hub: { ...base.hub!, entradas: { ...base.hub!.entradas, dinheiro: 100 } }, config: configDaUnidade({ multiplo_avulso: 10 }) });
    expect(r.alertas.find((a) => a.regra === 8)?.mensagem).toMatch(/R\$\s10,00/); // 545
  });

  it("calendário: sábado é dia de expediente em unidade que abre sábado", () => {
    const o = { data: "2026-11-07", hoje: "2026-11-09", agoraHHMM: "10:00", horarioLimite: "20:00", feriados: [], enviado: false, niveisAbertos: [] };
    expect(statusDoDia(o)).toBe("sem_expediente");
    expect(statusDoDia({ ...o, diasFuncionamento: [1, 2, 3, 4, 5, 6] })).toBe("nao_enviado");
  });

  it("descreve os dias em português", () => {
    expect(descreverDias([1, 2, 3, 4, 5])).toBe("segunda a sexta");
    expect(descreverDias([1, 3, 6])).toBe("segunda, quarta e sábado");
    expect(descreverDias([])).toBe("nenhum dia");
  });

  it("valores inválidos da unidade voltam ao padrão", () => {
    expect(configDaUnidade({ valor_plano: 0, multiplo_avulso: "abc" })).toMatchObject({ valorPlano: 35, multiploAvulso: 5 });
    expect(configDaUnidade({ valor_plano: "42.50" }).valorPlano).toBe(42.5);
  });
});

describe("acesso por unidade", () => {
  const scs = "id-scs", studio = "id-studio";

  it("funcionário só fecha o caixa da própria unidade (servidor)", () => {
    expect(unidadeDoCaixa("funcionario", studio, studio)).toBe(studio);
    expect(unidadeDoCaixa("funcionario", studio, undefined)).toBe(studio);
    expect(() => unidadeDoCaixa("funcionario", studio, scs)).toThrow("Você não tem acesso a esta unidade.");
    expect(() => unidadeDoCaixa("funcionario", null, undefined)).toThrow("sem unidade");
  });

  it("dono fecha o caixa de qualquer unidade (servidor)", () => {
    expect(unidadeDoCaixa("dono", scs, studio)).toBe(studio);
    expect(unidadeDoCaixa("dono", scs, undefined)).toBe(scs);
  });

  it("endereço /codigo: Breno (Studio 302) é barrado na SCS", () => {
    const breno = { papel: "funcionario", unidadeId: studio };
    expect(acessoAUnidade(breno, studio)).toBe("liberado");
    expect(acessoAUnidade(breno, scs)).toBe("outra_unidade");
    expect(acessoAUnidade({ papel: "dono", unidadeId: scs }, studio)).toBe("liberado");
    expect(acessoAUnidade(null, scs)).toBe("sem_login");
  });

  it("código do endereço: só minúsculas/números/hífen e sem nomes de páginas do app", () => {
    for (const ok of ["scs", "studio302", "planaltina", "mondial"]) expect(codigoValido(ok)).toBe(true);
    for (const ruim of ["painel", "caixa", "Studio302", "a", "com espaço"]) expect(codigoValido(ruim)).toBe(false);
  });
});
