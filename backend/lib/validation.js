// =============================================================================
// MailerOps - Input Validation
// =============================================================================
// Validation functions for every entity in the system.
// Each returns { isValid: boolean, errors: string[] }
// =============================================================================

// ─── Helpers ────────────────────────────────────────────────────────────────

function isValidIPAddress(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;
  return ip.split('.').every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

function isValidDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

function isNonNegativeInt(val) {
  const n = Number(val);
  return Number.isInteger(n) && n >= 0;
}

function isInRange(val, min, max) {
  const n = Number(val);
  return !isNaN(n) && n >= min && n <= max;
}

// ─── Allowed Collections ────────────────────────────────────────────────────

const ALLOWED_COLLECTIONS = [
  'servers',
  'domains',
  'ips',
  'warmups',
  'sending_logs',
  'reputation',
  'postmaster_raw',
  'deliveries',
  'accounts',
  'tasks',
  'actions',
  'folders',
  'deliveryPresets',
  'deliverySessions',
  'postmasterCredentials',
  'testSeeds',
  'testSeedItems',
  'testSeedEvaluations',
  'postmasterTasks'
];

function sanitizeCollection(collection) {
  const sanitized = String(collection || '').trim().toLowerCase();
  return ALLOWED_COLLECTIONS.find(c => c.toLowerCase() === sanitized) || null;
}

// ─── Server Validation ──────────────────────────────────────────────────────

function validateServer(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('Server name is required and must be a non-empty string');
    }
  } else {
    if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim().length === 0)) {
      errors.push('Server name must be a non-empty string');
    }
  }

  if (data.status !== undefined && !['active', 'paused', 'stopped'].includes(data.status)) {
    errors.push('Invalid status. Must be: active, paused, or stopped');
  }

  if (data.runtimeStatus !== undefined && !['running', 'stopped'].includes(data.runtimeStatus)) {
    errors.push('Invalid runtimeStatus. Must be: running or stopped');
  }

  if (data.sendPerDay !== undefined && !isNonNegativeInt(data.sendPerDay)) {
    errors.push('sendPerDay must be a non-negative integer');
  }

  if (data.sentPerDay !== undefined && !isNonNegativeInt(data.sentPerDay)) {
    errors.push('sentPerDay must be a non-negative integer');
  }

  if (data.dailyLimit !== undefined && !isNonNegativeInt(data.dailyLimit)) {
    errors.push('dailyLimit must be a non-negative integer');
  }

  if (data.tags !== undefined && !Array.isArray(data.tags)) {
    errors.push('tags must be an array');
  }

  if (data.tags && Array.isArray(data.tags)) {
    if (!data.tags.every(t => typeof t === 'string')) {
      errors.push('All tags must be strings');
    }
  }

  return { isValid: errors.length === 0, errors };
}

// ─── Domain Validation ──────────────────────────────────────────────────────

function validateDomain(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if ((data.serverId === undefined || data.serverId === null) || typeof data.serverId !== 'string') {
      errors.push('serverId is required');
    }
    const name = data.name || data.domain; // Accept both for legacy/frontend compatibility
    if (!name || typeof name !== 'string' || !name.includes('.')) {
      errors.push('Domain name is required and must be a valid domain format (must contain ".")');
    }
  } else {
    const name = data.name !== undefined ? data.name : data.domain;
    if (name !== undefined && (typeof name !== 'string' || !name.includes('.'))) {
      errors.push('Domain name must be a valid domain format');
    }
  }

  if (data.reputation !== undefined && !isInRange(data.reputation, 0, 100)) {
    errors.push('Reputation must be between 0 and 100');
  }

  if (data.health !== undefined && !['excellent', 'good', 'fair', 'poor'].includes(data.health)) {
    errors.push('Invalid health status. Must be: excellent, good, fair, or poor');
  }

  if (data.totalBoxes !== undefined && !isNonNegativeInt(data.totalBoxes)) {
    errors.push('totalBoxes must be a non-negative integer');
  }

  if (data.currentBoxes !== undefined && !isNonNegativeInt(data.currentBoxes)) {
    errors.push('currentBoxes must be a non-negative integer');
  }

  return { isValid: errors.length === 0, errors };
}

// ─── IP Validation ──────────────────────────────────────────────────────────

function validateIP(data, isUpdate = false) {
  const errors = [];
  const allowedStatuses = ['active', 'inactive', 'blocked', 'fresh', 'warming', 'scaled', 'burned'];

  if (!isUpdate) {
    if (!data.domainId || typeof data.domainId !== 'string') {
      errors.push('domainId is required');
    }
    if (!data.ip || !isValidIPAddress(data.ip)) {
      errors.push('Valid IP address is required');
    }
  } else {
    if (data.ip !== undefined && !isValidIPAddress(data.ip)) {
      errors.push('Invalid IP address format');
    }
  }

  if (data.status !== undefined && !allowedStatuses.includes(data.status)) {
    errors.push(`Invalid IP status. Must be one of: ${allowedStatuses.join(', ')}`);
  }

  // Extended lifecycle statuses from audit
  if (data.lifecycle !== undefined && !['fresh', 'warming', 'scaled', 'burned'].includes(data.lifecycle)) {
    errors.push('Invalid lifecycle. Must be: fresh, warming, scaled, or burned');
  }

  if (data.health_score !== undefined && !isInRange(data.health_score, 0, 100)) {
    errors.push('health_score must be between 0 and 100');
  }

  if (data.warmup_day !== undefined && !isNonNegativeInt(data.warmup_day)) {
    errors.push('warmup_day must be a non-negative integer');
  }

  if (data.success_rate !== undefined && !isInRange(data.success_rate, 0, 1)) {
    errors.push('success_rate must be between 0 and 1');
  }

  if (data.fail_rate !== undefined && !isInRange(data.fail_rate, 0, 1)) {
    errors.push('fail_rate must be between 0 and 1');
  }

  return { isValid: errors.length === 0, errors };
}

// ─── Warmup Validation ──────────────────────────────────────────────────────

function validateWarmup(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.ipId || typeof data.ipId !== 'string') {
      errors.push('ipId is required');
    }
    if (!data.domainId || typeof data.domainId !== 'string') {
      errors.push('domainId is required');
    }
    if (!data.date || !isValidDate(data.date)) {
      errors.push('Valid date (YYYY-MM-DD) is required');
    }
  } else {
    if (data.date !== undefined && !isValidDate(data.date)) {
      errors.push('Invalid date format. Must be YYYY-MM-DD');
    }
  }

  if (data.sent !== undefined && !isNonNegativeInt(data.sent)) {
    errors.push('sent must be a non-negative integer');
  }

  if (data.status !== undefined && !['scheduled', 'in_progress', 'completed'].includes(data.status)) {
    errors.push('Invalid warmup status. Must be: scheduled, in_progress, or completed');
  }

  return { isValid: errors.length === 0, errors };
}

// ─── Sending Log Validation ─────────────────────────────────────────────────

function validateSendingLog(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.serverId || typeof data.serverId !== 'string') {
      errors.push('serverId is required');
    }
    if (!data.domainId || typeof data.domainId !== 'string') {
      errors.push('domainId is required');
    }
    if (!data.ipId || typeof data.ipId !== 'string') {
      errors.push('ipId is required');
    }
  }

  // Phase tracking (from audit — warmup vs scale)
  if (data.phase !== undefined && !['warmup', 'scale'].includes(data.phase)) {
    errors.push('Invalid phase. Must be: warmup or scale');
  }

  const countFields = ['sent_count', 'success_count', 'fail_count', 'bounce_count', 'complaint_count'];
  for (const field of countFields) {
    if (data[field] !== undefined && !isNonNegativeInt(data[field])) {
      errors.push(`${field} must be a non-negative integer`);
    }
  }

  // Consistency check
  if (data.sent_count !== undefined && data.success_count !== undefined && data.fail_count !== undefined) {
    const sent = Number(data.sent_count);
    const success = Number(data.success_count);
    const fail = Number(data.fail_count);
    if (success + fail > sent) {
      errors.push('success_count + fail_count cannot exceed sent_count');
    }
  }

  return { isValid: errors.length === 0, errors };
}

// ─── Reputation Validation ──────────────────────────────────────────────────

function validateReputation(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.domainId || typeof data.domainId !== 'string') {
      errors.push('domainId is required');
    }
    if (!data.date || !isValidDate(data.date)) {
      errors.push('date must be in YYYY-MM-DD format');
    }
  } else {
    if (data.date !== undefined && !isValidDate(data.date)) {
      errors.push('Invalid date format. Must be YYYY-MM-DD');
    }
  }

  // Support frontend Postmaster format
  if (data.domainRep !== undefined || data.ipRep !== undefined || data.spamRate !== undefined) {
    if (data.domainRep !== undefined && typeof data.domainRep !== 'string') errors.push('domainRep must be a string');
    if (data.ipRep !== undefined && typeof data.ipRep !== 'string') errors.push('ipRep must be a string');
    if (data.spamRate !== undefined && typeof data.spamRate !== 'string') errors.push('spamRate must be a string');
  }

  if (data.score !== undefined && !isInRange(data.score, 0, 100)) {
    errors.push('Score must be between 0 and 100');
  }

  const statusFields = ['spf_status', 'dkim_status', 'dmarc_status'];
  for (const field of statusFields) {
    if (data[field] !== undefined && !['pass', 'fail', 'neutral'].includes(data[field])) {
      errors.push(`Invalid ${field}. Must be: pass, fail, or neutral`);
    }
  }

  if (data.blacklist_status !== undefined && !['clean', 'listed'].includes(data.blacklist_status)) {
    errors.push('Invalid blacklist_status. Must be: clean or listed');
  }

  return { isValid: errors.length === 0, errors };
}

// ─── Delivery Validation (NEW from audit) ───────────────────────────────────

function validateDelivery(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('Delivery name is required');
    }
    // Support serverId from frontend
    if (!data.serverId && !data.rdp_id) {
      errors.push('serverId (or rdp_id) is required');
    }
  } else {
    if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim().length === 0)) {
      errors.push('Delivery name must be a non-empty string');
    }
  }

  // Support totalBoxes and currentBoxes from frontend
  const total = data.totalBoxes !== undefined ? data.totalBoxes : data.total_accounts;
  const current = data.currentBoxes !== undefined ? data.currentBoxes : data.active_accounts;

  if (total !== undefined && !isNonNegativeInt(total)) {
    errors.push('totalBoxes must be a non-negative integer');
  }

  if (current !== undefined && !isNonNegativeInt(current)) {
    errors.push('currentBoxes must be a non-negative integer');
  }

  if (data.status !== undefined && !['active', 'paused', 'stopped', 'completed'].includes(data.status)) {
    errors.push('Invalid delivery status. Must be: active, paused, stopped, or completed');
  }

  return { isValid: errors.length === 0, errors };
}

// ─── Account Validation (NEW from audit) ────────────────────────────────────

function validateAccount(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.email || typeof data.email !== 'string' || !data.email.includes('@')) {
      errors.push('Valid email address is required');
    }
    if (!data.delivery_id || typeof data.delivery_id !== 'string') {
      errors.push('delivery_id is required');
    }
  } else {
    if (data.email !== undefined && (typeof data.email !== 'string' || !data.email.includes('@'))) {
      errors.push('Invalid email format');
    }
  }

  if (data.status !== undefined && !['active', 'disabled', 'restricted'].includes(data.status)) {
    errors.push('Invalid account status. Must be: active, disabled, or restricted');
  }

  return { isValid: errors.length === 0, errors };
}

// ─── Postmaster Raw Validation ──────────────────────────────────────────────

function validatePostmasterRaw(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.data || typeof data.data !== 'object' || Array.isArray(data.data)) {
      errors.push('data must be a non-null object');
    }
  }

  if (data.processed !== undefined && typeof data.processed !== 'boolean') {
    errors.push('processed must be a boolean');
  }

  return { isValid: errors.length === 0, errors };
}

// ─── Test Seed Validation ───────────────────────────────────────────────────

function validateTestSeed(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.delivery_id || typeof data.delivery_id !== 'string') {
      errors.push('delivery_id is required');
    }
  }

  if (data.status !== undefined && !['draft', 'active', 'waiting_results', 'completed', 'failed', 'archived'].includes(data.status)) {
    errors.push('Invalid status. Must be: draft, active, waiting_results, completed, failed, or archived');
  }

  return { isValid: errors.length === 0, errors };
}

// ─── Test Seed Item Validation ──────────────────────────────────────────────

function validateTestSeedItem(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.test_seed_id || typeof data.test_seed_id !== 'string') {
      errors.push('test_seed_id is required');
    }
  }

  const countFields = ['day1_target_sent', 'day2_target_sent', 'day1_actual_sent', 'day2_actual_sent'];
  for (const field of countFields) {
    if (data[field] !== undefined && !isNonNegativeInt(data[field])) {
      errors.push(`${field} must be a non-negative integer`);
    }
  }

  if (data.status !== undefined && !['pending', 'in_progress', 'ready', 'validated'].includes(data.status)) {
    errors.push('Invalid status. Must be: pending, in_progress, ready, or validated');
  }

  if (data.postmaster_day1 !== undefined && data.postmaster_day1 !== null && typeof data.postmaster_day1 !== 'string') {
    errors.push('postmaster_day1 must be a string when provided');
  }

  if (data.postmaster_day2 !== undefined && data.postmaster_day2 !== null && typeof data.postmaster_day2 !== 'string') {
    errors.push('postmaster_day2 must be a string when provided');
  }

  if (data.risk_level !== undefined && !['good', 'warning', 'risky'].includes(data.risk_level)) {
    errors.push('Invalid risk_level. Must be: good, warning, or risky');
  }

  return { isValid: errors.length === 0, errors };
}

// ─── Postmaster Task Validation ─────────────────────────────────────────────

function validatePostmasterTask(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.test_seed_item_id || typeof data.test_seed_item_id !== 'string') {
      errors.push('test_seed_item_id is required');
    }
    if (!data.task_type || !['check_day1', 'check_day2', 'refresh_status'].includes(data.task_type)) {
      errors.push('Invalid task_type');
    }
  }

  if (data.status !== undefined && !['pending', 'processing', 'completed', 'failed'].includes(data.status)) {
    errors.push('Invalid task status. Must be: pending, processing, completed, or failed');
  }

  return { isValid: errors.length === 0, errors };
}

// ─── Test Seed Evaluation Validation ────────────────────────────────────────

function validateTestSeedEvaluation(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.test_seed_id || typeof data.test_seed_id !== 'string') {
      errors.push('test_seed_id is required');
    }
  }

  if (data.spam_rate !== undefined && !['low', 'medium', 'high'].includes(data.spam_rate)) {
    errors.push('Invalid spam_rate');
  }

  if (data.ip_reputation !== undefined && !['bad', 'medium', 'good'].includes(data.ip_reputation)) {
    errors.push('Invalid ip_reputation');
  }

  if (data.domain_reputation !== undefined && !['bad', 'medium', 'good'].includes(data.domain_reputation)) {
    errors.push('Invalid domain_reputation');
  }

  if (data.feedback_loop !== undefined && !['yes', 'no'].includes(data.feedback_loop)) {
    errors.push('Invalid feedback_loop');
  }

  if (data.delivery_errors !== undefined && !['low', 'medium', 'high'].includes(data.delivery_errors)) {
    errors.push('Invalid delivery_errors');
  }

  if (data.final_result !== undefined && !['good', 'bad', 'pending'].includes(data.final_result)) {
    errors.push('Invalid final_result');
  }

  return { isValid: errors.length === 0, errors };
}

// ─── Collection-Aware Validator ─────────────────────────────────────────────

const VALIDATORS = {
  servers: validateServer,
  domains: validateDomain,
  ips: validateIP,
  warmups: validateWarmup,
  sending_logs: validateSendingLog,
  reputation: validateReputation,
  deliveries: validateDelivery,
  accounts: validateAccount,
  postmaster_raw: validatePostmasterRaw,
  testSeeds: validateTestSeed,
  testSeedItems: validateTestSeedItem,
  testSeedEvaluations: validateTestSeedEvaluation,
  postmasterTasks: validatePostmasterTask
};

function validateForCollection(collection, data, isUpdate = false) {
  const validator = VALIDATORS[collection];
  if (!validator) {
    return { isValid: true, errors: [] }; // no validation for unknown collections
  }
  return validator(data, isUpdate);
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  // Individual validators
  validateServer,
  validateDomain,
  validateIP,
  validateWarmup,
  validateSendingLog,
  validateReputation,
  validateDelivery,
  validateAccount,
  validatePostmasterRaw,
  validateTestSeed,
  validateTestSeedItem,
  validateTestSeedEvaluation,
  validatePostmasterTask,

  // Generic
  validateForCollection,
  sanitizeCollection,
  ALLOWED_COLLECTIONS,

  // Helpers
  isValidIPAddress,
  isValidDate,
  isNonNegativeInt,
  isInRange
};
