# Conferente de Caixa · Navalha da Corte — regras do sistema e migração para VPS

> Documento de referência de **tudo que o sistema faz** e de **como tirá-lo do Lovable** e rodar numa VPS própria.
> Atualizado em 09/11/2026, versão do código `1b11da9`.

---

## 1. Visão geral

Sistema **interno** para fechar e conferir o caixa diário de cada unidade da barbearia.

- O **barbeiro** fotografa a tela do HubBarber e o resumo da PagBank, digita 3 valores e envia.
- A **IA** (Claude) lê as fotos.
- O sistema **confere** os valores com 11 regras e gera alertas verdes, amarelos ou vermelhos.
- O **dono** acompanha tudo num painel por unidade: calendário, histórico, ajustes, reabrir e corrigir.

Fuso horário de tudo: **America/Sao_Paulo**. Valores calculados em **centavos** para não errar arredondamento.

**Tecnologia:** TanStack Start (React + servidor), Supabase (Postgres, login e armazenamento das fotos), IA Claude e Tailwind.

---

## 2. Unidades

| Unidade | Código | Endereço do caixa |
|---|---|---|
| SCS | `scs` | `/scs` |
| Studio 302 | `studio302` | `/studio302` |
| Planaltina | `planaltina` | `/planaltina` |
| Mondial | `mondial` | `/mondial` |

Cada unidade tem as próprias regras, editáveis em **Painel → Ajustes**:

| Campo (`unidades`) | Para que serve | Padrão (SCS) |
|---|---|---|
| `nome` | Nome exibido | — |
| `codigo` | Endereço do caixa: minúsculas, números e hífen, de 2 a 30 caracteres | — |
| `valor_plano` | Valor de cada serviço do plano de assinatura | R$ 35,00 |
| `multiplo_avulso` | A receita avulsa do dia deve ser múltiplo deste valor | R$ 5,00 |
| `dias_funcionamento` | Dias em que abre (0 = domingo … 6 = sábado) | seg–sex `{1,2,3,4,5}` |
| `dias_ilimitado` | Dias em que o atendimento ilimitado (R$ 0,01) vale | seg–qua `{1,2,3}` |
| `horario_limite` | Depois desse horário, o dia sem envio fica "não enviado" | 20:00 |
| `data_inicio_assinatura` | Data a partir da qual a forma "Outro" deve virar "Assinatura" | 09/11/2026 |
| `ativa` | Unidade inativa: o link do caixa para de funcionar | sim |

Os códigos `caixa`, `painel`, `configuracao-inicial`, `api`, `assets`, `login` e `sair` são **reservados**, porque já são páginas do app.

---

## 3. Perfis e acesso

| Perfil | O que pode |
|---|---|
| **Funcionário (barbeiro)** | Só o caixa **de hoje** e **da unidade dele**. Não vê calendário, histórico nem outras unidades. |
| **Dono** | Tudo, em todas as unidades: painel, caixa de qualquer unidade, reabrir, corrigir, ajustes, usuários e feriados. |

- Os papéis ficam na tabela `user_roles` (`dono` ou `funcionario`), conferidos pela função `has_role()`. **Nunca** guarde o papel na tabela `usuarios`.
- Cada usuário pertence a **uma** unidade (`usuarios.unidade_id`).
- **Não existe cadastro aberto.** Só o dono cria contas (Ajustes → Usuários). O primeiro dono é criado em `/configuracao-inicial`, que só funciona enquanto não existe nenhum dono.
- Usuário desativado fica bloqueado no login.

### Login (telefone + PIN)
- O telefone vira um e-mail interno: `61994415050@func.navalhadacorte.app`.
- O PIN de 4 dígitos vira a senha: `ndc-<PIN>-scs`. O sufixo `scs` é fixo para todas as unidades, por compatibilidade. **Não mude**, ou todos os logins param de funcionar.
- O telefone é normalizado: o app tira o `+55` e o `0` da frente, como o celular costuma autopreencher.

### Endereços
| Endereço | Comportamento |
|---|---|
| `/` | Login geral: o dono vai para `/painel` e o barbeiro para `/<codigo da unidade dele>` |
| `/<codigo>` | Sem login: login da unidade. Logado: caixa da unidade. |
| `/<codigo>` com funcionário de **outra** unidade | Login recusado com "Você não tem acesso à unidade X". Se já estiver logado, aparece a tela de bloqueio com um link para a unidade dele. |
| `/caixa` | Redireciona para a unidade certa |
| `/painel`, `/painel/historico`, `/painel/config`, `/painel/dia/AAAA-MM-DD` | Só o dono |

O bloqueio também acontece **no servidor** (`unidadeDoCaixa`) e **no banco** (políticas de acesso). Mudar o endereço não dá acesso a nada.

---

## 4. Fechamento do caixa (passo a passo do barbeiro)

1. **Início:** mostra o dia e a data. Se o caixa de hoje já foi enviado, fica **bloqueado** ("Caixa enviado às HH:MM por Fulano"). Só o dono reabre.
2. **Foto do HubBarber:** o quadro **"Entradas por forma"**. Logo depois da foto, a IA faz uma **checagem rápida**:
   - Se não achar os números, abre o aviso **"Não localizamos o fechamento"** com X, motivo e dica: longe, cortada, reflexo, desfocada, escura ou tela errada.
   - **Só avisa:** o barbeiro pode tirar outra foto ou "Usar assim mesmo".
   - Se a IA estiver fora do ar, aparece um lembrete e o fechamento não trava.
3. **Foto da PagBank:** sem checagem, segue direto.
4. **Valores:** máquina, assinatura e dinheiro em espécie. Zero é permitido. Aceita `150,00`, `150.00` e `1.234,56`.
5. **Revisar e enviar.**

As fotos são comprimidas no celular (lado maior com 1600 px, JPEG com qualidade 0,85) e salvas em `fotos-caixa/<unidade_id>/<AAAA-MM-DD>/<tipo>-<timestamp>.jpg`.

**Ao enviar (servidor `enviarFechamento`):**
- confere o papel (dono ou funcionário) e a unidade do caixa (funcionário só a dele);
- exige uma foto de cada tipo, com o caminho completo validado: unidade, dia de hoje e nome do arquivo;
- recusa se o fechamento de hoje já foi enviado (a não ser que esteja "reaberto");
- grava o fechamento e as fotos com acesso de administrador. O funcionário **não consegue** gravar direto no banco;
- a IA lê as duas fotos, as regras geram os alertas e, se falhar ao salvar as fotos, o fechamento volta para "reaberto".

---

## 5. Leitura das fotos pela IA

- **HubBarber:** extrai entradas por forma (dinheiro, crédito, débito, PIX, assinatura, outro), saídas (forma, descrição e valor) e Saldo Final. Data, número do caixa e lançamentos só entram se aparecerem.
  - Forma que **não aparece** no quadro "Entradas por forma" = **R$ 0**.
  - "-" em Saídas = **nenhuma saída**.
- **PagBank:** total vendido e quantidade de vendas.
- **A IA nunca inventa valor:** campo ilegível vira `null` e o alerta "não foi possível conferir".
- **Checagem rápida (só HubBarber):** aprova se o quadro "Entradas por forma" estiver inteiro e legível. Não exige data.

Instruções da IA: `src/lib/leitura.server.ts`. Textos do aviso: `src/lib/checagem-foto.ts`.

---

## 6. Regras de conferência

Arquivo: `src/lib/regras.ts`, coberto por testes em `src/test/`. O servidor e o painel usam a **mesma** função `avaliar()`.

| # | Regra | Nível |
|---|---|---|
| 1 | Lançamento em dia que a unidade **não abre** (`dias_funcionamento`) ou em **feriado** | 🟡 |
| 2 | Foto do HubBarber com data de fechamento **de outro dia** | 🔴 |
| 2 | Caixa aberto num dia e fechado em outro | 🟡 |
| 3 | **Máquina:** o valor digitado tem que ser igual ao total da PagBank e à soma crédito + débito + PIX do HubBarber | 🔴 se diferente · 🟡 se não deu para ler |
| 4 | **Dinheiro:** o valor digitado tem que ser igual às entradas em dinheiro menos as saídas em dinheiro | 🔴 se diferente · 🟡 se não deu para ler |
| 5 | Valor em **"Outro"** a partir de `data_inicio_assinatura` (deveria ser "Assinatura") | 🟡 |
| 6 | **Assinatura** não é múltiplo de `valor_plano`, ou o valor digitado difere do lido | 🟡 |
| 7 | **Ilimitado** (R$ 0,01) em dia de funcionamento fora de `dias_ilimitado` | 🟡 |
| 8 | **Avulso** (máquina + dinheiro) não é múltiplo de `multiplo_avulso` | 🟡 |
| 9 | Saída **sem descrição** | 🟡 |
| 10 | Saídas em dinheiro **maiores** que as entradas em dinheiro | 🔴 |
| 11 | Dia útil **sem envio** depois do `horario_limite`. É calculado na hora de exibir, não é gravado como alerta. | ⚫ não enviado |

**Assinatura:** cada serviço do plano vale `valor_plano` e cada ilimitado vale R$ 0,01 (os centavos). Exemplo com plano de R$ 35: R$ 490,04 = 14 serviços + 4 ilimitados.

**Status do dia:** 🔴 se houver alerta vermelho aberto · 🟡 se houver alerta aberto · 🟢 sem alertas · ⚫ não enviado · dia sem expediente ou futuro fica neutro.

**O dono pode:**
- **resolver** um alerta, com observação;
- **reabrir** o fechamento (a versão anterior fica guardada em `versoes`);
- **corrigir a leitura** da IA;
- mandar **ler as fotos de novo**.

Cada uma dessas ações recalcula os alertas não resolvidos.

**Feriados:** uma lista única, nacionais e do DF, que vale para **todas** as unidades. Ao cadastrar ou remover um feriado, os fechamentos daquele dia são recalculados.

---

## 7. Banco de dados (Supabase / Postgres)

Os scripts ficam em `drizzle/migrations/` e precisam rodar **em ordem**, de `0000` a `0006`.

**Tabelas:** `unidades`, `usuarios`, `user_roles`, `feriados`, `fechamentos` (1 por unidade por dia), `fotos`, `alertas`.

**Funções:**
- `has_role(user, papel)`: diz se o usuário tem aquele papel;
- `minha_unidade()`: unidade do usuário logado;
- `hoje_sp()`: data de hoje em São Paulo;
- `unidade_por_codigo(codigo)`: **pública**, devolve só `id`, `nome` e `codigo` de unidade ativa, para a tela de login.

**Políticas de acesso (RLS), em resumo:**
- **Visitante sem login:** não lê nada. Só pode chamar `unidade_por_codigo`.
- **Funcionário:** lê o próprio usuário, o próprio papel, a própria unidade e os feriados. Lê o fechamento e as fotos **de hoje da unidade dele**. **Não pode gravar** fechamentos nem fotos direto (só o servidor grava). Pode enviar imagens para `fotos-caixa/<sua unidade>/<hoje>/`.
- **Dono:** tudo.

**Armazenamento:** bucket **`fotos-caixa`, privado**. O painel abre as fotos com links temporários de 1 hora. ⚠️ O bucket **não está nos scripts**: o Lovable criou fora deles. Na migração, crie com `docs/vps/01-bucket.sql`.

**Configuração de login (Supabase Auth):**
- e-mail e senha ligados;
- **cadastro público desligado** (o dono cria as contas pelo servidor);
- confirmação de e-mail desligada (as contas já são criadas confirmadas).

---

## 8. Variáveis de ambiente

| Variável | Onde | Para quê |
|---|---|---|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | servidor / navegador | Endereço do Supabase |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | servidor / navegador | Chave **pública** (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | **só servidor** | Chave **secreta** de administrador: cria usuários e grava fechamentos. **Nunca** coloque no Git. |
| `LOVABLE_API_KEY` | só servidor | Chave da IA pelo Lovable. **Sai na migração** (veja abaixo). |
| `ANTHROPIC_API_KEY` | só servidor | Chave da IA própria, depois da migração |

Modelo de arquivo: `docs/vps/env.exemplo`.

---

## 9. O que depende do Lovable

| Item | Situação fora do Lovable | O que fazer |
|---|---|---|
| **Banco Supabase** (projeto `dfytztsmpxjdiqoufqfw`, "Lovable Cloud") | Fica no Lovable | **Migrar** para um Supabase seu (veja a seção 10) |
| **IA** (`@lovable.dev/ai-gateway` + `LOVABLE_API_KEY`) | **Para de funcionar** | Trocar pelo SDK oficial da Anthropic com `ANTHROPIC_API_KEY`. É uma mudança só em `src/lib/leitura.server.ts`. |
| **Build** (`@lovable.dev/vite-tanstack-config`) | Funciona, é um pacote público | Gerar com `NITRO_PRESET=node-server`. O padrão é Cloudflare. ✅ Testado. |
| `previewAuthStorage.ts`, `lovable-error-reporting.ts` | Ficam inativos fora dos domínios do Lovable | Podem ficar; removíveis depois |
| Selo "Edit with Lovable", estatística de visitas (`~flock.js`), imagem de compartilhamento do Lovable | São colocados pela hospedagem do Lovable | **Somem sozinhos** na VPS |
| `AGENTS.md`, `.lovable/`, `README.md` | Instruções para o Lovable | Atualizar ou remover depois da migração |

---

## 10. Migração para a VPS — passo a passo

> ⚠️ **Antes de tudo:** deixe o repositório do GitHub **privado** (Settings → Danger Zone → Change visibility). Os dados exportados (telefones, valores) **nunca** devem ir para o GitHub.

### A. Banco novo
Escolha uma opção:
- **Supabase na nuvem, na sua conta** (supabase.com): o mais simples, sem mudar código. O plano grátis atende.
- **Supabase instalado na VPS** (Docker): tudo na sua máquina, mas dá mais trabalho manter: backup, atualizações e segurança.

Depois, no banco novo:
1. Rode `drizzle/migrations/0000` até `0006`, em ordem, no SQL Editor.
2. Rode `docs/vps/01-bucket.sql` (bucket privado `fotos-caixa`).
3. Em Authentication: desligue o **cadastro público** e a **confirmação de e-mail**.

### B. Dados
1. **Exporte do Lovable** as tabelas `unidades`, `feriados`, `usuarios`, `user_roles`, `fechamentos`, `fotos` e `alertas`, e importe nessa mesma ordem.
2. **Exporte as fotos** do bucket `fotos-caixa` e envie para o bucket novo, **mantendo os mesmos caminhos**.
3. **Contas de login:** as senhas ficam no sistema de login do Supabase e talvez não dê para exportar. Se não der:
   - crie o dono de novo em `/configuracao-inicial`;
   - recadastre os barbeiros em Ajustes com o **mesmo telefone**, escolhendo um PIN;
   - ⚠️ como o `id` muda, os registros em `usuarios` e `user_roles` passam a ser criados pelo próprio app, então não importe essas duas tabelas;
   - os fechamentos antigos guardam o nome de quem enviou (`enviado_por_nome`), então o histórico continua legível.

### C. Código
1. Trocar a IA para a Anthropic (seção 9).
2. Criar o arquivo de configuração **fora do repositório**, em `/etc/conectorcaixa.env`, a partir de `docs/vps/env.exemplo`, com as chaves do banco novo e da Anthropic.
   ⚠️ O `.env` que está no repositório aponta para o **banco do Lovable**. Depois de migrar, troque o conteúdo dele pelas chaves **públicas** do banco novo, ou apague o arquivo. O build grava as variáveis `VITE_*` dentro do app, então elas precisam estar certas **na hora do build**.

### D. Rodar na VPS
```bash
# Node 20+ e Bun instalados
git clone <seu-repo> /opt/conectorcaixa && cd /opt/conectorcaixa
bun install
set -a; . /etc/conectorcaixa.env; set +a      # carrega as chaves do banco novo
NITRO_PRESET=node-server bun run build
node .output/server/index.mjs                 # usa PORT do arquivo (3000)
```
Para atualizar depois: `git pull`, repita o build e rode `sudo systemctl restart conectorcaixa`.
- Mantenha o app rodando com **pm2** ou **systemd**. Exemplo: `docs/vps/conectorcaixa.service`.
- Coloque **nginx** na frente com **HTTPS** (Let's Encrypt). A câmera do celular só funciona com HTTPS. Exemplo: `docs/vps/nginx.conf`.
- Aponte o domínio para a VPS e ajuste `SITE` em `src/routes/__root.tsx`, que é o endereço da imagem de compartilhamento.

### E. Conferência depois de migrar
- [ ] `/scs`, `/studio302`, `/planaltina` e `/mondial` mostram o nome da unidade
- [ ] O dono entra e vê o painel com o seletor das 4 unidades
- [ ] O barbeiro entra no endereço da unidade dele e fecha o caixa de ponta a ponta (fotos → checagem → valores → envio)
- [ ] A IA leu as fotos (o painel do dia mostra a leitura e os alertas)
- [ ] Um barbeiro em outra unidade é bloqueado
- [ ] As fotos antigas abrem no painel
- [ ] `https://seu-dominio/robots.txt` bloqueia buscadores
- [ ] Backup diário do banco configurado
- [ ] Projeto antigo no Lovable desligado só depois de tudo conferido

---

## 11. Comandos úteis
| Comando | O que faz |
|---|---|
| `bun install` | Instala as dependências |
| `bun run dev` | Ambiente de desenvolvimento |
| `bun run test` | Testes automáticos (73 hoje) |
| `bun x tsc --noEmit -p .` | Checagem de tipos |
| `NITRO_PRESET=node-server bun run build` | Build para VPS |
| `node .output/server/index.mjs` | Roda o build (porta pela variável `PORT`) |
