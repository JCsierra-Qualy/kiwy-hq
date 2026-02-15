import express from 'express';
import cookieParser from 'cookie-parser';
import { readSecrets, writeSecrets, type SecretsField } from './secrets-store';
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

    const fieldUpdatedAt = (field: SecretsField) => {
      const ts = stored?.fieldUpdatedAt?.[field] || stored?.updatedAt;
      return typeof ts === 'string' ? ts : '';
    };

    const isSet = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

    const statusPill = (on: boolean, updatedAtIso: string | undefined) => {
      const dot = `<span class="statusDot ${on ? 'on' : ''}" aria-hidden="true"></span>`;
      const label = on ? 'Set' : 'Not set';
      const when = updatedAtIso ? ` · ${escapeHtml(updatedAtIso)}` : '';
      return `<span class="statusPill">${dot}<span>${label}${when}</span></span>`;
    };

    const contentHtml = `
      <h2 style="margin: 0 0 10px;">Secrets & Config</h2>
      <p class="formHint">Stored locally in <code>data/secrets.json</code> (gitignored). We never render raw secrets in HTML. <strong>Leaving a field blank keeps the existing value.</strong></p>

      <div id="toast" class="toast hidden" role="status" aria-live="polite">
        Saved.
        <small>Changes written to <code>data/secrets.json</code>.</small>
      </div>

      <form method="post" action="/secrets">
        <div class="grid">
          <section class="card" style="grid-column: span 12;">
            <div class="sectionTitle">
              <h2>AppSheet CRM</h2>
              ${statusPill(isSet(stored?.appsheetCrmKey) && isSet(stored?.appsheetAppId), stored?.updatedAt)}
            </div>
            <p class="formHint">Key + App ID used by CRM automations. Leave blank to keep; use the clear checkbox to intentionally remove.</p>

            <div class="field">
              <div class="fieldRow">
                <span class="fieldLabel">App ID (CRM)</span>
                ${statusPill(isSet(stored?.appsheetAppId), fieldUpdatedAt('appsheetAppId'))}
              </div>
              <input class="input" type="text" name="appsheetAppId" value="" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              <label class="fieldLabel"><input type="checkbox" name="clear_appsheetAppId" value="1" /> Clear stored App ID</label>
            </div>

            <div class="field">
              <div class="fieldRow">
                <span class="fieldLabel">API key (CRM)</span>
                ${statusPill(isSet(stored?.appsheetCrmKey), fieldUpdatedAt('appsheetCrmKey'))}
              </div>
              <input class="input" type="password" name="appsheetCrmKey" value="" placeholder="V2-…" autocomplete="new-password" />
              <label class="fieldLabel"><input type="checkbox" name="clear_appsheetCrmKey" value="1" /> Clear stored CRM key</label>
            </div>
          </section>

          <section class="card" style="grid-column: span 12;">
            <div class="sectionTitle">
              <h2>AppSheet Ops</h2>
              ${statusPill(isSet(stored?.appsheetOpsKey), fieldUpdatedAt('appsheetOpsKey'))}
            </div>
            <p class="formHint">Ops/Tasks workflows key.</p>

            <div class="field">
              <div class="fieldRow">
                <span class="fieldLabel">API key (Ops)</span>
                ${statusPill(isSet(stored?.appsheetOpsKey), fieldUpdatedAt('appsheetOpsKey'))}
              </div>
              <input class="input" type="password" name="appsheetOpsKey" value="" placeholder="V2-…" autocomplete="new-password" />
              <label class="fieldLabel"><input type="checkbox" name="clear_appsheetOpsKey" value="1" /> Clear stored Ops key</label>
            </div>
          </section>

          <section class="card" style="grid-column: span 12;">
            <div class="sectionTitle">
              <h2>AppSheet Shared</h2>
              ${statusPill(true, stored?.updatedAt)}
            </div>
            <p class="formHint">Region domain is not a secret; legacy key is only for old scripts.</p>

            <div class="field">
              <div class="fieldRow">
                <span class="fieldLabel">Region domain</span>
                ${statusPill(isSet(stored?.appsheetRegion), fieldUpdatedAt('appsheetRegion'))}
              </div>
              <input class="input" type="text" name="appsheetRegion" value="" placeholder="www.appsheet.com / eu.appsheet.com / asia-southeast.appsheet.com" />
              <label class="fieldLabel"><input type="checkbox" name="clear_appsheetRegion" value="1" /> Clear stored region</label>
            </div>

            <div class="field">
              <div class="fieldRow">
                <span class="fieldLabel">Legacy key (single)</span>
                ${statusPill(isSet(stored?.appsheetKey), fieldUpdatedAt('appsheetKey'))}
              </div>
              <input class="input" type="password" name="appsheetKey" value="" placeholder="V2-…" autocomplete="new-password" />
              <label class="fieldLabel"><input type="checkbox" name="clear_appsheetKey" value="1" /> Clear stored legacy key</label>
            </div>
          </section>

          <section class="card" style="grid-column: span 12;">
            <div class="sectionTitle">
              <h2>n8n</h2>
              ${statusPill(isSet(stored?.n8nKey), fieldUpdatedAt('n8nKey'))}
            </div>
            <p class="formHint">API key used for calling n8n endpoints.</p>

            <div class="field">
              <div class="fieldRow">
                <span class="fieldLabel">n8n API key</span>
                ${statusPill(isSet(stored?.n8nKey), fieldUpdatedAt('n8nKey'))}
              </div>
              <input class="input" type="password" name="n8nKey" value="" placeholder="••••••••" autocomplete="new-password" />
              <label class="fieldLabel"><input type="checkbox" name="clear_n8nKey" value="1" /> Clear stored n8n key</label>
            </div>
          </section>

          <section class="card" style="grid-column: span 12;">
            <div class="sectionTitle">
              <h2>GitHub</h2>
              ${statusPill(isSet(stored?.githubPat), fieldUpdatedAt('githubPat'))}
            </div>
            <p class="formHint">Used for PR automation. Recommended: fine-grained token with Pull requests: Read/Write on repo <code>JCsierra-Qualy/kiwy-hq</code>.</p>

            <div class="field">
              <div class="fieldRow">
                <span class="fieldLabel">GitHub PAT</span>
                ${statusPill(isSet(stored?.githubPat), fieldUpdatedAt('githubPat'))}
              </div>
              <input class="input" type="password" name="githubPat" value="" placeholder="github_pat_… / ghp_…" autocomplete="new-password" />
              <label class="fieldLabel"><input type="checkbox" name="clear_githubPat" value="1" /> Clear stored token</label>
            </div>
          </section>

          <section class="card" style="grid-column: span 12; padding: 0; background: transparent; border: none;">
            <div class="stickyBar">
              <button class="navlink" type="submit">Save changes</button>
            </div>
          </section>
        </div>
      </form>

      <script>
        (function () {
          var saved = ${saved ? 'true' : 'false'};
          if (!saved) return;
          var toast = document.getElementById('toast');
          if (!toast) return;
          toast.classList.remove('hidden');
          window.setTimeout(function () { toast.classList.add('hidden'); }, 2600);
          try {
            var url = new URL(window.location.href);
            url.searchParams.delete('saved');
            window.history.replaceState({}, document.title, url.toString());
          } catch {}
        })();
      </script>
    `;

    res.type('html').send(pageLayout({ title: 'Secrets', active: 'secrets', contentHtml }));
  });

  app.post('/secrets', async (req, res) => {
    const body = req.body || {};

    const getString = (name: string) => (typeof (body as any)[name] === 'string' ? String((body as any)[name]).trim() : '');
    const isClear = (name: string) => (body as any)[`clear_${name}`] === '1' || (body as any)[`clear_${name}`] === 'on';

    const update: Partial<Record<SecretsField, string | null>> = {};

    const setOrKeepOrClear = (field: SecretsField) => {
      if (isClear(field)) {
        update[field] = null;
        return;
      }
      const v = getString(field);
      if (v.length > 0) update[field] = v;
    };

    setOrKeepOrClear('appsheetAppId');
    setOrKeepOrClear('appsheetCrmKey');
    setOrKeepOrClear('appsheetOpsKey');
    setOrKeepOrClear('appsheetRegion');
    setOrKeepOrClear('appsheetKey');
    setOrKeepOrClear('n8nKey');
    setOrKeepOrClear('githubPat');

    await writeSecrets(update);

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
