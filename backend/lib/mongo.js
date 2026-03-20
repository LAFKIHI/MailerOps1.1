const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || process.env.MONGO_DB_NAME || 'mailerops';

let clientPromise;

function getClient() {
  if (!clientPromise) {
    const client = new MongoClient(MONGODB_URI);
    clientPromise = client.connect().then(() => client);
  }

  return clientPromise;
}

async function getDb() {
  const client = await getClient();
  return client.db(MONGODB_DB_NAME);
}

function sanitizeCollection(name) {
  return String(name || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

function createId() {
  return new ObjectId().toString();
}

function normalizeServerDocument(document) {
  const rdp = String(document?.rdp ?? document?.group ?? '').trim();
  const rawTags = Array.isArray(document?.tags) ? document.tags : [];
  const tags = [...new Set(rawTags.map(tag => String(tag).trim()).filter(Boolean))];
  const status = ['active', 'paused', 'banned'].includes(document?.status) ? document.status : 'active';
  const runtimeStatus = ['running', 'stopped'].includes(document?.runtimeStatus) ? document.runtimeStatus : 'stopped';
  const sendPerDayValue = Number(document?.sendPerDay ?? document?.sentPerDay ?? 0);
  const sendPerDay = Number.isFinite(sendPerDayValue) && sendPerDayValue >= 0
    ? Math.trunc(sendPerDayValue)
    : 0;

  const dailyLimitValue = Number(document?.dailyLimit ?? 0);
  const dailyLimit = Number.isFinite(dailyLimitValue) && dailyLimitValue >= 0
    ? Math.trunc(dailyLimitValue)
    : 0;

  return {
    ...document,
    rdp,
    group: rdp,
    tags,
    status,
    runtimeStatus,
    sendPerDay,
    sentPerDay: sendPerDay,
    dailyLimit,
  };
}

function normalizeOutgoingDocument(collection, document) {
  if (!document) return null;

  const { _id, ...rest } = document;
  const payload = collection === 'servers'
    ? normalizeServerDocument(rest)
    : rest;

  return {
    id: String(_id),
    ...payload,
  };
}

function normalizeIncomingDocument(collection, document, options = {}) {
  const normalized = { ...document };

  if (collection === 'servers') {
    const merged = normalizeServerDocument({
      status: options.isCreate ? 'active' : normalized.status,
      runtimeStatus: options.isCreate ? 'stopped' : normalized.runtimeStatus,
      sendPerDay: options.isCreate ? 0 : normalized.sendPerDay,
      ...normalized,
    });

    delete merged.id;
    delete merged._id;
    return merged;
  }

  delete normalized.id;
  delete normalized._id;
  return normalized;
}

module.exports = {
  MONGODB_DB_NAME,
  MONGODB_URI,
  createId,
  getClient,
  getDb,
  normalizeIncomingDocument,
  normalizeOutgoingDocument,
  normalizeServerDocument,
  sanitizeCollection,
};
