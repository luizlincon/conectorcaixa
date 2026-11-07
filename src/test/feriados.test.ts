import { describe, expect, it } from "vitest";
import { statusDoDia } from "@/lib/regras";

describe("Feriados nacionais e de Brasília", () => {
  const status = (data: string, feriados: string[]) => statusDoDia({
    data, hoje: "2026-12-31", agoraHHMM: "21:00", horarioLimite: "20:00",
    feriados, enviado: false, niveisAbertos: [],
  });
  it("Finados nacional não gera falta de envio", () => {
    expect(status("2026-11-02", ["2026-11-02"])).toBe("sem_expediente");
    expect(status("2026-11-02", [])).toBe("nao_enviado");
  });
  it("Dia do Evangélico em Brasília não gera falta de envio", () => {
    expect(status("2026-11-30", ["2026-11-30"])).toBe("sem_expediente");
    expect(status("2026-11-30", [])).toBe("nao_enviado");
  });
});