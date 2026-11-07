import { describe, expect, it } from "vitest";
import { emailDoTelefone, formatarTelefone, soDigitos } from "../lib/auth-utils";

describe("limite do telefone com DDD", () => {
  it("mantém no máximo 11 números ao digitar ou colar, sem contar a máscara", () => {
    for (const entrada of ["119876543210000", "(11) 98765-43210000"]) {
      const telefone = formatarTelefone(entrada);
      expect(soDigitos(telefone)).toBe("11987654321");
      expect(soDigitos(telefone)).toHaveLength(11);
    }
  });
});

describe("telefone com +55 ou 0 na frente", () => {
  const variacoes = [
    "61994415050",
    "(61) 99441-5050",
    "+55 61 99441-5050",
    "+5561994415050",
    "5561994415050",
    "061994415050",
  ];

  it("colado ou autopreenchido vira o mesmo número com DDD", () => {
    for (const entrada of variacoes) {
      expect(formatarTelefone(entrada)).toBe("(61) 99441-5050");
      expect(emailDoTelefone(entrada)).toBe("61994415050@func.navalhadacorte.app");
    }
  });

  it("digitado um caractere por vez também chega no número certo", () => {
    for (const entrada of variacoes) {
      let campo = "";
      for (const ch of entrada) campo = formatarTelefone(campo + ch);
      expect(campo).toBe("(61) 99441-5050");
    }
  });

  it("não mexe em número que começa com DDD 55", () => {
    expect(formatarTelefone("55991234567")).toBe("(55) 99123-4567");
  });
});
