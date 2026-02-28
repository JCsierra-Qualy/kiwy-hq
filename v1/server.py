#!/usr/bin/env python3
import json
import os
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE = "/home/ubuntu/.openclaw/workspace/hq/v1"
SUMMARY = os.path.join(BASE, "data", "summary.json")

ACTION_MAP = {
    "run_ops_report_now": "python3 /home/ubuntu/.openclaw/workspace/qualiver/qualiver_ops_report.py | head -n 80",
    "rerun_failed_crons": "python3 /home/ubuntu/.openclaw/workspace/hq/v1/tools/rerun_failed_crons.py",
    "run_meeting_monitor_now": "openclaw cron run --id 72fb1bef-ead1-402a-86f3-955966861ba1 --force",
}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE, **kwargs)

    def _send_json(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path.startswith("/api/summary"):
            if not os.path.exists(SUMMARY):
                return self._send_json(404, {"ok": False, "error": "summary not found"})
            data = json.load(open(SUMMARY, "r", encoding="utf-8"))
            return self._send_json(200, {"ok": True, "data": data})
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/approve"):
            ln = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(ln) if ln > 0 else b"{}"
            try:
                body = json.loads(raw.decode("utf-8"))
            except Exception:
                body = {}
            aid = body.get("actionId")
            cmd = ACTION_MAP.get(aid)
            if not cmd:
                return self._send_json(400, {"ok": False, "error": "unknown action"})
            p = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            return self._send_json(200, {
                "ok": p.returncode == 0,
                "actionId": aid,
                "stdout": (p.stdout or "")[:1200],
                "stderr": (p.stderr or "")[:1200],
                "code": p.returncode,
            })
        return self._send_json(404, {"ok": False, "error": "not found"})

if __name__ == "__main__":
    os.makedirs(os.path.join(BASE, "data"), exist_ok=True)
    httpd = ThreadingHTTPServer(("0.0.0.0", 3340), Handler)
    print("HQ server running on :3340")
    httpd.serve_forever()
