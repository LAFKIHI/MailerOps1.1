// =============================================================================
// MailerOps - Server Specific Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const { handleBulkAction } = require('../lib/serverBulkActions');

function getUserId(req) {
  return String(req.userId || '');
}

function getStore(req) {
  return req.app.locals.store;
}

// ─── Bulk Actions ───────────────────────────────────────────────────────────

router.post('/bulk-action', async (req, res) => {
  try {
    const store = getStore(req);
    const userId = getUserId(req);
    const result = await handleBulkAction(store, userId, req.body || {});
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[servers/bulk-action] error', error);
    res.status(error?.status || 500).json({
      error: error?.message || 'Bulk action failed',
      details: error?.details,
    });
  }
});

module.exports = router;
