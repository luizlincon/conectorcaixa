import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut, ShieldX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Marca } from "@/components/Marca";
import { FormLogin } from "@/components/FormLogin";
import { sair, useSessao } from "@/hooks/use-sessao";
import { podeOperarCaixa } from "@/lib/permissoes";
import { unidadePorCodigoQuery, type UnidadePublica } from "@/lib/unidades";
import { Caixa } from "./_authenticated/caixa";

/**
 * Endereço de cada unidade: /scs, /studio302, /planaltina, /mondial.
 * Sem login: tela de login da unidade. Logado: caixa da unidade.
 * Funcionário de outra unidade: bloqueado (o banco também só deixa ele ver a dele).
 */
export const Route = createFileRoute("/$unidade")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Fechar caixa · Navalha da Corte" },
      { name: "description", content: "Fechamento do caixa da unidade." },
      { property: "og:title", content: "Fechar caixa · Navalha da Corte" },
      { property: "og:description", content: "Fechamento do caixa da unidade." },
    ],
  }),
  component: PaginaUnidade,
});

/** Funcionário só acessa a unidade dele; o dono acessa todas. */
export function acessoAUnidade(sessao: { papel: string; unidadeId: string | null } | null | undefined, unidadeId: string) {
  if (!sessao) return "sem_login" as const;
  if (!podeOperarCaixa(sessao.papel)) return "sem_permissao" as const;
  if (sessao.papel === "dono" || sessao.unidadeId === unidadeId) return "liberado" as const;
  return "outra_unidade" as const;
}

function PaginaUnidade() {
  const { unidade: codigo } = Route.useParams();
  const qc = useQueryClient();
  const u = useQuery(unidadePorCodigoQuery(codigo.toLowerCase()));
  const { data: sessao, isLoading } = useSessao();

  if (u.isLoading || isLoading) return null;
  if (!u.data) return <NaoEncontrada codigo={codigo} />;
  const unidade = u.data;

  const acesso = acessoAUnidade(sessao, unidade.id);
  if (acesso === "liberado") return <Caixa unidade={unidade} />;
  if (acesso === "outra_unidade" || acesso === "sem_permissao") return <Bloqueado unidade={unidade} meuCodigo={sessao?.unidadeCodigo ?? null} meuNome={sessao?.unidadeNome ?? ""} />;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-between px-6 py-10">
      <Marca subtitulo={`Unidade ${unidade.nome}`} />
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold">Hora de fechar<br />o caixa.</h1>
          <p className="mt-2 text-muted-foreground">Entre com seu telefone e PIN.</p>
        </div>
        <FormLogin
          aoEntrar={async (s) => {
            if (acessoAUnidade(s, unidade.id) !== "liberado") {
              // Login certo, mas de outra unidade: não deixa entrar por este endereço.
              await supabase.auth.signOut();
              qc.removeQueries({ queryKey: ["sessao"] });
              toast.error(`Você não tem acesso à unidade ${unidade.nome}.`, {
                description: s.unidadeCodigo ? `Use o endereço da sua unidade: /${s.unidadeCodigo}` : "Fale com o dono.",
              });
              return;
            }
            await qc.invalidateQueries({ queryKey: ["sessao"] });
          }}
        />
      </div>
      <p className="text-center text-sm text-muted-foreground">Esqueceu o PIN? Fale com o dono.</p>
    </main>
  );
}

function Bloqueado({ unidade, meuCodigo, meuNome }: { unidade: UnidadePublica; meuCodigo: string | null; meuNome: string }) {
  return (
    <main className="mx-auto min-h-screen max-w-md space-y-8 px-6 py-10">
      <Marca subtitulo={`Unidade ${unidade.nome}`} />
      <div className="space-y-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive"><ShieldX className="size-8" /></div>
        <h1 className="text-2xl font-bold">Você não tem acesso a esta unidade</h1>
        <p className="text-muted-foreground">Este é o caixa da unidade <b>{unidade.nome}</b>. Seu usuário só pode fechar o caixa da sua unidade.</p>
      </div>
      <div className="space-y-3">
        {meuCodigo && (
          <Button asChild size="lg" className="h-14 w-full">
            <Link to="/$unidade" params={{ unidade: meuCodigo }}>Ir para o caixa {meuNome ? `da ${meuNome}` : "da minha unidade"}</Link>
          </Button>
        )}
        <Button variant="outline" size="lg" className="h-14 w-full" onClick={sair}><LogOut /> Sair</Button>
      </div>
    </main>
  );
}

function NaoEncontrada({ codigo }: { codigo: string }) {
  return (
    <main className="mx-auto min-h-screen max-w-md space-y-6 px-6 py-10">
      <Marca />
      <h1 className="text-2xl font-bold">Unidade não encontrada</h1>
      <p className="text-muted-foreground">Não existe unidade ativa com o endereço <b>/{codigo}</b>. Confira o link com o dono.</p>
      <Button asChild variant="outline"><Link to="/">Ir para o início</Link></Button>
    </main>
  );
}
