const {
  createId,
  getClient,
  getDb,
  normalizeIncomingDocument,
  normalizeOutgoingDocument,
} = require('./mongo');
const { executeServerBulkAction } = require('./serverBulkActions');

function nowIso() {
  return new Date().toISOString();
}

function parseIncomingRecord(collection, data, options = {}) {
  const source = data || {};
  const { id: requestedId, _id: requestedMongoId, ...rest } = source;
  const recordId = String(requestedId || requestedMongoId || createId()).trim();

  return {
    _id: recordId,
    ...normalizeIncomingDocument(collection, rest, options),
  };
}

function serialize(collection, document) {
  return normalizeOutgoingDocument(collection, document);
}

async function runMaybeTransactional(client, task) {
  const session = client.startSession();

  try {
    return await session.withTransaction(() => task(session));
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    const unsupportedTransaction = message.includes('transaction') && (
      message.includes('replica set')
      || message.includes('standalone')
      || message.includes('not supported')
    );

    if (unsupportedTransaction) {
      return task(undefined);
    }

    throw error;
  } finally {
    await session.endSession();
  }
}

async function createMongoStore() {
  const client = await getClient();
  const db = await getDb();

  return {
    kind: 'mongo',
    async reset() {
      const collections = await db.listCollections({}, { nameOnly: true }).toArray();

      for (const collection of collections) {
        if (collection.name.startsWith('system.')) continue;
        await db.collection(collection.name).deleteMany({});
      }
    },
    async insertPostmasterRaw(userId, rows) {
      const now = nowIso();
      const documents = rows.map(row => ({
        _id: createId(),
        userId,
        createdAt: now,
        updatedAt: now,
        ...row,
      }));

      if (documents.length > 0) {
        await db.collection('postmaster_raw').insertMany(documents, { ordered: true });
      }

      return { success: true, inserted: documents.length };
    },
    async executeServerBulkAction(userId, payload) {
      return runMaybeTransactional(client, (session) => executeServerBulkAction(db, userId, payload, session));
    },
    async list(collection, userId) {
      const rows = await db.collection(collection).find({ userId }).toArray();
      return rows.map(row => serialize(collection, row));
    },
    async get(collection, userId, id) {
      const row = await db.collection(collection).findOne({ _id: id, userId });
      return row ? serialize(collection, row) : null;
    },
    async create(collection, userId, data) {
      const now = nowIso();
      const incoming = parseIncomingRecord(collection, data, { isCreate: true });
      const record = {
        ...incoming,
        userId,
        createdAt: data?.createdAt || now,
        updatedAt: now,
      };

      await db.collection(collection).replaceOne({ _id: record._id }, record, { upsert: true });
      return serialize(collection, record);
    },
    async update(collection, userId, id, patch) {
      const existing = await db.collection(collection).findOne({ _id: id, userId });
      if (!existing) return null;

      const updated = {
        ...existing,
        ...normalizeIncomingDocument(collection, patch || {}, { isCreate: false }),
        _id: id,
        userId,
        updatedAt: nowIso(),
      };

      await db.collection(collection).replaceOne({ _id: id, userId }, updated);
      return serialize(collection, updated);
    },
    async delete(collection, userId, id) {
      const result = await db.collection(collection).deleteOne({ _id: id, userId });
      return result.deletedCount > 0;
    },
  };
}

module.exports = {
  createMongoStore,
};
