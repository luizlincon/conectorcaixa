export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>A página não carregou</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0f0f0f" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #0f0f0f; color: #f8f8f8; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; background: #202020; border-radius: 1rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #a3a3a3; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.6rem 1.1rem; border-radius: 0.6rem; font: inherit; font-weight: 600; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #5dd62c; color: #0f0f0f; }
      .secondary { background: transparent; color: #f8f8f8; border-color: #3a3a3a; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>A página não carregou</h1>
      <p>Algo deu errado do nosso lado. Tente de novo ou volte ao início.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Tentar de novo</button>
        <a class="secondary" href="/">Ir para o início</a>
      </div>
    </div>
  </body>
</html>`;
}
