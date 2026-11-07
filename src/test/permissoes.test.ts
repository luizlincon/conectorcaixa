import { describe, expect, it } from "vitest";
import { podeOperarCaixa, podeVerMeses } from "@/lib/permissoes";

describe("Acesso exclusivo do dono", () => {
  it("somente dono pode abrir ou fechar o caixa", () => {
    expect(podeOperarCaixa("dono")).toBe(true);
    expect(podeOperarCaixa("funcionario")).toBe(false);
    expect(podeOperarCaixa(undefined)).toBe(false);
  });
  it("somente dono pode visualizar os meses", () => {
    expect(podeVerMeses("dono")).toBe(true);
    expect(podeVerMeses("funcionario")).toBe(false);
    expect(podeVerMeses(null)).toBe(false);
  });
});