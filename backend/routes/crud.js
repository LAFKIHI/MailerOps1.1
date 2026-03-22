// =============================================================================
// MailerOps - Generic CRUD Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const { validateForCollection, sanitizeCollection } = require('../lib/validation');
const { cascadeDeleteIfNeeded } = require('../lib/cascadeDelete');
const { ValidationError, NotFoundError } = require('../middleware/error');

function getUserId(req) {
  return String(req.userId || '');
}

function getStore(req) {
  return req.app.locals.store;
}

// ─── List ───────────────────────────────────────────────────────────────────

router.get('/:collection', async (req, res, next) => {
  try {
    const collection = sanitizeCollection(req.params.collection);
    const userId = getUserId(req);

    if (!collection) {
      return res.status(400).json({ error: 'Invalid collection' });
    }

    const { filters, limit, skip, sort } = req.query;
    let parsedFilters = {};
    if (filters) {
      try { parsedFilters = JSON.parse(filters); } catch (e) {}
    }
    
    // Note: The new stores use limit/skip/sort internally or via the list call
    const options = {
      limit: limit ? parseInt(limit) : 1000,
      skip: skip ? parseInt(skip) : 0,
      sort: sort ? JSON.parse(sort) : { createdAt: -1 }
    };

    const rows = await getStore(req).list(collection, userId, parsedFilters, options);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// ─── Get Single ─────────────────────────────────────────────────────────────

router.get('/:collection/:id', async (req, res, next) => {
  try {
    const collection = sanitizeCollection(req.params.collection);
    const id = String(req.params.id || '').trim();
    const userId = getUserId(req);

    if (!collection || !id) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const row = await getStore(req).get(collection, userId, id);
    if (!row) throw new NotFoundError(`${collection} item not found`);

    res.json(row);
  } catch (error) {
    next(error);
  }
});

// ─── Create ─────────────────────────────────────────────────────────────────

router.post('/:collection', async (req, res, next) => {
  try {
    const collection = sanitizeCollection(req.params.collection);
    const userId = getUserId(req);

    if (!collection) {
      return res.status(400).json({ error: 'Invalid collection' });
    }

    const validation = validateForCollection(collection, req.body, false);
    if (!validation.isValid) {
      throw new ValidationError('Validation failed', validation.errors);
    }

    // Auto-link IP to Server if missing but Domain is present
    if (collection === 'ips' && !req.body.serverId && req.body.domainId) {
      const domain = await getStore(req).get('domains', userId, req.body.domainId);
      if (domain && domain.serverId) {
        req.body.serverId = domain.serverId;
      }
    }

    const row = await getStore(req).create(collection, userId, req.body || {});
    res.json(row);
  } catch (error) {
    next(error);
  }
});

// ─── Update ─────────────────────────────────────────────────────────────────

router.put('/:collection/:id', async (req, res, next) => {
  try {
    const collection = sanitizeCollection(req.params.collection);
    const id = String(req.params.id || '').trim();
    const userId = getUserId(req);

    if (!collection || !id) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const validation = validateForCollection(collection, req.body, true);
    if (!validation.isValid) {
      throw new ValidationError('Validation failed', validation.errors);
    }

    const row = await getStore(req).update(collection, userId, id, req.body || {});
    if (!row) throw new NotFoundError(`${collection} item not found`);

    res.json(row);
  } catch (error) {
    next(error);
  }
});

// ─── Delete ─────────────────────────────────────────────────────────────────

router.delete('/:collection/:id', async (req, res, next) => {
  try {
    const collection = sanitizeCollection(req.params.collection);
    const id = String(req.params.id || '').trim();
    const userId = getUserId(req);

    if (!collection || !id) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Attempt cascade delete first
    const cascaded = await cascadeDeleteIfNeeded(getStore(req), userId, collection, id);
    
    if (!cascaded) {
      const deleted = await getStore(req).delete(collection, userId, id);
      if (!deleted) throw new NotFoundError(`${collection} item not found`);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
