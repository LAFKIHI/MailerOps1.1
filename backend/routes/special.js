// =============================================================================
// MailerOps - Specialized API Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const { handleBulkWarmup } = require('../lib/serverBulkActions');
const { calculateIPStats, calculateDeliveryHealth } = require('../lib/businessLogic');
const { validatePostmasterRaw } = require('../lib/validation');

function getUserId(req) {
  return String(req.userId || '');
}

function getStore(req) {
  return req.app.locals.store;
}

// ─── DB Reset (Dev Only) ────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  router.post('/_reset', async (req, res) => {
    if (!process.env.ADMIN_USER_ID || req.userId !== process.env.ADMIN_USER_ID) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await getStore(req).resetAll(req.userId);
    res.json({ success: true });
  });
}

// ─── JSON / Postmaster Upload ───────────────────────────────────────────────

router.post('/json-upload', async (req, res) => {
  try {
    const store = getStore(req);
    const userId = getUserId(req);
    const { data } = req.body || {};

    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid JSON format: expected array' });
    }

    const validRows = [];
    for (const row of data) {
      const validation = validatePostmasterRaw({ data: row, processed: false }, false);
      if (validation.isValid) validRows.push(row);
    }

    for (const row of validRows) {
      await store.create('postmaster_raw', userId, { data: row, processed: false });
    }

    res.json({ success: true, inserted: validRows.length, total: data.length });
  } catch (error) {
    console.error('[json-upload] error', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Upload failed' });
  }
});

// ─── IP Statistics ──────────────────────────────────────────────────────────

router.get('/ip-stats/:ipId', async (req, res) => {
  try {
    const store = getStore(req);
    const userId = getUserId(req);
    const ipId = req.params.ipId;
    
    const logs = await store.list('sending_logs', userId);
    const ipLogs = logs.filter(l => l.ipId === ipId || l.ip_id === ipId);
    
    const stats = calculateIPStats(ipLogs);
    res.json(stats);
  } catch (err) {
    res.json({ total_sent: 0, success_rate: 0, fail_rate: 0, health_score: 0 });
  }
});

// ─── Delivery Health ────────────────────────────────────────────────────────

router.get('/delivery-health/:deliveryId', async (req, res) => {
  try {
    const store = getStore(req);
    const userId = getUserId(req);
    const deliveryId = req.params.deliveryId;
    
    const delivery = await store.get('deliveries', userId, deliveryId);
    if (!delivery) return res.json({ active: 0, disabled: 0, ratio: 0, health_score: 0 });
    
    const accounts = await store.listByField('accounts', userId, 'delivery_id', deliveryId);
    const health = accounts.length > 0
      ? calculateDeliveryHealth(accounts)
      : (() => {
          const active = Math.max(0, Number(delivery.currentBoxes || 0));
          const total = Math.max(active, Number(delivery.totalBoxes || 0));
          const disabled = Math.max(0, total - active);
          const ratio = total > 0 ? Math.round((active / total) * 100) / 100 : 0;
          return { active, disabled, ratio, health_score: Math.round(ratio * 100) };
        })();
    
    res.json(health);
  } catch (err) {
    res.json({ active: 0, disabled: 0, ratio: 0, health_score: 0 });
  }
});

// ─── Bulk Warmup ────────────────────────────────────────────────────────────

router.post('/servers/bulk-warmup', async (req, res) => {
  try {
    const store = getStore(req);
    const userId = getUserId(req);
    const result = await handleBulkWarmup(store, userId, req.body || {});
    res.json(result);
  } catch (error) {
    console.error('[bulk-warmup] error', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Bulk warmup failed' });
  }
});

module.exports = router;
