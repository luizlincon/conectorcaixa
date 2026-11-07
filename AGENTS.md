<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Cash-check rules live as pure functions in `src/lib/regras.ts` (cents math) and are covered by `src/test/regras.test.ts`; server and UI both call `avaliar()` so results never diverge.
- Login is phone + 4-digit PIN mapped to a synthetic email/derived password (`src/lib/auth-utils.ts`); public signup is disabled and accounts are created only by the owner via admin server functions.
- Roles live in `user_roles` + `has_role()`; never store role on `usuarios`.
- Photo reading uses the Lovable AI Gateway (Anthropic Claude, messages surface) inside server functions; no Edge Functions.
- Rule 11 ("não enviado") is derived at display time from `unidades.horario_limite`, not stored as an alert.
