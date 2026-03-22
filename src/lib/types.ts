export interface Task {
  id: string;
  taskId: string;
  userId: string;
  deliveryName: string;
  serverId: string;
  seedCount: number;
  actionCode: string;
  folderName: string;
  date: string;
  status: 'In Progress' | 'Done';
  boxesOpened: number | null;
  boxesTotal: number | null;
  notes: string | null;
  reminderTime: string | null;
  reminderSent: boolean;
  createdAt: string;
  archived?: boolean;
}

export interface Server {
  id: string;
  userId: string;
  name: string;
  rdp: string;
  group?: string;
  tags: string[];
  status: 'active' | 'paused' | 'banned';
  runtimeStatus: 'running' | 'stopped';
  sendPerDay: number;
  reputation?: string;
  createdAt: string;
  archived?: boolean;
}

export interface Domain {
  id: string;
  userId: string;
  serverId: string;
  domain: string;
  provider: string;
  status: 'inbox' | 'spam' | 'blocked';
  unsubscribe: 'YES' | 'NO';
  spamRate: string;
  lastCheck: string;
  domainRep?: string;
  ipRep?: string;
  archived?: boolean;
}

export interface IP {
  id: string;
  userId: string;
  domainId: string;
  ip: string;
  status?: 'fresh' | 'warming' | 'scaled' | 'burned';
  warmup_day?: number;
  current_daily_send?: number;
  total_sent?: number;
  health_score?: number;
  manually_marked_ready?: boolean;
}

export interface Warmup {
  id: string;
  userId: string;
  ipId: string;
  date: string;
  sent: number;
}

export interface Reputation {
  id: string;
  userId: string;
  domainId: string;
  date: string;
  domainRep: string;
  ipRep: string;
  spamRate: string;
}

export interface PostmasterStat {
  id: string;
  userId: string;
  domainName: string;
  date: string;
  domainRep: string;
  ipRep: string;
  spamRate: string;
  userReportedSpamRatio: number;
  spamFilteredRatio: number;
  source: 'postmaster_api' | 'manual';
  fetchedAt: string;
}

export interface PostmasterCredential {
  id: string;
  userId: string;
  source: 'manual_json';
  clientId: string;
  clientEmail?: string;
  projectId?: string;
  rawJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface DBAction {
  id: string;
  userId: string;
  code: string;
  label: string;
  special: boolean;
}

export interface Folder {
  id: string;
  userId: string;
  name: string;
}

export interface DeliveryPreset {
  id: string;
  userId: string;
  name: string;
}

export interface DBState {
  tasks: Task[];
  servers: Server[];
  domains: Domain[];
  ips: IP[];
  warmups: Warmup[];
  reputation: Reputation[];
  actions: DBAction[];
  folders: Folder[];
  deliveryPresets: DeliveryPreset[];
  deliveries: Delivery[];
  deliverySessions: DeliverySession[];
  postmasterStats: PostmasterStat[];
  postmasterCredentials: PostmasterCredential[];
  testSeeds: TestSeed[];
  testSeedItems: TestSeedItem[];
  testSeedEvaluations: TestSeedEvaluation[];
  postmasterTasks: PostmasterTask[];
  providers: string[];
  groups: string[];
  currentUser: { uid: string; email: string | null } | null;
  isReady: boolean;
}

// ── Health score helpers ──────────────────────────────────────────

export function domainHealthScore(d: Domain, latestRep: Reputation | null): number {
  let score = 0;

  // Status (0-30)
  if (d.status === 'inbox')   score += 30;
  else if (d.status === 'spam') score += 10;
  // blocked = 0

  // Domain reputation (0-30)
  const dRep = d.domainRep ?? latestRep?.domainRep ?? '';
  if (dRep === 'HIGH')        score += 30;
  else if (dRep === 'MEDIUM') score += 20;
  else if (dRep === 'LOW')    score += 8;
  // BAD = 0

  // IP reputation (0-20)
  const iRep = d.ipRep ?? latestRep?.ipRep ?? '';
  if (iRep === 'HIGH')        score += 20;
  else if (iRep === 'MEDIUM') score += 13;
  else if (iRep === 'LOW')    score += 5;

  // Spam rate (0-20) only when value is available.
  let rawRate: number | null = null;
  const rawInput = d.spamRate ?? latestRep?.spamRate;
  if (typeof rawInput === 'number') {
    rawRate = rawInput;
  } else if (typeof rawInput === 'string' && rawInput.trim().length > 0) {
    const parsed = parseFloat(rawInput.replace('%', ''));
    rawRate = Number.isNaN(parsed) ? null : parsed;
  }
  if (rawRate !== null) {
    if (rawRate === 0)        score += 20;
    else if (rawRate < 0.1)   score += 16;
    else if (rawRate < 0.3)   score += 10;
    else if (rawRate < 1)     score += 4;
    // >= 1% = 0
  }

  return Math.min(100, score);
}

export function healthColor(score: number): string {
  if (score >= 80) return '#4df0a0';
  if (score >= 55) return '#4d8ff0';
  if (score >= 30) return '#f09a4d';
  return '#f04d4d';
}

export function healthLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 55) return 'Good';
  if (score >= 30) return 'At Risk';
  return 'Critical';
}

// ── Delivery tracking types ───────────────────────────────────────

export interface Delivery {
  id: string;
  userId: string;
  name: string;
  totalBoxes: number;      // boxes on day 1 — never changes
  currentBoxes: number;    // decreases when boxes are deleted
  serverId: string;
  notes: string;
  createdAt: string;
  lastActivityAt: string;
}

export interface DeliverySession {
  id: string;
  userId: string;
  deliveryId: string;
  date: string;
  actionCode: string;
  serverId: string;
  succeeded: number;    // ok, kept as-is
  badProxy: number;     // replaced proxy, back in pool
  deleted: number;      // permanently removed (disabled/restricted/mail error)
  untouched: number;    // not processed yet this session
  notes: string;
  createdAt: string;
}

// ── TEST-SEED Module Types ──────────────────────────────────────────

export interface TestSeed {
  id: string;
  userId: string;
  delivery_id: string;
  server_id: string;
  domain_id: string;
  ip_id: string;
  name?: string | null;
  status: 'draft' | 'active' | 'waiting_results' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface TestSeedItem {
  id: string;
  userId: string;
  test_seed_id: string;
  day1_target_sent: number;
  day2_target_sent: number;
  day1_actual_sent?: number | null;
  day2_actual_sent?: number | null;
  postmaster_day1?: string | null;
  postmaster_day2?: string | null;
  status: 'pending' | 'in_progress' | 'ready' | 'validated';
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestSeedEvaluation {
  id: string;
  userId: string;
  test_seed_id: string;
  spam_rate: 'low' | 'medium' | 'high';
  ip_reputation: 'bad' | 'medium' | 'good';
  domain_reputation: 'bad' | 'medium' | 'good';
  feedback_loop: 'yes' | 'no';
  delivery_errors: 'low' | 'medium' | 'high';
  final_result: 'good' | 'bad' | 'pending';
  decision_reason?: string | null;
  evaluated_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostmasterTask {
  id: string;
  userId: string;
  test_seed_item_id: string;
  task_type: 'check_day1' | 'check_day2' | 'refresh_status';
  scheduled_for: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result_payload?: any;
  error_message?: string;
  executed_at?: string;
  created_at: string;
  updated_at: string;
}
