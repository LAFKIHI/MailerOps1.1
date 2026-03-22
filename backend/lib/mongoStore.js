// =============================================================================
// MailerOps - MongoDB Data Store
// =============================================================================
// Document-style store backed by MongoDB. Uses a single `items` collection
// with the same interface as the SQLite store for seamless switching.
// =============================================================================

const { MongoClient } = require('mongodb');
const { randomUUID } = require('crypto');

async function createMongoStore() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mailerops';
  const client = new MongoClient(uri);

  await client.connect();
  console.log('[mongo] Connected to MongoDB');

  const dbName = uri.split('/').pop().split('?')[0] || 'mailerops';
  const db = client.db(dbName);
  const items = db.collection('items');

  // ─── Indexes ──────────────────────────────────────────────────────────
  await items.createIndex({ collection: 1, userId: 1 });
  await items.createIndex({ userId: 1, createdAt: -1 });
  await items.createIndex({ collection: 1, userId: 1, id: 1 }, { unique: true });

  // ─── Helpers ──────────────────────────────────────────────────────────

  function formatDoc(doc) {
    if (!doc) return null;
    const { _id, collection: _col, data, ...meta } = doc;
    return { ...meta, ...(data || {}) };
  }

  function matchesFilters(item, filters = {}) {
    return Object.entries(filters).every(([key, value]) => item[key] === value);
  }

  // ─── Store API ────────────────────────────────────────────────────────

  async function list(collection, userId, filters = {}, options = {}) {
    const limit = Math.max(0, Number(options.limit ?? 1000));
    const skip = Math.max(0, Number(options.skip ?? 0));
    const sort = options.sort && typeof options.sort === 'object' ? options.sort : { createdAt: -1 };
    const query = { collection, userId };
    const docs = await items
      .find(query)
      .sort(sort)
      .toArray();
    return docs
      .map(formatDoc)
      .filter(item => matchesFilters(item, filters))
      .slice(skip, skip + limit);
  }

  async function listByField(collection, userId, fieldName, fieldValue) {
    const all = await list(collection, userId);
    return all.filter(item => item[fieldName] === fieldValue);
  }

  async function get(collection, userId, id) {
    const doc = await items.findOne({ collection, userId, id });
    return formatDoc(doc);
  }

  async function create(collection, userId, data) {
    const now = new Date().toISOString();
    const id = data.id || randomUUID();

    const { id: _id, userId: _uid, createdAt: _ca, updatedAt: _ua, ...cleanData } = data;

    const doc = {
      id,
      collection,
      userId,
      createdAt: now,
      updatedAt: now,
      data: cleanData
    };

    await items.insertOne(doc);
    return { id, userId, createdAt: now, updatedAt: now, ...cleanData };
  }

  async function update(collection, userId, id, updates) {
    const existing = await get(collection, userId, id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const { id: _id, userId: _uid, createdAt: _ca, updatedAt: _ua, ...cleanUpdates } = updates;
    const { id: eId, userId: eUid, createdAt: eCa, updatedAt: eUa, ...existingData } = existing;
    const merged = { ...existingData, ...cleanUpdates };

    await items.updateOne(
      { collection, userId, id },
      { $set: { data: merged, updatedAt: now } }
    );

    return { id, userId, createdAt: existing.createdAt, updatedAt: now, ...merged };
  }

  async function del(collection, userId, id) {
    const result = await items.deleteOne({ collection, userId, id });
    return result.deletedCount > 0;
  }

  async function deleteCollection(collection, userId) {
    const result = await items.deleteMany({ collection, userId });
    return result.deletedCount;
  }

  async function count(collection, userId) {
    return items.countDocuments({ collection, userId });
  }

  /**
   * Transaction wrapper for MongoDB.
   * Note: Transactions require a replica set. For standalone, operations
   * are performed sequentially without true transaction guarantees.
   */
  function transaction(fn) {
    // For standalone MongoDB, just execute the function directly
    // For replica sets, wrap in a session transaction
    return async () => {
      try {
        const session = client.startSession();
        try {
          session.startTransaction();
          const result = await fn();
          await session.commitTransaction();
          return result;
        } catch (err) {
          await session.abortTransaction();
          throw err;
        } finally {
          session.endSession();
        }
      } catch (sessionErr) {
        // Fallback for standalone MongoDB (no replica set)
        return fn();
      }
    };
  }

  async function resetAll(userId) {
    if (!userId) throw new Error('userId required for reset');
    await items.deleteMany({ userId });
    return true;
  }

  function close() {
    return client.close();
  }

  function getDb() {
    return db;
  }

  async function findOne(collection, userId, filters = {}) {
    const listResults = await list(collection, userId, filters, { limit: 1 });
    return listResults.length > 0 ? listResults[0] : null;
  }

  async function listUserIds() {
    const userIds = await items.distinct('userId', { userId: { $nin: [null, ''] } });
    return userIds.filter(Boolean);
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
    type: 'mongodb'
  };
}

module.exports = { createMongoStore };
