import express from 'express';
import cookieParser from 'cookie-parser';
import { readSecrets, writeSecrets, type SecretsField } from './secrets-store';
import { readHqStatus, writeHqStatus, type MacroProjectKey } from './hq-status-store';
import { clearCredential, importKnownCredentials, maskValue, readCredentials, upsertCredential } from './credentials-store';
import { readAgents, writeAgentStatus } from './agents-store';
import { readCompany, addMeeting, deleteMeeting, addAction, updateActionStatus, deleteAction, addSuggestion, updateSuggestionStatus, type ActionPriority, type ActionStatus } from './company-store';
import { readCosts, upsertDailyCost, updateCostsConfig, monthlyTotals, calcCost, type DailyCost } from './costs-store';
import { escapeHtml, pageLayout } from './ui';

const AUTH_COOKIE = 'kiwy_hq_auth';

function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.path === '/health' || req.path === '/login' || req.path === '/api/push') return next();
  if (req.cookies?.[AUTH_COOKIE] === '1') return next();
  return res.redirect(302, '/login');
}

function fmtTs(ts?: string) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return escapeHtml(ts);
  return escapeHtml(d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC');
}

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'ahora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: '?', month: '?', time: '?' };
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return { day: String(d.getDate()), month: months[d.getMonth()], time: iso.slice(11, 16) };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthStr() {
  return new Date().toISOString().slice(0, 7);
}

// ── SVG costs chart ──────────────────────────────────────────────────────
function buildCostChart(daily: DailyCost[], warningLine: number): string {
  const W = 560; const H = 90; const barW = 14; const gap = 4; const days = 30;
  const totalW = days * (barW + gap);

  // build last 30 days array
  const map = new Map(daily.map((d) => [d.date, d]));
  const entries: (DailyCost | null)[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    entries.push(map.get(d.toISOString().slice(0, 10)) ?? null);
  }

  const maxTok = Math.max(warningLine * 1.2, ...entries.map((e) => e?.totalTokens ?? 0), 1);

  const bars = entries.map((e, i) => {
    const x = i * (barW + gap);
    if (!e) return `<rect x="${x}" y="${H}" width="${barW}" height="2" rx="2" fill="rgba(255,255,255,.05)"/>`;
    const pct = e.totalTokens / maxTok;
    const bh = Math.max(3, Math.round(pct * H));
    const color = pct > 0.9 ? '#f43f5e' : pct > 0.65 ? '#f59e0b' : '#34d399';
    const op = e.date === todayStr() ? '1' : '0.75';
    return `<rect x="${x}" y="${H - bh}" width="${barW}" height="${bh}" rx="2" fill="${color}" opacity="${op}"/>`;
  }).join('');

  const warnY = H - Math.round((warningLine / maxTok) * H);
  const warnLine = `<line x1="0" y1="${warnY}" x2="${totalW}" y2="${warnY}" stroke="#f59e0b" stroke-width="1" stroke-dasharray="4,3" opacity=".5"/>`;

  // date labels every 7 days
  const labels = entries.filter((_, i) => i % 7 === 0).map((e, i) => {
    const x = i * 7 * (barW + gap) + barW / 2;
    const label = e?.date ? e.date.slice(5) : '';
    return `<text x="${x}" y="${H + 16}" font-size="9" fill="#38415a" text-anchor="middle" font-family="JetBrains Mono,monospace">${label}</text>`;
  }).join('');

  return `<div class="costs-chart-wrap"><svg width="${totalW}" height="${H + 22}" viewBox="0 0 ${totalW} ${H + 22}" xmlns="http://www.w3.org/2000/svg">${bars}${warnLine}${labels}</svg></div>`;
}

function numFmt(n: number) { return n.toLocaleString('es'); }
function usdFmt(n: number) { return '$' + n.toFixed(2); }

export function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(auth);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // ── Redirect legacy routes ─────────────────────────────────────────────
  app.get('/secrets', (_req, res) => res.redirect(301, '/config'));
  app.get('/credentials', (_req, res) => res.redirect(301, '/config'));

  /* ═══════════════════════════════════════════════════════════════════════
     DASHBOARD
  ═══════════════════════════════════════════════════════════════════════ */
  app.get('/', async (_req, res) => {
    const [stored, status, agentsData, costsData] = await Promise.all([
      readSecrets(), readHqStatus(), readAgents(), readCosts(),
    ]);

    const secretFields: SecretsField[] = ['appsheetAppId','appsheetCrmKey','appsheetOpsKey','appsheetRegion','appsheetKey','n8nKey','githubPat'];
    const cfgd = secretFields.filter((f) => typeof (stored as any)?.[f] === 'string').length;

    const activeAgents = agentsData.agents.filter((a) => a.status === 'active' || a.status === 'thinking').length;
    const mon = monthlyTotals(costsData.daily, monthStr());
    const budgetPct = Math.round((mon.costUsd / costsData.config.monthlyBudgetUsd) * 100);

    const semColor = (key: MacroProjectKey) => {
      const s = status[key]; if (!s || s === 'No status yet.') return 'b-dim';
      const l = s.toLowerCase();
      if (l.includes('bloqueado') || l.includes('error')) return 'b-red';
      if (l.includes('riesgo') || l.includes('demora')) return 'b-amber';
      return 'b-green';
    };

    const projCard = (name: string, key: MacroProjectKey) => `
      <div class="card">
        <div class="flex ai-c gap-8 mb-8">
          <span class="badge ${semColor(key)}">${escapeHtml(name)}</span>
          <span style="font-size:11px;color:var(--dim);margin-left:auto;font-family:'JetBrains Mono',monospace">${fmtTs(status.fieldUpdatedAt?.[key])}</span>
        </div>
        <div style="font-size:13px;color:var(--mu);line-height:1.5">${escapeHtml(status[key])}</div>
        <div style="margin-top:10px"><a href="/status" style="font-size:12px;color:var(--v)">Editar →</a></div>
      </div>`;

    const content = `
      <div class="ph">
        <div class="ph-title">Dashboard</div>
        <div class="ph-sub">Pulso global de Qualiver · ${new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })}</div>
      </div>

      <div class="g g4 mb-16">
        <div class="card kv-green">
          <div class="kpi-label">Agentes activos</div>
          <div class="kpi-val">${activeAgents}</div>
          <div class="kpi-sub">de ${agentsData.agents.length} configurados</div>
        </div>
        <div class="card kv-violet">
          <div class="kpi-label">Gasto este mes</div>
          <div class="kpi-val">${usdFmt(mon.costUsd)}</div>
          <div class="kpi-sub">${budgetPct}% del presupuesto · ${numFmt(mon.totalTokens)} tok</div>
        </div>
        <div class="card">
          <div class="kpi-label">Tokens hoy</div>
          <div class="kpi-val ${agentsData.agents.reduce((s,a) => s + a.metrics.tokensToday, 0) > costsData.config.dailyTokenWarning ? 'kv-amber' : ''}">
            ${numFmt(agentsData.agents.reduce((s,a) => s + a.metrics.tokensToday, 0))}
          </div>
          <div class="kpi-sub">límite aviso: ${numFmt(costsData.config.dailyTokenWarning)}</div>
        </div>
        <div class="card">
          <div class="kpi-label">APIs configuradas</div>
          <div class="kpi-val">${cfgd}/7</div>
          <div class="kpi-sub">secrets activos</div>
        </div>
      </div>

      <div class="sec-label">Estado de proyectos</div>
      <div class="g g2 mb-16">
        ${projCard('Qualiver', 'qualiver')}
        ${projCard('ECHO', 'echo')}
        ${projCard('Kuenti', 'kuenti')}
        ${projCard('Personal', 'personal')}
      </div>

      <div class="sec-label">Acceso rápido</div>
      <div class="g g3">
        <a href="/agents" class="card" style="cursor:pointer;transition:border-color .13s" onmouseover="this.style.borderColor='rgba(124,92,255,.4)'" onmouseout="this.style.borderColor=''">
          <div style="font-size:12px;font-weight:700;color:var(--v);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Agentes</div>
          <div style="font-size:13px;color:var(--mu)">Timeline de actividad, tokens consumidos y estado de cada agente OpenClaw.</div>
        </a>
        <a href="/costs" class="card" style="cursor:pointer;transition:border-color .13s" onmouseover="this.style.borderColor='rgba(52,211,153,.4)'" onmouseout="this.style.borderColor=''">
          <div style="font-size:12px;font-weight:700;color:var(--g);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Costos</div>
          <div style="font-size:13px;color:var(--mu)">Gráfico diario de tokens, gasto en USD, comparativa vs presupuesto y límites.</div>
        </a>
        <a href="/company" class="card" style="cursor:pointer;transition:border-color .13s" onmouseover="this.style.borderColor='rgba(245,158,11,.4)'" onmouseout="this.style.borderColor=''">
          <div style="font-size:12px;font-weight:700;color:var(--am);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Empresa</div>
          <div style="font-size:13px;color:var(--mu)">Reuniones, seguimiento de tareas y conversaciones activas con Kiwy.</div>
        </a>
      </div>`;

    res.type('html').send(pageLayout({ title: 'Dashboard', active: 'dashboard', contentHtml: content }));
  });

  /* ═══════════════════════════════════════════════════════════════════════
     AGENTES — solo observación
  ═══════════════════════════════════════════════════════════════════════ */
  app.get('/agents', async (_req, res) => {
    const { agents, updatedAt } = await readAgents();

    const statusLabel: Record<string, string> = { active:'Activo', thinking:'Procesando', idle:'En espera', error:'Error' };
    const statusBadge: Record<string, string> = { active:'b-green', thinking:'b-violet', idle:'b-amber', error:'b-red' };
    const dotCls: Record<string, string> = { active:'active', thinking:'thinking', idle:'idle', error:'error' };

    const totalTokensToday = agents.reduce((s, a) => s + (a.metrics.tokensToday || 0), 0);
    const activeCount = agents.filter((a) => a.status === 'active' || a.status === 'thinking').length;

    const agentBlock = agents.map((a) => {
      const pct = Math.min(100, Math.max(0, a.progress));
      const fillCls = a.status === 'error' ? 'err' : pct >= 100 ? 'done' : '';

      const timeline = a.recentActions.length
        ? a.recentActions.slice(0, 10).map((r) => `
          <div class="tl-row">
            <span class="tl-time">${relative(r.time)}</span>
            <span class="tl-dot ${r.type === 'error' ? 'err' : r.type === 'success' ? 'ok' : ''}"></span>
            <span class="tl-txt">${escapeHtml(r.action)}</span>
          </div>`).join('')
        : `<div class="empty" style="padding:10px;text-align:left;font-size:12px">Sin actividad registrada aún.</div>`;

      return `
        <!-- AGENT ROW -->
        <div class="agent-row" id="ar-${escapeHtml(a.id)}" onclick="toggleAgent('${escapeHtml(a.id)}')" role="button" tabindex="0">
          <span class="dot ${dotCls[a.status] ?? 'idle'}" style="flex-shrink:0"></span>
          <div style="min-width:0">
            <div class="agent-name">${escapeHtml(a.name)}</div>
            <div class="agent-role">${escapeHtml(a.role)}</div>
          </div>
          <div class="agent-task c-mu" style="flex:1;min-width:0">${escapeHtml(a.currentTask)}</div>
          <span class="badge ${statusBadge[a.status] ?? 'b-dim'}" style="flex-shrink:0">${statusLabel[a.status] ?? a.status}</span>
          <span class="agent-pct">${pct}%</span>
          <svg class="agent-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>

        <!-- AGENT DETAIL -->
        <div class="agent-detail" id="ad-${escapeHtml(a.id)}">
          <!-- Progress -->
          <div class="flex ai-c gap-8 mb-8" style="font-size:12px">
            <span class="c-mu">Progreso de tarea actual</span>
            <span class="mono" style="margin-left:auto;font-size:12px">${pct}%</span>
          </div>
          <div class="pb mb-12"><div class="pb-fill ${fillCls}" style="width:${pct}%"></div></div>

          <!-- Tarea actual -->
          <div style="font-size:11px;font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">Tarea actual</div>
          <div style="font-size:13px;color:var(--tx);margin-bottom:14px;padding:10px 12px;background:rgba(255,255,255,.03);border-radius:8px;border:1px solid var(--bd)">${escapeHtml(a.currentTask)}</div>

          <!-- Métricas -->
          <div class="metrics-row mb-12">
            <div class="metric">
              <div class="metric-v">${numFmt(a.metrics.tokensToday)}</div>
              <div class="metric-k">Tokens hoy</div>
            </div>
            <div class="metric">
              <div class="metric-v">${a.metrics.tasksCompleted}</div>
              <div class="metric-k">Completadas</div>
            </div>
            <div class="metric">
              <div class="metric-v">${a.metrics.tasksOpen}</div>
              <div class="metric-k">Abiertas</div>
            </div>
            <div class="metric">
              <div class="metric-v">${a.metrics.successRate}%</div>
              <div class="metric-k">Tasa éxito</div>
            </div>
          </div>

          <!-- Timeline -->
          <div style="font-size:11px;font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Historial de actividad</div>
          <div class="tl">${timeline}</div>

          <div style="margin-top:10px;font-size:11px;color:var(--dim);font-family:'JetBrains Mono',monospace">
            Últ. actividad: ${fmtTs(a.lastActivity)}
          </div>
        </div>`;
    }).join('\n');

    // All-agents summary timeline (merged, most recent first)
    const allActions = agents.flatMap((a) =>
      (a.recentActions ?? []).map((r) => ({ ...r, agentName: a.name, agentId: a.id }))
    ).sort((a, b) => b.time.localeCompare(a.time)).slice(0, 25);

    const globalTl = allActions.length
      ? allActions.map((r) => `
          <div class="tl-row">
            <span class="tl-time">${relative(r.time)}</span>
            <span class="tl-dot ${r.type === 'error' ? 'err' : r.type === 'success' ? 'ok' : ''}"></span>
            <div class="tl-txt">
              <span class="c-violet" style="font-size:11px;font-weight:700">${escapeHtml(r.agentName)}</span>
              · ${escapeHtml(r.action)}
            </div>
          </div>`).join('')
      : `<div class="empty">Sin actividad reciente. Los scripts de Kiwy empujan datos a <code>POST /api/push</code>.</div>`;

    const content = `
      <div class="ph">
        <div class="ph-title">Agentes OpenClaw</div>
        <div class="ph-sub">Estado y actividad de cada agente. Datos: ${fmtTs(updatedAt)}</div>
      </div>

      <div class="g g4 mb-16">
        <div class="card kv-green">
          <div class="kpi-label">Activos ahora</div>
          <div class="kpi-val">${activeCount}</div>
          <div class="kpi-sub">de ${agents.length} agentes</div>
        </div>
        <div class="card kv-violet">
          <div class="kpi-label">Tokens hoy (total)</div>
          <div class="kpi-val">${numFmt(totalTokensToday)}</div>
          <div class="kpi-sub">suma de todos los agentes</div>
        </div>
        <div class="card">
          <div class="kpi-label">Tareas completadas</div>
          <div class="kpi-val">${agents.reduce((s, a) => s + a.metrics.tasksCompleted, 0)}</div>
          <div class="kpi-sub">hoy en total</div>
        </div>
        <div class="card">
          <div class="kpi-label">Tareas abiertas</div>
          <div class="kpi-val">${agents.reduce((s, a) => s + a.metrics.tasksOpen, 0)}</div>
          <div class="kpi-sub">en todos los agentes</div>
        </div>
      </div>

      <div class="g g2" style="align-items:start">
        <!-- Lista de agentes -->
        <div>
          <div class="sec-label">Agentes — click para ver detalle</div>
          <div class="stack">${agentBlock || '<div class="empty card">Sin agentes configurados.</div>'}</div>
        </div>

        <!-- Timeline global -->
        <div class="card">
          <div class="card-hd">Timeline global <span class="card-hd-count">${allActions.length} eventos</span></div>
          <div class="tl" style="max-height:500px;overflow-y:auto">${globalTl}</div>
        </div>
      </div>

      <div class="card mt-16" style="border-style:dashed;background:transparent">
        <div class="card-hd">API de ingesta — para scripts de Kiwy/OpenClaw</div>
        <p style="font-size:13px;color:var(--mu);margin-bottom:10px">
          Los agentes reportan su estado llamando a <code>POST /api/push</code> con el header <code>X-Kiwy-Token: &lt;KIWY_HQ_TOKEN&gt;</code>.
        </p>
        <pre style="font-size:11.5px;color:var(--mu);background:rgba(255,255,255,.03);border:1px solid var(--bd);border-radius:8px;padding:12px;overflow-x:auto;line-height:1.6"># Ejemplo Python
import requests, os
requests.post("https://tu-dominio.vercel.app/api/push",
  headers={"X-Kiwy-Token": os.environ["KIWY_HQ_TOKEN"]},
  json={
    "type": "agent",
    "agentId": "kiwy-main",
    "status": "active",
    "currentTask": "Procesando reporte de operaciones",
    "progress": 60,
    "action": {"action": "Leyó 45 tareas del CRM", "type": "success"},
    "metrics": {"tokensToday": 12300, "tasksCompleted": 5, "tasksOpen": 2, "successRate": 98}
  }
)</pre>
      </div>

      <script>
        function toggleAgent(id) {
          var row = document.getElementById('ar-' + id);
          var det = document.getElementById('ad-' + id);
          var open = det.classList.contains('open');
          det.classList.toggle('open', !open);
          row.classList.toggle('expanded', !open);
        }
        document.querySelectorAll('.agent-row').forEach(function(el) {
          el.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
          });
        });
      </script>`;

    res.type('html').send(pageLayout({ title: 'Agentes', active: 'agents', contentHtml: content }));
  });

  /* ═══════════════════════════════════════════════════════════════════════
     EMPRESA — visibilidad de reuniones, tareas, conversaciones
  ═══════════════════════════════════════════════════════════════════════ */
  app.get('/company', async (req, res) => {
    const saved = req.query?.saved === '1';
    const company = await readCompany();

    const upcoming = company.meetings
      .filter((m) => m.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date));

    const tasksByStatus = {
      pending:     company.actions.filter((a) => a.status === 'pending'),
      'in-progress': company.actions.filter((a) => a.status === 'in-progress'),
      done:        company.actions.filter((a) => a.status === 'done').slice(0, 6),
    };

    const pendingSugg = company.suggestions.filter((s) => s.status === 'pending');
    const approvedSugg = company.suggestions.filter((s) => s.status === 'approved').slice(0, 4);

    const priLabel: Record<string, string> = { high:'Alta', medium:'Media', low:'Baja' };
    const priCls: Record<string, string> = { high:'pri-high', medium:'pri-med', low:'pri-low' };

    const meetRow = (m: typeof upcoming[0]) => {
      const d = fmtDate(m.date);
      const past = new Date(m.date) < new Date();
      return `
        <div class="meet-row" style="${past ? 'opacity:.55' : ''}">
          <div class="meet-date">
            <div class="meet-date-m">${d.month}</div>
            <div class="meet-date-d">${d.day}</div>
          </div>
          <div class="meet-body">
            <div class="meet-title">${escapeHtml(m.title)}${m.status === 'completed' ? ' <span class="badge b-green" style="font-size:10px">Hecha</span>' : ''}</div>
            <div class="meet-meta">${d.time} · ${escapeHtml(m.attendees.join(', '))}${m.project ? ' · <span style="color:var(--v)">' + escapeHtml(m.project) + '</span>' : ''}</div>
            ${m.notes ? `<div style="font-size:12px;color:var(--mu);margin-top:5px;padding:6px 8px;background:rgba(255,255,255,.03);border-radius:6px;border:1px solid var(--bd)">${escapeHtml(m.notes)}</div>` : ''}
          </div>
          <form method="post" action="/company/meetings/${escapeHtml(m.id)}/delete" style="flex-shrink:0">
            <button type="submit" style="background:none;border:none;color:var(--dim);cursor:pointer;padding:4px;border-radius:4px;font-size:14px" title="Eliminar">×</button>
          </form>
        </div>`;
    };

    const taskRow = (a: typeof tasksByStatus.pending[0], isDone = false) => `
      <div class="task-row${isDone ? ' task-done' : ''}">
        <span class="pri-tag ${priCls[a.priority] ?? 'pri-med'}">${priLabel[a.priority] ?? 'Med'}</span>
        <div style="flex:1;min-width:0">
          <div class="task-title">${escapeHtml(a.title)}</div>
          <div class="task-meta">${a.project ? escapeHtml(a.project) + ' · ' : ''}${a.dueDate ? 'Vence ' + a.dueDate : 'Sin fecha'}</div>
        </div>
        ${!isDone ? `
          <form method="post" action="/company/actions/${escapeHtml(a.id)}/done" style="display:inline">
            <button type="submit" class="btn-ghost btn-sm" style="color:var(--g);border-color:rgba(52,211,153,.2)" title="Completar">✓</button>
          </form>` : ''}
        <form method="post" action="/company/actions/${escapeHtml(a.id)}/delete" style="display:inline">
          <button type="submit" style="background:none;border:none;color:var(--dim);cursor:pointer;padding:4px 6px;font-size:14px" title="Eliminar">×</button>
        </form>
      </div>`;

    const suggRow = (s: typeof pendingSugg[0]) => `
      <div class="conv-row">
        <div class="conv-hd">
          <span class="conv-src">${escapeHtml(s.source)}</span>
          ${s.status !== 'pending' ? `<span class="badge ${s.status === 'approved' ? 'b-green' : 'b-dim'}">${s.status === 'approved' ? 'Aprobada' : 'Descartada'}</span>` : ''}
          <span class="conv-ts">${s.date.slice(0, 10)}</span>
        </div>
        <div class="conv-txt">${escapeHtml(s.text)}</div>
        ${s.impact ? `<div class="conv-notes">Impacto: ${escapeHtml(s.impact)}</div>` : ''}
        ${s.status === 'pending' ? `
          <div class="flex gap-6 mt-12">
            <form method="post" action="/company/suggestions/${escapeHtml(s.id)}/approve" style="display:inline">
              <button type="submit" class="btn btn-sm">Aprobar</button>
            </form>
            <form method="post" action="/company/suggestions/${escapeHtml(s.id)}/reject" style="display:inline">
              <button type="submit" class="btn-ghost btn-sm">Descartar</button>
            </form>
          </div>` : ''}
      </div>`;

    const content = `
      <div id="toast" class="toast${saved ? '' : ' hidden'}">Guardado. <small>Cambios aplicados.</small></div>

      <div class="ph">
        <div class="ph-title">Centro de Empresa</div>
        <div class="ph-sub">Visibilidad de operaciones — reuniones, tareas y seguimiento con Kiwy.</div>
      </div>

      <div class="g g3" style="align-items:start;gap:16px">

        <!-- REUNIONES -->
        <div class="card">
          <div class="card-hd">Reuniones <span class="card-hd-count">${upcoming.length}</span></div>
          <div class="stack mb-12">
            ${upcoming.length ? upcoming.map(meetRow).join('') : '<div class="empty">Sin reuniones. Agrégalas abajo.</div>'}
          </div>
          <div class="divider"></div>
          <div style="font-size:11px;font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Agregar reunión</div>
          <form method="post" action="/company/meetings/add">
            <div class="stack" style="gap:8px">
              <div class="field"><label class="flabel">Título</label>
                <input type="text" name="title" class="inp" required maxlength="200" placeholder="Revisión semanal…"/></div>
              <div class="g g2" style="gap:8px">
                <div class="field"><label class="flabel">Fecha y hora</label>
                  <input type="datetime-local" name="date" class="inp" required/></div>
                <div class="field"><label class="flabel">Proyecto</label>
                  <input type="text" name="project" class="inp" maxlength="80" placeholder="Qualiver…"/></div>
              </div>
              <div class="field"><label class="flabel">Asistentes (coma)</label>
                <input type="text" name="attendees" class="inp" placeholder="Juan, Kiwy…"/></div>
              <div class="field"><label class="flabel">Notas</label>
                <input type="text" name="notes" class="inp" maxlength="300" placeholder="Agenda o contexto…"/></div>
            </div>
            <div style="margin-top:10px"><button type="submit" class="btn btn-sm w100" style="justify-content:center">Agregar reunión</button></div>
          </form>
        </div>

        <!-- TAREAS -->
        <div class="card">
          <div class="card-hd">Tareas <span class="card-hd-count">${company.actions.length}</span></div>

          ${tasksByStatus['in-progress'].length ? `
            <div class="sec-label" style="color:var(--v)">En progreso (${tasksByStatus['in-progress'].length})</div>
            <div class="stack mb-12">${tasksByStatus['in-progress'].map((a) => taskRow(a)).join('')}</div>` : ''}

          <div class="sec-label" style="color:var(--am)">Pendientes (${tasksByStatus.pending.length})</div>
          <div class="stack mb-12">
            ${tasksByStatus.pending.length ? tasksByStatus.pending.map((a) => taskRow(a)).join('') : '<div class="empty">Sin pendientes. 🎉</div>'}
          </div>

          ${tasksByStatus.done.length ? `
            <div class="sec-label" style="color:var(--g)">Completadas recientemente</div>
            <div class="stack mb-12">${tasksByStatus.done.map((a) => taskRow(a, true)).join('')}</div>` : ''}

          <div class="divider"></div>
          <div style="font-size:11px;font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Nueva tarea</div>
          <form method="post" action="/company/actions/add">
            <div class="stack" style="gap:8px">
              <div class="field"><label class="flabel">Título</label>
                <input type="text" name="title" class="inp" required maxlength="300" placeholder="Revisar propuestas de Kiwy…"/></div>
              <div class="g g2" style="gap:8px">
                <div class="field"><label class="flabel">Prioridad</label>
                  <select name="priority" class="inp"><option value="high">Alta</option><option value="medium" selected>Media</option><option value="low">Baja</option></select></div>
                <div class="field"><label class="flabel">Fecha límite</label>
                  <input type="date" name="dueDate" class="inp"/></div>
              </div>
              <div class="field"><label class="flabel">Proyecto</label>
                <input type="text" name="project" class="inp" maxlength="80" placeholder="Qualiver / ECHO…"/></div>
            </div>
            <div style="margin-top:10px"><button type="submit" class="btn btn-sm w100" style="justify-content:center">Agregar tarea</button></div>
          </form>
        </div>

        <!-- KIWY — SUGERENCIAS / CONVERSACIONES -->
        <div class="card">
          <div class="card-hd">Kiwy dice <span class="card-hd-count">${pendingSugg.length} pendientes</span></div>
          <div class="stack mb-12">
            ${pendingSugg.length ? pendingSugg.map(suggRow).join('') : '<div class="empty">Sin sugerencias pendientes.</div>'}
          </div>
          ${approvedSugg.length ? `
            <div class="divider"></div>
            <div class="sec-label" style="color:var(--g)">Aprobadas recientemente</div>
            <div class="stack">${approvedSugg.map(suggRow).join('')}</div>` : ''}
          <div class="divider"></div>
          <div style="font-size:11px;font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Agregar sugerencia</div>
          <form method="post" action="/company/suggestions/add">
            <div class="stack" style="gap:8px">
              <div class="field"><label class="flabel">Sugerencia</label>
                <input type="text" name="text" class="inp" required maxlength="400" placeholder="Texto…"/></div>
              <div class="g g2" style="gap:8px">
                <div class="field"><label class="flabel">Fuente</label>
                  <input type="text" name="source" class="inp" value="Kiwy" maxlength="60"/></div>
                <div class="field"><label class="flabel">Impacto</label>
                  <input type="text" name="impact" class="inp" maxlength="150" placeholder="Ahorra 2h/sem…"/></div>
              </div>
            </div>
            <div style="margin-top:10px"><button type="submit" class="btn btn-sm w100" style="justify-content:center">Agregar</button></div>
          </form>
        </div>
      </div>

      <script>
        (function(){
          var t=document.getElementById('toast');
          if(!t||t.classList.contains('hidden'))return;
          setTimeout(function(){t.classList.add('hidden');},2800);
          try{var u=new URL(location.href);u.searchParams.delete('saved');history.replaceState({},'',u);}catch(e){}
        })();
      </script>`;

    res.type('html').send(pageLayout({ title: 'Empresa', active: 'company', contentHtml: content }));
  });

  // Company routes (unchanged)
  app.post('/company/meetings/add', async (req, res) => {
    const b = req.body ?? {};
    const g = (k: string) => (typeof b[k] === 'string' ? String(b[k]).trim() : '');
    const title = g('title'); const date = g('date');
    const attendees = g('attendees').split(',').map((s) => s.trim()).filter(Boolean);
    if (title && date) await addMeeting({ title, date, attendees, status: 'upcoming', notes: g('notes') || undefined, project: g('project') || undefined });
    return res.redirect(302, '/company?saved=1');
  });
  app.post('/company/meetings/:id/delete', async (req, res) => { await deleteMeeting(req.params.id); return res.redirect(302, '/company?saved=1'); });
  app.post('/company/actions/add', async (req, res) => {
    const b = req.body ?? {}; const g = (k: string) => (typeof b[k] === 'string' ? String(b[k]).trim() : '');
    const title = g('title'); const priority = (g('priority') as ActionPriority) || 'medium';
    if (title) await addAction({ title, priority, status: 'pending', dueDate: g('dueDate') || undefined, project: g('project') || undefined });
    return res.redirect(302, '/company?saved=1');
  });
  app.post('/company/actions/:id/done', async (req, res) => { await updateActionStatus(req.params.id, 'done' as ActionStatus); return res.redirect(302, '/company?saved=1'); });
  app.post('/company/actions/:id/delete', async (req, res) => { await deleteAction(req.params.id); return res.redirect(302, '/company?saved=1'); });
  app.post('/company/suggestions/add', async (req, res) => {
    const b = req.body ?? {}; const g = (k: string) => (typeof b[k] === 'string' ? String(b[k]).trim() : '');
    const text = g('text');
    if (text) await addSuggestion({ text, source: g('source') || 'Kiwy', date: new Date().toISOString().slice(0, 10), status: 'pending', impact: g('impact') || undefined });
    return res.redirect(302, '/company?saved=1');
  });
  app.post('/company/suggestions/:id/approve', async (req, res) => { await updateSuggestionStatus(req.params.id, 'approved'); return res.redirect(302, '/company?saved=1'); });
  app.post('/company/suggestions/:id/reject', async (req, res) => { await updateSuggestionStatus(req.params.id, 'rejected'); return res.redirect(302, '/company?saved=1'); });

  /* ═══════════════════════════════════════════════════════════════════════
     COSTOS — panel de tokens y gasto
  ═══════════════════════════════════════════════════════════════════════ */
  app.get('/costs', async (req, res) => {
    const saved = req.query?.saved === '1';
    const data = await readCosts();
    const { daily, config } = data;

    const mon = monthlyTotals(daily, monthStr());
    const budgetPct = Math.min(100, Math.round((mon.costUsd / config.monthlyBudgetUsd) * 100));

    const todayRow = daily.find((d) => d.date === todayStr());
    const todayTok = todayRow?.totalTokens ?? 0;
    const todayWarningPct = Math.min(100, Math.round((todayTok / config.dailyTokenWarning) * 100));

    const barColor = (pct: number) => pct > 90 ? 'kv-red' : pct > 65 ? 'kv-amber' : 'kv-green';

    // Top 5 days this month
    const top5 = [...daily]
      .filter((d) => d.date.startsWith(monthStr()))
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .slice(0, 5);

    const chart = buildCostChart(daily, config.dailyTokenWarning);

    // Last 7 days table
    const last7: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      last7.push(d);
    }
    const tableRows = last7.map((date) => {
      const r = daily.find((d) => d.date === date);
      if (!r) return `<tr><td class="mono" style="font-size:12px">${date}</td><td colspan="4" style="color:var(--dim);font-size:12px">Sin datos</td></tr>`;
      const pct = Math.round((r.totalTokens / config.dailyTokenWarning) * 100);
      return `<tr>
        <td class="mono" style="font-size:12px">${r.date}</td>
        <td>${numFmt(r.inputTokens)}</td>
        <td>${numFmt(r.outputTokens)}</td>
        <td><b>${numFmt(r.totalTokens)}</b> <span class="badge ${barColor(pct).replace('kv-','')==='green'?'b-green':barColor(pct).replace('kv-','')==='amber'?'b-amber':'b-red'}" style="font-size:10px">${pct}%</span></td>
        <td>${usdFmt(r.costUsd)}</td>
      </tr>`;
    }).join('');

    const content = `
      <div id="toast" class="toast${saved ? '' : ' hidden'}">Configuración guardada.</div>

      <div class="ph">
        <div class="ph-title">Panel de Costos</div>
        <div class="ph-sub">Consumo de tokens y gasto estimado · Modelo: <code>${escapeHtml(config.model)}</code></div>
      </div>

      <!-- KPIs -->
      <div class="g g4 mb-16">
        <div class="card ${barColor(budgetPct)}">
          <div class="kpi-label">Gasto este mes</div>
          <div class="kpi-val">${usdFmt(mon.costUsd)}</div>
          <div class="kpi-sub">${budgetPct}% de ${usdFmt(config.monthlyBudgetUsd)} presupuesto</div>
          <div class="pb mt-12"><div class="pb-fill ${budgetPct > 90 ? 'err' : budgetPct > 65 ? 'warn' : ''}" style="width:${budgetPct}%"></div></div>
        </div>
        <div class="card ${barColor(todayWarningPct)}">
          <div class="kpi-label">Tokens hoy</div>
          <div class="kpi-val">${numFmt(todayTok)}</div>
          <div class="kpi-sub">${todayWarningPct}% del límite diario</div>
          <div class="pb mt-12"><div class="pb-fill ${todayWarningPct > 90 ? 'err' : todayWarningPct > 65 ? 'warn' : ''}" style="width:${todayWarningPct}%"></div></div>
        </div>
        <div class="card">
          <div class="kpi-label">Tokens este mes</div>
          <div class="kpi-val kv-violet">${numFmt(mon.totalTokens)}</div>
          <div class="kpi-sub">en ${mon.days} días con datos</div>
        </div>
        <div class="card">
          <div class="kpi-label">Costo/día promedio</div>
          <div class="kpi-val">${mon.days > 0 ? usdFmt(mon.costUsd / mon.days) : '$0.00'}</div>
          <div class="kpi-sub">estimado · ${usdFmt(config.inputPricePerMTok)}/MTok input · ${usdFmt(config.outputPricePerMTok)}/MTok output</div>
        </div>
      </div>

      <!-- Gráfico -->
      <div class="card mb-16">
        <div class="card-hd" style="margin-bottom:14px">
          Tokens diarios — últimos 30 días
          <span class="card-hd-count">
            <span style="display:inline-block;width:8px;height:8px;background:#34d399;border-radius:2px;margin-right:4px"></span>Normal
            <span style="display:inline-block;width:8px;height:8px;background:#f59e0b;border-radius:2px;margin:0 4px 0 8px"></span>Aviso
            <span style="display:inline-block;width:8px;height:8px;background:#f43f5e;border-radius:2px;margin-right:4px"></span>Límite — línea punteada = umbral (${numFmt(config.dailyTokenWarning)} tok)
          </span>
        </div>
        ${chart}
      </div>

      <div class="g g2" style="align-items:start;gap:16px">
        <!-- Tabla últimos 7 días -->
        <div class="card">
          <div class="card-hd">Últimos 7 días</div>
          <div style="overflow:auto">
            <table>
              <thead><tr><th>Fecha</th><th>Input</th><th>Output</th><th>Total tok</th><th>Costo USD</th></tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>

          <div class="divider"></div>
          <div class="card-hd" style="margin-bottom:10px">Ingresar uso diario manualmente</div>
          <form method="post" action="/costs/add">
            <div class="g g2" style="gap:8px;margin-bottom:8px">
              <div class="field"><label class="flabel">Fecha</label>
                <input type="date" name="date" class="inp" value="${todayStr()}" required/></div>
              <div class="field"><label class="flabel">Modelo</label>
                <input type="text" name="model" class="inp" value="${escapeHtml(config.model)}" maxlength="60"/></div>
              <div class="field"><label class="flabel">Tokens entrada</label>
                <input type="number" name="inputTokens" class="inp" min="0" value="0"/></div>
              <div class="field"><label class="flabel">Tokens salida</label>
                <input type="number" name="outputTokens" class="inp" min="0" value="0"/></div>
            </div>
            <button type="submit" class="btn btn-sm">Guardar</button>
          </form>
        </div>

        <!-- Top días + Config -->
        <div class="stack" style="gap:12px">
          ${top5.length ? `
          <div class="card">
            <div class="card-hd">Top días del mes</div>
            <div class="stack">
              ${top5.map((r) => `
                <div class="flex ai-c gap-8">
                  <span class="mono" style="font-size:12px;color:var(--mu);min-width:60px">${r.date.slice(5)}</span>
                  <div style="flex:1"><div class="pb"><div class="pb-fill" style="width:${Math.round((r.totalTokens/top5[0].totalTokens)*100)}%"></div></div></div>
                  <span class="mono" style="font-size:12px">${numFmt(r.totalTokens)}</span>
                  <span style="font-size:12px;color:var(--mu);min-width:44px;text-align:right">${usdFmt(r.costUsd)}</span>
                </div>`).join('')}
            </div>
          </div>` : ''}

          <div class="card">
            <div class="card-hd">Configuración del modelo</div>
            <form method="post" action="/costs/config">
              <div class="stack" style="gap:8px">
                <div class="field"><label class="flabel">Modelo</label>
                  <input type="text" name="model" class="inp" value="${escapeHtml(config.model)}" maxlength="80"/></div>
                <div class="g g2" style="gap:8px">
                  <div class="field"><label class="flabel">Precio entrada ($/MTok)</label>
                    <input type="number" name="inputPricePerMTok" class="inp" step="0.01" value="${config.inputPricePerMTok}"/></div>
                  <div class="field"><label class="flabel">Precio salida ($/MTok)</label>
                    <input type="number" name="outputPricePerMTok" class="inp" step="0.01" value="${config.outputPricePerMTok}"/></div>
                </div>
                <div class="g g2" style="gap:8px">
                  <div class="field"><label class="flabel">Presupuesto mensual (USD)</label>
                    <input type="number" name="monthlyBudgetUsd" class="inp" step="1" value="${config.monthlyBudgetUsd}"/></div>
                  <div class="field"><label class="flabel">Tokens/día aviso</label>
                    <input type="number" name="dailyTokenWarning" class="inp" value="${config.dailyTokenWarning}"/></div>
                </div>
              </div>
              <div style="margin-top:10px"><button type="submit" class="btn btn-sm">Actualizar config</button></div>
            </form>
          </div>
        </div>
      </div>

      <script>
        (function(){
          var t=document.getElementById('toast');
          if(!t||t.classList.contains('hidden'))return;
          setTimeout(function(){t.classList.add('hidden');},2600);
          try{var u=new URL(location.href);u.searchParams.delete('saved');history.replaceState({},'',u);}catch(e){}
        })();
      </script>`;

    res.type('html').send(pageLayout({ title: 'Costos', active: 'costs', contentHtml: content }));
  });

  app.post('/costs/add', async (req, res) => {
    const b = req.body ?? {};
    const n = (k: string) => Math.max(0, parseInt(String(b[k] ?? '0')) || 0);
    const g = (k: string) => (typeof b[k] === 'string' ? String(b[k]).trim() : '');
    const date = g('date') || todayStr();
    const inputTokens = n('inputTokens'); const outputTokens = n('outputTokens');
    await upsertDailyCost({ date, inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, model: g('model') || undefined });
    return res.redirect(302, '/costs?saved=1');
  });

  app.post('/costs/config', async (req, res) => {
    const b = req.body ?? {};
    const f = (k: string) => parseFloat(String(b[k] ?? '0')) || 0;
    const g = (k: string) => (typeof b[k] === 'string' ? String(b[k]).trim() : '');
    await updateCostsConfig({
      model: g('model') || undefined,
      inputPricePerMTok: f('inputPricePerMTok') || undefined,
      outputPricePerMTok: f('outputPricePerMTok') || undefined,
      monthlyBudgetUsd: f('monthlyBudgetUsd') || undefined,
      dailyTokenWarning: parseInt(String(b.dailyTokenWarning ?? '0')) || undefined,
    } as any);
    return res.redirect(302, '/costs?saved=1');
  });

  /* ═══════════════════════════════════════════════════════════════════════
     API PUSH — para que los scripts de Kiwy/OpenClaw reporten datos
  ═══════════════════════════════════════════════════════════════════════ */
  app.post('/api/push', async (req, res) => {
    const token = req.headers['x-kiwy-token'];
    if (token !== process.env.KIWY_HQ_TOKEN) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    try {
      const body = req.body ?? {};
      const type = body.type;

      if (type === 'agent') {
        const { agentId, action, ...update } = body;
        if (!agentId) return res.status(400).json({ ok: false, error: 'agentId required' });

        const { readAgents } = await import('./agents-store');
        const current = await readAgents();
        const agent = current.agents.find((a) => a.id === agentId);
        const existing = agent?.recentActions ?? [];
        const newActions = action
          ? [{ time: new Date().toISOString(), action: String(action.action ?? ''), type: action.type ?? 'info' }, ...existing].slice(0, 30)
          : existing;

        await writeAgentStatus(agentId, {
          status: update.status,
          currentTask: update.currentTask,
          progress: typeof update.progress === 'number' ? update.progress : undefined,
          metrics: update.metrics,
          recentActions: newActions,
        });
        return res.json({ ok: true });
      }

      if (type === 'cost') {
        const { date, inputTokens, outputTokens, model } = body;
        const inp = Number(inputTokens) || 0; const out = Number(outputTokens) || 0;
        await upsertDailyCost({ date: date || todayStr(), inputTokens: inp, outputTokens: out, totalTokens: inp + out, model });
        return res.json({ ok: true });
      }

      return res.status(400).json({ ok: false, error: 'Unknown type. Use "agent" or "cost".' });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: String(err?.message ?? err) });
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════
     ESTADO
  ═══════════════════════════════════════════════════════════════════════ */
  app.get('/status', async (req, res) => {
    const saved = req.query?.saved === '1';
    const status = await readHqStatus();
    const si = (field: MacroProjectKey, label: string, hint: string) => `
      <div class="field">
        <div class="field-row">
          <label class="flabel">${escapeHtml(label)}</label>
          <span class="status-pill"><span class="sdot on"></span>${fmtTs(status.fieldUpdatedAt?.[field])}</span>
        </div>
        <input class="inp" type="text" name="${field}" maxlength="220" value="${escapeHtml(status[field])}" placeholder="${escapeHtml(hint)}"/>
      </div>`;

    const content = `
      <div id="toast" class="toast${saved ? '' : ' hidden'}">Estado guardado. <small>data/hq-status.json</small></div>
      <div class="ph"><div class="ph-title">Tablero de estado</div>
        <div class="ph-sub">Una oración concisa por macro proyecto. Pulso ejecutivo.</div></div>
      <form method="post" action="/status">
        <div class="card" style="max-width:680px">
          <div class="flex ai-c jb mb-12">
            <div style="font-size:13px;font-weight:600">Pulso de proyectos</div>
            <span class="status-pill"><span class="sdot on"></span>Últ: ${fmtTs(status.updatedAt)}</span>
          </div>
          <div class="stack" style="gap:10px">
            ${si('qualiver','Qualiver','«Validaciones cerradas; preparando despliegue.»')}
            ${si('echo','ECHO','«Inbox estabilizado; automatizando prioridades.»')}
            ${si('kuenti','Kuenti','«Docs restructuradas; búsqueda mejorada.»')}
            ${si('personal','Personal / Otro','«Sin bloqueos.»')}
          </div>
        </div>
        <div class="sbar"><button class="btn" type="submit">Guardar estado</button></div>
      </form>
      <script>(function(){var t=document.getElementById('toast');if(!t||t.classList.contains('hidden'))return;setTimeout(function(){t.classList.add('hidden');},2600);try{var u=new URL(location.href);u.searchParams.delete('saved');history.replaceState({},'',u);}catch(e){}})();</script>`;
    res.type('html').send(pageLayout({ title: 'Estado', active: 'status', contentHtml: content }));
  });

  app.post('/status', async (req, res) => {
    const b = req.body ?? {}; const g = (n: string) => (typeof b[n] === 'string' ? String(b[n]) : '');
    await writeHqStatus({ qualiver: g('qualiver'), echo: g('echo'), kuenti: g('kuenti'), personal: g('personal') });
    return res.redirect(302, '/status?saved=1');
  });

  /* ═══════════════════════════════════════════════════════════════════════
     CONFIG — secrets + credenciales unificados
  ═══════════════════════════════════════════════════════════════════════ */
  app.get('/config', async (req, res) => {
    const saved = req.query?.saved === '1';
    const tab = req.query?.tab === 'creds' ? 'creds' : 'secrets';
    const [stored, db] = await Promise.all([readSecrets(), readCredentials()]);

    const ftAt = (f: SecretsField) => { const ts = stored?.fieldUpdatedAt?.[f] || stored?.updatedAt; return typeof ts === 'string' ? ts : ''; };
    const isSet = (v: unknown) => typeof v === 'string' && (v as string).trim().length > 0;

    const pill = (on: boolean) => `<span class="sdot ${on ? 'on' : ''}"></span><span style="font-size:11px;color:var(--mu)">${on ? 'Configurado' : 'No configurado'}</span>`;

    const secField = (f: SecretsField, label: string, type: 'text' | 'password', ph: string) => `
      <div class="cfg-item">
        <div style="flex:1;min-width:0">
          <div class="cfg-label">${escapeHtml(label)}</div>
          <div class="cfg-hint" style="margin-top:2px">${isSet((stored as any)?.[f]) ? `<span class="c-green">● Configurado</span> · ${ftAt(f).slice(0,16)}` : '<span style="color:var(--dim)">○ No configurado</span>'}</div>
        </div>
        <div class="cfg-edit-wrap">
          <input class="inp" type="${type}" name="${f}" value="" placeholder="${escapeHtml(ph)}" autocomplete="new-password" style="width:200px"/>
          <label style="font-size:11.5px;color:var(--mu);white-space:nowrap;display:flex;align-items:center;gap:4px">
            <input type="checkbox" name="clear_${f}" value="1"/> Borrar
          </label>
        </div>
      </div>`;

    const credRows = db.items.sort((a, b) => a.label.localeCompare(b.label)).map((x) => `
      <tr>
        <td><b>${escapeHtml(x.label)}</b><div style="font-size:11px;color:var(--dim);font-family:'JetBrains Mono',monospace">${escapeHtml(x.key)}</div></td>
        <td class="mono" style="font-size:12px">${escapeHtml(maskValue(x.value))}</td>
        <td style="font-size:12px;color:var(--mu)">${escapeHtml(x.source)}</td>
        <td class="mono" style="font-size:11px;color:var(--dim)">${fmtTs(x.updatedAt)}</td>
        <td><form method="post" action="/config/creds/clear" style="display:inline">
          <input type="hidden" name="key" value="${escapeHtml(x.key)}"/>
          <button type="submit" class="btn-ghost btn-sm" style="color:var(--rd);border-color:rgba(244,63,94,.2)">Borrar</button>
        </form></td>
      </tr>`).join('');

    const secretsTab = `
      <div style="font-size:13px;color:var(--mu);margin-bottom:14px">Deja el campo en blanco para <b>conservar</b> el valor actual. Marca "Borrar" para eliminarlo.</div>
      <form method="post" action="/config/secrets">
        <div class="stack" style="gap:0">
          <div style="padding:10px 14px;background:rgba(255,255,255,.03);border:1px solid var(--bd);border-radius:9px 9px 0 0;font-size:11px;font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.6px">AppSheet</div>
          ${secField('appsheetAppId','App ID (CRM)','text','xxxxxxxx-xxxx-xxxx-xxxx')}
          ${secField('appsheetCrmKey','API Key CRM','password','V2-…')}
          ${secField('appsheetOpsKey','API Key Ops','password','V2-…')}
          ${secField('appsheetRegion','Region domain','text','www.appsheet.com')}
          ${secField('appsheetKey','Legacy key','password','V2-…')}
          <div style="padding:10px 14px;background:rgba(255,255,255,.03);border:1px solid var(--bd);border-top:none;font-size:11px;font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.6px">n8n</div>
          ${secField('n8nKey','API Key n8n','password','••••')}
          <div style="padding:10px 14px;background:rgba(255,255,255,.03);border:1px solid var(--bd);border-top:none;font-size:11px;font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.6px">GitHub</div>
          ${secField('githubPat','GitHub PAT','password','github_pat_…')}
        </div>
        <div class="sbar"><button class="btn" type="submit">Guardar secrets</button></div>
      </form>`;

    const credsTab = `
      <div class="flex ai-c gap-8 mb-12">
        <form method="post" action="/config/creds/import">
          <button type="submit" class="btn btn-sm">Importar APIs detectadas</button>
        </form>
        <span style="font-size:12px;color:var(--mu)">${db.items.length} credenciales almacenadas</span>
      </div>
      <div style="overflow:auto;margin-bottom:16px">
        <table>
          <thead><tr><th>Credencial</th><th>Valor</th><th>Fuente</th><th>Actualizado</th><th></th></tr></thead>
          <tbody>${credRows || '<tr><td colspan="5" class="empty">Sin credenciales.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="divider"></div>
      <div class="card-hd" style="margin-bottom:10px">Agregar credencial</div>
      <form method="post" action="/config/creds/upsert">
        <div class="g g3" style="gap:8px;margin-bottom:10px">
          <div class="field"><label class="flabel">Clave interna</label><input class="inp" type="text" name="key" required maxlength="120" placeholder="google.sheets.key"/></div>
          <div class="field"><label class="flabel">Etiqueta</label><input class="inp" type="text" name="label" required maxlength="120" placeholder="Google Sheets Key"/></div>
          <div class="field"><label class="flabel">Valor</label><input class="inp" type="password" name="value" required autocomplete="new-password"/></div>
        </div>
        <button class="btn btn-sm" type="submit">Guardar</button>
      </form>`;

    const content = `
      <div id="toast" class="toast${saved ? '' : ' hidden'}">Guardado correctamente.</div>
      <div class="ph"><div class="ph-title">Configuración</div>
        <div class="ph-sub"><b>Secrets</b>: valores conocidos (AppSheet, n8n, GitHub) · <b>Credenciales</b>: hub genérico de APIs. Nunca se renderizan en HTML.</div></div>

      <!-- Tabs -->
      <div class="flex gap-6 mb-16">
        <a href="/config?tab=secrets" class="btn${tab==='secrets'?'':'-ghost'}" style="${tab==='secrets'?'':''}">Secrets</a>
        <a href="/config?tab=creds" class="btn${tab==='creds'?'':'-ghost'}">Credenciales</a>
      </div>

      <div class="card" style="max-width:900px">
        ${tab === 'secrets' ? secretsTab : credsTab}
      </div>
      <script>(function(){var t=document.getElementById('toast');if(!t||t.classList.contains('hidden'))return;setTimeout(function(){t.classList.add('hidden');},2600);})();</script>`;

    res.type('html').send(pageLayout({ title: 'Config', active: 'config', contentHtml: content }));
  });

  app.post('/config/secrets', async (req, res) => {
    const b = req.body ?? {}; const g = (n: string) => (typeof b[n] === 'string' ? String(b[n]).trim() : '');
    const isClear = (n: string) => b[`clear_${n}`] === '1' || b[`clear_${n}`] === 'on';
    const update: Partial<Record<SecretsField, string | null>> = {};
    const soc = (f: SecretsField) => { if (isClear(f)) { update[f] = null; return; } const v = g(f); if (v.length > 0) update[f] = v; };
    (['appsheetAppId','appsheetCrmKey','appsheetOpsKey','appsheetRegion','appsheetKey','n8nKey','githubPat'] as SecretsField[]).forEach(soc);
    await writeSecrets(update); return res.redirect(302, '/config?tab=secrets&saved=1');
  });
  app.post('/config/creds/import', async (_req, res) => { await importKnownCredentials(); return res.redirect(302, '/config?tab=creds&saved=1'); });
  app.post('/config/creds/upsert', async (req, res) => {
    const key = typeof req.body?.key === 'string' ? req.body.key.trim() : '';
    const label = typeof req.body?.label === 'string' ? req.body.label.trim() : '';
    const value = typeof req.body?.value === 'string' ? req.body.value.trim() : '';
    if (!key || !label || !value) return res.status(400).type('text').send('Missing fields');
    await upsertCredential({ key, label, value, source: 'manual' }); return res.redirect(302, '/config?tab=creds&saved=1');
  });
  app.post('/config/creds/clear', async (req, res) => {
    const key = typeof req.body?.key === 'string' ? req.body.key.trim() : '';
    if (key) await clearCredential(key); return res.redirect(302, '/config?tab=creds&saved=1');
  });

  /* ═══════════════════════════════════════════════════════════════════════
     LOGIN / LOGOUT
  ═══════════════════════════════════════════════════════════════════════ */
  app.get('/login', (_req, res) => {
    const content = `
      <div style="min-height:80vh;display:flex;align-items:center;justify-content:center">
        <div class="card" style="width:100%;max-width:400px">
          <div style="text-align:center;margin-bottom:20px">
            <div style="width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,var(--v),var(--g));margin:0 auto 12px;box-shadow:0 0 0 3px rgba(124,92,255,.18),0 0 22px rgba(124,92,255,.14)"></div>
            <div style="font-size:19px;font-weight:700;letter-spacing:-.3px">Kiwy HQ</div>
            <div style="font-size:12.5px;color:var(--mu);margin-top:3px">OpenClaw · Control Center</div>
          </div>
          <form method="post" action="/login">
            <div class="field" style="margin-bottom:12px">
              <label class="flabel">Token de acceso</label>
              <input type="password" name="token" class="inp" autocomplete="current-password" placeholder="••••••••" autofocus/>
              <div class="hint" style="margin-top:4px">Variable <code>KIWY_HQ_TOKEN</code> en el servidor.</div>
            </div>
            <button class="btn w100" type="submit" style="justify-content:center">Entrar</button>
          </form>
        </div>
      </div>`;
    res.status(200).type('html').send(pageLayout({ title: 'Acceso', active: 'dashboard', contentHtml: content }));
  });

  app.post('/login', (req, res) => {
    const expected = process.env.KIWY_HQ_TOKEN;
    const provided = typeof req.body?.token === 'string' ? req.body.token : '';
    if (!expected) {
      const errHtml = pageLayout({ title: 'Error', active: 'dashboard', contentHtml: `
        <div style="min-height:70vh;display:flex;align-items:center;justify-content:center">
          <div class="card" style="max-width:460px;border-color:rgba(244,63,94,.35)">
            <div style="font-size:11px;font-weight:700;color:var(--rd);margin-bottom:8px;text-transform:uppercase;letter-spacing:.6px">Error de configuración</div>
            <div style="font-size:15px;font-weight:600;margin-bottom:8px">Variable <code>KIWY_HQ_TOKEN</code> no definida</div>
            <p style="color:var(--mu);font-size:13px;line-height:1.6">Ve a <b>Vercel → Settings → Environment Variables</b>, agrega <code>KIWY_HQ_TOKEN</code> con un valor seguro y redeploya.</p>
          </div>
        </div>` });
      return res.status(500).type('html').send(errHtml);
    }
    if (provided !== expected) return res.status(401).type('text').send('Token incorrecto');
    res.cookie(AUTH_COOKIE, '1', { httpOnly: true, sameSite: 'lax', path: '/' });
    return res.redirect(302, '/');
  });

  app.post('/logout', (_req, res) => {
    res.clearCookie(AUTH_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' });
    return res.redirect(302, '/login');
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3334);
  const app = createApp();
  app.listen(port, '0.0.0.0', () => console.log(`Kiwy HQ listening on :${port}`));
}
