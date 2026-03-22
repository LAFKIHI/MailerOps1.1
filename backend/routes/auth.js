// =============================================================================
// MailerOps - Auth Routes
// =============================================================================

const express = require('express');
const router = express.Router();

// ─── OAuth Callback (for Electron) ──────────────────────────────────────────

router.get('/callback', (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('No authorization code provided');
  const serializedCode = JSON.stringify(String(code));

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>OAuth Callback</title>
        <style>
          body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: white; margin: 0; }
          .card { background: #1e293b; padding: 2rem; border-radius: 0.75rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Authentication Successful</h2>
          <p>You can close this window now.</p>
        </div>
        <script>
          if (window.electron) {
            window.electron.ipcRenderer.send('oauth-code', ${serializedCode});
            setTimeout(() => window.close(), 1000);
          } else {
            // Fallback for browser-only testing
            console.log('OAuth Code:', ${serializedCode});
          }
        </script>
      </body>
    </html>
  `);
});

module.exports = router;
