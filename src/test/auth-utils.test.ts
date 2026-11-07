import { describe, expect, it } from "vitest";
import { formatarTelefone, soDigitos } from "../lib/auth-utils";

describe("limite do telefone com DDD", () => {
  it("mantém no máximo 11 números ao digitar ou colar, sem contar a máscara", () => {
    for (const entrada of ["119876543210000", "(11) 98765-43210000"]) {
      const telefone = formatarTelefone(entrada);
      expect(soDigitos(telefone)).toBe("11987654321");
      expect(soDigitos(telefone)).toHaveLength(11);
    }
  });
});