import { avaliar, type LeituraHub, type LeituraPag } from "./regras";
import { lerHub, lerPag } from "./leitura.server";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

function paraBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function baixar(admin: Admin, path: string) {
  const { data, error } = await admin.storage.from("fotos-caixa").download(path);
  if (error || !data) throw new Error("Foto não encontrada");
  return paraBase64(await data.arrayBuffer());
}

/** Lê as fotos com IA e salva a leitura. Não lança: registra erro no fechamento. */
export async function lerFotos(admin: Admin, fechamentoId: string) {
  const { data: fotos } = await admin.from("fotos").select("tipo, path").eq("fechamento_id", fechamentoId).order("created_at", { ascending: false });
  const hubFoto = fotos?.find((f) => f.tipo === "hubbarber");
  const pagFoto = fotos?.find((f) => f.tipo === "pagbank");
  try {
    const [hub, pag] = await Promise.all([
      hubFoto ? baixar(admin, hubFoto.path).then(lerHub) : Promise.resolve(null),
      pagFoto ? baixar(admin, pagFoto.path).then(lerPag) : Promise.resolve(null),
    ]);
    await admin.from("fechamentos").update({ leitura_hub: hub as never, leitura_pag: pag as never, leitura_status: "lido", leitura_erro: null }).eq("id", fechamentoId);
  } catch (e) {
    console.error("leitura falhou", e);
    await admin.from("fechamentos").update({ leitura_status: "erro", leitura_erro: e instanceof Error ? e.message : "erro" }).eq("id", fechamentoId);
  }
}

/** Recalcula alertas: substitui os não resolvidos pelos novos. */
export async function gerarAlertas(admin: Admin, fechamentoId: string) {
  const { data: f } = await admin.from("fechamentos").select("*").eq("id", fechamentoId).single();
  if (!f) throw new Error("Fechamento não encontrado");
  const [{ data: feriados }, { data: unidade }] = await Promise.all([
    admin.from("feriados").select("data"),
    admin.from("unidades").select("data_inicio_assinatura").eq("id", f.unidade_id).single(),
  ]);
  const r = avaliar({
    data: f.data,
    maquina: Number(f.valor_maquina),
    assinatura: Number(f.valor_assinatura),
    dinheiro: Number(f.valor_dinheiro),
    hub: (f.leitura_hub as LeituraHub | null) ?? null,
    pag: (f.leitura_pag as LeituraPag | null) ?? null,
    feriados: (feriados ?? []).map((x) => x.data),
    dataInicioAssinatura: unidade?.data_inicio_assinatura ?? "2026-11-09",
  });
  await admin.from("alertas").delete().eq("fechamento_id", fechamentoId).eq("resolvido", false);
  if (r.alertas.length) {
    await admin.from("alertas").insert(
      r.alertas.map((a) => ({ ...a, fechamento_id: fechamentoId, unidade_id: f.unidade_id, data: f.data })),
    );
  }
  return r;
}
