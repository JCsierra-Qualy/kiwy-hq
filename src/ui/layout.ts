export type NavKey = 'dashboard' | 'agents' | 'company' | 'status' | 'secrets' | 'credentials';

export function escapeHtml(input: string): string {
  return (String(input ?? '') || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const IC = {
  dashboard: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>`,
  agents: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="6" rx="2"/><path d="M8 8v2M16 8v2"/><rect x="3" y="10" width="18" height="10" rx="2"/><circle cx="9" cy="15" r="1.2"/><circle cx="15" cy="15" r="1.2"/><path d="M9.5 18.5c.8.35 1.5.5 2.5.5s1.7-.15 2.5-.5"/></svg>`,
  company: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  status: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  secrets: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  credentials: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  logout: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  chevrons: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>`,
};

const NAV: { key: NavKey; label: string; href: string }[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/' },
  { key: 'agents', label: 'Agentes', href: '/agents' },
  { key: 'company', label: 'Empresa', href: '/company' },
  { key: 'status', label: 'Estado', href: '/status' },
  { key: 'secrets', label: 'Secrets', href: '/secrets' },
  { key: 'credentials', label: 'Credenciales', href: '/credentials' },
];

export function pageLayout(opts: { title: string; active: NavKey; contentHtml: string }): string {
  const title = escapeHtml(opts.title);

  const navItem = (key: NavKey, label: string, href: string) => {
    const active = opts.active === key;
    return `<a href="${href}" class="nav-item${active ? ' active' : ''}" aria-current="${active ? 'page' : 'false'}">
      <span class="ni">${IC[key]}</span><span class="nl">${escapeHtml(label)}</span></a>`;
  };

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} · Kiwy HQ</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300..700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
  <style>
    :root {
      --bg: #05080f;
      --surface: #080c17;
      --panel: rgba(12,18,38,0.85);
      --panel-hi: rgba(16,23,46,0.9);
      --border: rgba(255,255,255,0.07);
      --border-hi: rgba(124,92,255,0.4);
      --text: #e2e8f8;
      --muted: #7a88aa;
      --dim: #3a4460;
      --violet: #7c5cff;
      --violet-soft: rgba(124,92,255,0.1);
      --violet-glow: rgba(124,92,255,0.25);
      --green: #34d399;
      --green-soft: rgba(52,211,153,0.1);
      --green-glow: rgba(52,211,153,0.2);
      --amber: #f59e0b;
      --amber-soft: rgba(245,158,11,0.12);
      --red: #f43f5e;
      --red-soft: rgba(244,63,94,0.1);
      --sw: 236px;
      --sw-c: 60px;
      --r: 12px;
      --r-lg: 16px;
      --shadow: 0 1px 2px rgba(0,0,0,0.6), 0 6px 20px rgba(0,0,0,0.35);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { height: 100%; }
    body {
      min-height: 100vh;
      font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: var(--text);
      background: var(--bg);
      background-image:
        radial-gradient(ellipse 900px 600px at -5% -10%, rgba(124,92,255,0.18) 0%, transparent 60%),
        radial-gradient(ellipse 700px 500px at 105% 5%, rgba(52,211,153,0.1) 0%, transparent 55%);
      overflow-x: hidden;
    }
    a { color: inherit; text-decoration: none; }
    button { font-family: inherit; font-size: inherit; }

    /* ── APP SHELL ──────────────────────────────── */
    .app { display: flex; min-height: 100vh; }

    /* ── SIDEBAR ────────────────────────────────── */
    .sidebar {
      position: fixed; top: 0; left: 0; bottom: 0;
      width: var(--sw);
      display: flex; flex-direction: column;
      background: var(--surface);
      border-right: 1px solid var(--border);
      z-index: 200;
      transition: width 0.22s cubic-bezier(0.4,0,0.2,1);
      overflow: hidden;
    }
    .app.col .sidebar { width: var(--sw-c); }

    /* brand */
    .sb-top { padding: 16px 14px 12px; flex-shrink: 0; }
    .brand { display: flex; align-items: center; gap: 10px; overflow: hidden; }
    .brand-logo {
      width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
      background: linear-gradient(135deg, var(--violet) 0%, var(--green) 100%);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 0 2px rgba(124,92,255,0.2), 0 0 20px rgba(124,92,255,0.2);
    }
    .brand-logo::after {
      content: ''; display: block; width: 10px; height: 10px;
      border-radius: 50%; background: rgba(255,255,255,0.9);
    }
    .brand-text { overflow: hidden; white-space: nowrap; }
    .brand-name { font-size: 15px; font-weight: 700; letter-spacing: -0.3px; color: var(--text); }
    .brand-sub { font-size: 11px; color: var(--muted); margin-top: 1px; }

    /* divider */
    .sb-div { height: 1px; background: var(--border); margin: 8px 0; flex-shrink: 0; }

    /* nav */
    .sb-nav { flex: 1; padding: 6px 8px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; overflow-x: hidden; }
    .nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px; border-radius: 9px;
      color: var(--muted); font-size: 13.5px; font-weight: 500;
      transition: all 0.13s ease; white-space: nowrap; overflow: hidden;
      border: 1px solid transparent;
    }
    .nav-item:hover { color: var(--text); background: var(--panel); border-color: var(--border); }
    .nav-item.active {
      color: var(--text); background: var(--violet-soft);
      border-color: var(--border-hi);
      box-shadow: inset 0 0 0 1px rgba(124,92,255,0.15);
    }
    .ni { display: flex; flex-shrink: 0; width: 17px; }
    .nl { opacity: 1; transition: opacity 0.15s ease; }
    .app.col .nl { opacity: 0; pointer-events: none; }
    .app.col .nav-item { justify-content: center; padding: 9px; }

    /* bottom area */
    .sb-bot { padding: 8px; flex-shrink: 0; }
    .sb-status {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; margin-bottom: 4px;
      border-radius: 9px; border: 1px solid var(--border);
      background: var(--panel); overflow: hidden;
    }
    .sb-status-text { font-size: 12px; color: var(--muted); white-space: nowrap; }
    .logout-btn {
      display: flex; align-items: center; gap: 10px;
      width: 100%; padding: 8px 10px; border-radius: 9px;
      background: none; border: 1px solid transparent; cursor: pointer;
      color: var(--muted); font-size: 13.5px; font-weight: 500;
      transition: all 0.13s ease; white-space: nowrap; overflow: hidden;
    }
    .logout-btn:hover { color: var(--red); border-color: var(--red-soft); background: var(--red-soft); }
    .app.col .logout-btn, .app.col .sb-status { justify-content: center; padding: 9px; }
    .app.col .sb-status-text { opacity: 0; pointer-events: none; width: 0; margin: 0; }
    .sb-toggle {
      position: absolute; top: 18px; right: -11px;
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--surface); border: 1px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--muted);
      transition: all 0.15s ease; z-index: 10;
    }
    .sb-toggle:hover { color: var(--text); border-color: var(--violet); box-shadow: 0 0 8px var(--violet-glow); }
    .sb-toggle svg { transition: transform 0.22s ease; }
    .app.col .sb-toggle svg { transform: rotate(180deg); }

    /* ── MAIN ───────────────────────────────────── */
    .main-w {
      flex: 1; min-width: 0;
      margin-left: var(--sw);
      transition: margin-left 0.22s cubic-bezier(0.4,0,0.2,1);
    }
    .app.col .main-w { margin-left: var(--sw-c); }
    .main { padding: 32px 36px 60px; max-width: 1200px; }

    /* ── PAGE HEADER ────────────────────────────── */
    .ph { margin-bottom: 28px; }
    .ph-title { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; color: var(--text); }
    .ph-sub { font-size: 13px; color: var(--muted); margin-top: 4px; }

    /* ── GRID ───────────────────────────────────── */
    .g { display: grid; gap: 14px; }
    .g-4 { grid-template-columns: repeat(4, 1fr); }
    .g-3 { grid-template-columns: repeat(3, 1fr); }
    .g-2 { grid-template-columns: 1fr 1fr; }
    .g-1 { grid-template-columns: 1fr; }
    .span-2 { grid-column: span 2; }
    .span-3 { grid-column: span 3; }
    .span-4 { grid-column: span 4; }

    /* ── CARD ───────────────────────────────────── */
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--r-lg);
      padding: 18px 20px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
    }
    .card-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .card-title span { font-size: 12px; font-weight: 400; color: var(--muted); }

    /* ── KPI CARD ───────────────────────────────── */
    .kpi-val { font-size: 32px; font-weight: 800; letter-spacing: -1px; color: var(--text); margin: 6px 0 4px; line-height: 1; }
    .kpi-label { font-size: 12px; color: var(--muted); }
    .kpi-sub { font-size: 11px; color: var(--dim); margin-top: 6px; font-family: 'JetBrains Mono', monospace; }
    .kpi-green .kpi-val { color: var(--green); }
    .kpi-violet .kpi-val { color: var(--violet); }
    .kpi-amber .kpi-val { color: var(--amber); }

    /* ── STATUS DOT ─────────────────────────────── */
    .dot {
      display: inline-block; width: 8px; height: 8px; border-radius: 50%;
      background: var(--dim); flex-shrink: 0;
    }
    .dot.active {
      background: var(--green);
      box-shadow: 0 0 0 2px rgba(52,211,153,0.15);
      animation: pulse-green 2s ease infinite;
    }
    .dot.thinking {
      background: var(--violet);
      box-shadow: 0 0 0 2px rgba(124,92,255,0.15);
      animation: pulse-violet 1.4s ease infinite;
    }
    .dot.error {
      background: var(--red);
      box-shadow: 0 0 0 2px rgba(244,63,94,0.15);
    }
    .dot.idle { background: var(--amber); box-shadow: 0 0 0 2px rgba(245,158,11,0.1); }

    @keyframes pulse-green {
      0%,100% { box-shadow: 0 0 0 2px rgba(52,211,153,0.15), 0 0 0 0 rgba(52,211,153,0.35); }
      50%      { box-shadow: 0 0 0 2px rgba(52,211,153,0.15), 0 0 0 6px rgba(52,211,153,0); }
    }
    @keyframes pulse-violet {
      0%,100% { box-shadow: 0 0 0 2px rgba(124,92,255,0.15), 0 0 0 0 rgba(124,92,255,0.35); }
      50%      { box-shadow: 0 0 0 2px rgba(124,92,255,0.15), 0 0 0 6px rgba(124,92,255,0); }
    }

    /* ── AGENT CARD ─────────────────────────────── */
    .agent-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--r-lg);
      padding: 20px;
      box-shadow: var(--shadow);
      display: flex; flex-direction: column; gap: 14px;
      transition: border-color 0.15s ease;
    }
    .agent-card:hover { border-color: rgba(124,92,255,0.25); }
    .agent-card.status-active { border-left: 3px solid var(--green); }
    .agent-card.status-thinking { border-left: 3px solid var(--violet); }
    .agent-card.status-error { border-left: 3px solid var(--red); }
    .agent-card.status-idle { border-left: 3px solid var(--dim); }

    .agent-head { display: flex; align-items: flex-start; gap: 10px; }
    .agent-name { font-size: 15px; font-weight: 700; color: var(--text); }
    .agent-role { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
    .status-badge {
      margin-left: auto; flex-shrink: 0;
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 8px; border-radius: 999px;
      font-size: 11px; font-weight: 500;
    }
    .badge-active { background: var(--green-soft); color: var(--green); border: 1px solid rgba(52,211,153,0.25); }
    .badge-thinking { background: var(--violet-soft); color: var(--violet); border: 1px solid rgba(124,92,255,0.25); }
    .badge-idle { background: var(--amber-soft); color: var(--amber); border: 1px solid rgba(245,158,11,0.2); }
    .badge-error { background: var(--red-soft); color: var(--red); border: 1px solid rgba(244,63,94,0.2); }

    .agent-task-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 5px; }
    .agent-task-text { font-size: 13px; color: var(--text); line-height: 1.45; }

    .progress-wrap { display: flex; flex-direction: column; gap: 6px; }
    .progress-row { display: flex; justify-content: space-between; align-items: center; }
    .progress-label { font-size: 11px; color: var(--muted); }
    .progress-pct { font-size: 12px; font-weight: 600; font-family: 'JetBrains Mono', monospace; color: var(--text); }
    .progress-bar {
      height: 5px; border-radius: 999px;
      background: rgba(255,255,255,0.06); overflow: hidden;
    }
    .progress-fill {
      height: 100%; border-radius: 999px;
      background: linear-gradient(90deg, var(--violet) 0%, var(--green) 100%);
      transition: width 0.5s ease;
    }
    .progress-fill.done { background: var(--green); }
    .progress-fill.error { background: var(--red); }

    .agent-metrics {
      display: flex; gap: 0; border-top: 1px solid var(--border);
      padding-top: 12px;
    }
    .metric { flex: 1; text-align: center; }
    .metric + .metric { border-left: 1px solid var(--border); }
    .metric-val { font-size: 16px; font-weight: 700; color: var(--text); font-family: 'JetBrains Mono', monospace; }
    .metric-key { font-size: 10.5px; color: var(--muted); margin-top: 2px; }

    .timeline { display: flex; flex-direction: column; gap: 0; }
    .tl-item {
      display: flex; gap: 10px; padding: 7px 0;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      font-size: 12px;
    }
    .tl-item:last-child { border-bottom: none; }
    .tl-time { color: var(--dim); font-family: 'JetBrains Mono', monospace; flex-shrink: 0; width: 38px; }
    .tl-dot-col { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; padding-top: 5px; }
    .tl-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dim); }
    .tl-dot.ok { background: var(--green); }
    .tl-dot.err { background: var(--red); }
    .tl-text { color: var(--muted); line-height: 1.45; }

    /* ── SEMAPHORE ──────────────────────────────── */
    .sema { display: inline-flex; align-items: center; gap: 6px; }
    .sema-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .sema-green .sema-dot { background: var(--green); box-shadow: 0 0 6px var(--green-glow); }
    .sema-amber .sema-dot { background: var(--amber); }
    .sema-red .sema-dot { background: var(--red); }
    .sema-gray .sema-dot { background: var(--dim); }

    /* ── PROJECT STATUS CARD ────────────────────── */
    .proj-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--r);
      padding: 14px 16px;
    }
    .proj-name { font-size: 13.5px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
    .proj-status { font-size: 13px; color: var(--muted); line-height: 1.45; }
    .proj-footer { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
    .proj-link { font-size: 12px; color: var(--violet); }
    .proj-link:hover { text-decoration: underline; }
    .proj-ts { font-size: 11px; color: var(--dim); font-family: 'JetBrains Mono', monospace; }

    /* ── COMPANY CARDS ──────────────────────────── */

    /* meetings */
    .meeting-card {
      display: flex; gap: 14px; align-items: flex-start;
      background: var(--panel); border: 1px solid var(--border);
      border-radius: var(--r); padding: 14px 16px;
      transition: border-color 0.13s ease;
    }
    .meeting-card:hover { border-color: rgba(124,92,255,0.3); }
    .meeting-date-box {
      flex-shrink: 0; width: 44px; text-align: center;
      background: var(--violet-soft); border: 1px solid var(--border-hi);
      border-radius: 9px; padding: 6px 4px;
    }
    .meeting-date-month { font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--violet); font-weight: 700; }
    .meeting-date-day { font-size: 20px; font-weight: 800; color: var(--text); line-height: 1; margin-top: 2px; }
    .meeting-body { flex: 1; min-width: 0; }
    .meeting-title { font-size: 13.5px; font-weight: 600; color: var(--text); }
    .meeting-meta { font-size: 12px; color: var(--muted); margin-top: 4px; }
    .meeting-proj { font-size: 11px; color: var(--violet); margin-top: 4px; }
    .meeting-del {
      flex-shrink: 0; background: none; border: 1px solid transparent;
      color: var(--dim); cursor: pointer; border-radius: 6px; padding: 3px 6px; font-size: 12px;
    }
    .meeting-del:hover { border-color: var(--red-soft); color: var(--red); background: var(--red-soft); }

    /* actions */
    .action-item {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 11px 14px; border-radius: var(--r);
      border: 1px solid var(--border); background: var(--panel);
      transition: border-color 0.13s ease;
    }
    .action-item:hover { border-color: rgba(124,92,255,0.2); }
    .action-done { opacity: 0.45; }
    .action-pri {
      flex-shrink: 0; padding: 2px 7px; border-radius: 5px;
      font-size: 10.5px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase;
    }
    .pri-high { background: var(--red-soft); color: var(--red); border: 1px solid rgba(244,63,94,0.2); }
    .pri-medium { background: var(--amber-soft); color: var(--amber); border: 1px solid rgba(245,158,11,0.2); }
    .pri-low { background: var(--green-soft); color: var(--green); border: 1px solid rgba(52,211,153,0.2); }
    .action-body { flex: 1; min-width: 0; }
    .action-title { font-size: 13px; font-weight: 500; color: var(--text); }
    .action-meta { font-size: 11.5px; color: var(--muted); margin-top: 3px; }
    .action-btns { display: flex; gap: 6px; margin-left: auto; flex-shrink: 0; }
    .action-btn {
      background: none; border: 1px solid var(--border); border-radius: 6px;
      padding: 3px 8px; font-size: 11.5px; color: var(--muted); cursor: pointer;
      transition: all 0.13s ease;
    }
    .action-btn.check:hover { border-color: var(--green); color: var(--green); background: var(--green-soft); }
    .action-btn.del:hover { border-color: var(--red); color: var(--red); background: var(--red-soft); }

    /* suggestions */
    .suggestion-card {
      background: var(--panel); border: 1px solid var(--border);
      border-radius: var(--r); padding: 14px 16px;
      transition: border-color 0.13s ease;
    }
    .suggestion-card:hover { border-color: rgba(124,92,255,0.25); }
    .suggestion-card.approved { border-left: 3px solid var(--green); }
    .suggestion-card.rejected { opacity: 0.4; }
    .sug-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .sug-source { font-size: 11px; font-weight: 700; color: var(--violet); }
    .sug-date { font-size: 11px; color: var(--dim); margin-left: auto; font-family: 'JetBrains Mono', monospace; }
    .sug-text { font-size: 13px; color: var(--text); line-height: 1.5; }
    .sug-impact { font-size: 12px; color: var(--muted); margin-top: 6px; }
    .sug-actions { display: flex; gap: 8px; margin-top: 12px; }
    .sug-approve {
      background: var(--green-soft); border: 1px solid rgba(52,211,153,0.3);
      color: var(--green); border-radius: 7px; padding: 5px 12px;
      font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;
      transition: all 0.13s ease;
    }
    .sug-approve:hover { background: rgba(52,211,153,0.2); }
    .sug-reject {
      background: none; border: 1px solid var(--border);
      color: var(--muted); border-radius: 7px; padding: 5px 12px;
      font-size: 12px; cursor: pointer; font-family: inherit;
      transition: all 0.13s ease;
    }
    .sug-reject:hover { border-color: var(--red); color: var(--red); background: var(--red-soft); }
    .sug-status-tag {
      margin-left: auto; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 5px;
    }
    .sug-status-approved { background: var(--green-soft); color: var(--green); }
    .sug-status-rejected { background: var(--red-soft); color: var(--red); }

    /* ── FORMS ──────────────────────────────────── */
    .form-section { display: flex; flex-direction: column; gap: 10px; }
    .form-row { display: flex; gap: 10px; }
    .field { display: flex; flex-direction: column; gap: 5px; }
    .field-label { font-size: 12px; color: var(--muted); font-weight: 500; }
    .input, select.input {
      padding: 9px 12px; border-radius: var(--r); border: 1px solid var(--border);
      background: rgba(10,14,28,0.6); color: var(--text); font-family: inherit;
      font-size: 13.5px; outline: none; width: 100%;
      transition: border-color 0.13s ease, box-shadow 0.13s ease;
      -webkit-appearance: none;
    }
    .input:focus, select.input:focus {
      border-color: rgba(124,92,255,0.5);
      box-shadow: 0 0 0 3px rgba(124,92,255,0.12);
    }
    .input::placeholder { color: var(--dim); }
    select.input { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a88aa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }

    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 16px; border-radius: var(--r); border: 1px solid var(--border-hi);
      background: var(--violet-soft); color: var(--text); font-family: inherit;
      font-size: 13px; font-weight: 600; cursor: pointer;
      transition: all 0.13s ease;
    }
    .btn:hover { background: rgba(124,92,255,0.18); box-shadow: 0 0 16px rgba(124,92,255,0.2); }
    .btn-sm { padding: 6px 12px; font-size: 12px; }
    .btn-ghost {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 16px; border-radius: var(--r); border: 1px solid var(--border);
      background: none; color: var(--muted); font-family: inherit;
      font-size: 13px; cursor: pointer; transition: all 0.13s ease;
    }
    .btn-ghost:hover { color: var(--text); border-color: rgba(255,255,255,0.15); }
    .sticky-bar {
      position: sticky; bottom: 10px;
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 10px 14px; margin-top: 16px;
      background: rgba(12,18,38,0.85); backdrop-filter: blur(12px);
      border: 1px solid var(--border); border-radius: var(--r-lg);
    }

    /* ── MISC ───────────────────────────────────── */
    .divider { height: 1px; background: linear-gradient(90deg, transparent, var(--border), transparent); margin: 22px 0; }
    .section-label {
      font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;
      letter-spacing: 0.8px; margin-bottom: 12px;
    }
    .stack { display: flex; flex-direction: column; gap: 8px; }
    .empty { color: var(--dim); font-size: 13px; padding: 20px; text-align: center; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .text-muted { color: var(--muted); }
    .text-green { color: var(--green); }
    .text-violet { color: var(--violet); }
    .text-red { color: var(--red); }
    .text-amber { color: var(--amber); }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .gap-6 { gap: 6px; }
    .gap-8 { gap: 8px; }
    .mb-4 { margin-bottom: 4px; }
    .mb-8 { margin-bottom: 8px; }
    .mb-16 { margin-bottom: 16px; }
    .mt-16 { margin-top: 16px; }
    .w-full { width: 100%; }
    code { font-family: 'JetBrains Mono', monospace; font-size: 0.9em; background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 4px; color: var(--muted); }

    /* table */
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 9px 10px; border-bottom: 1px solid var(--border); text-align: left; }
    th { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); }
    td { color: var(--text); }

    /* toast */
    .toast {
      position: fixed; right: 20px; bottom: 20px; z-index: 999;
      padding: 12px 16px; border-radius: var(--r-lg); max-width: min(480px, calc(100vw - 40px));
      background: rgba(10,14,28,0.9); backdrop-filter: blur(14px);
      border: 1px solid rgba(52,211,153,0.3); box-shadow: var(--shadow);
      font-size: 13.5px; color: var(--text);
    }
    .toast small { display: block; color: var(--muted); font-size: 12px; margin-top: 3px; }
    .hidden { display: none !important; }

    /* secrets/creds specific */
    .spill { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
    .spill h3 { font-size: 13.5px; font-weight: 600; margin: 0; }
    .status-pill {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 8px; border-radius: 999px; font-size: 11px;
      border: 1px solid var(--border); background: rgba(10,14,28,0.4); color: var(--muted);
    }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dim); }
    .status-dot.on { background: var(--green); box-shadow: 0 0 0 2px rgba(52,211,153,0.15), 0 0 8px rgba(52,211,153,0.2); }
    .form-hint { font-size: 11.5px; color: var(--dim); }
    .field-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }

    /* responsive */
    @media (max-width: 1000px) {
      .main { padding: 24px 22px 50px; }
      .g-4 { grid-template-columns: repeat(2, 1fr); }
      .g-3 { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 680px) {
      .g-4, .g-3, .g-2 { grid-template-columns: 1fr; }
      .sidebar { width: var(--sw-c); }
      .nl { opacity: 0 !important; pointer-events: none !important; }
      .main-w { margin-left: var(--sw-c); }
      .nav-item { justify-content: center; padding: 9px; }
      .main { padding: 20px 16px 50px; }
    }
  </style>
</head>
<body>
<div class="app" id="app">
  <aside class="sidebar">
    <div class="sb-top">
      <div class="brand">
        <div class="brand-logo"></div>
        <div class="brand-text">
          <div class="brand-name">Kiwy HQ</div>
          <div class="brand-sub">OpenClaw · Control Center</div>
        </div>
      </div>
    </div>
    <button class="sb-toggle" id="sb-toggle" aria-label="Colapsar barra lateral">${IC.chevrons}</button>
    <div class="sb-div"></div>
    <nav class="sb-nav" aria-label="Principal">
      ${NAV.map((n) => navItem(n.key, n.label, n.href)).join('\n      ')}
    </nav>
    <div class="sb-bot">
      <div class="sb-div"></div>
      <div class="sb-status">
        <span class="dot active"></span>
        <span class="sb-status-text">Sistema operativo</span>
      </div>
      <form method="post" action="/logout" style="margin-top:4px">
        <button type="submit" class="logout-btn">
          <span class="ni">${IC.logout}</span><span class="nl">Cerrar sesión</span>
        </button>
      </form>
    </div>
  </aside>

  <div class="main-w">
    <main class="main">
      ${opts.contentHtml}
    </main>
    <div style="padding:0 36px 20px;font-size:11px;color:var(--dim)">Kiwy HQ · MVP v3 · sin secretos en HTML</div>
  </div>
</div>

<script>
  (function(){
    var app = document.getElementById('app');
    var btn = document.getElementById('sb-toggle');
    if (localStorage.getItem('sb-col') === '1') app.classList.add('col');
    if (btn) btn.addEventListener('click', function(){
      app.classList.toggle('col');
      localStorage.setItem('sb-col', app.classList.contains('col') ? '1' : '0');
    });
  })();
</script>
</body>
</html>`;
}
