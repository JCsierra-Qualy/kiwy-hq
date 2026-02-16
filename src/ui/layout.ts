export type NavKey = 'dashboard' | 'status' | 'secrets';

export function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function pageLayout(opts: { title: string; active: NavKey; contentHtml: string }) {
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
        --bg: #070b18;
        --panel: #121a33;
        --panel-soft: rgba(18,26,51,.66);
        --text: #eef2ff;
        --muted: #a8b0d9;
        --kiwy: #7c5cff;
        --kiwy2: #34d399;
        --danger: #f43f5e;
        --border: rgba(232,236,255,.14);
        --shadow: 0 12px 34px rgba(0,0,0,.3);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        background: radial-gradient(1200px 700px at 20% -10%, rgba(124,92,255,.35), transparent 60%),
                    radial-gradient(900px 600px at 100% 0%, rgba(52,211,153,.2), transparent 55%),
                    var(--bg);
        color: var(--text);
      }
      header {
        border-bottom: 1px solid var(--border);
        background: rgba(12,17,34,.78);
        backdrop-filter: blur(10px);
        position: sticky;
        top: 0;
        z-index: 50;
      }
      .wrap { max-width: 1120px; margin: 0 auto; padding: 16px; }
      .brand { display: flex; align-items: baseline; gap: 12px; }
      .logo {
        width: 14px; height: 14px; border-radius: 4px;
        background: linear-gradient(135deg, var(--kiwy), var(--kiwy2));
        box-shadow: 0 0 0 3px rgba(124,92,255,.18);
      }
      h1 { font-size: 18px; margin: 0; letter-spacing: .2px; }
      .tag { color: var(--muted); font-size: 12px; margin-top: 2px; }
      nav { display: flex; gap: 10px; align-items: center; margin-top: 12px; }
      .navlink {
        display: inline-flex;
        padding: 9px 11px;
        border: 1px solid var(--border);
        border-radius: 11px;
        text-decoration: none;
        color: var(--text);
        background: rgba(11,16,32,.32);
        transition: all .15s ease;
      }
      .navlink:hover { border-color: rgba(124,92,255,.5); transform: translateY(-1px); }
      .navlink[aria-current="page"] {
        border-color: rgba(124,92,255,.65);
        box-shadow: 0 0 0 3px rgba(124,92,255,.16);
      }
      main { padding: 20px 16px 36px; }
      .headline { margin: 0 0 6px; font-size: 23px; letter-spacing: .2px; }
      .subhead { margin: 0 0 18px; color: var(--muted); font-size: 14px; }
      .divider { height: 1px; background: linear-gradient(90deg, transparent, var(--border), transparent); margin: 18px 0; }
      .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 14px; }
      .card {
        grid-column: span 6;
        background: var(--panel-soft);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 16px;
        box-shadow: var(--shadow);
      }
      .card h2 { margin: 0 0 6px; font-size: 15px; }
      .card p { margin: 0 0 10px; color: var(--muted); font-size: 13px; line-height: 1.4; }
      .kpi { grid-column: span 3; }
      .kpiValue { font-size: 30px; margin: 2px 0; font-weight: 700; letter-spacing: .2px; }
      .kpiLabel { color: var(--muted); font-size: 12px; }
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

      .sectionTitle { display:flex; align-items:center; justify-content:space-between; gap: 10px; margin: 0 0 10px; }
      .sectionTitle h2 { margin: 0; font-size: 14px; }
      .statusPill {
        display:inline-flex; align-items:center; gap:6px;
        padding: 4px 8px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: rgba(11,16,32,.25);
        font-size: 12px;
        color: var(--muted);
      }
      .statusDot { width: 8px; height: 8px; border-radius: 99px; background: rgba(168,176,217,.45); box-shadow: 0 0 0 2px rgba(168,176,217,.12); }
      .statusDot.on { background: rgba(52,211,153,.9); box-shadow: 0 0 0 2px rgba(52,211,153,.18), 0 0 18px rgba(52,211,153,.22); }
      .formHint { color: var(--muted); font-size: 12px; margin: 0 0 10px; }
      .field { display:flex; flex-direction:column; gap: 6px; margin-top: 10px; }
      .fieldRow { display:flex; align-items:center; justify-content:space-between; gap: 10px; }
      .fieldLabel { font-size: 12px; color: var(--muted); }
      .input {
        width:100%; padding:11px; border-radius: 12px;
        border: 1px solid var(--border);
        background: rgba(11,16,32,.25);
        color: var(--text);
        outline: none;
      }
      .input:focus { border-color: rgba(124,92,255,.58); box-shadow: 0 0 0 3px rgba(124,92,255,.18); }
      .stickyBar {
        position: sticky;
        bottom: 10px;
        margin-top: 14px;
        padding: 10px;
        border-radius: 14px;
        border: 1px solid var(--border);
        background: rgba(18,26,51,.72);
        backdrop-filter: blur(10px);
        display:flex;
        justify-content:flex-end;
        gap: 10px;
      }
      .toast {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 999;
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px solid rgba(52,211,153,.35);
        background: rgba(11,16,32,.65);
        backdrop-filter: blur(10px);
        color: var(--text);
        box-shadow: var(--shadow);
        max-width: min(520px, calc(100vw - 36px));
      }
      .toast small { color: var(--muted); display:block; margin-top: 2px; }
      .hidden { display:none; }

      @media (max-width: 920px) {
        .kpi { grid-column: span 6; }
      }
      @media (max-width: 720px) {
        .card, .kpi { grid-column: span 12; }
      }
    </style>
  </head>
  <body data-kiwy-shell="v2">
    <header>
      <div class="wrap">
        <div class="brand">
          <div class="logo" aria-hidden="true"></div>
          <div>
            <h1>Kiwy HQ</h1>
            <div class="tag">Qualiver • ECHO • Kuenti • Personal</div>
          </div>
        </div>
        <nav aria-label="Primary">
          ${navLink('dashboard', 'Dashboard', '/')}
          ${navLink('status', 'Project status', '/status')}
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
        <div class="fineprint">Kiwy HQ MVP v2 · no raw secret rendering in HTML.</div>
      </div>
    </main>
  </body>
</html>`;
}
