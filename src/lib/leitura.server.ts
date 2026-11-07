import { generateMessage } from "@lovable.dev/ai-gateway";
import type { LeituraHub, LeituraPag } from "./regras";

const MODELO = "anthropic/claude-sonnet-5" as const;

const REGRA_GERAL = `Responda APENAS com JSON válido, sem markdown. Valores monetários como número em reais (ex.: 1234.56). Se um campo estiver ilegível ou não aparecer, use null e inclua o nome do campo na lista "nao_identificados". NUNCA invente ou estime valores.`;

const PROMPT_HUB = `Esta é uma foto da tela de fechamento de caixa do sistema HubBarber. Extraia:
{
 "numero_caixa": string|null,
 "status": string|null,
 "abertura": "YYYY-MM-DDTHH:MM"|null,
 "fechamento": "YYYY-MM-DDTHH:MM"|null,
 "entradas": {"dinheiro":n|null,"credito":n|null,"debito":n|null,"pix":n|null,"assinatura":n|null,"outro":n|null},
 "saidas": [{"forma":string|null,"descricao":string|null,"valor":n|null}],
 "valor_inicial": n|null,
 "total": n|null,
 "lancamentos": [{"hora":string|null,"comanda":string|null,"cliente":string|null,"forma":string|null,"valor":n|null}],
 "nao_identificados": [string]
}
Formas de entrada: Dinheiro, Cartão de Crédito, Cartão de Débito, PIX, Assinatura, Outro. Se a forma não aparecer na tela, use 0 apenas se a tela mostrar claramente que não houve entrada; caso contrário null. Saída sem descrição: descricao null. ${REGRA_GERAL}`;

const PROMPT_PAG = `Esta é uma foto do aplicativo/maquininha PagBank com o resumo de vendas do dia. Extraia:
{"total_vendido": n|null, "quantidade_vendas": inteiro|null, "nao_identificados": [string]}
${REGRA_GERAL}`;

async function ler<T>(imagemBase64: string, prompt: string): Promise<T> {
  const resp = await generateMessage({
    model: MODELO,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imagemBase64 } },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
  const texto = (resp.content ?? [])
    .map((b) => ("text" in b && typeof b.text === "string" ? b.text : ""))
    .join("");
  const ini = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (ini < 0 || fim < 0) throw new Error("Resposta da leitura sem JSON");
  return JSON.parse(texto.slice(ini, fim + 1)) as T;
}

export const lerHub = (b64: string) => ler<LeituraHub>(b64, PROMPT_HUB);
export const lerPag = (b64: string) => ler<LeituraPag>(b64, PROMPT_PAG);
