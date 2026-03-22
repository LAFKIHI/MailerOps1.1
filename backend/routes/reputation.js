// =============================================================================
// MailerOps - Reputation API Routes
// =============================================================================

const express = require('express');
const router = express.Router();

function getUserId(req) {
  return String(req.userId || '');
}

function getStore(req) {
  return req.app.locals.store;
}

// ─── Reputation Upsert ──────────────────────────────────────────────────────

/**
 * POST /reputation/upsert
 * Body: { domainId, date, domainRep, ipRep, spamRate }
 */
router.post('/upsert', async (req, res) => {
  try {
    const { domainId, date, ...data } = req.body;
    const userId = getUserId(req);
    const store = getStore(req);

    if (!domainId || !date) {
      return res.status(400).json({ error: 'domainId and date are required' });
    }

    // Attempt to find existing record for this domain and date
    const existing = await store.findOne('reputation', userId, { domainId, date });

    if (existing) {
      // Update existing record
      const updated = await store.update('reputation', userId, existing.id, { ...data, date });
      return res.json(updated);
    } else {
      // Create new record
      const created = await store.create('reputation', userId, { domainId, date, ...data });
      return res.status(201).json(created);
    }
  } catch (error) {
    console.error('[reputation-upsert] error', error);
    res.status(500).json({ error: error?.message || 'Upsert failed' });
  }
});

// ─── Duplicate Cleanup ──────────────────────────────────────────────────────

/**
 * POST /reputation/cleanup
 * Removes duplicate reputation records keeping only the most recently updated.
 */
router.post('/cleanup', async (req, res) => {
  try {
    const store = getStore(req);
    const userId = getUserId(req);
    
    const reputations = await store.list('reputation', userId);
    const grouped = new Map(); // key: domainId|date

    for (const rep of reputations) {
      const key = `${rep.domainId}|${rep.date}`;
      if (!grouped.has(key) || new Date(rep.updatedAt) > new Date(grouped.get(key).updatedAt)) {
        grouped.set(key, rep);
      }
    }

    const toKeep = new Set(Array.from(grouped.values()).map(r => r.id));
    const toDelete = reputations.filter(r => !toKeep.has(r.id));

    let deletedCount = 0;
    for (const rep of toDelete) {
      const success = await store.delete('reputation', userId, rep.id);
      if (success) deletedCount++;
    }

    res.json({ success: true, deleted: deletedCount });
  } catch (error) {
    console.error('[reputation-cleanup] error', error);
    res.status(500).json({ error: error?.message || 'Cleanup failed' });
  }
});

module.exports = router;
