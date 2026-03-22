function calculateIPHealthScore(ipId, logs) {
  const ipLogs = logs.filter(l => l.ip_id === ipId || l.ipId === ipId);
  
  if (ipLogs.length === 0) return 0;
  
  let totalSent = 0;
  let totalSuccess = 0;
  
  for (const log of ipLogs) {
    totalSent += Number(log.sent_count || log.sentcount || 0);
    totalSuccess += Number(log.success_count || log.successcount || 0);
  }
  
  if (totalSent === 0) return 0;
  
  const successRate = totalSuccess / totalSent;
  return Math.round(successRate * 100);
}

function calculateDomainHealth(reputation) {
  if (reputation >= 90) return 'excellent';
  if (reputation >= 75) return 'good';
  if (reputation >= 50) return 'fair';
  return 'poor';
}

function formatDate(date) {
  return new Date(date).toISOString();
}

function sanitizeString(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().toLowerCase();
}

module.exports = {
  calculateIPHealthScore,
  calculateDomainHealth,
  formatDate,
  sanitizeString
};
