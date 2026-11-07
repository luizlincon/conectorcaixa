import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  lerFotos: vi.fn(),
  gerarAlertas: vi.fn(),
}));

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
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("@/lib/processamento.server", () => ({ lerFotos: mocks.lerFotos, gerarAlertas: mocks.gerarAlertas }));

import { enviarFechamento } from "@/lib/caixa.functions";
import { hojeSP } from "@/lib/formato";

const sql = readFileSync("drizzle/migrations/0003_bloquear_insercoes_diretas_funcionario_caixa.sql", "utf8");

describe("Segurança do fechamento", () => {
  it("bloqueia a inserção direta do funcionário em fechamentos", () => {
    expect(sql).toContain('ALTER POLICY "func insere fechamento do dia" ON public.fechamentos WITH CHECK (false);');
  });

  it("bloqueia a inserção direta do funcionário em fotos sem alterar outras policies", () => {
    expect(sql).toContain('ALTER POLICY "func insere fotos do dia" ON public.fotos WITH CHECK (false);');
    expect(sql.split(";").filter((s) => s.trim())).toHaveLength(2);
  });

  it("permite envio do funcionário pelo servidor e executa leitura e alertas com cliente admin", async () => {
    vi.clearAllMocks();
    const fechamentoInsert = vi.fn().mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "fechamento" }, error: null }) }) });
    const fotosInsert = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockImplementation((table: string) => table === "fechamentos" ? {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
      insert: fechamentoInsert,
    } : table === "unidades" ? {
      // O servidor confere se a unidade do caixa existe e está ativa.
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "unidade", ativa: true } }) }) }),
    } : { insert: fotosInsert });
    const userFrom = vi.fn().mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ data: { nome: "Funcionário", unidade_id: "unidade", ativo: true } }) }) }) });
    const context = {
      userId: "funcionario",
      supabase: {
        rpc: vi.fn().mockImplementation((_fn, args) => Promise.resolve({ data: args._role === "funcionario" })),
        from: userFrom,
      },
    };
    const fotos = ["hubbarber", "pagbank"].map((tipo) => ({ tipo, path: `unidade/${hojeSP()}/${tipo}-1730000000000.jpg`, capturada_em: new Date().toISOString() }));
    const handler = enviarFechamento as unknown as (args: { data: unknown; context: typeof context }) => Promise<{ ok: boolean }>;
    expect(await handler({ data: { maquina: 445, assinatura: 35.04, dinheiro: 95, fotos }, context })).toMatchObject({ ok: true });
    expect(fechamentoInsert).toHaveBeenCalledWith(expect.objectContaining({ enviado_por: "funcionario", data: hojeSP(), leitura_status: "pendente" }));
    expect(fotosInsert).toHaveBeenCalledWith(fotos.map((foto) => ({ ...foto, fechamento_id: "fechamento" })));
    expect(userFrom).toHaveBeenCalledTimes(1);
    expect(userFrom).toHaveBeenCalledWith("usuarios");
    expect(mocks.lerFotos).toHaveBeenCalledWith({ from: mocks.from }, "fechamento");
    expect(mocks.gerarAlertas).toHaveBeenCalledWith({ from: mocks.from }, "fechamento");
    expect(mocks.lerFotos.mock.invocationCallOrder[0]).toBeLessThan(mocks.gerarAlertas.mock.invocationCallOrder[0] ?? 0);
  });
});