import express from 'express';
import cookieParser from 'cookie-parser';
import { readSecrets, writeSecrets, type SecretsField } from './secrets-store';
import { readHqStatus, writeHqStatus, type MacroProjectKey } from './hq-status-store';
import { clearCredential, importKnownCredentials, maskValue, readCredentials, upsertCredential } from './credentials-store';
import { readAgents } from './agents-store';
import {
  readCompany,
  addMeeting, deleteMeeting,
  addAction, updateActionStatus, deleteAction,
  addSuggestion, updateSuggestionStatus,
  type ActionPriority, type ActionStatus,
} from './company-store';
import { escapeHtml, pageLayout } from './ui';

const AUTH_COOKIE = 'kiwy_hq_auth';

function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.path === '/health' || req.path === '/login') return next();
  if (req.cookies?.[AUTH_COOKIE] === '1') return next();
  return res.redirect(302, '/login');
}

function fmtTs(ts?: string) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return escapeHtml(ts);
  return escapeHtml(d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC');
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return { day: d.getDate(), month: months[d.getMonth()], time: iso.slice(11, 16) };
}

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'ahora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

export function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: false }));
  app.use(auth);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  /* ─────────────────────────── DASHBOARD ─────────────────────────── */
  app.get('/', async (_req, res) => {
    const [stored, status, agentsData] = await Promise.all([readSecrets(), readHqStatus(), readAgents()]);

    const secretFields: SecretsField[] = [
      'appsheetAppId', 'appsheetCrmKey', 'appsheetOpsKey',
      'appsheetRegion', 'appsheetKey', 'n8nKey', 'githubPat',
    ];
    const configuredSecrets = secretFields.filter((f) => typeof (stored as any)?.[f] === 'string').length;
    const statusFields: MacroProjectKey[] = ['qualiver', 'echo', 'kuenti', 'personal'];
    const statusReady = statusFields.filter((f) => status[f] && status[f] !== 'No status yet.').length;

    const activeAgents = agentsData.agents.filter((a) => a.status === 'active' || a.status === 'thinking').length;
    const errorAgents = agentsData.agents.filter((a) => a.status === 'error').length;

    const semColor = (key: MacroProjectKey) => {
      const s = status[key];
      if (!s || s === 'No status yet.') return 'sema-gray';
      const lower = s.toLowerCase();
      if (lower.includes('bloqueado') || lower.includes('error') || lower.includes('fallo')) return 'sema-red';
      if (lower.includes('riesgo') || lower.includes('pendiente') || lower.includes('demora')) return 'sema-amber';
      return 'sema-green';
    };

    const projCard = (name: string, key: MacroProjectKey) => `
      <div class="proj-card">
        <div class="proj-name">
          <span class="sema ${semColor(key)}"><span class="sema-dot"></span></span>
          ${escapeHtml(name)}
        </div>
        <div class="proj-status">${escapeHtml(status[key])}</div>
        <div class="proj-footer">
          <a href="/status" class="proj-link">Editar</a>
          <span class="proj-ts">${fmtTs(status.fieldUpdatedAt?.[key])}</span>
        </div>
      </div>`;

    const content = `
      <div class="ph">
        <div class="ph-title">Dashboard</div>
        <div class="ph-sub">Pulso global de Qualiver — operaciones, agentes y configuración.</div>
      </div>

      <div class="g g-4 mb-16">
        <div class="card kpi-green">
          <div class="kpi-label">Agentes activos</div>
          <div class="kpi-val">${activeAgents}</div>
          <div class="kpi-sub">de ${agentsData.agents.length} totales${errorAgents > 0 ? ` · ${errorAgents} en error` : ''}</div>
        </div>
        <div class="card">
          <div class="kpi-label">Estados de proyectos</div>
          <div class="kpi-val kpi-violet">${statusReady}/4</div>
          <div class="kpi-sub">Últ. act. ${fmtTs(status.updatedAt)}</div>
        </div>
        <div class="card">
          <div class="kpi-label">Secrets configurados</div>
          <div class="kpi-val">${configuredSecrets}/7</div>
          <div class="kpi-sub">Operatividad de integraciones</div>
        </div>
        <div class="card kpi-green">
          <div class="kpi-label">Sistema</div>
          <div class="kpi-val" style="font-size:20px;padding-top:6px">OK</div>
          <div class="kpi-sub">Auth activo · archivos seguros</div>
        </div>
      </div>

      <div class="divider"></div>
      <div class="section-label">Estado de macro proyectos</div>
      <div class="g g-2">
        ${projCard('Qualiver', 'qualiver')}
        ${projCard('ECHO', 'echo')}
        ${projCard('Kuenti', 'kuenti')}
        ${projCard('Personal / Otro', 'personal')}
      </div>

      <div class="divider"></div>
      <div class="section-label">Acceso rápido</div>
      <div class="g g-3">
        <a href="/agents" class="card" style="text-decoration:none;transition:border-color .13s ease;cursor:pointer" onmouseover="this.style.borderColor='rgba(124,92,255,0.4)'" onmouseout="this.style.borderColor=''">
          <div class="kpi-label">Agentes OpenClaw</div>
          <div style="font-size:13px;color:var(--muted);margin-top:6px">Monitorea tareas, progreso y tokens de cada agente en tiempo real.</div>
        </a>
        <a href="/company" class="card" style="text-decoration:none;transition:border-color .13s ease;cursor:pointer" onmouseover="this.style.borderColor='rgba(124,92,255,0.4)'" onmouseout="this.style.borderColor=''">
          <div class="kpi-label">Centro de Empresa</div>
          <div style="font-size:13px;color:var(--muted);margin-top:6px">Reuniones, acciones pendientes y sugerencias de Kiwy.</div>
        </a>
        <a href="/status" class="card" style="text-decoration:none;transition:border-color .13s ease;cursor:pointer" onmouseover="this.style.borderColor='rgba(124,92,255,0.4)'" onmouseout="this.style.borderColor=''">
          <div class="kpi-label">Tablero de estado</div>
          <div style="font-size:13px;color:var(--muted);margin-top:6px">Actualiza el pulso de una oración por proyecto para revisión rápida.</div>
        </a>
      </div>`;

    res.type('html').send(pageLayout({ title: 'Dashboard', active: 'dashboard', contentHtml: content }));
  });

  /* ─────────────────────────── AGENTES ───────────────────────────── */
  app.get('/agents', async (_req, res) => {
    const { agents, updatedAt } = await readAgents();

    const statusLabel: Record<string, string> = {
      active: 'Activo', thinking: 'Procesando', idle: 'En espera', error: 'Error',
    };

    const agentCard = (a: (typeof agents)[0]) => {
      const pct = Math.min(100, Math.max(0, a.progress));
      const fillClass = a.status === 'error' ? 'error' : pct === 100 ? 'done' : '';
      const recentStr = a.recentActions.slice(0, 5).map((r) => {
        const dotClass = r.type === 'error' ? 'err' : r.type === 'success' ? 'ok' : '';
        return `<div class="tl-item">
          <span class="tl-time">${relative(r.time)}</span>
          <div class="tl-dot-col"><span class="tl-dot ${dotClass}"></span></div>
          <span class="tl-text">${escapeHtml(r.action)}</span>
        </div>`;
      }).join('') || `<div class="empty" style="padding:10px;text-align:left">Sin acciones recientes.</div>`;

      return `
        <div class="agent-card status-${a.status}">
          <div class="agent-head">
            <div>
              <div class="agent-name">${escapeHtml(a.name)}</div>
              <div class="agent-role">${escapeHtml(a.role)}</div>
            </div>
            <span class="status-badge badge-${a.status}">
              <span class="dot ${a.status}"></span>
              ${statusLabel[a.status] ?? a.status}
            </span>
          </div>

          <div>
            <div class="agent-task-label">Tarea actual</div>
            <div class="agent-task-text">${escapeHtml(a.currentTask)}</div>
          </div>

          <div class="progress-wrap">
            <div class="progress-row">
              <span class="progress-label">Progreso</span>
              <span class="progress-pct">${pct}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill ${fillClass}" style="width:${pct}%"></div>
            </div>
          </div>

          <div class="agent-metrics">
            <div class="metric">
              <div class="metric-val">${a.metrics.tokensToday.toLocaleString('es')}</div>
              <div class="metric-key">Tokens hoy</div>
            </div>
            <div class="metric">
              <div class="metric-val">${a.metrics.tasksCompleted}</div>
              <div class="metric-key">Completadas</div>
            </div>
            <div class="metric">
              <div class="metric-val">${a.metrics.tasksOpen}</div>
              <div class="metric-key">Abiertas</div>
            </div>
            <div class="metric">
              <div class="metric-val">${a.metrics.successRate}%</div>
              <div class="metric-key">Éxito</div>
            </div>
          </div>

          <div>
            <div class="section-label" style="margin-bottom:8px">Historial reciente</div>
            <div class="timeline">${recentStr}</div>
          </div>

          <div style="font-size:11px;color:var(--dim);font-family:'JetBrains Mono',monospace">
            Últ. actividad: ${fmtTs(a.lastActivity)}
          </div>
        </div>`;
    };

    const totalTokens = agents.reduce((s, a) => s + (a.metrics.tokensToday || 0), 0);
    const activeCount = agents.filter((a) => a.status === 'active' || a.status === 'thinking').length;
    const errorCount = agents.filter((a) => a.status === 'error').length;

    const content = `
      <div class="ph">
        <div class="ph-title">Agentes OpenClaw</div>
        <div class="ph-sub">Estado, progreso y actividad de cada agente en tiempo real. Datos actualizados: ${fmtTs(updatedAt)}</div>
      </div>

      <div class="g g-4 mb-16">
        <div class="card kpi-green">
          <div class="kpi-label">Agentes activos</div>
          <div class="kpi-val">${activeCount}</div>
          <div class="kpi-sub">de ${agents.length} configurados</div>
        </div>
        <div class="card">
          <div class="kpi-label">Total agentes</div>
          <div class="kpi-val kpi-violet">${agents.length}</div>
          <div class="kpi-sub">en este entorno</div>
        </div>
        <div class="card ${errorCount > 0 ? '' : 'kpi-green'}">
          <div class="kpi-label">Errores</div>
          <div class="kpi-val ${errorCount > 0 ? 'text-red' : ''}">${errorCount}</div>
          <div class="kpi-sub">${errorCount > 0 ? 'Requieren atención' : 'Sin errores detectados'}</div>
        </div>
        <div class="card">
          <div class="kpi-label">Tokens hoy (total)</div>
          <div class="kpi-val kpi-violet">${totalTokens.toLocaleString('es')}</div>
          <div class="kpi-sub">suma de todos los agentes</div>
        </div>
      </div>

      <div class="section-label">Estado de agentes</div>
      <div class="g g-2">
        ${agents.map(agentCard).join('\n')}
      </div>

      <div class="card mt-16" style="border-style:dashed;background:transparent">
        <div class="card-title">Actualizar agente manualmente <span>para pruebas / entrada de datos externa</span></div>
        <form method="post" action="/agents/update">
          <div class="g g-2" style="gap:10px;margin-bottom:12px">
            <div class="field">
              <label class="field-label">ID del agente</label>
              <select name="agentId" class="input">
                ${agents.map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label class="field-label">Estado</label>
              <select name="status" class="input">
                <option value="active">Activo</option>
                <option value="thinking">Procesando</option>
                <option value="idle">En espera</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div class="field span-2">
              <label class="field-label">Tarea actual</label>
              <input type="text" name="currentTask" class="input" maxlength="200" placeholder="Describe qué está haciendo el agente…" />
            </div>
            <div class="field">
              <label class="field-label">Progreso (0–100)</label>
              <input type="number" name="progress" class="input" min="0" max="100" value="0" />
            </div>
            <div class="field">
              <label class="field-label">Acción reciente (opcional)</label>
              <input type="text" name="recentAction" class="input" maxlength="200" placeholder="Ej: Procesó reporte de crons" />
            </div>
          </div>
          <button type="submit" class="btn btn-sm">Guardar estado del agente</button>
        </form>
      </div>`;

    res.type('html').send(pageLayout({ title: 'Agentes', active: 'agents', contentHtml: content }));
  });

  app.post('/agents/update', async (req, res) => {
    const body = req.body ?? {};
    const getString = (k: string) => (typeof body[k] === 'string' ? String(body[k]).trim() : '');
    const agentId = getString('agentId');
    const status = getString('status') as any;
    const currentTask = getString('currentTask');
    const progress = Math.min(100, Math.max(0, parseInt(getString('progress')) || 0));
    const recentAction = getString('recentAction');

    if (agentId) {
      const { readAgents, writeAgentStatus } = await import('./agents-store');
      const current = await readAgents();
      const agent = current.agents.find((a) => a.id === agentId);
      const existingActions = agent?.recentActions ?? [];

      const newActions = recentAction
        ? [{ time: new Date().toISOString(), action: recentAction, type: 'info' as const }, ...existingActions].slice(0, 20)
        : existingActions;

      await writeAgentStatus(agentId, {
        ...(status ? { status } : {}),
        ...(currentTask ? { currentTask } : {}),
        progress,
        recentActions: newActions,
      });
    }
    return res.redirect(302, '/agents');
  });

  /* ─────────────────────────── EMPRESA ───────────────────────────── */
  app.get('/company', async (req, res) => {
    const saved = req.query?.saved === '1';
    const company = await readCompany();

    const now = new Date();

    const upcomingMeetings = company.meetings
      .filter((m) => m.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date));

    const pendingActions = company.actions
      .filter((a) => a.status !== 'done')
      .sort((a, b) => {
        const pri: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (pri[a.priority] ?? 1) - (pri[b.priority] ?? 1);
      });

    const doneActions = company.actions.filter((a) => a.status === 'done').slice(0, 5);

    const pendingSuggestions = company.suggestions.filter((s) => s.status === 'pending');
    const otherSuggestions = company.suggestions.filter((s) => s.status !== 'pending').slice(0, 4);

    const priLabel: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };

    const meetingCard = (m: (typeof upcomingMeetings)[0]) => {
      const d = fmtDate(m.date);
      const completed = m.status === 'completed';
      return `
        <div class="meeting-card">
          <div class="meeting-date-box" style="${completed ? 'opacity:0.5' : ''}">
            <div class="meeting-date-month">${typeof d === 'object' ? d.month : ''}</div>
            <div class="meeting-date-day">${typeof d === 'object' ? d.day : m.date.slice(0, 10)}</div>
          </div>
          <div class="meeting-body">
            <div class="meeting-title">${escapeHtml(m.title)}${completed ? ' <span style="font-size:11px;color:var(--green)">✓</span>' : ''}</div>
            <div class="meeting-meta">${typeof d === 'object' ? d.time + ' · ' : ''}${escapeHtml(m.attendees.join(', '))}</div>
            ${m.project ? `<div class="meeting-proj">${escapeHtml(m.project)}</div>` : ''}
            ${m.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:6px">${escapeHtml(m.notes)}</div>` : ''}
          </div>
          <form method="post" action="/company/meetings/${escapeHtml(m.id)}/delete">
            <button type="submit" class="meeting-del" title="Eliminar">×</button>
          </form>
        </div>`;
    };

    const actionItem = (a: (typeof pendingActions)[0], isDone = false) => `
      <div class="action-item${isDone ? ' action-done' : ''}">
        <span class="action-pri pri-${a.priority}">${priLabel[a.priority]}</span>
        <div class="action-body">
          <div class="action-title">${escapeHtml(a.title)}</div>
          <div class="action-meta">${a.project ? escapeHtml(a.project) + ' · ' : ''}${a.dueDate ? 'Vence: ' + a.dueDate : 'Sin fecha'}</div>
        </div>
        <div class="action-btns">
          ${!isDone ? `<form method="post" action="/company/actions/${escapeHtml(a.id)}/done" style="display:inline">
            <button type="submit" class="action-btn check" title="Marcar completada">✓</button>
          </form>` : ''}
          <form method="post" action="/company/actions/${escapeHtml(a.id)}/delete" style="display:inline">
            <button type="submit" class="action-btn del" title="Eliminar">×</button>
          </form>
        </div>
      </div>`;

    const suggCard = (s: (typeof pendingSuggestions)[0]) => `
      <div class="suggestion-card ${s.status}">
        <div class="sug-head">
          <span class="sug-source">${escapeHtml(s.source)}</span>
          ${s.status !== 'pending' ? `<span class="sug-status-tag sug-status-${s.status}">${s.status === 'approved' ? 'Aprobada' : 'Rechazada'}</span>` : ''}
          <span class="sug-date">${s.date.slice(0, 10)}</span>
        </div>
        <div class="sug-text">${escapeHtml(s.text)}</div>
        ${s.impact ? `<div class="sug-impact">Impacto: ${escapeHtml(s.impact)}</div>` : ''}
        ${s.status === 'pending' ? `
          <div class="sug-actions">
            <form method="post" action="/company/suggestions/${escapeHtml(s.id)}/approve" style="display:inline">
              <button type="submit" class="sug-approve">Aprobar</button>
            </form>
            <form method="post" action="/company/suggestions/${escapeHtml(s.id)}/reject" style="display:inline">
              <button type="submit" class="sug-reject">Descartar</button>
            </form>
          </div>` : ''}
      </div>`;

    const content = `
      <div id="toast" class="toast${saved ? '' : ' hidden'}" role="status" aria-live="polite">
        Guardado correctamente.
      </div>

      <div class="ph">
        <div class="ph-title">Centro de Empresa</div>
        <div class="ph-sub">Reuniones, acciones pendientes y sugerencias de Kiwy para Qualiver.</div>
      </div>

      <div class="g g-2" style="align-items:start">

        <!-- COLUMNA IZQUIERDA -->
        <div class="stack">

          <!-- REUNIONES -->
          <div class="card">
            <div class="card-title">Próximas reuniones <span>${upcomingMeetings.length} total</span></div>
            <div class="stack mb-16">
              ${upcomingMeetings.length ? upcomingMeetings.map(meetingCard).join('') : '<div class="empty">Sin reuniones programadas.</div>'}
            </div>

            <div class="divider"></div>
            <div class="section-label">Agregar reunión</div>
            <form method="post" action="/company/meetings/add">
              <div class="form-section">
                <div class="field">
                  <label class="field-label">Título</label>
                  <input type="text" name="title" class="input" required maxlength="200" placeholder="Revisión semanal de proyectos" />
                </div>
                <div class="g g-2" style="gap:10px">
                  <div class="field">
                    <label class="field-label">Fecha y hora</label>
                    <input type="datetime-local" name="date" class="input" required />
                  </div>
                  <div class="field">
                    <label class="field-label">Proyecto (opc.)</label>
                    <input type="text" name="project" class="input" maxlength="100" placeholder="Qualiver" />
                  </div>
                </div>
                <div class="field">
                  <label class="field-label">Asistentes (separados por coma)</label>
                  <input type="text" name="attendees" class="input" placeholder="Juan, Kiwy, Equipo" />
                </div>
                <div class="field">
                  <label class="field-label">Notas (opc.)</label>
                  <input type="text" name="notes" class="input" maxlength="300" placeholder="Agenda o contexto…" />
                </div>
              </div>
              <div style="margin-top:12px"><button type="submit" class="btn btn-sm">Agregar reunión</button></div>
            </form>
          </div>

          <!-- SUGERENCIAS -->
          <div class="card">
            <div class="card-title">Sugerencias de Kiwy <span>${pendingSuggestions.length} pendientes</span></div>
            <div class="stack mb-16">
              ${pendingSuggestions.length ? pendingSuggestions.map(suggCard).join('') : '<div class="empty">Sin sugerencias pendientes.</div>'}
              ${otherSuggestions.length ? otherSuggestions.map(suggCard).join('') : ''}
            </div>

            <div class="divider"></div>
            <div class="section-label">Agregar sugerencia manual</div>
            <form method="post" action="/company/suggestions/add">
              <div class="form-section">
                <div class="field">
                  <label class="field-label">Sugerencia</label>
                  <input type="text" name="text" class="input" required maxlength="400" placeholder="Texto de la sugerencia…" />
                </div>
                <div class="g g-2" style="gap:10px">
                  <div class="field">
                    <label class="field-label">Fuente</label>
                    <input type="text" name="source" class="input" value="Kiwy" maxlength="80" />
                  </div>
                  <div class="field">
                    <label class="field-label">Impacto (opc.)</label>
                    <input type="text" name="impact" class="input" maxlength="200" placeholder="Ahorra 2h/semana…" />
                  </div>
                </div>
              </div>
              <div style="margin-top:12px"><button type="submit" class="btn btn-sm">Agregar sugerencia</button></div>
            </form>
          </div>
        </div>

        <!-- COLUMNA DERECHA: ACCIONES -->
        <div class="card">
          <div class="card-title">Acciones pendientes <span>${pendingActions.length} abiertas</span></div>
          <div class="stack mb-16">
            ${pendingActions.length ? pendingActions.map((a) => actionItem(a)).join('') : '<div class="empty">Sin acciones pendientes. ¡Todo al día!</div>'}
          </div>

          ${doneActions.length ? `
            <div class="divider"></div>
            <div class="section-label">Completadas recientemente</div>
            <div class="stack mb-16">${doneActions.map((a) => actionItem(a, true)).join('')}</div>
          ` : ''}

          <div class="divider"></div>
          <div class="section-label">Nueva acción</div>
          <form method="post" action="/company/actions/add">
            <div class="form-section">
              <div class="field">
                <label class="field-label">Título de la acción</label>
                <input type="text" name="title" class="input" required maxlength="300" placeholder="Revisar propuestas de Kiwy…" />
              </div>
              <div class="g g-2" style="gap:10px">
                <div class="field">
                  <label class="field-label">Prioridad</label>
                  <select name="priority" class="input">
                    <option value="high">Alta</option>
                    <option value="medium" selected>Media</option>
                    <option value="low">Baja</option>
                  </select>
                </div>
                <div class="field">
                  <label class="field-label">Fecha límite (opc.)</label>
                  <input type="date" name="dueDate" class="input" />
                </div>
              </div>
              <div class="field">
                <label class="field-label">Proyecto (opc.)</label>
                <input type="text" name="project" class="input" maxlength="100" placeholder="Qualiver / ECHO / Kuenti…" />
              </div>
            </div>
            <div style="margin-top:12px"><button type="submit" class="btn btn-sm">Agregar acción</button></div>
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

  // Company action routes
  app.post('/company/meetings/add', async (req, res) => {
    const b = req.body ?? {};
    const g = (k: string) => (typeof b[k] === 'string' ? String(b[k]).trim() : '');
    const title = g('title');
    const date = g('date');
    const attendees = g('attendees').split(',').map((s) => s.trim()).filter(Boolean);
    if (title && date) {
      await addMeeting({ title, date, attendees, status: 'upcoming', notes: g('notes') || undefined, project: g('project') || undefined });
    }
    return res.redirect(302, '/company?saved=1');
  });

  app.post('/company/meetings/:id/delete', async (req, res) => {
    await deleteMeeting(req.params.id);
    return res.redirect(302, '/company?saved=1');
  });

  app.post('/company/actions/add', async (req, res) => {
    const b = req.body ?? {};
    const g = (k: string) => (typeof b[k] === 'string' ? String(b[k]).trim() : '');
    const title = g('title');
    const priority = (g('priority') as ActionPriority) || 'medium';
    if (title) {
      await addAction({
        title, priority, status: 'pending',
        dueDate: g('dueDate') || undefined,
        project: g('project') || undefined,
      });
    }
    return res.redirect(302, '/company?saved=1');
  });

  app.post('/company/actions/:id/done', async (req, res) => {
    await updateActionStatus(req.params.id, 'done' as ActionStatus);
    return res.redirect(302, '/company?saved=1');
  });

  app.post('/company/actions/:id/delete', async (req, res) => {
    await deleteAction(req.params.id);
    return res.redirect(302, '/company?saved=1');
  });

  app.post('/company/suggestions/add', async (req, res) => {
    const b = req.body ?? {};
    const g = (k: string) => (typeof b[k] === 'string' ? String(b[k]).trim() : '');
    const text = g('text');
    if (text) {
      await addSuggestion({ text, source: g('source') || 'Manual', date: new Date().toISOString().slice(0, 10), status: 'pending', impact: g('impact') || undefined });
    }
    return res.redirect(302, '/company?saved=1');
  });

  app.post('/company/suggestions/:id/approve', async (req, res) => {
    await updateSuggestionStatus(req.params.id, 'approved');
    return res.redirect(302, '/company?saved=1');
  });

  app.post('/company/suggestions/:id/reject', async (req, res) => {
    await updateSuggestionStatus(req.params.id, 'rejected');
    return res.redirect(302, '/company?saved=1');
  });

  /* ─────────────────────────── STATUS ────────────────────────────── */
  app.get('/status', async (req, res) => {
    const saved = req.query?.saved === '1';
    const status = await readHqStatus();

    const statusInput = (field: MacroProjectKey, label: string, hint: string) => `
      <div class="field">
        <div class="field-row">
          <label class="field-label">${escapeHtml(label)}</label>
          <span class="status-pill">
            <span class="status-dot on"></span>
            ${fmtTs(status.fieldUpdatedAt?.[field])}
          </span>
        </div>
        <input class="input" type="text" name="${field}" maxlength="220" value="${escapeHtml(status[field])}" placeholder="${escapeHtml(hint)}" />
      </div>`;

    const content = `
      <div id="toast" class="toast${saved ? '' : ' hidden'}" role="status" aria-live="polite">
        Estado guardado. <small>Escrito en data/hq-status.json</small>
      </div>

      <div class="ph">
        <div class="ph-title">Tablero de estado</div>
        <div class="ph-sub">Una oración concreta por macro proyecto. Pulso ejecutivo rápido.</div>
      </div>

      <form method="post" action="/status">
        <div class="card" style="max-width:720px">
          <div class="card-title">
            Pulso de proyectos
            <span class="status-pill"><span class="status-dot on"></span>Últ. guardado: ${fmtTs(status.updatedAt)}</span>
          </div>
          <p class="form-hint mb-16">Máximo 220 caracteres por proyecto. Conciso y orientado a acción.</p>
          <div class="form-section">
            ${statusInput('qualiver', 'Qualiver', 'Ej: «Validaciones piloto cerradas; preparando checklist de despliegue.»')}
            ${statusInput('echo', 'ECHO', 'Ej: «Triage de inbox estabilizado; automatizando prioridades de alertas.»')}
            ${statusInput('kuenti', 'Kuenti', 'Ej: «Docs core restructuradas; calidad de búsqueda mejorada esta semana.»')}
            ${statusInput('personal', 'Personal / Otro (opcional)', 'Ej: «Stack de productividad estable, sin bloqueos.»')}
          </div>
        </div>
        <div class="sticky-bar">
          <button class="btn" type="submit">Guardar estado</button>
        </div>
      </form>

      <script>
        (function(){
          var t=document.getElementById('toast');
          if(!t||t.classList.contains('hidden'))return;
          setTimeout(function(){t.classList.add('hidden');},2600);
          try{var u=new URL(location.href);u.searchParams.delete('saved');history.replaceState({},'',u);}catch(e){}
        })();
      </script>`;

    res.type('html').send(pageLayout({ title: 'Estado', active: 'status', contentHtml: content }));
  });

  app.post('/status', async (req, res) => {
    const body = req.body ?? {};
    const g = (n: string) => (typeof body[n] === 'string' ? String(body[n]) : '');
    await writeHqStatus({ qualiver: g('qualiver'), echo: g('echo'), kuenti: g('kuenti'), personal: g('personal') });
    return res.redirect(302, '/status?saved=1');
  });

  /* ─────────────────────────── SECRETS ───────────────────────────── */
  app.get('/secrets', async (req, res) => {
    const saved = req.query?.saved === '1';
    const stored = await readSecrets();

    const ftAt = (f: SecretsField) => {
      const ts = stored?.fieldUpdatedAt?.[f] || stored?.updatedAt;
      return typeof ts === 'string' ? ts : '';
    };
    const isSet = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
    const pill = (on: boolean, ts?: string) => `
      <span class="status-pill">
        <span class="status-dot ${on ? 'on' : ''}"></span>
        ${on ? 'Configurado' : 'No configurado'}${ts ? ' · ' + escapeHtml(ts.slice(0, 16)) : ''}
      </span>`;

    const sec = (field: SecretsField, label: string, type: 'text' | 'password', placeholder: string) => `
      <div class="field">
        <div class="field-row">
          <label class="field-label">${escapeHtml(label)}</label>
          ${pill(isSet((stored as any)?.[field]), ftAt(field))}
        </div>
        <input class="input" type="${type}" name="${field}" value="" placeholder="${escapeHtml(placeholder)}" autocomplete="new-password" />
        <label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;margin-top:4px">
          <input type="checkbox" name="clear_${field}" value="1" /> Borrar valor guardado
        </label>
      </div>`;

    const content = `
      <div id="toast" class="toast${saved ? '' : ' hidden'}" role="status" aria-live="polite">
        Secrets guardados. <small>Escrito en data/secrets.json (gitignoreado)</small>
      </div>

      <div class="ph">
        <div class="ph-title">Secrets & configuración</div>
        <div class="ph-sub">Almacenados localmente en <code>data/secrets.json</code>. Nunca se renderizan en HTML.</div>
      </div>

      <form method="post" action="/secrets">
        <div class="stack" style="max-width:720px">
          <div class="card">
            <div class="spill"><h3>AppSheet CRM</h3>${pill(isSet(stored?.appsheetCrmKey) && isSet(stored?.appsheetAppId), stored?.updatedAt)}</div>
            <p class="form-hint mb-16">Clave + App ID para automatizaciones de CRM. Deja en blanco para conservar.</p>
            ${sec('appsheetAppId', 'App ID (CRM)', 'text', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')}
            ${sec('appsheetCrmKey', 'API key (CRM)', 'password', 'V2-…')}
          </div>
          <div class="card">
            <div class="spill"><h3>AppSheet Ops</h3>${pill(isSet(stored?.appsheetOpsKey), ftAt('appsheetOpsKey'))}</div>
            ${sec('appsheetOpsKey', 'API key (Ops)', 'password', 'V2-…')}
          </div>
          <div class="card">
            <div class="spill"><h3>AppSheet Shared</h3>${pill(true, stored?.updatedAt)}</div>
            ${sec('appsheetRegion', 'Region domain', 'text', 'www.appsheet.com')}
            ${sec('appsheetKey', 'Legacy key', 'password', 'V2-…')}
          </div>
          <div class="card">
            <div class="spill"><h3>n8n</h3>${pill(isSet(stored?.n8nKey), ftAt('n8nKey'))}</div>
            ${sec('n8nKey', 'n8n API key', 'password', '••••••••')}
          </div>
          <div class="card">
            <div class="spill"><h3>GitHub</h3>${pill(isSet(stored?.githubPat), ftAt('githubPat'))}</div>
            ${sec('githubPat', 'GitHub PAT', 'password', 'github_pat_… / ghp_…')}
          </div>
        </div>
        <div class="sticky-bar">
          <button class="btn" type="submit">Guardar secrets</button>
        </div>
      </form>

      <script>
        (function(){
          var t=document.getElementById('toast');
          if(!t||t.classList.contains('hidden'))return;
          setTimeout(function(){t.classList.add('hidden');},2600);
          try{var u=new URL(location.href);u.searchParams.delete('saved');history.replaceState({},'',u);}catch(e){}
        })();
      </script>`;

    res.type('html').send(pageLayout({ title: 'Secrets', active: 'secrets', contentHtml: content }));
  });

  app.post('/secrets', async (req, res) => {
    const body = req.body ?? {};
    const g = (n: string) => (typeof body[n] === 'string' ? String(body[n]).trim() : '');
    const isClear = (n: string) => body[`clear_${n}`] === '1' || body[`clear_${n}`] === 'on';
    const update: Partial<Record<SecretsField, string | null>> = {};
    const soc = (f: SecretsField) => {
      if (isClear(f)) { update[f] = null; return; }
      const v = g(f);
      if (v.length > 0) update[f] = v;
    };
    (['appsheetAppId', 'appsheetCrmKey', 'appsheetOpsKey', 'appsheetRegion', 'appsheetKey', 'n8nKey', 'githubPat'] as SecretsField[]).forEach(soc);
    await writeSecrets(update);
    return res.redirect(302, '/secrets?saved=1');
  });

  /* ─────────────────────────── CREDENTIALS ───────────────────────── */
  app.get('/credentials', async (req, res) => {
    const imported = req.query?.imported === '1';
    const saved = req.query?.saved === '1';
    const db = await readCredentials();

    const rows = db.items
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((x) => `
        <tr>
          <td><strong>${escapeHtml(x.label)}</strong><div class="form-hint">${escapeHtml(x.key)}</div></td>
          <td><code>${escapeHtml(maskValue(x.value))}</code></td>
          <td>${escapeHtml(x.source)}</td>
          <td class="mono" style="font-size:12px">${fmtTs(x.updatedAt)}</td>
          <td>
            <form method="post" action="/credentials/clear" style="display:inline">
              <input type="hidden" name="key" value="${escapeHtml(x.key)}" />
              <button class="action-btn del" type="submit">Borrar</button>
            </form>
          </td>
        </tr>`).join('');

    const content = `
      <div id="toast" class="toast${saved || imported ? '' : ' hidden'}" role="status" aria-live="polite">
        ${imported ? 'APIs detectadas e importadas.' : 'Credencial guardada.'}
      </div>

      <div class="ph">
        <div class="ph-title">Hub de Credenciales</div>
        <div class="ph-sub">Centraliza APIs sin repetirlas. Importa detectadas, crea nuevas o actualiza existentes.</div>
      </div>

      <div class="g g-2" style="align-items:start">
        <div class="stack">
          <div class="card">
            <div class="card-title">Importar APIs conocidas <span>${db.items.length} total</span></div>
            <p class="form-hint mb-16">Detecta secretos legacy y variables de entorno comunes y los agrega al HQ.</p>
            <form method="post" action="/credentials/import">
              <button class="btn btn-sm" type="submit">Importar APIs detectadas</button>
            </form>
          </div>
          <div class="card">
            <div class="card-title">Crear / actualizar credencial</div>
            <form method="post" action="/credentials/upsert">
              <div class="form-section">
                <div class="field">
                  <label class="field-label">Clave interna</label>
                  <input class="input" type="text" name="key" required maxlength="120" placeholder="google.sheets.api_key" />
                </div>
                <div class="field">
                  <label class="field-label">Etiqueta visible</label>
                  <input class="input" type="text" name="label" required maxlength="120" placeholder="Google Sheets API Key" />
                </div>
                <div class="field">
                  <label class="field-label">Valor secreto</label>
                  <input class="input" type="password" name="value" required autocomplete="new-password" />
                </div>
              </div>
              <div style="margin-top:12px"><button class="btn btn-sm" type="submit">Guardar credencial</button></div>
            </form>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Inventario actual</div>
          <div style="overflow:auto">
            <table>
              <thead><tr><th>Credencial</th><th>Mask</th><th>Fuente</th><th>Actualizado</th><th></th></tr></thead>
              <tbody>${rows || '<tr><td colspan="5" class="empty">Sin credenciales aún.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </div>

      <script>
        (function(){
          var t=document.getElementById('toast');
          if(!t||t.classList.contains('hidden'))return;
          setTimeout(function(){t.classList.add('hidden');},2600);
        })();
      </script>`;

    res.type('html').send(pageLayout({ title: 'Credenciales', active: 'credentials', contentHtml: content }));
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

  /* ─────────────────────────── LOGIN / LOGOUT ─────────────────────── */
  app.get('/login', (_req, res) => {
    const content = `
      <div style="min-height:80vh;display:flex;align-items:center;justify-content:center">
        <div class="card" style="width:100%;max-width:420px">
          <div style="text-align:center;margin-bottom:20px">
            <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,var(--violet),var(--green));margin:0 auto 12px;box-shadow:0 0 0 3px rgba(124,92,255,0.2),0 0 24px rgba(124,92,255,0.15)"></div>
            <div style="font-size:20px;font-weight:700;letter-spacing:-0.3px">Kiwy HQ</div>
            <div style="font-size:13px;color:var(--muted);margin-top:4px">OpenClaw · Control Center</div>
          </div>
          <form method="post" action="/login">
            <div class="field" style="margin-bottom:14px">
              <label class="field-label">Token de acceso</label>
              <input type="password" name="token" class="input" autocomplete="current-password" placeholder="••••••••" autofocus />
              <div class="form-hint" style="margin-top:5px">Token configurado como <code>KIWY_HQ_TOKEN</code> en el servidor.</div>
            </div>
            <button class="btn w-full" type="submit" style="justify-content:center">Entrar</button>
          </form>
        </div>
      </div>`;
    res.status(200).type('html').send(pageLayout({ title: 'Acceso', active: 'dashboard', contentHtml: content }));
  });

  app.post('/login', (req, res) => {
    const expected = process.env.KIWY_HQ_TOKEN;
    const provided = typeof req.body?.token === 'string' ? req.body.token : '';
    if (!expected) {
      const errHtml = pageLayout({ title: 'Error de configuración', active: 'dashboard', contentHtml: `
        <div style="min-height:70vh;display:flex;align-items:center;justify-content:center">
          <div class="card" style="max-width:480px;border-color:rgba(244,63,94,0.35)">
            <div style="font-size:13px;font-weight:700;color:var(--red);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.6px">Error de configuración</div>
            <div style="font-size:15px;font-weight:600;margin-bottom:8px">Variable de entorno faltante</div>
            <p style="color:var(--muted);font-size:13px;line-height:1.6">
              El servidor no tiene configurada la variable <code>KIWY_HQ_TOKEN</code>.<br><br>
              Ve a <strong>Vercel → Settings → Environment Variables</strong>, agrega
              <code>KIWY_HQ_TOKEN</code> con un valor seguro y redeploya.
            </p>
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
