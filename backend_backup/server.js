const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const {
  validateServer,
  validateDomain,
  validateIP,
  validateWarmup,
  validateSendingLog,
  validateReputation,
  validatePostmasterRaw
} = require('./lib/validation');
const { errorHandler, ValidationError, NotFoundError } = require('./middleware/error');

const getValidator = (collection) => {
  const validators = {
    servers: validateServer,
    domains: validateDomain,
    ips: validateIP,
    warmups: validateWarmup,
    sending_logs: validateSendingLog,
    reputation: validateReputation,
    postmaster_raw: validatePostmasterRaw
  };
  return validators[collection];
};

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { createMongoStore } = require('./lib/mongoStore');
const { createSqliteStore } = require('./lib/sqliteStore');
const { sanitizeCollection } = require('./lib/mongo');

const SQLITE_DB_FILE = path.join(__dirname, 'data.sqlite');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function getUserId(req) {
  return String(req.query.userId || 'default');
}

function getStore(req) {
  return req.app.locals.store;
}

app.post('/_reset', async (req, res) => {
  await getStore(req).reset();
  res.json({ success: true });
});

app.post('/api/json-upload', async (req, res) => {
  try {
    const store = getStore(req);
    const userId = getUserId(req);
    const { data } = req.body || {};

    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid JSON format' });
    }

    if (data.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
      return res.status(400).json({ error: 'Invalid JSON format' });
    }

    const result = await store.insertPostmasterRaw(userId, data);
    res.json(result);
  } catch (error) {
    console.error('[api/json-upload] error', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Upload failed' });
  }
});

app.get('/oauth/callback', (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('No code');

  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>OAuth Callback</title></head>
      <body>
        <p>Authenticating...</p>
        <script>
          if (window.electron) {
            window.electron.ipcRenderer.send('oauth-code', '${code}');
            window.close();
          } else {
            document.body.innerHTML = 'Not in Electron app';
          }
        </script>
      </body>
    </html>
  `);
});

// --- SHADOW INTELLIGENCE LAYER ---
app.post('/api/sending-logs', async (req, res) => {
  try {
    const store = getStore(req);
    const userId = getUserId(req);
    const data = req.body || {};
    await store.create('sending_logs', userId, data);
    res.json({ success: true });
  } catch (err) {
    console.warn('[shadow-layer] logging sending failed', err?.message);
    res.json({ success: false });
  }
});

app.get('/api/ip-stats/:ipId', async (req, res) => {
  try {
    const store = getStore(req);
    const userId = getUserId(req);
    const ipId = req.params.ipId;
    
    const logs = await store.list('sending_logs', userId);
    const ipLogs = logs.filter(l => l.ip_id === ipId);
    
    let total_sent = 0;
    let total_success = 0;
    let total_fail = 0;
    
    for (const log of ipLogs) {
      total_sent += Number(log.sent_count || 0);
      total_success += Number(log.success_count || 0);
      total_fail += Number(log.fail_count || 0);
    }
    
    const success_rate = total_sent > 0 ? (total_success / total_sent) : 0;
    const fail_rate = total_sent > 0 ? (total_fail / total_sent) : 0;
    
    res.json({ total_sent, success_rate, fail_rate });
  } catch (err) {
    res.json({ total_sent: 0, success_rate: 0, fail_rate: 0 });
  }
});

app.get('/api/delivery-health/:deliveryId', async (req, res) => {
  try {
    const store = getStore(req);
    const userId = getUserId(req);
    const deliveryId = req.params.deliveryId;
    
    const delivery = await store.get('deliveries', userId, deliveryId);
    if (!delivery) return res.json({ active: 0, disabled: 0, ratio: 0, health_score: 0 });
    
    const total = Number(delivery.totalBoxes) || 0;
    const active = Number(delivery.currentBoxes) || 0;
    const disabled = total - active;
    const ratio = total > 0 ? active / total : 0;
    
    res.json({ active, disabled, ratio, health_score: Math.round(ratio * 100) });
  } catch (err) {
    res.json({ active: 0, disabled: 0, ratio: 0, health_score: 0 });
  }
});

let isUpdating = false;
async function updateIPStatsBackground() {
  if (isUpdating || !app.locals.store) return;
  isUpdating = true;
  try {
    const store = app.locals.store;
    const userId = 'default';
    
    const ips = await store.list('ips', userId) || [];
    const logs = await store.list('sending_logs', userId) || [];
    
    for (const ip of ips) {
      const ipLogs = logs.filter(l => l.ip_id === ip.id);
      let total_sent = 0;
      let total_success = 0;
      for (const log of ipLogs) {
        total_sent += Number(log.sent_count || 0);
        total_success += Number(log.success_count || 0);
      }
      const success_rate = total_sent > 0 ? (total_success / total_sent) : 0;
      
      await store.update('ips', userId, ip.id, {
        total_sent,
        health_score: Math.round(success_rate * 100)
      });
    }
  } catch (err) {
    console.warn('[shadow-layer] background updater failed', err?.message);
  } finally {
    isUpdating = false;
  }
}
setInterval(updateIPStatsBackground, 10 * 60 * 1000);
// --- END SHADOW LAYER ---

app.post('/servers/bulk-action', async (req, res) => {
  try {
    const store = getStore(req);
    const userId = getUserId(req);
    const result = await store.executeServerBulkAction(userId, req.body || {});
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[api/servers/bulk-action] error', error);
    res.status(error?.status || 500).json({
      error: error?.message || 'Bulk action failed',
      details: error?.details,
    });
  }
});

app.post('/api/servers/bulk-warmup', async (req, res) => {
  try {
    const store = getStore(req);
    const userId = getUserId(req);
    const { serverIds, count, date } = req.body || {};

    if (!Array.isArray(serverIds) || !count || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const numericCount = Number(count);
    if (!Number.isInteger(numericCount) || numericCount < 0) {
      return res.status(400).json({ error: 'Count must be a positive integer' });
    }

    const domains = await store.list('domains', userId);
    const ips = await store.list('ips', userId);
    const warmups = await store.list('warmups', userId);

    const relevantDomains = domains.filter(d => serverIds.includes(d.serverId));
    const domainIds = relevantDomains.map(d => d.id);
    const relevantIps = ips.filter(ip => domainIds.includes(ip.domainId));

    for (const ip of relevantIps) {
      const existing = warmups.find(w => w.ipId === ip.id && w.date === date);
      if (existing) {
        await store.update('warmups', userId, existing.id, { sent: numericCount });
      } else {
        await store.create('warmups', userId, {
          ipId: ip.id,
          date,
          sent: numericCount
        });
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error('[api/servers/bulk-warmup] error', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Bulk warmup failed' });
  }
});

app.get('/:collection', async (req, res, next) => {
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

app.get('/:collection/:id', async (req, res, next) => {
  try {
    const collection = sanitizeCollection(req.params.collection);
    const id = String(req.params.id || '').trim();
    const userId = getUserId(req);

    if (!collection || !id) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const row = await getStore(req).get(collection, userId, id);
    if (!row) throw new NotFoundError('Not found');

    res.json(row);
  } catch (error) {
    next(error);
  }
});

app.post('/:collection', async (req, res, next) => {
  try {
    const collection = sanitizeCollection(req.params.collection);
    const userId = getUserId(req);

    if (!collection) {
      return res.status(400).json({ error: 'Invalid collection' });
    }

    const validator = getValidator(collection);
    if (validator) {
      const validation = validator(req.body);
      if (!validation.isValid) {
        throw new ValidationError('Validation failed', validation.errors);
      }
    }

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

app.put('/:collection/:id', async (req, res, next) => {
  try {
    const collection = sanitizeCollection(req.params.collection);
    const id = String(req.params.id || '').trim();
    const userId = getUserId(req);

    if (!collection || !id) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const validator = getValidator(collection);
    if (validator) {
      const validation = validator(req.body);
      if (!validation.isValid) {
        throw new ValidationError('Validation failed', validation.errors);
      }
    }

    const row = await getStore(req).update(collection, userId, id, req.body || {});
    if (!row) throw new NotFoundError('Not found');

    res.json(row);
  } catch (error) {
    next(error);
  }
});

app.delete('/:collection/:id', async (req, res, next) => {
  try {
    const collection = sanitizeCollection(req.params.collection);
    const id = String(req.params.id || '').trim();
    const userId = getUserId(req);

    if (!collection || !id) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    if (collection === 'servers') {
      await getStore(req).cascadeDeleteServer(userId, id);
    } else if (collection === 'domains') {
      await getStore(req).cascadeDeleteDomain(userId, id);
    } else {
      const deleted = await getStore(req).delete(collection, userId, id);
      if (!deleted) throw new NotFoundError('Not found');
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.use(errorHandler);

async function createStore() {
  try {
    const mongoStore = await createMongoStore();
    console.log('Storage mode: MongoDB');
    return mongoStore;
  } catch (error) {
    console.warn(`MongoDB unavailable, falling back to SQLite: ${error?.message || error}`);
    const sqliteStore = createSqliteStore(SQLITE_DB_FILE);
    console.log('Storage mode: SQLite');
    return sqliteStore;
  }
}

async function startServer() {
  const store = await createStore();
  const port = process.env.PORT || 3000;

  app.locals.store = store;

  app.listen(port, () => {
    console.log(`API running on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start API', error);
  process.exit(1);
});
