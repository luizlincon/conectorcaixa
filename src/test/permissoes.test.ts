import { describe, expect, it } from "vitest";
import { podeAcessarDia, podeOperarCaixa, podeVerMeses } from "@/lib/permissoes";

describe("Acesso ao caixa", () => {
  it("dono e funcionário podem abrir e fechar o caixa", () => {
    expect(podeOperarCaixa("dono")).toBe(true);
    expect(podeOperarCaixa("funcionario")).toBe(true);
    expect(podeOperarCaixa(undefined)).toBe(false);
  });
  it("funcionário acessa somente o dia atual", () => {
    expect(podeAcessarDia("funcionario", "2026-11-07", "2026-11-07")).toBe(true);
    expect(podeAcessarDia("funcionario", "2026-11-06", "2026-11-07")).toBe(false);
    expect(podeAcessarDia("funcionario", "2026-11-08", "2026-11-07")).toBe(false);
  });
  it("dono pode analisar dias anteriores", () => {
    expect(podeAcessarDia("dono", "2026-11-06", "2026-11-07")).toBe(true);
    expect(podeAcessarDia(null, "2026-11-07", "2026-11-07")).toBe(false);
  });
  it("somente dono pode visualizar os meses", () => {
    expect(podeVerMeses("dono")).toBe(true);
    expect(podeVerMeses("funcionario")).toBe(false);
    expect(podeVerMeses(null)).toBe(false);
  });
});