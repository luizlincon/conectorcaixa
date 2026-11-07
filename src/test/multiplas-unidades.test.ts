import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0005_parametros_multiplas_unidades.sql", "utf8");
const obrigatorio = readFileSync("drizzle/migrations/0006_codigo_unidade_obrigatorio.sql", "utf8");

describe("parâmetros por unidade", () => {
  it("preserva código scs, obrigatório, único e com formato de 2 a 30 caracteres", () => {
    expect(sql).toContain("SET codigo = 'scs'");
    expect(obrigatorio).toContain("ALTER COLUMN codigo SET NOT NULL");
    expect(sql).toContain("UNIQUE (codigo)");
    expect(sql).toContain("CHECK (codigo ~ '^[a-z0-9-]{2,30}$')");
  });
  it("mantém plano de 35 reais e exige valor positivo", () => {
    expect(sql).toContain("valor_plano numeric(10,2) NOT NULL DEFAULT 35.00");
    expect(sql).toContain("CHECK (valor_plano > 0)");
  });
  it("mantém múltiplo avulso de 5 reais e exige valor positivo", () => {
    expect(sql).toContain("multiplo_avulso numeric(10,2) NOT NULL DEFAULT 5.00");
    expect(sql).toContain("CHECK (multiplo_avulso > 0)");
  });
  it("mantém funcionamento de segunda a sexta, só com dias de 0 a 6", () => {
    expect(sql).toContain("dias_funcionamento smallint[] NOT NULL DEFAULT '{1,2,3,4,5}'");
    expect(sql).toContain("dias_funcionamento <@ ARRAY[0,1,2,3,4,5,6]::smallint[] AND array_position(dias_funcionamento, NULL) IS NULL");
  });
  it("mantém ilimitado de segunda a quarta, só com dias de 0 a 6", () => {
    expect(sql).toContain("dias_ilimitado smallint[] NOT NULL DEFAULT '{1,2,3}'");
    expect(sql).toContain("dias_ilimitado <@ ARRAY[0,1,2,3,4,5,6]::smallint[] AND array_position(dias_ilimitado, NULL) IS NULL");
  });
  it("ativa unidades por padrão", () => {
    expect(sql).toContain("ativa boolean NOT NULL DEFAULT true");
  });
  it("expõe somente id, nome e código de unidade ativa antes do login", () => {
    expect(sql).toContain("RETURNS TABLE (id uuid, nome text, codigo text)");
    expect(sql).toContain("SELECT u.id, u.nome, u.codigo");
    expect(sql).toContain("WHERE u.codigo = _codigo AND u.ativa = true");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = ''");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.unidade_por_codigo(text) FROM PUBLIC");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.unidade_por_codigo(text) TO anon, authenticated");
    expect(sql).not.toMatch(/ALTER POLICY|CREATE POLICY|GRANT SELECT/);
  });
});