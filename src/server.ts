import express from 'express';
import cookieParser from 'cookie-parser';

const AUTH_COOKIE_NAME = 'kiwy_hq_auth';

type NavKey = 'dashboard' | 'secrets';

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function pageLayout(opts: { title: string; active: NavKey; contentHtml: string }) {
  const title = escapeHtml(opts.title);

  const navLink = (key: NavKey, label: string, href: string) => {
    const isActive = opts.active === key;
    return `<a class="navlink" href="${href}" ${isActive ? 'aria-current="page"' : ''}>${escapeHtml(label)}</a>`;
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} · Kiwy HQ</title>
    <style>
      :root {
        --bg: #0b1020;
        --panel: #121a33;
        --text: #e8ecff;
        --muted: #a8b0d9;
        --kiwy: #7c5cff;
        --kiwy2: #34d399;
        --border: rgba(232,236,255,.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        background: radial-gradient(1200px 700px at 20% -10%, rgba(124,92,255,.35), transparent 60%),
                    radial-gradient(900px 600px at 100% 0%, rgba(52,211,153,.25), transparent 55%),
                    var(--bg);
        color: var(--text);
      }
      header {
        border-bottom: 1px solid var(--border);
        background: rgba(18,26,51,.75);
        backdrop-filter: blur(8px);
      }
      .wrap { max-width: 1040px; margin: 0 auto; padding: 16px; }
      .brand { display: flex; align-items: baseline; gap: 12px; }
      .logo {
        width: 14px; height: 14px; border-radius: 4px;
        background: linear-gradient(135deg, var(--kiwy), var(--kiwy2));
        box-shadow: 0 0 0 3px rgba(124,92,255,.18);
      }
      h1 { font-size: 18px; margin: 0; letter-spacing: .2px; }
      .tag { color: var(--muted); font-size: 12px; margin-top: 2px; }
      nav { display: flex; gap: 12px; align-items: center; margin-top: 10px; }
      .navlink {
        display: inline-flex;
        padding: 8px 10px;
        border: 1px solid var(--border);
        border-radius: 10px;
        text-decoration: none;
        color: var(--text);
        background: rgba(11,16,32,.25);
      }
      .navlink[aria-current="page"] {
        border-color: rgba(124,92,255,.55);
        box-shadow: 0 0 0 3px rgba(124,92,255,.18);
      }
      main { padding: 20px 16px 32px; }
      .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 14px; }
      .card {
        grid-column: span 6;
        background: rgba(18,26,51,.72);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 14px;
      }
      .card h2 { margin: 0 0 6px; font-size: 14px; }
      .card p { margin: 0 0 10px; color: var(--muted); font-size: 13px; line-height: 1.35; }
      .pillrow { display: flex; flex-wrap: wrap; gap: 8px; }
      .pill {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        padding: 7px 10px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: rgba(11,16,32,.25);
        color: var(--text);
        text-decoration: none;
        font-size: 13px;
      }
      .pill small { color: var(--muted); font-size: 12px; }
      .fineprint { margin-top: 18px; color: var(--muted); font-size: 12px; }
      @media (max-width: 720px) { .card { grid-column: span 12; } }
    </style>
  </head>
  <body data-kiwy-shell="v1">
    <header>
      <div class="wrap">
        <div class="brand">
          <div class="logo" aria-hidden="true"></div>
          <div>
            <h1>Kiwy HQ</h1>
            <div class="tag">quick actions for Qualiver • ECHO • Kuenti • Personal</div>
          </div>
        </div>
        <nav aria-label="Primary">
          ${navLink('dashboard', 'Dashboard', '/')}
          ${navLink('secrets', 'Secrets', '/secrets')}
          <form method="post" action="/logout" style="margin-left:auto">
            <button class="navlink" type="submit">Logout</button>
          </form>
        </nav>
      </div>
    </header>
    <main>
      <div class="wrap">
        ${opts.contentHtml}
        <div class="fineprint">Kiwy HQ MVP v1 · never shows stored secrets in HTML.</div>
      </div>
    </main>
  </body>
</html>`;
}

function authRequiredMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Public endpoints
  if (req.path === '/health' || req.path === '/login') return next();

  const authed = req.cookies?.[AUTH_COOKIE_NAME] === '1';
  if (authed) return next();

  return res.redirect(302, '/login');
}

export function createApp() {
  const app = express();

  // Middleware
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: false }));
  app.use(authRequiredMiddleware);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.get('/', (_req, res) => {
    const contentHtml = `
      <div class="grid">
        <section class="card">
          <h2>Qualiver</h2>
          <p>Quality ops and field checks.</p>
          <div class="pillrow">
            <a class="pill" href="#"><span>Open Qualiver</span> <small>(soon)</small></a>
            <a class="pill" href="#"><span>Latest checks</span> <small>(soon)</small></a>
          </div>
        </section>

        <section class="card">
          <h2>ECHO</h2>
          <p>Alerts, inbox, and follow-ups.</p>
          <div class="pillrow">
            <a class="pill" href="#"><span>Open ECHO</span> <small>(soon)</small></a>
            <a class="pill" href="#"><span>Recent alerts</span> <small>(soon)</small></a>
          </div>
        </section>

        <section class="card">
          <h2>Kuenti</h2>
          <p>Knowledge, docs, and quick reference.</p>
          <div class="pillrow">
            <a class="pill" href="#"><span>Open Kuenti</span> <small>(soon)</small></a>
            <a class="pill" href="#"><span>Search</span> <small>(soon)</small></a>
          </div>
        </section>

        <section class="card">
          <h2>Personal</h2>
          <p>Settings and private tools.</p>
          <div class="pillrow">
            <a class="pill" href="/secrets"><span>Secrets</span> <small>(AppSheet / n8n)</small></a>
            <a class="pill" href="#"><span>Profile</span> <small>(soon)</small></a>
          </div>
        </section>
      </div>
    `;

    res.type('html').send(pageLayout({ title: 'Dashboard', active: 'dashboard', contentHtml }));
  });

  app.get('/secrets', (_req, res) => {
    // Storage is implemented in a later story. This page must not render any stored values.
    const contentHtml = `
      <h2 style="margin: 0 0 10px;">Secrets</h2>
      <p style="margin: 0 0 14px; color: var(--muted);">Store API keys locally (not displayed). Coming in the next story.</p>

      <div class="grid">
        <section class="card" style="grid-column: span 12;">
          <h2>AppSheet API key</h2>
          <p>Saved locally; never rendered back into the page.</p>
          <label>
            <span class="tag" style="display:block; margin-bottom: 6px;">AppSheet key</span>
            <input type="password" name="appsheet" value="" placeholder="••••••••" disabled
              style="width:100%; padding:10px; border-radius: 12px; border: 1px solid var(--border); background: rgba(11,16,32,.25); color: var(--text);" />
          </label>
        </section>

        <section class="card" style="grid-column: span 12;">
          <h2>n8n API key</h2>
          <p>Saved locally; never rendered back into the page.</p>
          <label>
            <span class="tag" style="display:block; margin-bottom: 6px;">n8n key</span>
            <input type="password" name="n8n" value="" placeholder="••••••••" disabled
              style="width:100%; padding:10px; border-radius: 12px; border: 1px solid var(--border); background: rgba(11,16,32,.25); color: var(--text);" />
          </label>
        </section>
      </div>
    `;

    res.type('html').send(pageLayout({ title: 'Secrets', active: 'secrets', contentHtml }));
  });

  app.get('/login', (_req, res) => {
    res
      .status(200)
      .type('html')
      .send(`<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Kiwy HQ - Login</title></head>
  <body>
    <h1>Login</h1>
    <form method="post" action="/login">
      <label>Token <input type="password" name="token" autocomplete="current-password" /></label>
      <button type="submit">Login</button>
    </form>
  </body>
</html>`);
  });

  app.post('/login', (req, res) => {
    const expectedToken = process.env.KIWY_HQ_TOKEN;
    const providedToken = typeof req.body?.token === 'string' ? req.body.token : '';

    if (!expectedToken) {
      // Misconfiguration: don't reveal or log tokens.
      return res.status(500).type('text').send('Server is not configured');
    }

    if (providedToken !== expectedToken) {
      return res.status(401).type('text').send('Unauthorized');
    }

    res.cookie(AUTH_COOKIE_NAME, '1', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

    return res.redirect(302, '/');
  });

  app.post('/logout', (_req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

    return res.status(200).type('text').send('Logged out');
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3334);
  const app = createApp();
  app.listen(port, '0.0.0.0', () => {
    console.log(`Kiwy HQ listening on :${port}`);
  });
}
