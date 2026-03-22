function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  return error;
}

const ACTIONS = {
  updateSendPerDay: 'updateSendPerDay',
  change_daily_limit: 'change_daily_limit',
  change_rdp: 'change_rdp',
  startServers: 'startServers',
  stopServers: 'stopServers',
  deleteServers: 'deleteServers',
  updateStatus: 'updateStatus',
  assignTag: 'assignTag',
  removeTag: 'removeTag',
  // Immediate status-toggle actions
  stop: 'stop',
  start: 'start',
  pause: 'pause',
  resume: 'resume',
};

const VALID_STATUSES = new Set(['active', 'paused', 'banned']);

function normalizeServerIds(serverIds) {
  if (!Array.isArray(serverIds)) {
    throw createHttpError(400, 'serverIds must be an array');
  }

  const normalized = [...new Set(serverIds.map(id => String(id || '').trim()).filter(Boolean))];

  if (normalized.length === 0) {
    throw createHttpError(400, 'At least one server must be selected');
  }

  return normalized;
}

function assertNoUnexpectedValue(action, value) {
  if (value !== undefined && value !== null && value !== '') {
    throw createHttpError(400, `${action} does not accept a value`);
  }
}

function validateActionPayload(action, value) {
  switch (action) {
    case ACTIONS.updateSendPerDay: {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000000) {
        throw createHttpError(400, 'sendPerDay must be an integer between 0 and 1000000');
      }
      return parsed;
    }
    case ACTIONS.change_daily_limit: {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000000) {
        throw createHttpError(400, 'dailyLimit must be an integer between 0 and 1000000');
      }
      return parsed;
    }
    case ACTIONS.change_rdp: {
      const parsed = String(value || '').trim();
      if (!parsed || parsed.length > 100) {
        throw createHttpError(400, 'rdp must be between 1 and 100 characters');
      }
      return parsed;
    }
    case ACTIONS.startServers:
    case ACTIONS.stopServers:
    case ACTIONS.deleteServers:
    case ACTIONS.stop:
    case ACTIONS.start:
    case ACTIONS.resume: {
      assertNoUnexpectedValue(action, value);
      return undefined;
    }
    case ACTIONS.pause: {
      if (value !== undefined && value !== null && value !== '') {
        const parsed = String(value).trim();
        if (parsed.length > 200) {
          throw createHttpError(400, 'Pause reason is too long (max 200 characters)');
        }
        return parsed;
      }
      return undefined;
    }
    case ACTIONS.updateStatus: {
      const parsed = String(value || '').trim();
      if (!VALID_STATUSES.has(parsed)) {
        throw createHttpError(400, 'status must be one of: active, paused, banned');
      }
      return parsed;
    }
    case ACTIONS.assignTag:
    case ACTIONS.removeTag: {
      const parsed = String(value || '').trim();
      if (!parsed || parsed.length > 40 || !/^[A-Za-z0-9 _-]+$/.test(parsed)) {
        throw createHttpError(400, 'tag must be 1-40 characters and use letters, numbers, spaces, "_" or "-"');
      }
      return parsed;
    }
    default:
      throw createHttpError(400, 'Invalid bulk action');
  }
}

async function ensureServersExist(serversCollection, userId, serverIds, session) {
  const rows = await serversCollection
    .find(
      { userId, _id: { $in: serverIds } },
      { session, projection: { _id: 1 } }
    )
    .toArray();

  const foundIds = new Set(rows.map(row => String(row._id)));
  const missingIds = serverIds.filter(id => !foundIds.has(id));

  if (missingIds.length > 0) {
    throw createHttpError(404, 'Some selected servers were not found', { missingIds });
  }
}

async function executeDeleteFlow(db, userId, serverIds, session, now) {
  const domainsCollection = db.collection('domains');
  const ipsCollection = db.collection('ips');
  const warmupsCollection = db.collection('warmups');
  const reputationCollection = db.collection('reputation');
  const serversCollection = db.collection('servers');

  const domains = await domainsCollection
    .find(
      { userId, serverId: { $in: serverIds } },
      { session, projection: { _id: 1 } }
    )
    .toArray();
  const domainIds = domains.map(domain => String(domain._id));

  const ips = domainIds.length > 0
    ? await ipsCollection
      .find(
        { userId, domainId: { $in: domainIds } },
        { session, projection: { _id: 1 } }
      )
      .toArray()
    : [];
  const ipIds = ips.map(ip => String(ip._id));

  if (ipIds.length > 0) {
    await warmupsCollection.bulkWrite([
      {
        deleteMany: {
          filter: { userId, ipId: { $in: ipIds } },
        },
      },
    ], { session, ordered: true });
  }

  if (domainIds.length > 0) {
    await reputationCollection.bulkWrite([
      {
        deleteMany: {
          filter: { userId, domainId: { $in: domainIds } },
        },
      },
    ], { session, ordered: true });
  }

  if (domainIds.length > 0) {
    await ipsCollection.bulkWrite([
      {
        deleteMany: {
          filter: { userId, domainId: { $in: domainIds } },
        },
      },
    ], { session, ordered: true });
  }

  await db.collection('domains').bulkWrite([
    {
      deleteMany: {
        filter: { userId, serverId: { $in: serverIds } },
      },
    },
  ], { session, ordered: true });

  const serverDeleteResult = await serversCollection.bulkWrite(
    serverIds.map(serverId => ({
      deleteOne: {
        filter: { _id: serverId, userId },
      },
    })),
    { session, ordered: true }
  );

  return {
    action: ACTIONS.deleteServers,
    matchedCount: serverIds.length,
    modifiedCount: serverDeleteResult.deletedCount ?? serverIds.length,
    deletedCount: serverDeleteResult.deletedCount ?? serverIds.length,
    updatedAt: now,
  };
}

async function executeServerBulkAction(db, userId, payload, session) {
  const action = String(payload?.action || '').trim();
  const serverIds = normalizeServerIds(payload?.serverIds);
  const value = validateActionPayload(action, payload?.value);
  const serversCollection = db.collection('servers');
  const now = new Date().toISOString();

  await ensureServersExist(serversCollection, userId, serverIds, session);

  if (action === ACTIONS.deleteServers) {
    return executeDeleteFlow(db, userId, serverIds, session, now);
  }

  let operation;

  if (action === ACTIONS.updateSendPerDay) {
    operation = {
      updateMany: {
        filter: { userId, _id: { $in: serverIds } },
        update: {
          $set: {
            sendPerDay: value,
            sentPerDay: value,
            updatedAt: now,
          },
        },
      },
    };
  }

  if (action === ACTIONS.change_daily_limit) {
    operation = {
      updateMany: {
        filter: { userId, _id: { $in: serverIds } },
        update: {
          $set: {
            dailyLimit: value,
            sendPerDay: value,
            updatedAt: now,
          },
        },
      },
    };
  }

  if (action === ACTIONS.change_rdp) {
    operation = {
      updateMany: {
        filter: { userId, _id: { $in: serverIds } },
        update: {
          $set: {
            rdp: value,
            group: value,
            updatedAt: now,
          },
        },
      },
    };
  }

  if (action === ACTIONS.startServers || action === ACTIONS.start) {
    operation = {
      updateMany: {
        filter: { userId, _id: { $in: serverIds } },
        update: {
          $set: {
            runtimeStatus: 'running',
            status: 'active',
            updatedAt: now,
          },
        },
      },
    };
  }

  if (action === ACTIONS.stopServers || action === ACTIONS.stop) {
    operation = {
      updateMany: {
        filter: { userId, _id: { $in: serverIds } },
        update: {
          $set: {
            runtimeStatus: 'stopped',
            updatedAt: now,
          },
        },
      },
    };
  }

  if (action === ACTIONS.pause) {
    const updateSet = {
      status: 'paused',
      updatedAt: now,
    };
    if (value) updateSet.pauseReason = value;

    operation = {
      updateMany: {
        filter: { userId, _id: { $in: serverIds } },
        update: {
          $set: updateSet,
        },
      },
    };
  }

  if (action === ACTIONS.resume) {
    operation = {
      updateMany: {
        filter: { userId, _id: { $in: serverIds } },
        update: {
          $set: {
            status: 'active',
            runtimeStatus: 'running',
            updatedAt: now,
          },
          $unset: {
            pauseReason: "",
          },
        },
      },
    };
  }

  if (action === ACTIONS.updateStatus) {
    operation = {
      updateMany: {
        filter: { userId, _id: { $in: serverIds } },
        update: {
          $set: {
            status: value,
            updatedAt: now,
          },
        },
      },
    };
  }

  if (action === ACTIONS.assignTag) {
    operation = {
      updateMany: {
        filter: { userId, _id: { $in: serverIds } },
        update: {
          $addToSet: {
            tags: value,
          },
          $set: {
            updatedAt: now,
          },
        },
      },
    };
  }

  if (action === ACTIONS.removeTag) {
    operation = {
      updateMany: {
        filter: { userId, _id: { $in: serverIds } },
        update: {
          $pull: {
            tags: value,
          },
          $set: {
            updatedAt: now,
          },
        },
      },
    };
  }

  const result = await serversCollection.bulkWrite([operation], { session, ordered: true });

  return {
    action,
    matchedCount: result.matchedCount ?? serverIds.length,
    modifiedCount: result.modifiedCount ?? 0,
    deletedCount: 0,
    updatedAt: now,
  };
}

module.exports = {
  ACTIONS,
  createHttpError,
  executeServerBulkAction,
  normalizeServerIds,
  validateActionPayload,
};
