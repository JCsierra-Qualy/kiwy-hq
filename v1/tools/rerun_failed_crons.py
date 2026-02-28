#!/usr/bin/env python3
import json, subprocess

raw = subprocess.run("openclaw cron list --json", shell=True, capture_output=True, text=True)
if raw.returncode != 0:
    print("No se pudo listar crons")
    raise SystemExit(1)

jobs = json.loads(raw.stdout).get("jobs", [])
failed = [j for j in jobs if j.get("enabled") and j.get("state", {}).get("lastStatus") == "error"]
for j in failed:
    jid = j.get("id")
    name = j.get("name")
    r = subprocess.run(f"openclaw cron run --id {jid} --force", shell=True, capture_output=True, text=True)
    print(f"{name}: {'OK' if r.returncode==0 else 'FAIL'}")

if not failed:
    print("Sin crons fallidos")
