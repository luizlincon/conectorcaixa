import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("restringe leitura à unidade do funcionário ou ao dono, sem alterar feriados ou edição", () => {
  const sql = readFileSync("drizzle/migrations/0004_restringir_leitura_unidades_funcionario.sql", "utf8");
  expect(sql.trim()).toBe('ALTER POLICY "ler unidades" ON public.unidades USING (id = public.minha_unidade() OR public.has_role(auth.uid(), \'dono\'));');
});