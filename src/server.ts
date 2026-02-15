import express from 'express';
import cookieParser from 'cookie-parser';
import { maskSecret, readSecrets, writeSecrets } from './secrets-store';
import { escapeHtml, pageLayout } from './ui';

const AUTH_COOKIE_NAME = 'kiwy_hq_auth';

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

  app.get('/secrets', async (req, res) => {
    const saved = req.query?.saved === '1';
    const stored = await readSecrets();
    const appsheetPreview = stored?.appsheetKey ? maskSecret(stored.appsheetKey) : 'Not set';
    const n8nPreview = stored?.n8nKey ? maskSecret(stored.n8nKey) : 'Not set';
    const githubPreview = stored?.githubPat ? maskSecret(stored.githubPat) : 'Not set';

    const contentHtml = `
      <h2 style="margin: 0 0 10px;">Secrets</h2>
      <p style="margin: 0 0 14px; color: var(--muted);">Stored locally in <code>data/secrets.json</code> (gitignored). File permissions are set to <code>600</code> (best-effort).</p>
      ${saved ? '<p style="margin: 0 0 14px; color: var(--kiwy2);">Saved.</p>' : ''}

      <form method="post" action="/secrets">
        <div class="grid">
          <section class="card" style="grid-column: span 12;">
            <h2>AppSheet API key</h2>
            <p>Current: <code>${escapeHtml(appsheetPreview)}</code></p>
            <label>
              <span class="tag" style="display:block; margin-bottom: 6px;">New AppSheet key (leave blank to keep)</span>
              <input type="password" name="appsheetKey" value="" placeholder="••••••••"
                style="width:100%; padding:10px; border-radius: 12px; border: 1px solid var(--border); background: rgba(11,16,32,.25); color: var(--text);" />
            </label>
          </section>

          <section class="card" style="grid-column: span 12;">
            <h2>n8n API key</h2>
            <p>Current: <code>${escapeHtml(n8nPreview)}</code></p>
            <label>
              <span class="tag" style="display:block; margin-bottom: 6px;">New n8n key (leave blank to keep)</span>
              <input type="password" name="n8nKey" value="" placeholder="••••••••"
                style="width:100%; padding:10px; border-radius: 12px; border: 1px solid var(--border); background: rgba(11,16,32,.25); color: var(--text);" />
            </label>
          </section>

          <section class="card" style="grid-column: span 12;">
            <h2>GitHub PAT (for PR automation)</h2>
            <p>Current: <code>${escapeHtml(githubPreview)}</code></p>
            <label>
              <span class="tag" style="display:block; margin-bottom: 6px;">New GitHub PAT (leave blank to keep)</span>
              <input type="password" name="githubPat" value="" placeholder="ghp_…"
                style="width:100%; padding:10px; border-radius: 12px; border: 1px solid var(--border); background: rgba(11,16,32,.25); color: var(--text);" />
            </label>
            <p class="tag" style="margin-top:8px;">Needs: Fine-grained token with Pull requests: Read/Write on repo JCsierra-Qualy/kiwy-hq.</p>
          </section>

          <section class="card" style="grid-column: span 12; display:flex; justify-content:flex-end; gap: 10px;">
            <button class="navlink" type="submit">Save</button>
          </section>
        </div>
      </form>
    `;

    res.type('html').send(pageLayout({ title: 'Secrets', active: 'secrets', contentHtml }));
  });

  app.post('/secrets', async (req, res) => {
    const appsheet = typeof req.body?.appsheetKey === 'string' ? req.body.appsheetKey.trim() : '';
    const n8n = typeof req.body?.n8nKey === 'string' ? req.body.n8nKey.trim() : '';
    const githubPat = typeof req.body?.githubPat === 'string' ? req.body.githubPat.trim() : '';

    await writeSecrets({
      appsheetKey: appsheet.length > 0 ? appsheet : undefined,
      n8nKey: n8n.length > 0 ? n8n : undefined,
      githubPat: githubPat.length > 0 ? githubPat : undefined,
    });

    return res.redirect(302, '/secrets?saved=1');
  });

  app.get('/login', (_req, res) => {
    const contentHtml = `
      <div class="card" style="grid-column: span 12; max-width: 520px; margin: 18px auto;">
        <h2 style="margin:0 0 6px; font-size: 16px;">Entrar a Kiwy HQ</h2>
        <p style="margin:0 0 14px; color: var(--muted);">Pega tu token para entrar. (El token vive como <code>KIWY_HQ_TOKEN</code> en el servidor.)</p>
        <form method="post" action="/login">
          <label style="display:block; margin-bottom: 10px;">
            <span class="tag" style="display:block; margin-bottom: 6px;">Token</span>
            <input type="password" name="token" autocomplete="current-password" placeholder="••••••••"
              style="width:100%; padding:10px; border-radius: 12px; border: 1px solid var(--border); background: rgba(11,16,32,.25); color: var(--text);" />
          </label>
          <button class="navlink" type="submit" style="justify-content:center;">Login</button>
        </form>
      </div>
    `;

    // Reuse the neon shell but hide nav by setting active to dashboard (nav is fine even on login)
    res.status(200).type('html').send(pageLayout({ title: 'Login', active: 'dashboard', contentHtml }));
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
