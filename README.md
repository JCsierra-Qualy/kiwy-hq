# Kiwy HQ (MVP)

Internal portal (port **3334**) for Juan + Kiwy.

## Run

```bash
cd repos/kiwy-hq
npm install
npm run build
PORT=3334 npm start
```

Dev mode:

```bash
npm run build && npm run dev
```

## Notes
- Secrets will be stored locally under `data/` (not committed).
- Reverse proxy + HTTPS can be added later via your subdomain.
