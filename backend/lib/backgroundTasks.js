// =============================================================================
// MailerOps - Background Tasks (Shadow Intelligence Layer)
// =============================================================================
// Periodic tasks that run in the background:
//   1. IP stats updater - recalculates health_score, success_rate, etc.
//   2. IP lifecycle detector - suggests lifecycle transitions
//   3. Domain health updater - recalculates domain health from IPs
// =============================================================================

const {
  calculateIPStats,
  suggestIPLifecycle,
  calculateDomainHealth
} = require('./businessLogic');

let isUpdating = false;
let intervalHandle = null;

async function updateIPStatsBackground(store) {
  if (isUpdating || !store) return;
  isUpdating = true;

  try {
    const userIds = typeof store.listUserIds === 'function'
      ? await store.listUserIds()
      : [];

    if (userIds.length === 0) {
      return;
    }

    let updatedIpsCount = 0;
    let updatedDomainsCount = 0;

    for (const userId of userIds) {
      const ips = await store.list('ips', userId);
      if (!ips || ips.length === 0) {
        continue;
      }

      const allLogs = await store.list('sending_logs', userId);

      for (const ip of ips) {
        try {
          const ipLogs = allLogs.filter(log => log.ipId === ip.id || log.ip_id === ip.id);
          const stats = calculateIPStats(ipLogs);
          const suggestedStatus = suggestIPLifecycle(ip, stats);

          const updates = {
            total_sent: stats.total_sent,
            success_rate: stats.success_rate,
            fail_rate: stats.fail_rate,
            health_score: stats.health_score,
          };

          if (ip.status !== suggestedStatus || ip.lifecycle !== suggestedStatus) {
            updates.status = suggestedStatus;
            updates.lifecycle = suggestedStatus;
          }

          await store.update('ips', userId, ip.id, updates);
          updatedIpsCount++;
        } catch (ipErr) {
          console.warn(`[shadow-layer] Failed to update IP ${ip.id}:`, ipErr.message);
        }
      }

      const domains = await store.list('domains', userId);
      const updatedIps = await store.list('ips', userId);

      for (const domain of domains) {
        try {
          const domainIps = updatedIps.filter(ip => ip.domainId === domain.id);
          if (domainIps.length === 0) continue;

          const avgHealth = Math.round(
            domainIps.reduce((sum, ip) => sum + Number(ip.health_score || 0), 0) / domainIps.length
          );

          const healthLabel = calculateDomainHealth(avgHealth);

          await store.update('domains', userId, domain.id, {
            reputation: avgHealth,
            health: healthLabel
          });
          updatedDomainsCount++;
        } catch (domErr) {
          console.warn(`[shadow-layer] Failed to update domain ${domain.id}:`, domErr.message);
        }
      }
    }

    console.log(`[shadow-layer] Updated ${updatedIpsCount} IPs, ${updatedDomainsCount} domains across ${userIds.length} user(s)`);
  } catch (err) {
    console.warn('[shadow-layer] Background updater failed:', err.message);
  } finally {
    isUpdating = false;
  }
}

function startBackgroundTasks(store, intervalMs) {
  const interval = intervalMs || Number(process.env.IP_STATS_INTERVAL) || 600000;

  console.log(`[shadow-layer] Starting background tasks (interval: ${interval / 1000}s)`);

  setTimeout(() => {
    updateIPStatsBackground(store);
  }, 5000);

  intervalHandle = setInterval(() => {
    updateIPStatsBackground(store);
  }, interval);

  return intervalHandle;
}

function stopBackgroundTasks() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[shadow-layer] Background tasks stopped');
  }
}

module.exports = {
  updateIPStatsBackground,
  startBackgroundTasks,
  stopBackgroundTasks
};
