#!/usr/bin/env python3
import json
import os
import re
import subprocess
from datetime import datetime, timezone

ROOT = "/home/ubuntu/.openclaw/workspace"
OUT = os.path.join(ROOT, "hq", "v1", "data", "summary.json")
MEET_STATE = os.path.join(ROOT, "qualiver", "state", "google_record_meetings_state.json")
HEARTBEAT = os.path.join(ROOT, "HEARTBEAT.md")
OPS_SCRIPT = os.path.join(ROOT, "qualiver", "qualiver_ops_report.py")


def run(cmd: str) -> str:
    p = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return p.stdout if p.returncode == 0 else ""


def parse_json_cmd(cmd: str, fallback=None):
    txt = run(cmd).strip()
    if not txt:
        return fallback if fallback is not None else {}
    try:
        return json.loads(txt)
    except Exception:
        return fallback if fallback is not None else {}


def parse_ops(text):
    out = {"kpis": {}, "projects": [], "critical_tasks": []}
    m = re.search(r"KPIs:\s*total=(\d+)\s*\|\s*abiertas=(\d+)\s*\|\s*vencidas_operativas=(\d+)\s*\|\s*validando=(\d+)\s*\|\s*validando_fuera_plazo=(\d+)\s*\|\s*bloqueadas=(\d+)", text)
    if m:
        out["kpis"] = {
            "total": int(m.group(1)), "abiertas": int(m.group(2)), "vencidas_operativas": int(m.group(3)),
            "validando": int(m.group(4)), "validando_fuera_plazo": int(m.group(5)), "bloqueadas": int(m.group(6)),
        }

    sem_block = text.split("Semáforo por proyecto (top 8 por carga):")
    if len(sem_block) > 1:
        part = sem_block[1].split("Semáforo por meta", 1)[0]
        for line in part.splitlines():
            line = line.strip()
            if not line.startswith("-"):
                continue
            pm = re.match(r"-\s*(\S+)\s+(.*?)\s*\|\s*(.*?)\s*\|\s*abiertas=(\d+)\s*\|\s*vencidas_operativas=(\d+)\s*\|\s*bloqueadas=(\d+)\s*\|\s*validando=(\d+)", line)
            if pm:
                out["projects"].append({
                    "semaforo": pm.group(1), "codigo": pm.group(2), "nombre": pm.group(3),
                    "abiertas": int(pm.group(4)), "vencidas": int(pm.group(5)), "bloqueadas": int(pm.group(6)), "validando": int(pm.group(7)),
                })

    crit_block = text.split("Tareas críticas (top 10, excluye Validando):")
    if len(crit_block) > 1:
        for line in crit_block[1].splitlines():
            line = line.strip()
            if line.startswith("-"):
                out["critical_tasks"].append(line[2:])

    return out


def parse_skills(text: str):
    skills = []
    for line in text.splitlines():
        if not line.startswith("│") or ("✓ ready" not in line and "✗ missing" not in line):
            continue
        parts = [p.strip() for p in line.split("│")]
        if len(parts) < 5:
            continue
        skills.append({
            "status": "ready" if "✓" in parts[1] else "missing",
            "name": parts[2], "description": parts[3], "source": parts[4], "installedLocal": False,
        })
    return skills


def scan_local_private_skills():
    base = os.path.join(ROOT, "skills", "private")
    found = []
    if not os.path.isdir(base):
        return found
    for slug in sorted(os.listdir(base)):
        sk = os.path.join(base, slug, "SKILL.md")
        if not os.path.isfile(sk):
            continue
        found.append({"status": "ready", "name": slug, "description": "Local private skill", "source": "local-private", "installedLocal": True})
    return found


def collect_token_activity(enabled_jobs):
    activity, ti, to, tt = [], 0, 0, 0
    for j in enabled_jobs:
        runs = parse_json_cmd(f"openclaw cron runs --id {j.get('id')}", fallback={}).get("entries", [])
        recent = [e for e in runs[:10] if e.get("usage")]
        it = sum(int(e.get("usage", {}).get("input_tokens", 0)) for e in recent)
        ot = sum(int(e.get("usage", {}).get("output_tokens", 0)) for e in recent)
        tot = sum(int(e.get("usage", {}).get("total_tokens", 0)) for e in recent)
        if tot > 0:
            activity.append({"job": j.get("name"), "jobId": j.get("id"), "input_tokens": it, "output_tokens": ot, "total_tokens": tot})
            ti += it; to += ot; tt += tot
    activity.sort(key=lambda x: x["total_tokens"], reverse=True)
    return {"total_tokens_recent": tt, "input_tokens_recent": ti, "output_tokens_recent": to, "by_activity": activity[:12]}


def collect_history(enabled_jobs, limit=40):
    items = []
    for j in enabled_jobs:
        runs = parse_json_cmd(f"openclaw cron runs --id {j.get('id')}", fallback={}).get("entries", [])
        for e in runs[:8]:
            u = e.get("usage", {}) or {}
            items.append({
                "ts": e.get("ts", 0), "job": j.get("name"), "status": e.get("status", "unknown"),
                "tokens": int(u.get("total_tokens", 0) or 0),
                "detail": (e.get("summary") or e.get("error") or "").replace("\n", " ")[:200],
            })
    items.sort(key=lambda x: x.get("ts", 0), reverse=True)
    return items[:limit]


def scan_relay_requests(max_items=20):
    findings = []
    for name in os.listdir(ROOT):
        if not name.endswith(".jsonl"):
            continue
        p = os.path.join(ROOT, name)
        try:
            lines = open(p, "r", encoding="utf-8").readlines()[-300:]
        except Exception:
            continue
        for ln in lines:
            if "RELAY de" not in ln:
                continue
            m = re.search(r"RELAY de\s*\[?([+\d]+)\]?\s*:\s*(.+)$", ln)
            if m:
                findings.append({"from": m.group(1), "message": m.group(2)[:180]})
            else:
                findings.append({"from": "desconocido", "message": ln[:180]})
            if len(findings) >= max_items:
                return findings
    return findings


def build_recommendations(kpis, errored):
    recs = []
    if kpis.get("vencidas_operativas", 0) >= 10:
        recs.append({"id": "run_ops_report_now", "title": "Correr corte operativo ahora", "why": "Hay muchas vencidas operativas.", "impact": "Te doy un plan de choque actualizado para hoy."})
    if errored:
        recs.append({"id": "rerun_failed_crons", "title": "Reintentar automatizaciones con error", "why": f"Hay {len(errored)} cron(s) en error.", "impact": "Reducimos ruido y recuperamos flujo automático."})
    recs.append({"id": "run_meeting_monitor_now", "title": "Revisar reuniones nuevas ahora", "why": "Garantizar que no se perdió ninguna acción crítica.", "impact": "Se crean tareas y resumen inmediato si hay novedades."})
    return recs[:4]


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    cron_data = parse_json_cmd("openclaw cron list --json", fallback={"jobs": []})
    jobs = cron_data.get("jobs", [])
    enabled = [j for j in jobs if j.get("enabled")]
    errored = [j for j in enabled if j.get("state", {}).get("lastStatus") == "error"]

    ops = parse_ops(run(f"python3 {OPS_SCRIPT}"))
    kpis = ops.get("kpis", {})
    meetings = json.load(open(MEET_STATE, "r", encoding="utf-8")) if os.path.exists(MEET_STATE) else {}
    hb = open(HEARTBEAT, "r", encoding="utf-8").read() if os.path.exists(HEARTBEAT) else ""

    skills = parse_skills(run("openclaw skills list"))
    names = {s["name"].lower() for s in skills}
    for lp in scan_local_private_skills():
        if lp["name"].lower() not in names:
            skills.append(lp)

    agents = sorted(set([j.get("agentId", "main") for j in jobs]))
    token_activity = collect_token_activity(enabled)
    history = collect_history(enabled, 50)
    relay_requests = scan_relay_requests(20)

    pm_status = "En control"
    if kpis.get("vencidas_operativas", 0) >= 15 or kpis.get("bloqueadas", 0) >= 4:
        pm_status = "Atención alta"

    data = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "hq_version": "v2-pm",
        "pm": {
            "title": "Project Management · Qualiver",
            "status": pm_status,
            "summary": f"Abiertas: {kpis.get('abiertas', 0)} · Vencidas operativas: {kpis.get('vencidas_operativas', 0)} · Bloqueadas: {kpis.get('bloqueadas', 0)}",
            "proposals": build_recommendations(kpis, errored),
        },
        "tokens": token_activity,
        "automation": {
            "cron_total": len(jobs), "cron_enabled": len(enabled), "cron_error": len(errored),
            "cron_ok": max(0, len(enabled) - len(errored)), "history": history,
        },
        "ops": ops,
        "meetings": {"last_review_utc": meetings.get("last_review_utc"), "processed_count": len(meetings.get("processed_docs", [])), "last_docs": meetings.get("processed_docs", [])[-8:]},
        "heartbeat": {"configured": bool(hb.strip()), "has_meeting_flow": "Drive — Shared Kiwy (Reuniones)" in hb},
        "skills": {"all": skills, "ready": [s for s in skills if s.get("status") == "ready"], "missing": [s for s in skills if s.get("status") == "missing"]},
        "agents": {"ids": agents, "total": len(agents), "jobs_by_agent": {aid: len([j for j in jobs if j.get("agentId") == aid]) for aid in agents}},
        "team": {
            "members": [
                {"id": "1152456698", "name": "Juan Camilo Sierra Ramirez"},
                {"id": "1039451589", "name": "Natalia Jimenez"},
                {"id": "525936", "name": "Guillermo Souto"},
                {"id": "1003059949", "name": "Jose Ortiz"},
                {"id": "1013457030", "name": "Yenifer Mazo"}
            ],
            "conversations": {
                "status": "partial",
                "note": "Vista parcial de solicitudes externas detectadas por relay/log local.",
                "relay_requests": relay_requests,
            }
        },
    }

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"HQ snapshot actualizado: {OUT}")


if __name__ == "__main__":
    main()
