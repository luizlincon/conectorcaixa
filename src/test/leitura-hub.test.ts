import { describe, expect, it, vi } from "vitest";
import { avaliar } from "@/lib/regras";

const mocks = vi.hoisted(() => ({ generateMessage: vi.fn() }));
vi.mock("@lovable.dev/ai-gateway", () => ({ generateMessage: mocks.generateMessage }));

import { checarFoto, lerHub } from "@/lib/leitura.server";

const responde = (json: unknown) => mocks.generateMessage.mockResolvedValueOnce({ content: [{ type: "text", text: JSON.stringify(json) }] });
const promptEnviado = () => {
  const msg = mocks.generateMessage.mock.calls.at(-1)![0].messages[0].content;
  return msg.find((b: { type: string }) => b.type === "text").text as string;
};

describe("checagem da foto do HubBarber (tela modelo)", () => {
  it("descreve o quadro 'Entradas por forma' e não exige data", async () => {
    responde({ ok: true, problema: null });
    expect(await checarFoto("abc", "hubbarber")).toEqual({ ok: true, problema: null });
    const p = promptEnviado();
    expect(p).toContain('"Entradas por forma"');
    expect(p).toContain("NÃO exija data");
    expect(p).toContain("Tela escura com letras claras é o normal");
    expect(p).not.toMatch(/precisa .* data de fechamento/);
  });

  it("a leitura sabe que forma ausente no quadro é zero e '-' é sem saída", async () => {
    responde({ entradas: {} });
    await lerHub("abc");
    const p = promptEnviado();
    expect(p).toContain("a forma que não está na lista teve 0");
    expect(p).toContain('"Saídas por forma" com "-" = saidas []');
  });
});

describe("valores da tela modelo passam pelas regras", () => {
  // Leitura esperada da foto modelo: Dinheiro 52, Crédito 435, Débito 260, Outro 490, PIX 45, sem saídas, Saldo Final 1.282
  const hub = {
    entradas: { dinheiro: 52, credito: 435, debito: 260, pix: 45, assinatura: 0, outro: 490 },
    saidas: [],
    total: 1282,
    abertura: null,
    fechamento: null,
  };
  const base = { data: "2026-11-06", hub, feriados: [], dataInicioAssinatura: "2026-11-09" };

  it("digitando os mesmos valores, tudo confere (sem alerta de data)", () => {
    const r = avaliar({ ...base, maquina: 740, assinatura: 490, dinheiro: 52, pag: { total_vendido: 740 } });
    expect(r.maquinaConferida).toBe(true);
    expect(r.dinheiroConferido).toBe(true);
    expect(r.servicosPlano).toBe(14); // 490 / 35
    expect(r.alertas.find((a) => a.regra === 2)).toBeUndefined();
  });

  it("máquina diferente da soma crédito+débito+PIX (740) é vermelho", () => {
    const r = avaliar({ ...base, maquina: 700, assinatura: 490, dinheiro: 52, pag: { total_vendido: 700 } });
    expect(r.alertas.some((a) => a.regra === 3 && a.nivel === "vermelho")).toBe(true);
  });
});
