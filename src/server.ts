import express from 'express';
import cookieParser from 'cookie-parser';

const AUTH_COOKIE_NAME = 'kiwy_hq_auth';

type NavItem = {
  href: string;
  label: string;
  key: 'dashboard' | 'secrets';
};

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', key: 'dashboard' },
  { href: '/secrets', label: 'Secrets', key: 'secrets' },
];

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderLayout(opts: {
  title: string;
  activeNavKey: NavItem['key'];
  contentHtml: string;
}) {
  const navHtml = NAV_ITEMS.map((item) => {
    const active = item.key === opts.activeNavKey;
    return `<a href="${item.href}" class="nav-link${active ? ' is-active' : ''}" ${
      active ? 'aria-current="page"' : ''
    }>${escapeHtml(item.label)}</a>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(opts.title)} · Kiwy HQ</title>
    <style>
      :root{
        --kiwy-green:#2ecc71;
        --kiwy-ink:#0f172a;
        --kiwy-muted:#64748b;
        --kiwy-bg:#f8fafc;
        --kiwy-card:#ffffff;
        --kiwy-border:rgba(15,23,42,0.10);
      }
      *{box-sizing:border-box}
      body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,"Apple Color Emoji","Segoe UI Emoji";color:var(--kiwy-ink);background:var(--kiwy-bg)}
      a{color:inherit}
      .shell{min-height:100vh;display:flex;flex-direction:column}
      header{background:linear-gradient(135deg, rgba(46,204,113,0.20), rgba(46,204,113,0.05));border-bottom:1px solid var(--kiwy-border)}
      .wrap{max-width:1100px;margin:0 auto;padding:16px 20px}
      .brand{display:flex;align-items:baseline;gap:10px}
      .brand h1{margin:0;font-size:20px;letter-spacing:0.2px}
      .brand .tagline{color:var(--kiwy-muted);font-size:13px}
      nav{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;align-items:center}
      .nav-link{padding:8px 10px;border-radius:10px;text-decoration:none;border:1px solid transparent}
      .nav-link:hover{border-color:var(--kiwy-border);background:rgba(255,255,255,0.7)}
      .nav-link.is-active{background:var(--kiwy-card);border-color:var(--kiwy-border)}
      .spacer{flex:1}
      .logout{margin-left:auto}
      .logout button{background:transparent;border:1px solid var(--kiwy-border);border-radius:10px;padding:8px 10px;cursor:pointer}
      main{flex:1}
      .grid{display:grid;grid-template-columns:repeat(12,1fr);gap:14px}
      .col-6{grid-column:span 6}
      .col-12{grid-column:span 12}
      .card{background:var(--kiwy-card);border:1px solid var(--kiwy-border);border-radius:14px;padding:14px}
      .card h3{margin:0 0 6px 0;font-size:14px}
      .card p{margin:0;color:var(--kiwy-muted);font-size:13px;line-height:1.5}
      .card ul{margin:10px 0 0 18px;color:var(--kiwy-muted);font-size:13px}
      .section-title{margin:0 0 10px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:var(--kiwy-muted)}
      footer{border-top:1px solid var(--kiwy-border);color:var(--kiwy-muted)}
      @media (max-width:800px){.col-6{grid-column:span 12}}
    </style>
  </head>
  <body data-kiwy-shell="v1">
    <div class="shell">
      <header>
        <div class="wrap">
          <div class="brand">
            <h1>Kiwy HQ</h1>
            <div class="tagline">Small dashboard, big kiwi energy.</div>
          </div>
          <nav aria-label="Primary">
            ${navHtml}
            <span class="spacer"></span>
            <form class="logout" method="post" action="/logout">
              <button type="submit">Logout</button>
            </form>
          </nav>
        </div>
      </header>
      <main>
        <div class="wrap">
          ${opts.contentHtml}
        </div>
      </main>
      <footer>
        <div class="wrap">Kiwy HQ MVP v1 · never shows stored secrets in HTML.</div>
      </footer>
    </div>
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
      <p class="section-title">Dashboard</p>
      <div class="grid">
        <section class="card col-6">
          <h3>Qualiver</h3>
          <p>Quality ops and field checks.</p>
          <ul>
            <li><a href="#">Open Qualiver (soon)</a></li>
            <li><a href="#">Latest checks (soon)</a></li>
          </ul>
        </section>

        <section class="card col-6">
          <h3>ECHO</h3>
          <p>Alerts, inbox, and follow-ups.</p>
          <ul>
            <li><a href="#">Open ECHO (soon)</a></li>
            <li><a href="#">Recent alerts (soon)</a></li>
          </ul>
        </section>

        <section class="card col-6">
          <h3>Kuenti</h3>
          <p>Knowledge, docs, and quick reference.</p>
          <ul>
            <li><a href="#">Open Kuenti (soon)</a></li>
            <li><a href="#">Search (soon)</a></li>
          </ul>
        </section>

        <section class="card col-6">
          <h3>Personal</h3>
          <p>Settings and private tools.</p>
          <ul>
            <li><a href="/secrets">Secrets (AppSheet / n8n)</a></li>
            <li><a href="#">Profile (soon)</a></li>
          </ul>
        </section>
      </div>
    `;

    res.type('html').send(renderLayout({ title: 'Dashboard', activeNavKey: 'dashboard', contentHtml }));
  });

  app.get('/secrets', (_req, res) => {
    // Storage is implemented in a later story. This page must not render any stored values.
    const contentHtml = `
      <p class="section-title">Secrets</p>
      <div class="grid">
        <section class="card col-12">
          <h3>AppSheet API key</h3>
          <p>Saved locally; never rendered back into the page.</p>
          <input type="password" name="appsheet" value="" placeholder="••••••••" disabled style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--kiwy-border)" />
        </section>

        <section class="card col-12">
          <h3>n8n API key</h3>
          <p>Saved locally; never rendered back into the page.</p>
          <input type="password" name="n8n" value="" placeholder="••••••••" disabled style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--kiwy-border)" />
        </section>
      </div>
    `;

    res.type('html').send(renderLayout({ title: 'Secrets', activeNavKey: 'secrets', contentHtml }));
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
