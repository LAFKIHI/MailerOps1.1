// =============================================================================
// MailerOps - SQLite Data Store
// =============================================================================
// Generic document-style store using SQLite with a single `items` table.
// Each row stores: id, collection, userId, createdAt, updatedAt, data (JSON).
// =============================================================================

const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');

function createSqliteStore(dbFile) {
  const db = new Database(dbFile);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ─── Schema ───────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      collection TEXT NOT NULL,
      userId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_items_collection_userId
      ON items(collection, userId);

    CREATE INDEX IF NOT EXISTS idx_items_userId_createdAt
      ON items(userId, createdAt);

    CREATE INDEX IF NOT EXISTS idx_items_collection_userId_id
      ON items(collection, userId, id);
  `);

  // ─── Prepared Statements ──────────────────────────────────────────────
  const stmtInsert = db.prepare(`
    INSERT INTO items (id, collection, userId, createdAt, updatedAt, data)
    VALUES (@id, @collection, @userId, @createdAt, @updatedAt, @data)
  `);

  const stmtUpdate = db.prepare(`
    UPDATE items
       SET data = @data, updatedAt = @updatedAt
     WHERE id = @id AND collection = @collection AND userId = @userId
  `);

  const stmtDelete = db.prepare(`
    DELETE FROM items
     WHERE id = @id AND collection = @collection AND userId = @userId
  `);

  const stmtGet = db.prepare(`
    SELECT * FROM items
     WHERE id = @id AND collection = @collection AND userId = @userId
  `);

  const stmtList = db.prepare(`
    SELECT * FROM items
     WHERE collection = @collection AND userId = @userId
     ORDER BY createdAt DESC
  `);

  const stmtListByField = db.prepare(`
    SELECT * FROM items
     WHERE collection = @collection AND userId = @userId
     ORDER BY createdAt DESC
  `);

  const stmtDeleteByCollection = db.prepare(`
    DELETE FROM items
     WHERE collection = @collection AND userId = @userId
  `);

  const stmtDeleteAll = db.prepare(`DELETE FROM items`);

  const stmtCountByCollection = db.prepare(`
    SELECT COUNT(*) as count FROM items
     WHERE collection = @collection AND userId = @userId
  `);

  const stmtListUserIds = db.prepare(`
    SELECT DISTINCT userId FROM items
    WHERE userId IS NOT NULL AND userId != ''
  `);

  // ─── Helpers ──────────────────────────────────────────────────────────

  function parseRow(row) {
    if (!row) return null;
    const parsed = JSON.parse(row.data);
    return {
      id: row.id,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ...parsed
    };
  }

  function parseRows(rows) {
    return rows.map(parseRow).filter(Boolean);
  }

  // ─── Store API ────────────────────────────────────────────────────────

  /**
   * List all records in a collection for a given user.
   */
  function list(collection, userId, filters = {}, options = {}) {
    const rows = stmtList.all({ collection, userId });
    let parsed = parseRows(rows);

    if (filters && typeof filters === 'object') {
      parsed = parsed.filter(item =>
        Object.entries(filters).every(([key, value]) => item[key] === value)
      );
    }

    const limit = Math.max(0, Number(options.limit ?? 1000));
    const skip = Math.max(0, Number(options.skip ?? 0));
    const sort = options.sort && typeof options.sort === 'object' ? options.sort : { createdAt: -1 };
    const [sortKey, sortDirRaw] = Object.entries(sort)[0] || ['createdAt', -1];
    const sortDir = Number(sortDirRaw) >= 0 ? 1 : -1;

    parsed.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      return (String(av) > String(bv) ? 1 : -1) * sortDir;
    });

    return parsed.slice(skip, skip + limit);
  }

  /**
   * List records filtered by a specific field value.
   * e.g. listByField('domains', 'user1', 'serverId', 'srv-123')
   */
  function listByField(collection, userId, fieldName, fieldValue) {
    const rows = stmtListByField.all({ collection, userId });
    const parsed = parseRows(rows);
    return parsed.filter(item => item[fieldName] === fieldValue);
  }

  /**
   * Get a single record by ID.
   */
  function get(collection, userId, id) {
    const row = stmtGet.get({ id, collection, userId });
    return parseRow(row);
  }

  /**
   * Create a new record with auto-generated id and timestamps.
   */
  function create(collection, userId, data) {
    const now = new Date().toISOString();
    const id = data.id || randomUUID();

    // Strip meta fields from data payload — they live in columns
    const { id: _id, userId: _uid, createdAt: _ca, updatedAt: _ua, ...cleanData } = data;

    stmtInsert.run({
      id,
      collection,
      userId,
      createdAt: now,
      updatedAt: now,
      data: JSON.stringify(cleanData)
    });

    return { id, userId, createdAt: now, updatedAt: now, ...cleanData };
  }

  /**
   * Update an existing record (merge fields).
   */
  function update(collection, userId, id, updates) {
    const existing = get(collection, userId, id);
    if (!existing) return null;

    const now = new Date().toISOString();

    // Strip meta fields from updates
    const { id: _id, userId: _uid, createdAt: _ca, updatedAt: _ua, ...cleanUpdates } = updates;

    // Merge existing data with updates
    const { id: eId, userId: eUid, createdAt: eCa, updatedAt: eUa, ...existingData } = existing;
    const merged = { ...existingData, ...cleanUpdates };

    stmtUpdate.run({
      id,
      collection,
      userId,
      data: JSON.stringify(merged),
      updatedAt: now
    });

    return { id, userId, createdAt: existing.createdAt, updatedAt: now, ...merged };
  }

  /**
   * Delete a single record. Returns true if deleted, false if not found.
   */
  function del(collection, userId, id) {
    const result = stmtDelete.run({ id, collection, userId });
    return result.changes > 0;
  }

  /**
   * Delete all records in a collection for a user.
   */
  function deleteCollection(collection, userId) {
    const result = stmtDeleteByCollection.run({ collection, userId });
    return result.changes;
  }

  /**
   * Count records in a collection for a user.
   */
  function count(collection, userId) {
    const row = stmtCountByCollection.get({ collection, userId });
    return row ? row.count : 0;
  }

  function listUserIds() {
    return stmtListUserIds.all().map(row => row.userId).filter(Boolean);
  }

  /**
   * Run multiple operations in a single transaction.
   */
  function transaction(fn) {
    const txn = db.transaction(fn);
    return txn;
  }

  /**
   * Reset the entire database (development only).
   */
  function resetAll(userId) {
    if (!userId) throw new Error('userId required for reset');
    db.prepare(`DELETE FROM items WHERE userId = ?`).run(userId);
    return true;
  }

  /**
   * Close database connection.
   */
  function close() {
    db.close();
  }

  /**
   * Get the raw database instance (for transactions in bulk actions).
   */
  function getDb() {
    return db;
  }

  /**
   * Find a single record by filters.
   */
  function findOne(collection, userId, filters = {}) {
    const listResults = list(collection, userId, filters, { limit: 1 });
    return listResults.length > 0 ? listResults[0] : null;
  }

  return {
    list,
    listByField,
    get,
    findOne,
    create,
    update,
    delete: del,
    deleteCollection,
    count,
    listUserIds,
    transaction,
    resetAll,
    close,
    getDb,
    type: 'sqlite'
  };
}

module.exports = { createSqliteStore };
