import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailDoTelefone, formatarTelefone, pinValido, senhaDoPin } from "@/lib/auth-utils";
import { sessaoQuery, type Sessao } from "@/hooks/use-sessao";

/** Formulário de telefone + PIN. Depois de entrar, chama `aoEntrar` com a sessão (ou desconecta se a conta estiver inativa). */
export function FormLogin({ aoEntrar }: { aoEntrar: (s: Sessao) => void | Promise<void> }) {
  const qc = useQueryClient();
  const [tel, setTel] = useState("");
  const [pin, setPin] = useState("");
  const [carregando, setCarregando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinValido(pin)) return void toast.error("O PIN tem 4 dígitos.");
    setCarregando(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: emailDoTelefone(tel), password: senhaDoPin(pin) });
      if (error) return void toast.error("Telefone ou PIN incorretos.");
      qc.removeQueries({ queryKey: ["sessao"] });
      const s = await qc.fetchQuery(sessaoQuery);
      if (!s) {
        await supabase.auth.signOut();
        qc.removeQueries({ queryKey: ["sessao"] });
        return void toast.error("Usuário inativo ou sem cadastro.");
      }
      await aoEntrar(s);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <form onSubmit={entrar} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="tel">Telefone</Label>
        <Input id="tel" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="(61) 90000-0000" value={tel}
          onChange={(e) => setTel(formatarTelefone(e.target.value))} className="h-14 text-lg" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pin">PIN</Label>
        <Input id="pin" type="password" inputMode="numeric" maxLength={4} placeholder="••••" value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          className="h-14 text-center text-2xl tracking-[0.6em]" />
      </div>
      <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={carregando}>
        {carregando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
