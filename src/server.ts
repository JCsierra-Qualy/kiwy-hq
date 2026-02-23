import express from 'express';
import cookieParser from 'cookie-parser';
import { readSecrets, writeSecrets, type SecretsField } from './secrets-store';
import { readHqStatus, writeHqStatus, type MacroProjectKey } from './hq-status-store';
import { clearCredential, importKnownCredentials, maskValue, readCredentials, upsertCredential } from './credentials-store';
import { escapeHtml, pageLayout } from './ui';

const AUTH_COOKIE_NAME = 'kiwy_hq_auth';

function authRequiredMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.path === '/health' || req.path === '/login') return next();

  const authed = req.cookies?.[AUTH_COOKIE_NAME] === '1';
  if (authed) return next();

  return res.redirect(302, '/login');
}

function formatTimestamp(ts?: string) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return escapeHtml(ts);
  return escapeHtml(d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC');
}

export function createApp() {
  const app = express();

  app.use(cookieParser());
  app.use(express.urlencoded({ extended: false }));
  app.use(authRequiredMiddleware);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.get('/', async (_req, res) => {
    const [stored, status] = await Promise.all([readSecrets(), readHqStatus()]);

    const secretFields: SecretsField[] = [
      'appsheetAppId',
      'appsheetCrmKey',
      'appsheetOpsKey',
      'appsheetRegion',
      'appsheetKey',
      'n8nKey',
      'githubPat',
    ];
    const configuredSecrets = secretFields.filter((f) => typeof (stored as any)?.[f] === 'string').length;

    const statusFields: MacroProjectKey[] = ['qualiver', 'echo', 'kuenti', 'personal'];
    const statusReady = statusFields.filter((f) => status[f] && status[f] !== 'No status yet.').length;

    const macroCard = (name: string, key: MacroProjectKey) => `
      <section class="card">
        <h2>${escapeHtml(name)}</h2>
        <p>${escapeHtml(status[key])}</p>
        <div class="pillrow">
          <a class="pill" href="/status"><span>Edit status</span> <small>one sentence</small></a>
        </div>
      </section>
    `;

    const contentHtml = `
      <h2 class="headline">Dashboard</h2>
      <p class="subhead">Quick pulse across projects, status readiness, and HQ configuration health.</p>

      <div class="grid">
        <section class="card kpi">
          <div class="kpiLabel">Projects tracked</div>
          <div class="kpiValue">4</div>
          <div class="kpiLabel">Qualiver · ECHO · Kuenti · Personal</div>
        </section>
        <section class="card kpi">
          <div class="kpiLabel">Statuses updated</div>
          <div class="kpiValue">${statusReady}/4</div>
          <div class="kpiLabel">Last update: ${formatTimestamp(status.updatedAt)}</div>
        </section>
        <section class="card kpi">
          <div class="kpiLabel">Secrets configured</div>
          <div class="kpiValue">${configuredSecrets}/7</div>
          <div class="kpiLabel">Operational readiness indicator</div>
        </section>
        <section class="card kpi">
          <div class="kpiLabel">System</div>
          <div class="kpiValue">OK</div>
          <div class="kpiLabel">Auth active · local files secured</div>
        </section>
      </div>

      <div class="divider"></div>
      <h2 class="headline" style="font-size:18px;">Macro project status (single sentence)</h2>
      <p class="subhead">A concise sentence per project to communicate where we are now.</p>

      <div class="grid">
        ${macroCard('Qualiver', 'qualiver')}
        ${macroCard('ECHO', 'echo')}
        ${macroCard('Kuenti', 'kuenti')}
        ${macroCard('Personal / Other', 'personal')}
      </div>
    `;

    res.type('html').send(pageLayout({ title: 'Dashboard', active: 'dashboard', contentHtml }));
  });

  app.get('/status', async (req, res) => {
    const saved = req.query?.saved === '1';
    const status = await readHqStatus();

    const statusInput = (field: MacroProjectKey, label: string, hint: string) => `
      <div class="field">
        <div class="fieldRow">
          <span class="fieldLabel">${escapeHtml(label)}</span>
          <span class="statusPill"><span class="statusDot on" aria-hidden="true"></span>Updated: ${formatTimestamp(
            status.fieldUpdatedAt?.[field],
          )}</span>
        </div>
        <input class="input" type="text" name="${field}" maxlength="220" value="${escapeHtml(status[field])}" />
        <span class="formHint">${escapeHtml(hint)}</span>
      </div>
    `;

    const contentHtml = `
      <h2 class="headline">Project status board</h2>
      <p class="subhead">Write exactly one sentence per macro project. This is an executive pulse, not a CRM action panel.</p>

      <div id="toast" class="toast hidden" role="status" aria-live="polite">
        Status saved.
        <small>Changes written to <code>data/hq-status.json</code>.</small>
      </div>

      <form method="post" action="/status">
        <div class="grid">
          <section class="card" style="grid-column: span 12;">
            <div class="sectionTitle">
              <h2>Macro project pulse</h2>
              <span class="statusPill"><span class="statusDot on" aria-hidden="true"></span>Last update: ${formatTimestamp(
                status.updatedAt,
              )}</span>
            </div>
            <p class="formHint">Keep each line short and concrete (max 220 chars).</p>
            ${statusInput('qualiver', 'Qualiver', 'Example: \"Pilot validations closed; now preparing rollout checklist.\"')}
            ${statusInput('echo', 'ECHO', 'Example: \"Inbox triage stabilized; automating alert priorities next.\"')}
            ${statusInput('kuenti', 'Kuenti', 'Example: \"Core docs restructured; search quality improved this week.\"')}
            ${statusInput('personal', 'Personal / Other (optional)', 'Example: \"Personal productivity stack stable, no blockers.\"')}
          </section>

          <section class="card" style="grid-column: span 12; padding: 0; background: transparent; border: none; box-shadow: none;">
            <div class="stickyBar">
              <button class="navlink" type="submit">Save status</button>
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

    res.type('html').send(pageLayout({ title: 'Project status', active: 'status', contentHtml }));
  });

  app.post('/status', async (req, res) => {
    const body = req.body || {};
    const getString = (name: string) => (typeof (body as any)[name] === 'string' ? String((body as any)[name]) : '');

    await writeHqStatus({
      qualiver: getString('qualiver'),
      echo: getString('echo'),
      kuenti: getString('kuenti'),
      personal: getString('personal'),
    });

    return res.redirect(302, '/status?saved=1');
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
      <h2 class="headline">Secrets & config</h2>
      <p class="subhead">Stored locally in <code>data/secrets.json</code> (gitignored). We never render raw secrets. Blank input keeps current value.</p>

      <div id="toast" class="toast hidden" role="status" aria-live="polite">
        Secrets saved.
        <small>Changes written to <code>data/secrets.json</code>.</small>
      </div>

      <form method="post" action="/secrets">
        <div class="grid">
          <section class="card" style="grid-column: span 12;">
            <div class="sectionTitle">
              <h2>AppSheet CRM</h2>
              ${statusPill(isSet(stored?.appsheetCrmKey) && isSet(stored?.appsheetAppId), stored?.updatedAt)}
            </div>
            <p class="formHint">Key + App ID used by CRM automations. Leave blank to keep. Use clear checkbox to intentionally remove.</p>

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
            <p class="formHint">Used for PR automation. Recommended token scope: Pull requests Read/Write on <code>JCsierra-Qualy/kiwy-hq</code>.</p>

            <div class="field">
              <div class="fieldRow">
                <span class="fieldLabel">GitHub PAT</span>
                ${statusPill(isSet(stored?.githubPat), fieldUpdatedAt('githubPat'))}
              </div>
              <input class="input" type="password" name="githubPat" value="" placeholder="github_pat_… / ghp_…" autocomplete="new-password" />
              <label class="fieldLabel"><input type="checkbox" name="clear_githubPat" value="1" /> Clear stored token</label>
            </div>
          </section>

          <section class="card" style="grid-column: span 12; padding: 0; background: transparent; border: none; box-shadow: none;">
            <div class="stickyBar">
              <button class="navlink" type="submit">Save secrets</button>
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

  app.get('/credentials', async (req, res) => {
    const imported = req.query?.imported === '1';
    const saved = req.query?.saved === '1';
    const db = await readCredentials();

    const rows = db.items
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(
        (x) => `
          <tr>
            <td><strong>${escapeHtml(x.label)}</strong><div class="formHint">${escapeHtml(x.key)}</div></td>
            <td>${escapeHtml(maskValue(x.value))}</td>
            <td>${escapeHtml(x.source)}</td>
            <td>${formatTimestamp(x.updatedAt)}</td>
            <td>
              <form method="post" action="/credentials/clear" style="display:inline;">
                <input type="hidden" name="key" value="${escapeHtml(x.key)}" />
                <button class="navlink" type="submit">Clear</button>
              </form>
            </td>
          </tr>
        `,
      )
      .join('');

    const contentHtml = `
      <h2 class="headline">Credentials Hub</h2>
      <p class="subhead">Aquí puedes centralizar APIs sin repetirlas: importar detectadas, crear nuevas y actualizar existentes.</p>

      <div id="toast" class="toast ${saved || imported ? '' : 'hidden'}" role="status" aria-live="polite">
        ${imported ? 'APIs detectadas e importadas.' : 'Credencial guardada.'}
      </div>

      <div class="grid">
        <section class="card" style="grid-column: span 12;">
          <div class="sectionTitle">
            <h2>Importar APIs conocidas</h2>
            <span class="statusPill"><span class="statusDot on" aria-hidden="true"></span>Total: ${db.items.length}</span>
          </div>
          <p class="formHint">Toma secretos ya existentes (legacy + variables de entorno comunes) y los agrega al HQ.</p>
          <form method="post" action="/credentials/import">
            <button class="navlink" type="submit">Importar APIs detectadas</button>
          </form>
        </section>

        <section class="card" style="grid-column: span 12;">
          <div class="sectionTitle"><h2>Crear / actualizar credencial</h2></div>
          <form method="post" action="/credentials/upsert">
            <div class="field">
              <span class="fieldLabel">Clave interna (ej. google.sheets.api_key)</span>
              <input class="input" type="text" name="key" required maxlength="120" />
            </div>
            <div class="field">
              <span class="fieldLabel">Etiqueta visible</span>
              <input class="input" type="text" name="label" required maxlength="120" />
            </div>
            <div class="field">
              <span class="fieldLabel">Valor secreto</span>
              <input class="input" type="password" name="value" required autocomplete="new-password" />
            </div>
            <div class="stickyBar"><button class="navlink" type="submit">Guardar credencial</button></div>
          </form>
        </section>

        <section class="card" style="grid-column: span 12;">
          <h2 style="margin:0 0 10px;">Inventario actual</h2>
          <div style="overflow:auto">
            <table style="width:100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border)">Credencial</th>
                  <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border)">Mask</th>
                  <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border)">Source</th>
                  <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border)">Updated</th>
                  <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border)">Action</th>
                </tr>
              </thead>
              <tbody>${rows || '<tr><td colspan="5" style="padding:10px;color:var(--muted)">Sin credenciales aún.</td></tr>'}</tbody>
            </table>
          </div>
        </section>
      </div>
    `;

    res.type('html').send(pageLayout({ title: 'Credentials', active: 'credentials', contentHtml }));
  });

  app.post('/credentials/import', async (_req, res) => {
    await importKnownCredentials();
    return res.redirect(302, '/credentials?imported=1');
  });

  app.post('/credentials/upsert', async (req, res) => {
    const key = typeof req.body?.key === 'string' ? req.body.key.trim() : '';
    const label = typeof req.body?.label === 'string' ? req.body.label.trim() : '';
    const value = typeof req.body?.value === 'string' ? req.body.value.trim() : '';
    if (!key || !label || !value) return res.status(400).type('text').send('Missing fields');

    await upsertCredential({ key, label, value, source: 'manual' });
    return res.redirect(302, '/credentials?saved=1');
  });

  app.post('/credentials/clear', async (req, res) => {
    const key = typeof req.body?.key === 'string' ? req.body.key.trim() : '';
    if (key) await clearCredential(key);
    return res.redirect(302, '/credentials?saved=1');
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

    res.status(200).type('html').send(pageLayout({ title: 'Login', active: 'dashboard', contentHtml }));
  });

  app.post('/login', (req, res) => {
    const expectedToken = process.env.KIWY_HQ_TOKEN;
    const providedToken = typeof req.body?.token === 'string' ? req.body.token : '';

    if (!expectedToken) {
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
