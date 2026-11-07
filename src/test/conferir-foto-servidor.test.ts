import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ checarFoto: vi.fn() }));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/leitura.server", () => ({ checarFoto: mocks.checarFoto }));

import { conferirFoto } from "@/lib/caixa.functions";

type Handler = (a: { data: { tipo: string; imagem: string }; context: unknown }) => Promise<unknown>;
const handler = conferirFoto as unknown as Handler;
const contexto = (papel: string | null) => ({
  userId: "u1",
  supabase: { rpc: vi.fn((_fn: string, a: { _role: string }) => Promise.resolve({ data: a._role === papel })) },
});

describe("checagem da foto no servidor", () => {
  it("funcionário consegue conferir a foto", async () => {
    mocks.checarFoto.mockResolvedValue({ ok: false, problema: "longe" });
    const r = await handler({ data: { tipo: "pagbank", imagem: "abc" }, context: contexto("funcionario") });
    expect(r).toEqual({ ok: false, problema: "longe" });
    expect(mocks.checarFoto).toHaveBeenCalledWith("abc", "pagbank");
  });

  it("usuário sem papel no caixa é recusado e a IA não é chamada", async () => {
    mocks.checarFoto.mockClear();
    await expect(handler({ data: { tipo: "hubbarber", imagem: "abc" }, context: contexto(null) })).rejects.toThrow("Sem permissão");
    expect(mocks.checarFoto).not.toHaveBeenCalled();
  });
});
