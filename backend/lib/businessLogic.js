// =============================================================================
// MailerOps - Business Logic
// =============================================================================
// Core business calculations: health scores, lifecycle detection,
// warmup progress, burn detection, scaling readiness.
// =============================================================================

// ─── IP Health Score ────────────────────────────────────────────────────────

/**
 * Calculate IP health score from sending logs.
 * Returns 0-100 based on success rate.
 */
function calculateIPHealthScore(logs) {
  if (!logs || logs.length === 0) return 0;

  let totalSent = 0;
  let totalSuccess = 0;

  for (const log of logs) {
    totalSent += Number(log.sent_count || 0);
    totalSuccess += Number(log.success_count || 0);
  }

  if (totalSent === 0) return 0;
  return Math.round((totalSuccess / totalSent) * 100);
}

/**
 * Calculate full IP stats from logs.
 */
function calculateIPStats(logs) {
  if (!logs || logs.length === 0) {
    return {
      total_sent: 0,
      total_success: 0,
      total_fail: 0,
      total_bounce: 0,
      total_complaint: 0,
      success_rate: 0,
      fail_rate: 0,
      health_score: 0
    };
  }

  let totalSent = 0;
  let totalSuccess = 0;
  let totalFail = 0;
  let totalBounce = 0;
  let totalComplaint = 0;

  for (const log of logs) {
    totalSent += Number(log.sent_count || 0);
    totalSuccess += Number(log.success_count || 0);
    totalFail += Number(log.fail_count || 0);
    totalBounce += Number(log.bounce_count || 0);
    totalComplaint += Number(log.complaint_count || 0);
  }

  const successRate = totalSent > 0 ? totalSuccess / totalSent : 0;
  const failRate = totalSent > 0 ? totalFail / totalSent : 0;
  const healthScore = Math.round(successRate * 100);

  return {
    total_sent: totalSent,
    total_success: totalSuccess,
    total_fail: totalFail,
    total_bounce: totalBounce,
    total_complaint: totalComplaint,
    success_rate: Math.round(successRate * 1000) / 1000,
    fail_rate: Math.round(failRate * 1000) / 1000,
    health_score: healthScore
  };
}

// ─── Domain Health ──────────────────────────────────────────────────────────

/**
 * Derive domain health label from reputation score.
 */
function calculateDomainHealth(reputation) {
  const score = Number(reputation);
  if (isNaN(score)) return 'poor';
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

// ─── Delivery Health ────────────────────────────────────────────────────────

/**
 * Calculate delivery health from its accounts.
 */
function calculateDeliveryHealth(accounts) {
  if (!accounts || accounts.length === 0) {
    return { active: 0, disabled: 0, ratio: 0, health_score: 0 };
  }

  const active = accounts.filter(a => a.status === 'active').length;
  const disabled = accounts.filter(a => a.status !== 'active').length;
  const total = accounts.length;
  const ratio = total > 0 ? Math.round((active / total) * 100) / 100 : 0;
  const healthScore = Math.round(ratio * 100);

  return { active, disabled, ratio, health_score: healthScore };
}

// ─── IP Lifecycle Detection (from Audit) ────────────────────────────────────

/**
 * Detect if an IP should be marked as "burned".
 * Criteria: fail_rate > 0.2 AND total_sent is high (> 1000)
 */
function detectBurned(ipStats) {
  const { fail_rate, total_sent } = ipStats;
  return fail_rate > 0.2 && total_sent > 1000;
}

/**
 * Detect if an IP is ready for scaling.
 * Criteria: warmup_day > 14 AND success_rate > 0.85
 */
function detectScalingReady(ip, ipStats) {
  const warmupDay = Number(ip.warmup_day || 0);
  const { success_rate } = ipStats;
  return warmupDay > 14 && success_rate > 0.85;
}

/**
 * Suggest lifecycle status for an IP based on its data and logs.
 * Returns: 'fresh' | 'warming' | 'scaled' | 'burned'
 */
function suggestIPLifecycle(ip, ipStats) {
  // If manually set, respect it
  if (ip.manually_marked_ready) return 'scaled';

  // Check burn condition first (highest priority)
  if (detectBurned(ipStats)) return 'burned';

  // Check scaling readiness
  if (detectScalingReady(ip, ipStats)) return 'scaled';

  // If warmup_day > 0, it's warming
  const warmupDay = Number(ip.warmup_day || 0);
  if (warmupDay > 0 || ipStats.total_sent > 0) return 'warming';

  return 'fresh';
}

// ─── Warmup Progress ────────────────────────────────────────────────────────

/**
 * Calculate warmup progress percentage.
 * Standard warmup is 14 days.
 */
function calculateWarmupProgress(warmupDay, targetDays = 14) {
  const day = Number(warmupDay || 0);
  if (day <= 0) return 0;
  if (day >= targetDays) return 100;
  return Math.round((day / targetDays) * 100);
}

/**
 * Get recommended daily send volume for a warmup day.
 * Follows a geometric growth pattern starting from 50.
 */
function getWarmupDailyTarget(warmupDay) {
  const day = Number(warmupDay || 1);
  // Geometric growth: 50 * 1.5^(day-1), capped at 50000
  const target = Math.round(50 * Math.pow(1.5, day - 1));
  return Math.min(target, 50000);
}

// ─── Aggregation Helpers ────────────────────────────────────────────────────

/**
 * Aggregate sending logs by date for a given filter.
 */
function aggregateLogsByDate(logs) {
  const byDate = {};

  for (const log of logs) {
    const date = (log.timestamp || log.createdAt || '').substring(0, 10);
    if (!date) continue;

    if (!byDate[date]) {
      byDate[date] = { date, sent: 0, success: 0, fail: 0, bounce: 0, complaint: 0 };
    }

    byDate[date].sent += Number(log.sent_count || 0);
    byDate[date].success += Number(log.success_count || 0);
    byDate[date].fail += Number(log.fail_count || 0);
    byDate[date].bounce += Number(log.bounce_count || 0);
    byDate[date].complaint += Number(log.complaint_count || 0);
  }

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get today's sending stats from logs.
 */
function getTodayStats(logs) {
  const today = new Date().toISOString().substring(0, 10);
  const todayLogs = logs.filter(l => {
    const logDate = (l.timestamp || l.createdAt || '').substring(0, 10);
    return logDate === today;
  });
  return calculateIPStats(todayLogs);
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  calculateIPHealthScore,
  calculateIPStats,
  calculateDomainHealth,
  calculateDeliveryHealth,
  detectBurned,
  detectScalingReady,
  suggestIPLifecycle,
  calculateWarmupProgress,
  getWarmupDailyTarget,
  aggregateLogsByDate,
  getTodayStats
};
