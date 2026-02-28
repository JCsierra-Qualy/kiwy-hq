# PDR — Kiwy HQ (Project Management Command Center)

## 1) Resumen ejecutivo
Kiwy HQ es el centro de comando para operación de Qualiver: estado global, automatizaciones, riesgos, propuestas accionables de Kiwy y trazabilidad básica de solicitudes externas.

Objetivo: que Juan vea cómo va todo, qué propone ejecutar Kiwy, y aprobar ejecución desde el panel.

## 2) Problema
La operación está fragmentada (cron outputs, chats, scripts, reportes sueltos). Se necesita un solo lugar para:
- entender salud operativa rápida,
- ver tokens/costo de actividad,
- revisar señales de riesgo,
- ejecutar acciones concretas aprobadas.

## 3) Objetivos
1. Visión ejecutiva en < 30s.
2. Mostrar “qué va a hacer Kiwy” (no solo lo del equipo).
3. Aprobar acciones desde UI con feedback de ejecución.
4. Trazar solicitudes externas y alertas.
5. Mantener diseño usable, no saturado.

## 4) Usuarios
- Owner (Juan): decisión y control.
- Kiwy (operación autónoma): propone, ejecuta, reporta.

## 5) Alcance funcional (actual)
### Tabs
- Overview: KPIs, tokens recientes, historial operativo.
- Projects: propuestas de Kiwy + vista compacta por proyecto.
- Team: miembros + solicitudes externas detectadas.
- Skills: búsqueda y detalle clickeable.

### Propuestas aprobables
Botón “Aprobar y ejecutar” dispara backend y devuelve resultado.

### Estado PM arriba
- `Project Management · Qualiver`
- Estado general + resumen ejecutivo.

## 6) Acciones aprobables (actual mapping)
En `hq/v1/server.py` (`ACTION_MAP`):
- `run_ops_report_now`
- `rerun_failed_crons`
- `run_meeting_monitor_now`

Flujo:
1. UI `POST /api/approve`
2. server ejecuta comando
3. devuelve `ok/error + stdout/stderr`
4. UI refresca resumen

## 7) Arquitectura
### Frontend
- `hq/v1/index.html` (SPA vanilla JS + CSS)

### Backend local
- `hq/v1/server.py`
  - `GET /api/summary`
  - `POST /api/approve`

### Data pipeline
- `hq/v1/refresh_hq.py` genera `hq/v1/data/summary.json`
- cron de snapshot cada 20 min:
  - `HQ v1 - Refresh snapshot`

### Fuentes
- `openclaw cron list --json`
- `openclaw cron runs --id ...`
- `qualiver/qualiver_ops_report.py`
- `qualiver/state/google_record_meetings_state.json`
- `HEARTBEAT.md`
- skills list + skills locales

## 8) Modelo de datos (summary.json)
- `pm`: título, estado, resumen, propuestas
- `tokens`: totales y por actividad
- `automation`: salud + historial
- `ops`: KPIs + proyectos + tareas críticas
- `meetings`: revisión y docs recientes
- `skills`: all/ready/missing
- `agents`: ids y jobs por agente
- `team`: miembros + conversaciones parciales (relay requests)

## 9) Requisitos UX/UI
- Tema claro, limpio, no saturado.
- Neon solo en detalles (acento, botones, progreso).
- Sidebar colapsable usable (sin desbordes).
- Jerarquía clara:
  - Overview = general
  - Projects = propuestas ejecutables
- Feedback visual de ejecución:
  - estado, salida breve, recarga automática.

## 10) Requisitos no funcionales
- Carga rápida (<2s local).
- Tolerancia a fallos de fuentes (degrada sin romper UI).
- Seguridad:
  - acciones solo por backend mapeado (no comando libre desde UI).
- Operación local (127.0.0.1:3340 por defecto).

## 11) Estado actual
- UI funcional por tabs.
- Propuestas solo en Projects.
- Tokens con visual de barras.
- Skills clickeables.
- API de aprobación operativa.
- Repo GitHub listo:
  - `https://github.com/JCsierra-Qualy/kiwy-hq`
  - branch de trabajo: `kiwy/hq-ui-refresh`

## 12) Gaps abiertos
1. Conversaciones de equipo completas aún parciales (relay/log limitado).
2. Auditoría formal de aprobaciones (historial persistente por user/action).
3. Mejor contexto en salida de “Aprobar y ejecutar” (paso a paso).
4. Mejor visualización de costo/tokens por periodo (día/semana).

## 13) Roadmap recomendado
### V1.1
- Log de aprobaciones (`approvals.log`) con timestamp + resultado.
- Filtros en historial (ok/error/reuniones/automatización).
- Indicador “última acción ejecutada”.

### V1.2
- Módulo “Inbox externo” real (relay robusto).
- Confirm modal previo a ejecutar.
- Métricas de tokens por día/semana/actividad.

### V1.3
- Integración directa con GitHub issues/proyectos del HQ.
- Panel de “playbooks” (acciones compuestas en 1 clic).

## 14) Criterios de aceptación
- [ ] Owner entiende estado global en <30s.
- [ ] Puede aprobar acción desde Projects y ver resultado claro.
- [ ] Tokens legibles por actividad.
- [ ] Sidebar colapsa sin glitches.
- [ ] No hay propuestas fuera de Projects.
- [ ] Team muestra al menos miembros + solicitudes relay detectadas.

## 15) KPIs del producto HQ
- Tiempo a decisión (TTD) desde abrir HQ.
- % propuestas aprobadas y ejecutadas sin error.
- Reducción de crons en error.
- Reducción de vencidas operativas tras acciones aprobadas.
