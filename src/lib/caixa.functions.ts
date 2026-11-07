import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailDoTelefone, senhaDoPin, soDigitos } from "./auth-utils";
import { hojeSP } from "./formato";

const pin = z.string().regex(/^\d{4}$/, "PIN deve ter 4 dígitos");
const telefone = z.string().transform(soDigitos).refine((t) => t.length >= 10 && t.length <= 11, "Telefone inválido");

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function exigirDono(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "dono" });
  if (!data) throw new Error("Apenas o dono pode fazer isso.");
  const { data: u } = await ctx.supabase.from("usuarios").select("nome").eq("id", ctx.userId).single();
  return (u?.nome as string) ?? "Dono";
}

/* ---------- Configuração inicial (público, só funciona sem dono) ---------- */

export const existeDono = createServerFn({ method: "GET" }).handler(async () => {
  const a = await admin();
  const { count } = await a.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "dono");
  return { existe: (count ?? 0) > 0 };
});

export const criarPrimeiroDono = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ nome: z.string().trim().min(2), telefone, pin }).parse(d))
  .handler(async ({ data }) => {
    const a = await admin();
    const { count } = await a.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "dono");
    if ((count ?? 0) > 0) throw new Error("O dono já foi cadastrado.");
    await criarConta(a, { ...data, papel: "dono" });
    return { ok: true };
  });

async function criarConta(
  a: Awaited<ReturnType<typeof admin>>,
  d: { nome: string; telefone: string; pin: string; papel: "dono" | "funcionario" },
) {
  const { data: un } = await a.from("unidades").select("id").eq("nome", "SCS").single();
  const { data: criado, error } = await a.auth.admin.createUser({
    email: emailDoTelefone(d.telefone),
    password: senhaDoPin(d.pin),
    email_confirm: true,
    user_metadata: { nome: d.nome },
  });
  if (error || !criado.user) throw new Error(error?.message.includes("already") ? "Telefone já cadastrado." : error?.message ?? "Erro ao criar usuário");
  const id = criado.user.id;
  const { error: e1 } = await a.from("usuarios").insert({ id, nome: d.nome, telefone: d.telefone, unidade_id: un?.id ?? null });
  const { error: e2 } = await a.from("user_roles").insert({ user_id: id, role: d.papel });
  if (e1 || e2) {
    await a.auth.admin.deleteUser(id);
    throw new Error("Erro ao salvar usuário.");
  }
}

/* ---------- Funcionário ---------- */

const fotoSchema = z.object({
  tipo: z.enum(["hubbarber", "pagbank"]),
  path: z.string().min(5),
  capturada_em: z.string(),
});

export const enviarFechamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      maquina: z.number().min(0),
      assinatura: z.number().min(0),
      dinheiro: z.number().min(0),
      fotos: z.array(fotoSchema).length(2),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const a = await admin();
    const { data: u } = await a.from("usuarios").select("nome, unidade_id, ativo").eq("id", context.userId).single();
    if (!u?.ativo || !u.unidade_id) throw new Error("Usuário sem unidade ativa.");
    for (const f of data.fotos) if (!f.path.startsWith(`${u.unidade_id}/`)) throw new Error("Foto inválida.");
    const hoje = hojeSP();
    const { data: existente } = await a.from("fechamentos").select("*").eq("unidade_id", u.unidade_id).eq("data", hoje).maybeSingle();
    if (existente && existente.status !== "reaberto") throw new Error("O fechamento de hoje já foi enviado.");

    const valores = {
      status: "enviado",
      enviado_por: context.userId,
      enviado_por_nome: u.nome,
      enviado_em: new Date().toISOString(),
      valor_maquina: data.maquina,
      valor_assinatura: data.assinatura,
      valor_dinheiro: data.dinheiro,
      leitura_hub: null,
      leitura_pag: null,
      leitura_status: "pendente",
      leitura_erro: null,
      corrigido_por_nome: null,
      corrigido_em: null,
    };
    let id: string;
    if (existente) {
      id = existente.id;
      await a.from("fechamentos").update(valores).eq("id", id);
    } else {
      const { data: novo, error } = await a.from("fechamentos").insert({ ...valores, unidade_id: u.unidade_id, data: hoje }).select("id").single();
      if (error || !novo) throw new Error("Não foi possível salvar o fechamento.");
      id = novo.id;
    }
    await a.from("fotos").insert(data.fotos.map((f) => ({ ...f, fechamento_id: id })));

    const { lerFotos, gerarAlertas } = await import("./processamento.server");
    await lerFotos(a, id);
    await gerarAlertas(a, id);
    return { ok: true, enviado_em: valores.enviado_em, nome: u.nome };
  });

/* ---------- Dono ---------- */

export const reabrirFechamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const nome = await exigirDono(context);
    const a = await admin();
    const { data: f } = await a.from("fechamentos").select("*").eq("id", data.id).single();
    if (!f) throw new Error("Fechamento não encontrado.");
    const { data: fotos } = await a.from("fotos").select("tipo, path, capturada_em").eq("fechamento_id", f.id);
    const { versoes, ...snap } = f;
    const novas = [...((versoes as unknown[]) ?? []), { ...snap, fotos, reaberto_por: nome, reaberto_em: new Date().toISOString() }];
    await a.from("fechamentos").update({ status: "reaberto", versoes: novas as never }).eq("id", f.id);
    return { ok: true };
  });

const num = z.number().nullable();
export const corrigirLeitura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      entradas: z.object({ dinheiro: num, credito: num, debito: num, pix: num, assinatura: num, outro: num }),
      pag_total: num,
      pag_qtd: z.number().int().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const nome = await exigirDono(context);
    const a = await admin();
    const { data: f } = await a.from("fechamentos").select("leitura_hub, leitura_pag").eq("id", data.id).single();
    if (!f) throw new Error("Fechamento não encontrado.");
    const hub = { ...((f.leitura_hub as object) ?? {}), entradas: data.entradas };
    const pag = { ...((f.leitura_pag as object) ?? {}), total_vendido: data.pag_total, quantidade_vendas: data.pag_qtd };
    await a.from("fechamentos").update({
      leitura_hub: hub as never, leitura_pag: pag as never, leitura_status: "lido",
      corrigido_por_nome: nome, corrigido_em: new Date().toISOString(),
    }).eq("id", data.id);
    const { gerarAlertas } = await import("./processamento.server");
    await gerarAlertas(a, data.id);
    return { ok: true };
  });

export const lerNovamente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirDono(context);
    const a = await admin();
    const { lerFotos, gerarAlertas } = await import("./processamento.server");
    await lerFotos(a, data.id);
    await gerarAlertas(a, data.id);
    return { ok: true };
  });

export const recalcularAlertas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirDono(context);
    const { gerarAlertas } = await import("./processamento.server");
    await gerarAlertas(await admin(), data.id);
    return { ok: true };
  });

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ nome: z.string().trim().min(2), telefone, pin, papel: z.enum(["dono", "funcionario"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirDono(context);
    await criarConta(await admin(), data);
    return { ok: true };
  });

export const atualizarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), ativo: z.boolean().optional(), pin: pin.optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirDono(context);
    if (data.id === context.userId && data.ativo === false) throw new Error("Você não pode desativar a si mesmo.");
    const a = await admin();
    if (data.pin) await a.auth.admin.updateUserById(data.id, { password: senhaDoPin(data.pin) });
    if (data.ativo !== undefined) {
      await a.from("usuarios").update({ ativo: data.ativo }).eq("id", data.id);
      await a.auth.admin.updateUserById(data.id, { ban_duration: data.ativo ? "none" : "876000h" });
    }
    return { ok: true };
  });
