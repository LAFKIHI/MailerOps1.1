const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

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

app.get('/:collection', async (req, res) => {
  try {
    const collection = sanitizeCollection(req.params.collection);
    const userId = getUserId(req);

    if (!collection) {
      return res.status(400).json({ error: 'Invalid collection' });
    }

    const rows = await getStore(req).list(collection, userId);
    res.json(rows);
  } catch (error) {
    console.error('[collection:list] error', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Failed to list records' });
  }
});

app.get('/:collection/:id', async (req, res) => {
  try {
    const collection = sanitizeCollection(req.params.collection);
    const id = String(req.params.id || '').trim();
    const userId = getUserId(req);

    if (!collection || !id) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const row = await getStore(req).get(collection, userId, id);
    if (!row) return res.status(404).json({ error: 'Not found' });

    res.json(row);
  } catch (error) {
    console.error('[collection:get] error', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Failed to load record' });
  }
});

app.post('/:collection', async (req, res) => {
  try {
    const collection = sanitizeCollection(req.params.collection);
    const userId = getUserId(req);

    if (!collection) {
      return res.status(400).json({ error: 'Invalid collection' });
    }

    const row = await getStore(req).create(collection, userId, req.body || {});
    res.json(row);
  } catch (error) {
    console.error('[collection:create] error', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Create failed' });
  }
});

app.put('/:collection/:id', async (req, res) => {
  try {
    const collection = sanitizeCollection(req.params.collection);
    const id = String(req.params.id || '').trim();
    const userId = getUserId(req);

    if (!collection || !id) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const row = await getStore(req).update(collection, userId, id, req.body || {});
    if (!row) return res.status(404).json({ error: 'Not found' });

    res.json(row);
  } catch (error) {
    console.error('[collection:update] error', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Update failed' });
  }
});

app.delete('/:collection/:id', async (req, res) => {
  try {
    const collection = sanitizeCollection(req.params.collection);
    const id = String(req.params.id || '').trim();
    const userId = getUserId(req);

    if (!collection || !id) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const deleted = await getStore(req).delete(collection, userId, id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });

    res.json({ success: true });
  } catch (error) {
    console.error('[collection:delete] error', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Delete failed' });
  }
});

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
