const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');
const {
  normalizeIncomingDocument,
  normalizeServerDocument,
} = require('./mongo');
const {
  ACTIONS,
  createHttpError,
  normalizeServerIds,
  validateActionPayload,
} = require('./serverBulkActions');

function nowIso() {
  return new Date().toISOString();
}

function createSqliteStore(dbFile) {
  const db = new Database(dbFile);

  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      collection TEXT NOT NULL,
      userId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      data TEXT NOT NULL
    );
  `);

  const selectAllStmt = db.prepare('SELECT id, data FROM items WHERE collection = ? AND userId = ?');
  const selectOneStmt = db.prepare('SELECT id, data FROM items WHERE collection = ? AND userId = ? AND id = ?');
  const upsertStmt = db.prepare(`
    INSERT OR REPLACE INTO items (id, collection, userId, createdAt, updatedAt, data)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const deleteStmt = db.prepare('DELETE FROM items WHERE collection = ? AND userId = ? AND id = ?');
  const resetStmt = db.prepare('DELETE FROM items');

  function serialize(collection, id, data) {
    const payload = collection === 'servers' ? normalizeServerDocument(data) : data;
    return { id, ...payload };
  }

  function list(collection, userId) {
    return selectAllStmt.all(collection, userId).map(row => serialize(collection, row.id, JSON.parse(row.data)));
  }

  function get(collection, userId, id) {
    const row = selectOneStmt.get(collection, userId, id);
    return row ? serialize(collection, row.id, JSON.parse(row.data)) : null;
  }

  function create(collection, userId, data) {
    const source = data || {};
    const id = String(source.id || source._id || randomUUID()).trim();
    const now = nowIso();
    const record = {
      ...normalizeIncomingDocument(collection, source, { isCreate: true }),
      userId,
      createdAt: source.createdAt || now,
      updatedAt: now,
    };

    upsertStmt.run(id, collection, userId, record.createdAt, record.updatedAt, JSON.stringify(record));
    return serialize(collection, id, record);
  }

  function update(collection, userId, id, patch) {
    const existing = get(collection, userId, id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...normalizeIncomingDocument(collection, patch || {}, { isCreate: false }),
      userId,
      updatedAt: nowIso(),
    };

    delete updated.id;
    upsertStmt.run(id, collection, userId, existing.createdAt, updated.updatedAt, JSON.stringify(updated));
    return serialize(collection, id, updated);
  }

  function remove(collection, userId, id) {
    const result = deleteStmt.run(collection, userId, id);
    return result.changes > 0;
  }

  function updateServerRecord(server, action, value, updatedAt) {
    const next = { ...normalizeServerDocument(server), updatedAt };

    if (action === ACTIONS.updateSendPerDay) {
      next.sendPerDay = value;
      next.sentPerDay = value;
    }

    if (action === ACTIONS.change_daily_limit) {
      next.dailyLimit = value;
      next.sendPerDay = value;
    }

    if (action === ACTIONS.change_rdp) {
      next.rdp = value;
      next.group = value;
    }

    if (action === ACTIONS.startServers || action === ACTIONS.start) {
      next.runtimeStatus = 'running';
      next.status = 'active';
    }

    if (action === ACTIONS.stopServers || action === ACTIONS.stop) {
      next.runtimeStatus = 'stopped';
    }

    if (action === ACTIONS.pause) {
      next.status = 'paused';
      if (value) {
        next.pauseReason = value;
      }
    }

    if (action === ACTIONS.resume) {
      next.status = 'active';
      next.runtimeStatus = 'running';
      delete next.pauseReason;
    }

    if (action === ACTIONS.updateStatus) {
      next.status = value;
    }

    if (action === ACTIONS.assignTag) {
      next.tags = [...new Set([...(next.tags || []), value])];
    }

    if (action === ACTIONS.removeTag) {
      next.tags = (next.tags || []).filter(t => t !== value);
    }

    return next;
  }

  function executeServerBulkAction(userId, payload) {
    const action = String(payload?.action || '').trim();
    const serverIds = normalizeServerIds(payload?.serverIds);
    const value = validateActionPayload(action, payload?.value);
    const servers = serverIds.map(id => get('servers', userId, id)).filter(Boolean);

    if (servers.length !== serverIds.length) {
      const foundIds = new Set(servers.map(server => server.id));
      const missingIds = serverIds.filter(id => !foundIds.has(id));
      throw createHttpError(404, 'Some selected servers were not found', { missingIds });
    }

    const updatedAt = nowIso();

    if (action === ACTIONS.deleteServers) {
      const domains = list('domains', userId).filter(domain => serverIds.includes(domain.serverId));
      const domainIds = domains.map(domain => domain.id);
      const ips = list('ips', userId).filter(ip => domainIds.includes(ip.domainId));
      const ipIds = ips.map(ip => ip.id);
      const reputations = list('reputation', userId).filter(item => domainIds.includes(item.domainId));
      const warmups = list('warmups', userId).filter(item => ipIds.includes(item.ipId));

      const runDelete = db.transaction(() => {
        warmups.forEach(item => deleteStmt.run('warmups', userId, item.id));
        reputations.forEach(item => deleteStmt.run('reputation', userId, item.id));
        ips.forEach(item => deleteStmt.run('ips', userId, item.id));
        domains.forEach(item => deleteStmt.run('domains', userId, item.id));
        serverIds.forEach(id => deleteStmt.run('servers', userId, id));
      });

      runDelete();

      return {
        action,
        matchedCount: serverIds.length,
        modifiedCount: serverIds.length,
        deletedCount: serverIds.length,
        updatedAt,
      };
    }

    const runUpdate = db.transaction(() => {
      serverIds.forEach(id => {
        const server = get('servers', userId, id);
        const next = updateServerRecord(server, action, value, updatedAt);
        upsertStmt.run(id, 'servers', userId, server.createdAt, next.updatedAt, JSON.stringify(next));
      });
    });

    runUpdate();

    return {
      action,
      matchedCount: serverIds.length,
      modifiedCount: serverIds.length,
      deletedCount: 0,
      updatedAt,
    };
  }

  function deleteBatch(collection, userId, filters) {
    const items = list(collection, userId).filter(item => {
      for (const [key, value] of Object.entries(filters || {})) {
        if (item[key] !== value) return false;
      }
      return true;
    });
    for (const item of items) {
      remove(collection, userId, item.id);
    }
    return items.length;
  }

  function cascadeDeleteServer(userId, serverId) {
    const domains = list('domains', userId).filter(d => d.serverId === serverId);

    for (const domain of domains) {
      const ips = list('ips', userId).filter(ip => ip.domainId === domain.id);

      for (const ip of ips) {
        deleteBatch('warmups', userId, { ipId: ip.id });
        deleteBatch('sending_logs', userId, { ipId: ip.id });
        remove('ips', userId, ip.id);
      }

      deleteBatch('reputation', userId, { domainId: domain.id });
      deleteBatch('sending_logs', userId, { domainId: domain.id });
      remove('domains', userId, domain.id);
    }

    deleteBatch('sending_logs', userId, { serverId });
    remove('servers', userId, serverId);
  }

  function cascadeDeleteDomain(userId, domainId) {
    const ips = list('ips', userId).filter(ip => ip.domainId === domainId);

    for (const ip of ips) {
      deleteBatch('warmups', userId, { ipId: ip.id });
      deleteBatch('sending_logs', userId, { ipId: ip.id });
      remove('ips', userId, ip.id);
    }

    deleteBatch('reputation', userId, { domainId });
    deleteBatch('sending_logs', userId, { domainId });
    remove('domains', userId, domainId);
  }

  return {
    kind: 'sqlite',
    async reset() {
      resetStmt.run();
    },
    async insertPostmasterRaw(userId, rows) {
      const now = nowIso();
      const runInsert = db.transaction(() => {
        rows.forEach(row => {
          const id = randomUUID();
          const record = {
            ...row,
            userId,
            createdAt: now,
            updatedAt: now,
          };
          upsertStmt.run(id, 'postmaster_raw', userId, now, now, JSON.stringify(record));
        });
      });

      runInsert();
      return { success: true, inserted: rows.length };
    },
    async executeServerBulkAction(userId, payload) {
      return executeServerBulkAction(userId, payload);
    },
    async list(collection, userId, filters = {}, options = {}) {
      let results = list(collection, userId);
      
      if (filters && Object.keys(filters).length > 0) {
        results = results.filter(item => {
          for (const [key, value] of Object.entries(filters)) {
            if (item[key] !== value) return false;
          }
          return true;
        });
      }

      if (options.sort) {
        const sortKey = Object.keys(options.sort)[0];
        const dir = options.sort[sortKey] === 1 ? 1 : -1;
        if (sortKey) {
          results.sort((a, b) => {
            if (a[sortKey] < b[sortKey]) return -1 * dir;
            if (a[sortKey] > b[sortKey]) return 1 * dir;
            return 0;
          });
        }
      }

      if (options.skip) {
        results = results.slice(options.skip);
      }
      if (options.limit) {
        results = results.slice(0, options.limit);
      }

      return results;
    },
    async get(collection, userId, id) {
      return get(collection, userId, id);
    },
    async create(collection, userId, data) {
      return create(collection, userId, data);
    },
    async update(collection, userId, id, patch) {
      return update(collection, userId, id, patch);
    },
    async delete(collection, userId, id) {
      return remove(collection, userId, id);
    },
    async cascadeDeleteServer(userId, serverId) {
      return db.transaction(() => cascadeDeleteServer(userId, serverId))();
    },
    async cascadeDeleteDomain(userId, domainId) {
      return db.transaction(() => cascadeDeleteDomain(userId, domainId))();
    },
  };
}

module.exports = {
  createSqliteStore,
};
