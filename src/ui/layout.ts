export type NavKey = 'dashboard' | 'agents' | 'company' | 'costs' | 'status' | 'config';

export function escapeHtml(input: string): string {
  return (String(input ?? '') || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const IC: Record<string, string> = {
  dashboard: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>`,
  agents: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="6" rx="2"/><path d="M8 8v2M16 8v2"/><rect x="3" y="10" width="18" height="10" rx="2"/><circle cx="9" cy="15" r="1.2"/><circle cx="15" cy="15" r="1.2"/><path d="M9.5 18.5c.8.35 1.5.5 2.5.5s1.7-.15 2.5-.5"/></svg>`,
  company: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  costs: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  status: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  config: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>`,
  logout: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  chevLeft: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  menu: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  x: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
};

const NAV: { key: NavKey; label: string; href: string }[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/' },
  { key: 'agents',    label: 'Agentes',   href: '/agents' },
  { key: 'company',   label: 'Empresa',   href: '/company' },
  { key: 'costs',     label: 'Costos',    href: '/costs' },
  { key: 'status',    label: 'Estado',    href: '/status' },
  { key: 'config',    label: 'Config',    href: '/config' },
];

export function pageLayout(opts: { title: string; active: NavKey; contentHtml: string }): string {
  const title = escapeHtml(opts.title);
  const ni = (key: NavKey, label: string, href: string) => {
    const a = opts.active === key;
    return `<a href="${href}" class="ni-item${a ? ' active' : ''}" aria-current="${a ? 'page' : 'false'}">
      <span class="ni-icon">${IC[key]}</span><span class="ni-label">${escapeHtml(label)}</span></a>`;
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
    :root{
      --bg:#05080f;--sf:#080c17;--panel:rgba(12,18,38,.88);--panel-hi:rgba(16,24,48,.92);
      --bd:rgba(255,255,255,.07);--bd-hi:rgba(124,92,255,.4);
      --tx:#e2e8f8;--mu:#7a88aa;--dim:#38415a;
      --v:#7c5cff;--vs:rgba(124,92,255,.1);--vg:rgba(124,92,255,.22);
      --g:#34d399;--gs:rgba(52,211,153,.1);--gg:rgba(52,211,153,.18);
      --am:#f59e0b;--ams:rgba(245,158,11,.1);
      --rd:#f43f5e;--rds:rgba(244,63,94,.1);
      --sw:232px;--sw-c:60px;
      --r:11px;--r-lg:15px;
      --sh:0 1px 3px rgba(0,0,0,.55),0 6px 22px rgba(0,0,0,.32);
    }
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html{height:100%;-webkit-text-size-adjust:100%}
    body{
      min-height:100vh;font-family:'Inter',ui-sans-serif,system-ui,-apple-system,sans-serif;
      font-size:14px;line-height:1.5;color:var(--tx);background:var(--bg);
      background-image:
        radial-gradient(ellipse 900px 600px at -5% -10%,rgba(124,92,255,.16) 0%,transparent 60%),
        radial-gradient(ellipse 700px 500px at 108% 5%,rgba(52,211,153,.09) 0%,transparent 55%);
      overflow-x:hidden;
    }
    a{color:inherit;text-decoration:none}
    button{font-family:inherit;font-size:inherit;cursor:pointer}
    img{max-width:100%}

    /* ── LAYOUT ─────────────────────────── */
    .app{display:flex;min-height:100vh}

    /* ── MOBILE TOP BAR ─────────────────── */
    .topbar{
      display:none;position:fixed;top:0;left:0;right:0;z-index:300;
      height:52px;padding:0 16px;
      background:rgba(8,12,23,.92);backdrop-filter:blur(12px);
      border-bottom:1px solid var(--bd);
      align-items:center;justify-content:space-between;gap:12px;
    }
    .topbar-brand{display:flex;align-items:center;gap:9px;font-size:15px;font-weight:700;letter-spacing:-.2px}
    .topbar-logo{width:26px;height:26px;border-radius:7px;flex-shrink:0;
      background:linear-gradient(135deg,var(--v),var(--g));
      box-shadow:0 0 0 2px rgba(124,92,255,.22)}
    .topbar-btn{
      display:flex;align-items:center;justify-content:center;
      width:36px;height:36px;border-radius:9px;border:1px solid var(--bd);
      background:none;color:var(--mu);transition:all .13s ease
    }
    .topbar-btn:hover{color:var(--tx);border-color:var(--bd-hi)}

    /* ── SIDEBAR BACKDROP ───────────────── */
    .sb-backdrop{
      display:none;position:fixed;inset:0;z-index:190;
      background:rgba(0,0,0,.6);backdrop-filter:blur(2px);
    }
    .sb-open .sb-backdrop{display:block}

    /* ── SIDEBAR ────────────────────────── */
    .sidebar{
      position:fixed;top:0;left:0;bottom:0;z-index:200;
      width:var(--sw);display:flex;flex-direction:column;
      background:var(--sf);border-right:1px solid var(--bd);
      transition:width .22s cubic-bezier(.4,0,.2,1),transform .22s cubic-bezier(.4,0,.2,1);
      overflow:hidden;
    }
    .app.col .sidebar{width:var(--sw-c)}

    .sb-head{padding:16px 14px 10px;flex-shrink:0}
    .brand{display:flex;align-items:center;gap:10px;overflow:hidden}
    .brand-logo{
      width:30px;height:30px;border-radius:8px;flex-shrink:0;
      background:linear-gradient(135deg,var(--v),var(--g));
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 0 0 2px rgba(124,92,255,.18),0 0 18px rgba(124,92,255,.15);
    }
    .brand-logo::after{content:'';display:block;width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.9)}
    .brand-txt{overflow:hidden;white-space:nowrap;min-width:0}
    .brand-name{font-size:14px;font-weight:700;letter-spacing:-.2px}
    .brand-sub{font-size:10.5px;color:var(--mu);margin-top:1px}

    .sb-div{height:1px;background:var(--bd);margin:6px 0;flex-shrink:0}

    .sb-nav{flex:1;padding:4px 8px;display:flex;flex-direction:column;gap:2px;overflow-y:auto;overflow-x:hidden;scrollbar-width:none}
    .sb-nav::-webkit-scrollbar{display:none}
    .ni-item{
      display:flex;align-items:center;gap:10px;
      padding:8px 10px;border-radius:9px;
      color:var(--mu);font-size:13px;font-weight:500;
      transition:all .13s ease;white-space:nowrap;overflow:hidden;
      border:1px solid transparent;
    }
    .ni-item:hover{color:var(--tx);background:rgba(255,255,255,.04);border-color:var(--bd)}
    .ni-item.active{color:var(--tx);background:var(--vs);border-color:var(--bd-hi);box-shadow:inset 0 0 0 1px rgba(124,92,255,.12)}
    .ni-icon{display:flex;flex-shrink:0;width:16px}
    .ni-label{transition:opacity .15s ease}
    .app.col .ni-label{opacity:0;pointer-events:none;width:0;overflow:hidden}
    .app.col .ni-item{justify-content:center;padding:9px}

    .sb-bot{padding:8px;flex-shrink:0}
    .sb-sys{
      display:flex;align-items:center;gap:8px;
      padding:7px 10px;margin-bottom:4px;
      border-radius:9px;border:1px solid var(--bd);background:var(--panel);overflow:hidden;
    }
    .sb-sys-txt{font-size:11.5px;color:var(--mu);white-space:nowrap}
    .logout-btn{
      display:flex;align-items:center;gap:10px;width:100%;
      padding:8px 10px;border-radius:9px;border:1px solid transparent;
      background:none;color:var(--mu);font-size:13px;font-weight:500;
      transition:all .13s ease;white-space:nowrap;overflow:hidden;text-align:left;
    }
    .logout-btn:hover{color:var(--rd);border-color:rgba(244,63,94,.25);background:var(--rds)}
    .app.col .sb-sys,.app.col .logout-btn{justify-content:center;padding:9px}
    .app.col .sb-sys-txt{opacity:0;width:0}
    .app.col .logout-btn .ni-label{opacity:0;width:0}

    .sb-toggle{
      position:absolute;top:18px;right:-11px;
      width:22px;height:22px;border-radius:50%;
      background:var(--sf);border:1px solid var(--bd);
      display:flex;align-items:center;justify-content:center;
      color:var(--mu);transition:all .15s ease;z-index:10;
    }
    .sb-toggle:hover{color:var(--tx);border-color:var(--v);box-shadow:0 0 8px var(--vg)}
    .sb-toggle svg{transition:transform .22s ease}
    .app.col .sb-toggle svg{transform:rotate(180deg)}

    /* ── MAIN ───────────────────────────── */
    .main-w{
      flex:1;min-width:0;
      margin-left:var(--sw);
      transition:margin-left .22s cubic-bezier(.4,0,.2,1);
    }
    .app.col .main-w{margin-left:var(--sw-c)}
    .main{padding:28px 32px 60px;width:100%}
    .foot{padding:0 32px 20px;font-size:11px;color:var(--dim)}

    /* ── PAGE HEADER ────────────────────── */
    .ph{margin-bottom:24px}
    .ph-title{font-size:21px;font-weight:700;letter-spacing:-.4px}
    .ph-sub{font-size:13px;color:var(--mu);margin-top:4px}

    /* ── GRID ───────────────────────────── */
    .g{display:grid;gap:12px}
    .g4{grid-template-columns:repeat(4,1fr)}
    .g3{grid-template-columns:repeat(3,1fr)}
    .g2{grid-template-columns:1fr 1fr}
    .g1{grid-template-columns:1fr}
    .col-2{grid-column:span 2}
    .col-3{grid-column:span 3}
    .col-4{grid-column:span 4}

    /* ── CARD ───────────────────────────── */
    .card{
      background:var(--panel);border:1px solid var(--bd);border-radius:var(--r-lg);
      padding:16px 18px;box-shadow:var(--sh);backdrop-filter:blur(10px);
    }
    .card-hd{font-size:12px;font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:8px}
    .card-hd-count{font-size:11px;font-weight:500;color:var(--dim);text-transform:none;letter-spacing:0}

    /* ── KPI ────────────────────────────── */
    .kpi-val{font-size:30px;font-weight:800;letter-spacing:-1px;color:var(--tx);margin:4px 0 3px;line-height:1}
    .kpi-label{font-size:11.5px;color:var(--mu)}
    .kpi-sub{font-size:11px;color:var(--dim);margin-top:5px;font-family:'JetBrains Mono',monospace}
    .kv-green .kpi-val{color:var(--g)}
    .kv-violet .kpi-val{color:var(--v)}
    .kv-amber .kpi-val{color:var(--am)}
    .kv-red .kpi-val{color:var(--rd)}

    /* ── STATUS DOT ─────────────────────── */
    .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--dim);flex-shrink:0}
    .dot.active{background:var(--g);box-shadow:0 0 0 2px rgba(52,211,153,.15);animation:pg 2s ease infinite}
    .dot.thinking{background:var(--v);box-shadow:0 0 0 2px rgba(124,92,255,.15);animation:pv 1.4s ease infinite}
    .dot.idle{background:var(--am);box-shadow:0 0 0 2px rgba(245,158,11,.1)}
    .dot.error{background:var(--rd);box-shadow:0 0 0 2px rgba(244,63,94,.15)}
    @keyframes pg{0%,100%{box-shadow:0 0 0 2px rgba(52,211,153,.15),0 0 0 0 rgba(52,211,153,.3)}50%{box-shadow:0 0 0 2px rgba(52,211,153,.15),0 0 0 6px rgba(52,211,153,0)}}
    @keyframes pv{0%,100%{box-shadow:0 0 0 2px rgba(124,92,255,.15),0 0 0 0 rgba(124,92,255,.3)}50%{box-shadow:0 0 0 2px rgba(124,92,255,.15),0 0 0 6px rgba(124,92,255,0)}}

    /* ── BADGE ──────────────────────────── */
    .badge{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:600}
    .b-green{background:var(--gs);color:var(--g);border:1px solid rgba(52,211,153,.2)}
    .b-violet{background:var(--vs);color:var(--v);border:1px solid rgba(124,92,255,.2)}
    .b-amber{background:var(--ams);color:var(--am);border:1px solid rgba(245,158,11,.15)}
    .b-red{background:var(--rds);color:var(--rd);border:1px solid rgba(244,63,94,.15)}
    .b-dim{background:rgba(255,255,255,.04);color:var(--mu);border:1px solid var(--bd)}

    /* ── PROGRESS BAR ───────────────────── */
    .pb{height:4px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}
    .pb-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--v),var(--g));transition:width .4s ease}
    .pb-fill.done{background:var(--g)}
    .pb-fill.err{background:var(--rd)}
    .pb-fill.warn{background:var(--am)}

    /* ── AGENT LIST ─────────────────────── */
    .agent-row{
      display:flex;align-items:center;gap:12px;
      padding:12px 14px;border-radius:var(--r);border:1px solid var(--bd);
      background:var(--panel);cursor:pointer;
      transition:border-color .13s ease,background .13s ease;
    }
    .agent-row:hover{border-color:rgba(124,92,255,.3);background:var(--panel-hi)}
    .agent-row.expanded{border-color:var(--bd-hi);border-bottom-left-radius:0;border-bottom-right-radius:0;border-bottom-color:transparent}
    .agent-name{font-size:13.5px;font-weight:600;color:var(--tx)}
    .agent-role{font-size:11.5px;color:var(--mu)}
    .agent-task{font-size:12px;color:var(--mu);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .agent-pct{font-size:12px;font-weight:700;font-family:'JetBrains Mono',monospace;color:var(--tx);min-width:36px;text-align:right}
    .agent-chevron{color:var(--dim);transition:transform .2s ease;flex-shrink:0}
    .agent-row.expanded .agent-chevron{transform:rotate(90deg)}

    .agent-detail{
      border:1px solid var(--bd-hi);border-top:none;
      border-bottom-left-radius:var(--r);border-bottom-right-radius:var(--r);
      background:var(--panel-hi);padding:16px 18px;
      display:none;
    }
    .agent-detail.open{display:block}

    .metrics-row{display:flex;gap:0;border:1px solid var(--bd);border-radius:var(--r);overflow:hidden;margin-bottom:14px}
    .metric{flex:1;padding:10px 12px;text-align:center}
    .metric+.metric{border-left:1px solid var(--bd)}
    .metric-v{font-size:18px;font-weight:800;color:var(--tx);font-family:'JetBrains Mono',monospace}
    .metric-k{font-size:10px;color:var(--mu);margin-top:2px}

    .tl{display:flex;flex-direction:column}
    .tl-row{display:flex;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px}
    .tl-row:last-child{border-bottom:none}
    .tl-time{color:var(--dim);font-family:'JetBrains Mono',monospace;flex-shrink:0;min-width:32px}
    .tl-dot{width:6px;height:6px;border-radius:50%;background:var(--dim);margin-top:5px;flex-shrink:0}
    .tl-dot.ok{background:var(--g)}.tl-dot.err{background:var(--rd)}
    .tl-txt{color:var(--mu);line-height:1.45}

    /* ── COMPANY ────────────────────────── */
    .meet-row{
      display:flex;gap:12px;align-items:flex-start;
      padding:12px 14px;border-radius:var(--r);border:1px solid var(--bd);background:var(--panel);
      transition:border-color .13s ease;
    }
    .meet-row:hover{border-color:rgba(124,92,255,.25)}
    .meet-date{
      flex-shrink:0;width:40px;text-align:center;
      background:var(--vs);border:1px solid rgba(124,92,255,.3);border-radius:8px;padding:5px 3px;
    }
    .meet-date-m{font-size:9px;text-transform:uppercase;letter-spacing:.7px;color:var(--v);font-weight:700}
    .meet-date-d{font-size:19px;font-weight:800;color:var(--tx);line-height:1;margin-top:1px}
    .meet-body{flex:1;min-width:0}
    .meet-title{font-size:13.5px;font-weight:600;color:var(--tx)}
    .meet-meta{font-size:12px;color:var(--mu);margin-top:3px}

    .task-row{
      display:flex;align-items:flex-start;gap:10px;
      padding:10px 12px;border-radius:var(--r);border:1px solid var(--bd);background:var(--panel);
    }
    .task-title{font-size:13px;font-weight:500;color:var(--tx)}
    .task-meta{font-size:11.5px;color:var(--mu);margin-top:2px}
    .task-done .task-title{text-decoration:line-through;color:var(--mu);opacity:.6}

    .pri-high{background:var(--rds);color:var(--rd);border:1px solid rgba(244,63,94,.2)}
    .pri-med{background:var(--ams);color:var(--am);border:1px solid rgba(245,158,11,.15)}
    .pri-low{background:var(--gs);color:var(--g);border:1px solid rgba(52,211,153,.2)}
    .pri-tag{padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;flex-shrink:0;letter-spacing:.3px}

    .conv-row{
      padding:12px 14px;border-radius:var(--r);border:1px solid var(--bd);background:var(--panel);
    }
    .conv-hd{display:flex;align-items:center;gap:8px;margin-bottom:6px}
    .conv-src{font-size:11px;font-weight:700;color:var(--v)}
    .conv-ts{font-size:11px;color:var(--dim);margin-left:auto;font-family:'JetBrains Mono',monospace}
    .conv-txt{font-size:13px;color:var(--tx);line-height:1.5}
    .conv-notes{font-size:12px;color:var(--mu);margin-top:5px}

    /* ── COSTS CHART ────────────────────── */
    .costs-chart-wrap{overflow-x:auto;padding:4px 0}
    .costs-chart-wrap svg{display:block}

    /* ── CONFIG / SECRETS ───────────────── */
    .cfg-item{
      display:flex;align-items:center;gap:12px;
      padding:12px 14px;border-radius:var(--r);border:1px solid var(--bd);background:var(--panel);
    }
    .cfg-item+.cfg-item{margin-top:6px}
    .cfg-label{font-size:13px;font-weight:600;color:var(--tx);min-width:140px}
    .cfg-hint{font-size:11.5px;color:var(--mu)}
    .cfg-val{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--g)}
    .cfg-edit-wrap{margin-left:auto;display:flex;align-items:center;gap:8px}
    .cfg-set-badge{font-size:11px;padding:2px 7px;border-radius:5px;background:var(--gs);color:var(--g);border:1px solid rgba(52,211,153,.2)}
    .cfg-unset-badge{font-size:11px;padding:2px 7px;border-radius:5px;background:rgba(255,255,255,.04);color:var(--mu);border:1px solid var(--bd)}

    /* ── FORMS ──────────────────────────── */
    .field{display:flex;flex-direction:column;gap:5px}
    .flabel{font-size:11.5px;color:var(--mu);font-weight:500}
    .inp{
      padding:9px 12px;border-radius:var(--r);border:1px solid var(--bd);
      background:rgba(8,12,26,.7);color:var(--tx);font-family:inherit;font-size:13px;
      outline:none;width:100%;transition:border-color .13s,box-shadow .13s;-webkit-appearance:none;
    }
    .inp:focus{border-color:rgba(124,92,255,.5);box-shadow:0 0 0 3px rgba(124,92,255,.1)}
    .inp::placeholder{color:var(--dim)}
    select.inp{
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a88aa' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat:no-repeat;background-position:right 10px center;padding-right:30px;
    }
    .btn{
      display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:var(--r);
      border:1px solid var(--bd-hi);background:var(--vs);color:var(--tx);
      font-size:13px;font-weight:600;transition:all .13s ease;
    }
    .btn:hover{background:rgba(124,92,255,.18);box-shadow:0 0 14px var(--vg)}
    .btn-sm{padding:6px 11px;font-size:12px}
    .btn-ghost{
      display:inline-flex;align-items:center;gap:6px;padding:8px 14px;
      border-radius:var(--r);border:1px solid var(--bd);background:none;
      color:var(--mu);font-size:13px;transition:all .13s ease;
    }
    .btn-ghost:hover{color:var(--tx);border-color:rgba(255,255,255,.14)}
    .btn-danger{border-color:rgba(244,63,94,.25);background:var(--rds);color:var(--rd)}
    .btn-danger:hover{background:rgba(244,63,94,.2)}
    .sbar{
      position:sticky;bottom:10px;margin-top:16px;padding:10px 12px;
      border-radius:var(--r-lg);border:1px solid var(--bd);
      background:rgba(12,18,38,.88);backdrop-filter:blur(12px);
      display:flex;justify-content:flex-end;gap:8px;
    }
    .hint{font-size:11.5px;color:var(--dim)}

    /* ── MISC ───────────────────────────── */
    .divider{height:1px;background:linear-gradient(90deg,transparent,var(--bd),transparent);margin:20px 0}
    .sec-label{font-size:11px;font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px}
    .stack{display:flex;flex-direction:column;gap:8px}
    .empty{color:var(--dim);font-size:13px;padding:18px;text-align:center}
    .mono{font-family:'JetBrains Mono',monospace}
    .c-green{color:var(--g)}.c-violet{color:var(--v)}.c-red{color:var(--rd)}.c-amber{color:var(--am)}.c-mu{color:var(--mu)}
    .flex{display:flex}.ai-c{align-items:center}.jb{justify-content:space-between}.gap-6{gap:6px}.gap-8{gap:8px}
    .mb-8{margin-bottom:8px}.mb-12{margin-bottom:12px}.mb-16{margin-bottom:16px}.mt-12{margin-top:12px}.mt-16{margin-top:16px}.w100{width:100%}
    code{font-family:'JetBrains Mono',monospace;font-size:.88em;background:rgba(255,255,255,.06);padding:1px 5px;border-radius:4px;color:var(--mu)}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th,td{padding:9px 10px;border-bottom:1px solid var(--bd);text-align:left}
    th{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--mu)}
    .toast{
      position:fixed;right:18px;bottom:18px;z-index:999;
      padding:11px 15px;border-radius:var(--r-lg);max-width:min(460px,calc(100vw - 36px));
      background:rgba(8,12,26,.92);backdrop-filter:blur(14px);
      border:1px solid rgba(52,211,153,.3);box-shadow:var(--sh);font-size:13px;
    }
    .toast small{display:block;color:var(--mu);font-size:11.5px;margin-top:2px}
    .hidden{display:none!important}
    .status-pill{
      display:inline-flex;align-items:center;gap:5px;
      padding:3px 8px;border-radius:999px;font-size:11px;
      border:1px solid var(--bd);background:rgba(8,12,26,.4);color:var(--mu);
    }
    .sdot{width:7px;height:7px;border-radius:50%;background:var(--dim)}
    .sdot.on{background:var(--g);box-shadow:0 0 0 2px rgba(52,211,153,.12),0 0 8px rgba(52,211,153,.18)}
    .spill{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
    .field-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px}

    /* ── RESPONSIVE ─────────────────────── */
    @media(max-width:1100px){
      .g4{grid-template-columns:1fr 1fr}
      .g3{grid-template-columns:1fr 1fr}
      .main{padding:24px 24px 50px}
    }
    @media(max-width:768px){
      .topbar{display:flex}
      .sidebar{transform:translateX(calc(-1 * var(--sw)));width:var(--sw)!important}
      .sb-open .sidebar{transform:translateX(0)}
      .sb-toggle{display:none}
      .main-w{margin-left:0!important;padding-top:52px}
      .main{padding:20px 16px 50px}
      .foot{padding:0 16px 16px}
      .g4,.g3,.g2{grid-template-columns:1fr}
      .col-2,.col-3,.col-4{grid-column:span 1}
      .ph-title{font-size:18px}
    }
    @media(max-width:480px){
      .main{padding:16px 12px 50px}
    }
  </style>
</head>
<body>
<div class="app" id="app">

  <!-- Mobile top bar -->
  <div class="topbar" id="topbar">
    <div class="topbar-brand">
      <div class="topbar-logo"></div>
      Kiwy HQ
    </div>
    <button class="topbar-btn" id="sb-open-btn" aria-label="Abrir menú">${IC.menu}</button>
  </div>

  <!-- Backdrop for mobile -->
  <div class="sb-backdrop" id="sb-backdrop"></div>

  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sb-head">
      <div class="brand">
        <div class="brand-logo"></div>
        <div class="brand-txt">
          <div class="brand-name">Kiwy HQ</div>
          <div class="brand-sub">OpenClaw · Control Center</div>
        </div>
      </div>
    </div>
    <button class="sb-toggle" id="sb-col-btn" aria-label="Colapsar">${IC.chevLeft}</button>
    <div class="sb-div"></div>
    <nav class="sb-nav" aria-label="Principal">
      ${NAV.map((n) => ni(n.key, n.label, n.href)).join('\n      ')}
    </nav>
    <div class="sb-bot">
      <div class="sb-div"></div>
      <div class="sb-sys">
        <span class="dot active"></span>
        <span class="sb-sys-txt">Sistema activo</span>
      </div>
      <form method="post" action="/logout" style="margin-top:4px">
        <button type="submit" class="logout-btn">
          <span class="ni-icon">${IC.logout}</span><span class="ni-label">Cerrar sesión</span>
        </button>
      </form>
    </div>
  </aside>

  <!-- Main content -->
  <div class="main-w">
    <main class="main">
      ${opts.contentHtml}
    </main>
    <div class="foot">Kiwy HQ · MVP v3 · sin secretos en HTML</div>
  </div>
</div>

<script>
(function(){
  var app=document.getElementById('app');
  var colBtn=document.getElementById('sb-col-btn');
  var openBtn=document.getElementById('sb-open-btn');
  var backdrop=document.getElementById('sb-backdrop');

  // Desktop collapse
  if(localStorage.getItem('sb-col')==='1') app.classList.add('col');
  if(colBtn) colBtn.addEventListener('click',function(){
    app.classList.toggle('col');
    localStorage.setItem('sb-col',app.classList.contains('col')?'1':'0');
  });

  // Mobile drawer
  function openSb(){app.classList.add('sb-open');document.body.style.overflow='hidden'}
  function closeSb(){app.classList.remove('sb-open');document.body.style.overflow=''}
  if(openBtn) openBtn.addEventListener('click',openSb);
  if(backdrop) backdrop.addEventListener('click',closeSb);

  // Close mobile sidebar on nav click
  document.querySelectorAll('.ni-item').forEach(function(el){
    el.addEventListener('click',function(){if(window.innerWidth<=768)closeSb();});
  });
})();
</script>
</body>
</html>`;
}
