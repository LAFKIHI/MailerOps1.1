// =============================================================================
// MailerOps - Server Bulk Actions
// =============================================================================
// Handles all bulk operations on servers: start, stop, pause, resume,
// update limits, change RDP, tag management, bulk delete, bulk warmup.
// =============================================================================

const { cascadeDeleteServer } = require('./cascadeDelete');

class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = 'HttpError';
  }
}

// ─── Main Bulk Action Handler ───────────────────────────────────────────────

async function handleBulkAction(store, userId, payload) {
  const { action, serverIds, value } = payload;

  // Validate inputs
  if (!action || typeof action !== 'string') {
    throw new HttpError(400, 'action is required and must be a string');
  }

  if (!Array.isArray(serverIds) || serverIds.length === 0) {
    throw new HttpError(400, 'serverIds must be a non-empty array');
  }

  // Verify all servers exist
  const servers = [];
  for (const id of serverIds) {
    const server = await store.get('servers', userId, id);
    if (server) servers.push(server);
  }

  if (servers.length !== serverIds.length) {
    const foundIds = new Set(servers.map(s => s.id));
    const missingIds = serverIds.filter(id => !foundIds.has(id));
    throw new HttpError(404, 'Some selected servers were not found', { missingIds });
  }

  const updatedAt = new Date().toISOString();

  // Dispatch action
  switch (action) {
    case 'startServers':
    case 'start':
      return updateServersFields(store, userId, serverIds, {
        status: 'active',
        runtimeStatus: 'running'
      }, updatedAt);

    case 'stopServers':
    case 'stop':
      return updateServersFields(store, userId, serverIds, {
        runtimeStatus: 'stopped'
      }, updatedAt);

    case 'pause':
      return updateServersFields(store, userId, serverIds, {
        status: 'paused',
        pauseReason: value || 'Paused by user'
      }, updatedAt);

    case 'resume':
      return updateServersFields(store, userId, serverIds, {
        status: 'active',
        runtimeStatus: 'running',
        pauseReason: null
      }, updatedAt);

    case 'updateSendPerDay':
    case 'change_daily_limit':
      if (value === undefined || !Number.isInteger(Number(value)) || Number(value) < 0) {
        throw new HttpError(400, 'Value must be a non-negative integer');
      }
      return updateServersFields(store, userId, serverIds, {
        sendPerDay: Number(value),
        dailyLimit: Number(value)
      }, updatedAt);

    case 'change_rdp':
      if (!value || typeof value !== 'string') {
        throw new HttpError(400, 'RDP value must be a non-empty string');
      }
      return updateServersFields(store, userId, serverIds, {
        rdp: value,
        group: value
      }, updatedAt);

    case 'assignTag':
      if (!value || typeof value !== 'string') {
        throw new HttpError(400, 'Tag value must be a non-empty string');
      }
      return assignTagToServers(store, userId, serverIds, value, updatedAt);

    case 'removeTag':
      if (!value || typeof value !== 'string') {
        throw new HttpError(400, 'Tag value must be a non-empty string');
      }
      return removeTagFromServers(store, userId, serverIds, value, updatedAt);

    case 'updateStatus':
      if (!['active', 'paused', 'stopped'].includes(value)) {
        throw new HttpError(400, 'Invalid status value. Must be: active, paused, or stopped');
      }
      return updateServersFields(store, userId, serverIds, {
        status: value
      }, updatedAt);

    case 'deleteServers':
    case 'delete':
      return deleteServersWithCascade(store, userId, serverIds);

    default:
      throw new HttpError(400, `Unknown action: ${action}`);
  }
}

// ─── Action Implementations ─────────────────────────────────────────────────

async function updateServersFields(store, userId, serverIds, fields, updatedAt) {
  let modifiedCount = 0;

  for (const id of serverIds) {
    const server = await store.get('servers', userId, id);
    if (server) {
      await store.update('servers', userId, id, { ...fields, updatedAt });
      modifiedCount++;
    }
  }

  return {
    action: 'updateStatus',
    matchedCount: serverIds.length,
    modifiedCount,
    updatedAt
  };
}

async function assignTagToServers(store, userId, serverIds, tag, updatedAt) {
  let modifiedCount = 0;

  for (const id of serverIds) {
    const server = await store.get('servers', userId, id);
    if (server) {
      const currentTags = Array.isArray(server.tags) ? server.tags : [];
      const tags = [...new Set([...currentTags, tag])];
      await store.update('servers', userId, id, { tags, updatedAt });
      modifiedCount++;
    }
  }

  return {
    action: 'assignTag',
    matchedCount: serverIds.length,
    modifiedCount,
    updatedAt
  };
}

async function removeTagFromServers(store, userId, serverIds, tag, updatedAt) {
  let modifiedCount = 0;

  for (const id of serverIds) {
    const server = await store.get('servers', userId, id);
    if (server) {
      const currentTags = Array.isArray(server.tags) ? server.tags : [];
      const tags = currentTags.filter(t => t !== tag);
      await store.update('servers', userId, id, { tags, updatedAt });
      modifiedCount++;
    }
  }

  return {
    action: 'removeTag',
    matchedCount: serverIds.length,
    modifiedCount,
    updatedAt
  };
}

async function deleteServersWithCascade(store, userId, serverIds) {
  let deletedCount = 0;

  for (const serverId of serverIds) {
    await cascadeDeleteServer(store, userId, serverId);
    deletedCount++;
  }

  return {
    action: 'deleteServers',
    matchedCount: serverIds.length,
    modifiedCount: serverIds.length,
    deletedCount
  };
}

// ─── Bulk Warmup ────────────────────────────────────────────────────────────

/**
 * Create warmup records for all IPs under the given servers.
 * Process:
 *   1. Find all domains for the given servers
 *   2. Find all IPs for those domains
 *   3. Create or update warmup records for each IP on the specified date
 */
async function handleBulkWarmup(store, userId, payload) {
  const { serverIds, count, date } = payload;

  if (!Array.isArray(serverIds) || serverIds.length === 0) {
    throw new HttpError(400, 'serverIds must be a non-empty array');
  }

  if (!count || !Number.isInteger(Number(count)) || Number(count) < 0) {
    throw new HttpError(400, 'count must be a non-negative integer');
  }

  if (!date || typeof date !== 'string') {
    throw new HttpError(400, 'date is required (YYYY-MM-DD)');
  }

  const serverIdSet = new Set(serverIds);
  let createdCount = 0;
  let updatedCount = 0;

  // Get all domains for these servers
  const allDomains = await store.list('domains', userId);
  const domains = allDomains.filter(d => serverIdSet.has(d.serverId));

  // Get all IPs for those domains
  const domainIdSet = new Set(domains.map(d => d.id));
  const allIPs = await store.list('ips', userId);
  const ips = allIPs.filter(ip => domainIdSet.has(ip.domainId));

  // Get existing warmups to avoid duplicates
  const existingWarmups = await store.list('warmups', userId);

  for (const ip of ips) {
    // Check if a warmup already exists for this IP on this date
    const existing = existingWarmups.find(w => w.ipId === ip.id && w.date === date);

    if (existing) {
      // Update existing warmup
      await store.update('warmups', userId, existing.id, {
        sent: Number(count),
        status: 'scheduled'
      });
      updatedCount++;
    } else {
      // Create new warmup
      await store.create('warmups', userId, {
        ipId: ip.id,
        domainId: ip.domainId,
        date,
        sent: Number(count),
        status: 'scheduled'
      });
      createdCount++;
    }
  }

  return { success: true, processedIPs: ips.length, createdCount, updatedCount };
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  handleBulkAction,
  handleBulkWarmup,
  HttpError
};
