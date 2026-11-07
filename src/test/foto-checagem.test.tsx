import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizarChecagem } from "@/lib/checagem-foto";

const mocks = vi.hoisted(() => ({ conferirFoto: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => () => ({}), Link: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/use-sessao", () => ({ useSessao: () => ({ data: null }), sair: vi.fn() }));
vi.mock("@/lib/caixa.functions", () => ({ conferirFoto: mocks.conferirFoto, enviarFechamento: vi.fn() }));
vi.mock("@/lib/imagem", () => ({ comprimirFoto: async () => new Blob(["jpeg"], { type: "image/jpeg" }) }));

import { EtapaFoto } from "@/routes/_authenticated/caixa";

URL.createObjectURL = vi.fn(() => "blob:foto");
URL.revokeObjectURL = vi.fn();

function Tela({ tipo, onUsar }: { tipo: "hubbarber" | "pagbank"; onUsar: () => void }) {
  const [foto, setFoto] = useState<Parameters<typeof EtapaFoto>[0]["foto"]>(null);
  return <EtapaFoto tipo={tipo} titulo="Foto" dica="dica" foto={foto} setFoto={setFoto} onUsar={onUsar} />;
}

function tirarFoto(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["x"], "caixa.jpg", { type: "image/jpeg" })] } });
}

describe("captura da foto do caixa", () => {
  beforeEach(() => {
    mocks.conferirFoto.mockReset();
  });

  it("mostra dicas antes de fotografar", () => {
    render(<Tela tipo="hubbarber" onUsar={vi.fn()} />);
    expect(screen.getByText(/tela ocupando quase toda a foto/)).toBeInTheDocument();
  });

  it("sem números: abre o aviso 'Não localizamos o fechamento' com motivo, dica e X", async () => {
    mocks.conferirFoto.mockResolvedValue({ ok: false, problema: "longe" });
    const { container } = render(<Tela tipo="hubbarber" onUsar={vi.fn()} />);
    tirarFoto(container);

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent("Não localizamos o fechamento");
    expect(dialogo).toHaveTextContent("Os números ficaram pequenos demais para ler.");
    expect(dialogo).toHaveTextContent("Aproxime mais o celular");
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument(); // o X
    expect(mocks.conferirFoto).toHaveBeenCalledWith({ data: { tipo: "hubbarber", imagem: expect.any(String) } });
  });

  it("o X fecha o aviso e deixa um lembrete para ver a dica de novo", async () => {
    mocks.conferirFoto.mockResolvedValue({ ok: false, problema: "reflexo" });
    const { container } = render(<Tela tipo="hubbarber" onUsar={vi.fn()} />);
    tirarFoto(container);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByText(/Toque para ver a dica/));
    expect(await screen.findByRole("dialog")).toHaveTextContent("reflexo");
  });

  it("só avisa: 'Usar assim mesmo' segue para o próximo passo", async () => {
    mocks.conferirFoto.mockResolvedValue({ ok: false, problema: "nao_e_a_tela" });
    const onUsar = vi.fn();
    const { container } = render(<Tela tipo="hubbarber" onUsar={onUsar} />);
    tirarFoto(container);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Usar assim mesmo" }));
    expect(onUsar).toHaveBeenCalledTimes(1);
  });

  it("PagBank usa o título do resumo de vendas", async () => {
    mocks.conferirFoto.mockResolvedValue({ ok: false, problema: "desfocada" });
    const { container } = render(<Tela tipo="pagbank" onUsar={vi.fn()} />);
    tirarFoto(container);
    expect(await screen.findByRole("dialog")).toHaveTextContent("Não localizamos o resumo de vendas");
  });

  it("foto boa: confirma e não abre aviso", async () => {
    mocks.conferirFoto.mockResolvedValue({ ok: true, problema: null });
    const { container } = render(<Tela tipo="hubbarber" onUsar={vi.fn()} />);
    tirarFoto(container);
    expect(await screen.findByText(/Números encontrados/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Usar foto/ })).toBeEnabled();
  });

  it("enquanto confere, 'Usar foto' fica travado", async () => {
    mocks.conferirFoto.mockReturnValue(new Promise(() => {}));
    const { container } = render(<Tela tipo="hubbarber" onUsar={vi.fn()} />);
    tirarFoto(container);
    expect(await screen.findByRole("button", { name: /Conferindo/ })).toBeDisabled();
  });

  it("IA fora do ar: não trava o barbeiro", async () => {
    mocks.conferirFoto.mockRejectedValue(new Error("rede"));
    const { container } = render(<Tela tipo="hubbarber" onUsar={vi.fn()} />);
    tirarFoto(container);
    expect(await screen.findByText(/Não deu para conferir a foto agora/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Usar foto/ })).toBeEnabled();
  });
});

describe("resposta da IA na checagem", () => {
  it("só aprova com ok === true", () => {
    expect(normalizarChecagem({ ok: true, problema: "longe" })).toEqual({ ok: true, problema: null });
    expect(normalizarChecagem({ ok: "true" })).toEqual({ ok: false, problema: "nao_e_a_tela" });
  });
  it("motivo desconhecido vira 'não é a tela'", () => {
    expect(normalizarChecagem({ ok: false, problema: "outra coisa" })).toEqual({ ok: false, problema: "nao_e_a_tela" });
    expect(normalizarChecagem({ ok: false, problema: "cortada" })).toEqual({ ok: false, problema: "cortada" });
  });
});
