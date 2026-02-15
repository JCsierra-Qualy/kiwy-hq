import express from 'express';
import cookieParser from 'cookie-parser';

const AUTH_COOKIE_NAME = 'kiwy_hq_auth';

export function createApp() {
  const app = express();

  // Middleware
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: false }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.get('/', (_req, res) => {
    // Placeholder dashboard home. Protected routing is implemented in a later story.
    res.type('html').send('<h1>Kiwy HQ</h1>');
  });

  app.get('/login', (_req, res) => {
    res
      .status(200)
      .type('html')
      .send(`<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Kiwy HQ - Login</title></head>
  <body>
    <h1>Login</h1>
    <form method="post" action="/login">
      <label>Token <input type="password" name="token" autocomplete="current-password" /></label>
      <button type="submit">Login</button>
    </form>
  </body>
</html>`);
  });

  app.post('/login', (req, res) => {
    const expectedToken = process.env.KIWY_HQ_TOKEN;
    const providedToken = typeof req.body?.token === 'string' ? req.body.token : '';

    if (!expectedToken) {
      // Misconfiguration: don't reveal or log tokens.
      return res.status(500).type('text').send('Server is not configured');
    }

    if (providedToken !== expectedToken) {
      return res.status(401).type('text').send('Unauthorized');
    }

    res.cookie(AUTH_COOKIE_NAME, '1', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

    return res.redirect(302, '/');
  });

  app.post('/logout', (_req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

    return res.status(200).type('text').send('Logged out');
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3334);
  const app = createApp();
  app.listen(port, '0.0.0.0', () => {
    console.log(`Kiwy HQ listening on :${port}`);
  });
}
