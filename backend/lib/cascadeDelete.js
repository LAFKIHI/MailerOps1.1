// =============================================================================
// MailerOps - Cascade Delete Logic
// =============================================================================
// Hierarchical cascade deletion following the data model:
//   Server → Domain → IP → Warmup / SendingLog
//   Domain → Reputation
//   Delivery → Account
// =============================================================================

/**
 * Cascade-delete an IP and all its children (warmups + sending_logs).
 */
async function cascadeDeleteIP(store, userId, ipId) {
  // Delete warmups for this IP
  const warmups = await store.list('warmups', userId);
  for (const w of warmups) {
    if (w.ipId === ipId) {
      await store.delete('warmups', userId, w.id);
    }
  }

  // Delete sending logs for this IP
  const logs = await store.list('sending_logs', userId);
  for (const l of logs) {
    if (l.ipId === ipId) {
      await store.delete('sending_logs', userId, l.id);
    }
  }

  // Delete the IP itself
  await store.delete('ips', userId, ipId);
}

/**
 * Cascade-delete a TEST-SEED and its TEST-SEED-only child records.
 * Shared delivery and infrastructure records remain untouched.
 */
async function cascadeDeleteTestSeed(store, userId, testSeedId) {
  const testSeedItems = await store.list('testSeedItems', userId);
  const relatedItemIds = [];

  for (const item of testSeedItems) {
    if (item.test_seed_id === testSeedId) {
      relatedItemIds.push(item.id);
    }
  }

  const evaluations = await store.list('testSeedEvaluations', userId);
  for (const evaluation of evaluations) {
    if (evaluation.test_seed_id === testSeedId) {
      await store.delete('testSeedEvaluations', userId, evaluation.id);
    }
  }

  const postmasterTasks = await store.list('postmasterTasks', userId);
  for (const task of postmasterTasks) {
    if (relatedItemIds.includes(task.test_seed_item_id)) {
      await store.delete('postmasterTasks', userId, task.id);
    }
  }

  for (const itemId of relatedItemIds) {
    await store.delete('testSeedItems', userId, itemId);
  }

  await store.delete('testSeeds', userId, testSeedId);
}

/**
 * Cascade-delete a domain and all its children (IPs → warmups/logs, reputation).
 */
async function cascadeDeleteDomain(store, userId, domainId) {
  // Find and cascade-delete all IPs belonging to this domain
  const ips = await store.list('ips', userId);
  for (const ip of ips) {
    if (ip.domainId === domainId) {
      await cascadeDeleteIP(store, userId, ip.id);
    }
  }

  // Delete reputation records for this domain
  const reputations = await store.list('reputation', userId);
  for (const r of reputations) {
    if (r.domainId === domainId) {
      await store.delete('reputation', userId, r.id);
    }
  }

  // Delete sending logs linked directly to this domain (if any orphans)
  const logs = await store.list('sending_logs', userId);
  for (const l of logs) {
    if (l.domainId === domainId) {
      await store.delete('sending_logs', userId, l.id);
    }
  }

  // Delete the domain itself
  await store.delete('domains', userId, domainId);
}

/**
 * Cascade-delete a server and all its children
 * (domains → IPs → warmups/logs, reputation, direct logs).
 */
async function cascadeDeleteServer(store, userId, serverId) {
  // Find and cascade-delete all domains belonging to this server
  const domains = await store.list('domains', userId);
  for (const domain of domains) {
    if (domain.serverId === serverId) {
      await cascadeDeleteDomain(store, userId, domain.id);
    }
  }

  // Delete sending logs linked directly to this server (if any orphans)
  const logs = await store.list('sending_logs', userId);
  for (const l of logs) {
    if (l.serverId === serverId) {
      await store.delete('sending_logs', userId, l.id);
    }
  }

  // Delete the server itself
  await store.delete('servers', userId, serverId);
}

/**
 * Cascade-delete a delivery and all its child accounts.
 */
async function cascadeDeleteDelivery(store, userId, deliveryId) {
  // Delete all accounts belonging to this delivery
  const accounts = await store.list('accounts', userId);
  for (const a of accounts) {
    if (a.delivery_id === deliveryId) {
      await store.delete('accounts', userId, a.id);
    }
  }

  // Delete sending logs linked to this delivery
  const logs = await store.list('sending_logs', userId);
  for (const l of logs) {
    if (l.delivery_id === deliveryId) {
      await store.delete('sending_logs', userId, l.id);
    }
  }

  // Delete the delivery itself
  await store.delete('deliveries', userId, deliveryId);
}

/**
 * Determine if a collection needs cascade deletion and perform it.
 * Returns true if cascaded, false if normal delete suffices.
 */
async function cascadeDeleteIfNeeded(store, userId, collection, id) {
  switch (collection) {
    case 'servers':
      await cascadeDeleteServer(store, userId, id);
      return true;

    case 'domains':
      await cascadeDeleteDomain(store, userId, id);
      return true;

    case 'ips':
      await cascadeDeleteIP(store, userId, id);
      return true;

    case 'deliveries':
      await cascadeDeleteDelivery(store, userId, id);
      return true;

    case 'testSeeds':
      await cascadeDeleteTestSeed(store, userId, id);
      return true;

    default:
      // No cascade needed — just delete the single record
      return false;
  }
}

module.exports = {
  cascadeDeleteIP,
  cascadeDeleteDomain,
  cascadeDeleteServer,
  cascadeDeleteDelivery,
  cascadeDeleteTestSeed,
  cascadeDeleteIfNeeded
};
