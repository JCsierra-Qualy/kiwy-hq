import express from 'express';

export function createApp() {
  const app = express();
  app.get('/health', (_req, res) => res.json({ ok: true }));
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3334);
  const app = createApp();
  app.listen(port, '0.0.0.0', () => {
    console.log(`Kiwy HQ listening on :${port}`);
  });
}
