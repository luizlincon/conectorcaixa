import { generateMessage } from "@lovable.dev/ai-gateway";
import type { LeituraHub, LeituraPag } from "./regras";
import { normalizarChecagem, PROBLEMAS, type ChecagemFoto, type TipoFoto } from "./checagem-foto";

const MODELO = "anthropic/claude-sonnet-5" as const;

const REGRA_GERAL = `Responda APENAS com JSON válido, sem markdown. Valores monetários como número em reais (ex.: 1234.56). Se um campo estiver ilegível ou não aparecer, use null e inclua o nome do campo na lista "nao_identificados". NUNCA invente ou estime valores.`;

/** Como é a tela do HubBarber que o barbeiro fotografa (calibrado com a foto modelo do dono). */
const TELA_HUB = `A tela do caixa do HubBarber tem tema escuro. A parte que importa é o quadro "Entradas por forma": uma lista com o nome de cada forma de pagamento à esquerda (Dinheiro, Cartão de Crédito, Cartão de Débito, PIX, Assinatura, Outro) e o valor em verde à direita (ex.: "R$ 435,00"). Logo abaixo vem o quadro "Saídas por forma" (um "-" significa que não houve saída). Pode aparecer também um cartão "Saldo Final" com o valor em amarelo. Só aparecem as formas que tiveram movimento no dia. A foto pode ser de um monitor, notebook ou tablet, tirada com o celular.`;

const PROMPT_HUB = `Esta é uma foto da tela do caixa do sistema HubBarber. ${TELA_HUB}
Extraia:
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
Formas de entrada: Dinheiro, Cartão de Crédito, Cartão de Débito, PIX, Assinatura, Outro. Se o quadro "Entradas por forma" aparece inteiro e legível na foto, a forma que não está na lista teve 0 (use 0). Se o quadro estiver cortado, ilegível ou não aparecer, use null para as formas que você não consegue ver. "Saídas por forma" com "-" = saidas []. "Saldo Final" vai em "total". Datas, número do caixa e lançamentos só se aparecerem na foto; senão null/[] (não é erro). Saída sem descrição: descricao null. ${REGRA_GERAL}`;

const PROMPT_PAG = `Esta é uma foto do aplicativo/maquininha PagBank com o resumo de vendas do dia. Extraia:
{"total_vendido": n|null, "quantidade_vendas": inteiro|null, "nao_identificados": [string]}
${REGRA_GERAL}`;

async function ler<T>(imagemBase64: string, prompt: string, maxTokens = 4000): Promise<T> {
  const resp = await generateMessage({
    model: MODELO,
    max_tokens: maxTokens,
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

/* ---------- Checagem rápida logo após a foto ---------- */

const ESPERADO = {
  hubbarber: `a tela do caixa do sistema HubBarber. ${TELA_HUB}
Para a foto estar boa basta: o quadro "Entradas por forma" estar inteiro na foto e dar para ler com segurança o nome e o valor de cada linha. NÃO exija data, número do caixa, Saldo Final nem formas que não estão na lista. Tela escura com letras claras é o normal desta tela (não é foto escura).`,
  pagbank: `o resumo de vendas do dia no app ou na maquininha PagBank. Para estar boa, precisa dar para ler com segurança o TOTAL vendido no dia.`,
} as const;

const promptChecagem = (tipo: TipoFoto) => `Esta foto deveria mostrar ${ESPERADO[tipo]}
Não extraia valores. Só avalie a foto e responda APENAS com JSON válido, sem markdown:
{"ok": boolean, "problema": ${PROBLEMAS.map((p) => `"${p}"`).join(" | ")} | null}
- "ok": true se for a tela certa e os valores necessários estiverem legíveis. Na dúvida entre ok e um problema pequeno que não impede a leitura, responda ok=true.
- "problema" (quando ok=false, escolha o principal): "nao_e_a_tela" (outra tela, outro app ou sem números), "longe" (números pequenos demais), "cortada" (parte dos valores fora da foto), "reflexo" (brilho/reflexo cobrindo números), "desfocada" (tremida ou fora de foco), "escura" (pouca luz).`;

export async function checarFoto(b64: string, tipo: TipoFoto): Promise<ChecagemFoto> {
  return normalizarChecagem(await ler<{ ok?: unknown; problema?: unknown }>(b64, promptChecagem(tipo), 200));
}
