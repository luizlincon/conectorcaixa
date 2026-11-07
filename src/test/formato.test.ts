import { describe, expect, it } from "vitest";
import { parseBRL } from "@/lib/formato";

describe("valores digitados no caixa", () => {
  it("vírgula ou ponto como decimal dão o mesmo valor", () => {
    expect(parseBRL("150,00")).toBe(150);
    expect(parseBRL("150.00")).toBe(150);
    expect(parseBRL("12.5")).toBe(12.5);
    expect(parseBRL("12,5")).toBe(12.5);
  });
  it("ponto de milhar continua funcionando", () => {
    expect(parseBRL("1.234,56")).toBe(1234.56);
    expect(parseBRL("1.234")).toBe(1234);
    expect(parseBRL("1.234.567")).toBe(1234567);
  });
  it("inteiro e zero", () => {
    expect(parseBRL("35")).toBe(35);
    expect(parseBRL("0")).toBe(0);
  });
  it("vazio ou sem número é inválido", () => {
    expect(parseBRL("")).toBeNull();
    expect(parseBRL(".")).toBeNull();
    expect(parseBRL(",")).toBeNull();
  });
});
