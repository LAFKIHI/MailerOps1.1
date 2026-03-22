import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DBState, Task, Server, Domain, IP, Warmup, Reputation,
  DBAction, Folder, DeliveryPreset, Delivery, DeliverySession, PostmasterStat, PostmasterCredential,
  TestSeed, TestSeedItem, TestSeedEvaluation, PostmasterTask,
} from '../lib/types';
import { DEFAULT_ACTIONS, DEFAULT_DELIVERIES, DEFAULT_FOLDERS, genId, todayStr } from '../lib/constants';
import { apiCreate, apiDelete, apiGet, apiUpdate, apiLogSending, apiGetIPStats, apiGetDeliveryHealth, apiReputationUpsert, apiReputationCleanup } from '../lib/api';
import { FEATURES } from '../lib/features';
import { parseIngestionText } from '../lib/ingestion';

const STORAGE_KEY = 'mailerops_user';

const EMPTY: DBState = {
  tasks: [], servers: [], domains: [], ips: [],
  warmups: [], reputation: [], actions: [], folders: [],
  deliveryPresets: [], providers: ['Godaddy','Namecheap','Google','Cloudflare'],
  groups: ['Production','Development','Staging'],
  deliveries: [], deliverySessions: [], postmasterStats: [], postmasterCredentials: [],
  testSeeds: [], testSeedItems: [], testSeedEvaluations: [], postmasterTasks: [],
  currentUser: null, isReady: false,
};

function loadStoredUser(): { uid: string; email: string | null } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function storeUser(user: { uid: string; email: string | null }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

function clearStoredUser() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useDB() {
  const [state, setState] = useState<DBState>(EMPTY);
  const pendingReputationUpserts = useRef<Set<string>>(new Set());
  const pendingWarmupUpserts = useRef<Set<string>>(new Set());

  const setReady = useCallback((ready: boolean) => {
    setState(prev => ({ ...prev, isReady: ready }));
  }, []);

  const setCurrentUser = useCallback((user: { uid: string; email: string | null } | null) => {
    setState(prev => ({ ...prev, currentUser: user }));
  }, []);

  const loadAllData = useCallback(async (uid: string) => {
    const COLS = [
      'tasks','servers','domains','ips','warmups','reputation',
      'actions','folders','deliveryPresets',
      'deliveries','deliverySessions',
      'postmasterStats',
      'postmasterCredentials',
      'testSeeds',
      'testSeedItems',
      'testSeedEvaluations',
      'postmasterTasks',
    ] as const;

    const results = await Promise.all(COLS.map(col => apiGet(col, uid).catch(() => [])));

    setState(prev => ({
      ...prev,
      tasks:            results[0] as Task[],
      servers:          results[1] as Server[],
      domains:          results[2] as Domain[],
      ips:              results[3] as IP[],
      warmups:          results[4] as Warmup[],
      reputation:       results[5] as Reputation[],
      actions:          results[6] as DBAction[],
      folders:          results[7] as Folder[],
      deliveryPresets:  results[8] as DeliveryPreset[],
      deliveries:       results[9] as Delivery[],
      deliverySessions: results[10] as DeliverySession[],
      postmasterStats:  results[11] as PostmasterStat[],
      postmasterCredentials: results[12] as PostmasterCredential[],
      testSeeds:        results[13] as TestSeed[],
      testSeedItems:    results[14] as TestSeedItem[],
      testSeedEvaluations: results[15] as TestSeedEvaluation[],
      postmasterTasks:  results[16] as PostmasterTask[],
      isReady: true,
    }));
  }, []);

  const refreshData = useCallback(async () => {
    if (!state.currentUser?.uid) return;
    await loadAllData(state.currentUser.uid);
  }, [loadAllData, state.currentUser?.uid]);

  useEffect(() => {
    const user = loadStoredUser();
    if (!user) {
      setState(prev => ({ ...prev, isReady: true }));
      return;
    }
    setCurrentUser(user);
    loadAllData(user.uid).catch(() => setReady(true));
  }, [loadAllData, setCurrentUser, setReady]);

  const login = useCallback(async (email: string, uid?: string) => {
    const userId = uid || genId();
    const user = { uid: userId, email };
    storeUser(user);
    setCurrentUser(user);
    setReady(false);
    await loadAllData(userId);
  }, [loadAllData, setCurrentUser, setReady]);

  const logout = useCallback(() => {
    clearStoredUser();
    setState({ ...EMPTY, isReady: true });
  }, []);

  const updateLocal = useCallback(<T extends { id: string }>(
    coll: keyof DBState,
    item: T,
    merge = true
  ) => {
    setState(prev => {
      const current = (prev[coll] as any[]) ?? [];
      const existingIndex = current.findIndex(x => x.id === item.id);
      const next = [...current];
      if (existingIndex === -1) {
        next.push(item);
      } else {
        next[existingIndex] = merge ? { ...next[existingIndex], ...item } : item;
      }
      return { ...prev, [coll]: next } as DBState;
    });
  }, []);

  const removeLocal = useCallback((coll: keyof DBState, id: string) => {
    setState(prev => ({
      ...prev,
      [coll]: (prev[coll] as any[]).filter((item: any) => item.id !== id),
    } as DBState));
  }, []);

  const createTask = useCallback(async (data: Omit<Task, 'id' | 'taskId' | 'userId'>) => {
    if (!state.currentUser) return;
    const payload = { ...data, taskId: genId(), userId: state.currentUser.uid };
    const created = await apiCreate<Task>('tasks', payload, state.currentUser.uid);
    updateLocal('tasks', created);
  }, [state.currentUser, updateLocal]);

  const updateTask = useCallback(async (id: string, data: Partial<Task>) => {
    if (!state.currentUser) return;
    const updated = await apiUpdate<Task>('tasks', id, data, state.currentUser.uid);
    updateLocal('tasks', updated);
  }, [state.currentUser, updateLocal]);

  const deleteTask = useCallback(async (id: string) => {
    if (!state.currentUser) return;
    await apiDelete('tasks', id, state.currentUser.uid);
    removeLocal('tasks', id);
  }, [state.currentUser, removeLocal]);

  const duplicateTask = useCallback(async (task: Task) => {
    if (!state.currentUser) return;
    const { id: _id, ...rest } = task;
    const payload = {
      ...rest,
      taskId: genId(),
      date: todayStr(),
      status: 'In Progress',
      boxesOpened: null,
      reminderSent: false,
      createdAt: new Date().toISOString(),
      userId: state.currentUser.uid,
    };
    const created = await apiCreate<Task>('tasks', payload, state.currentUser.uid);
    updateLocal('tasks', created);
  }, [state.currentUser, updateLocal]);

  const createServer = useCallback(async (name: string, rdp = '', tags: string[] = []) => {
    if (!state.currentUser) return null;
    const existing = state.servers.find(
      s => s.name.toLowerCase() === name.toLowerCase() && !s.archived
    );
    if (existing) {
      throw new Error(`Server "${name}" already exists`);
    }
    const normalizedRdp = rdp.trim();
    const payload = {
      userId: state.currentUser.uid,
      name,
      rdp: normalizedRdp,
      group: normalizedRdp,
      tags,
      status: 'active' as const,
      runtimeStatus: 'stopped' as const,
      sendPerDay: 0,
      createdAt: new Date().toISOString(),
    };
    const created = await apiCreate<Server>('servers', payload, state.currentUser.uid);
    updateLocal('servers', created);
    return created;
  }, [state.currentUser, updateLocal]);

  const updateServer = useCallback(async (id: string, data: Partial<Server>) => {
    if (!state.currentUser) return;
    const patch = { ...data };
    if ('rdp' in patch || 'group' in patch) {
      const normalizedRdp = String(patch.rdp ?? patch.group ?? '').trim();
      patch.rdp = normalizedRdp;
      patch.group = normalizedRdp;
    }
    const updated = await apiUpdate<Server>('servers', id, patch, state.currentUser.uid);
    updateLocal('servers', updated);
  }, [state.currentUser, updateLocal]);

  const deleteServer = useCallback(async (serverId: string) => {
    if (!state.currentUser) return;

    const doms = state.domains.filter(d => d.serverId === serverId);
    const ipsToDelete = state.ips.filter(ip => doms.some(d => d.id === ip.domainId));
    const warmupsToDelete = state.warmups.filter(w => ipsToDelete.some(ip => ip.id === w.ipId));
    const reputationToDelete = state.reputation.filter(r => doms.some(d => d.id === r.domainId));

    await Promise.all([
      apiDelete('servers', serverId, state.currentUser.uid),
      ...doms.map(d => apiDelete('domains', d.id, state.currentUser.uid)),
      ...ipsToDelete.map(i => apiDelete('ips', i.id, state.currentUser.uid)),
      ...warmupsToDelete.map(w => apiDelete('warmups', w.id, state.currentUser.uid)),
      ...reputationToDelete.map(r => apiDelete('reputation', r.id, state.currentUser.uid)),
    ]);

    removeLocal('servers', serverId);
    doms.forEach(d => removeLocal('domains', d.id));
    ipsToDelete.forEach(i => removeLocal('ips', i.id));
    warmupsToDelete.forEach(w => removeLocal('warmups', w.id));
    reputationToDelete.forEach(r => removeLocal('reputation', r.id));
  }, [state, state.currentUser, removeLocal]);

  const importDomains = useCallback(async (defaultServerId: string, csv: string) => {
    if (!state.currentUser) return [];
    
    // Use smart parser
    const parsedRows = parseIngestionText(csv);
    const createdDomains: Domain[] = [];
    const createdIps: IP[] = [];

    for (const row of parsedRows) {
      const { domain, ip, serverHint, provider, status } = row;
      if (!domain) continue;

      // Identify target server
      let targetServerId = defaultServerId;
      
      // ONLY override if a serverHint is present AND we can find a server for it in the CURRENT state.
      // If we are in a bulk import (like from Servers.tsx), defaultServerId is already correct.
      if (serverHint) {
        const hLow = serverHint.toLowerCase();
        const hintNum = serverHint.replace(/\D/g, '');
        const found = state.servers.find(s => 
          !s.archived && (
            s.name.toLowerCase() === hLow || 
            s.id === hintNum
          )
        );
        if (found) {
          targetServerId = found.id;
        } else {
          // If not found in stale state, we TRUST defaultServerId if it's not empty
          if (!targetServerId) {
             // fallback to name matching or something? 
             // Logic: if defaultServerId is empty, it means we ARE relying on hints.
          }
        }
      }

      try {
        const domPayload = {
          userId: state.currentUser.uid,
          serverId: targetServerId,
          domain,
          provider,
          status: status as any,
          unsubscribe: 'NO' as const,
          spamRate: '0%',
          lastCheck: todayStr(),
        };
        const createdDomain = await apiCreate<Domain>('domains', domPayload, state.currentUser.uid);
        createdDomains.push(createdDomain);

        const ipPayload = {
          userId: state.currentUser.uid,
          domainId: createdDomain.id,
          ip,
        };
        const createdIp = await apiCreate<IP>('ips', ipPayload, state.currentUser.uid);
        createdIps.push(createdIp);
      } catch (e: any) {
        console.error('Failed to import row:', row, e);
        // Continue with other rows if one fails? Or throw? 
        // User saw "IMPORT FAILED", suggesting we should probably catch and keep going but track errors.
      }
    }

    if (createdDomains.length > 0) {
      setState(prev => ({
        ...prev,
        domains: [...prev.domains, ...createdDomains],
        ips: [...prev.ips, ...createdIps],
      }));
    }

    return createdDomains;
  }, [state.currentUser, state.domains, state.servers]);

  const updateDomain = useCallback(async (id: string, data: Partial<Domain>) => {
    if (!state.currentUser) return;
    const patch = { ...data } as Partial<Domain>;
    if ((patch as any).status) patch.lastCheck = todayStr();
    const updated = await apiUpdate<Domain>('domains', id, patch, state.currentUser.uid);
    updateLocal('domains', updated);
  }, [state.currentUser, updateLocal]);

  const deleteDomain = useCallback(async (domainId: string) => {
    if (!state.currentUser) return;
    const ipsToDelete = state.ips.filter(ip => ip.domainId === domainId);
    const warmupsToDelete = state.warmups.filter(w => ipsToDelete.some(ip => ip.id === w.ipId));
    const reputationToDelete = state.reputation.filter(r => r.domainId === domainId);

    await Promise.all([
      apiDelete('domains', domainId, state.currentUser.uid),
      ...ipsToDelete.map(i => apiDelete('ips', i.id, state.currentUser.uid)),
      ...warmupsToDelete.map(w => apiDelete('warmups', w.id, state.currentUser.uid)),
      ...reputationToDelete.map(r => apiDelete('reputation', r.id, state.currentUser.uid)),
    ]);

    removeLocal('domains', domainId);
    ipsToDelete.forEach(i => removeLocal('ips', i.id));
    warmupsToDelete.forEach(w => removeLocal('warmups', w.id));
    reputationToDelete.forEach(r => removeLocal('reputation', r.id));
  }, [state, state.currentUser, removeLocal]);

  const addWarmup = useCallback(async (ipId: string, sent: number, date?: string) => {
    if (!state.currentUser) return;
    const ip = state.ips.find(i => i.id === ipId);
    if (!ip) throw new Error(`IP with id ${ipId} not found`);
    const payload = {
      userId: state.currentUser.uid,
      ipId,
      domainId: ip.domainId,
      date: date ?? todayStr(),
      sent
    };
    const created = await apiCreate<Warmup>('warmups', payload, state.currentUser.uid);
    updateLocal('warmups', created);
  }, [state.currentUser, state.ips, updateLocal]);

  const updateWarmup = useCallback(async (id: string, sent: number) => {
    if (!state.currentUser) return;
    const updated = await apiUpdate<Warmup>('warmups', id, { sent }, state.currentUser.uid);
    updateLocal('warmups', updated);
  }, [state.currentUser, updateLocal]);

  const deleteWarmup = useCallback(async (id: string) => {
    if (!state.currentUser) return;
    await apiDelete('warmups', id, state.currentUser.uid);
    removeLocal('warmups', id);
  }, [state.currentUser, removeLocal]);

  const addReputation = useCallback(async (domainId: string, date: string, domainRep: string, ipRep: string, spamRate: string) => {
    if (!state.currentUser) return;
    const payload = { userId: state.currentUser.uid, domainId, date, domainRep, ipRep, spamRate };
    const created = await apiCreate<Reputation>('reputation', payload, state.currentUser.uid);
    updateLocal('reputation', created);
  }, [state.currentUser, updateLocal]);

  const upsertReputation = useCallback(async (domainId: string, date: string, domainRep: string, ipRep: string, spamRate: string) => {
    if (!state.currentUser) return;
    const key = `${domainId}-${date}`;
    if (pendingReputationUpserts.current.has(key)) return;
    pendingReputationUpserts.current.add(key);
    try {
      const result = await apiReputationUpsert({ domainId, date, domainRep, ipRep, spamRate }, state.currentUser.uid);
      updateLocal('reputation', result);
    } finally {
      pendingReputationUpserts.current.delete(key);
    }
  }, [state.currentUser, updateLocal]);

  const cleanupReputation = useCallback(async () => {
    if (!state.currentUser) return;
    const { success, deleted } = await apiReputationCleanup(state.currentUser.uid);
    if (success && deleted > 0) {
      await refreshData();
    }
    return { success, deleted };
  }, [state.currentUser, refreshData]);

  const updateReputation = useCallback(async (id: string, data: Partial<Reputation>) => {
    if (!state.currentUser) return;
    const updated = await apiUpdate<Reputation>('reputation', id, data, state.currentUser.uid);
    updateLocal('reputation', updated);
  }, [state.currentUser, updateLocal]);

  const deleteReputation = useCallback(async (id: string) => {
    if (!state.currentUser) return;
    await apiDelete('reputation', id, state.currentUser.uid);
    removeLocal('reputation', id);
  }, [state.currentUser, removeLocal]);

  const createTestSeed = useCallback(async (data: Omit<TestSeed, 'id' | 'userId' | 'created_at' | 'updated_at'>) => {
    if (!state.currentUser) return;
    
    // Rule A: One active test per delivery
    const existing = state.testSeeds.find(s => 
      s.delivery_id === data.delivery_id && 
      ['draft', 'active', 'waiting_results'].includes(s.status)
    );
    if (existing) {
      throw new Error("This sublist is already under test.");
    }

    const now = new Date().toISOString();
    const payload = { ...data, userId: state.currentUser.uid, created_at: now, updated_at: now };
    const created = await apiCreate<TestSeed>('testSeeds', payload, state.currentUser.uid);
    updateLocal('testSeeds', created);
    return created;
  }, [state.currentUser, state.testSeeds, updateLocal]);

  const updateTestSeed = useCallback(async (id: string, data: Partial<TestSeed>) => {
    if (!state.currentUser) return;
    const now = new Date().toISOString();
    const updated = await apiUpdate<TestSeed>('testSeeds', id, { ...data, updated_at: now }, state.currentUser.uid);
    updateLocal('testSeeds', updated);
    return updated;
  }, [state.currentUser, updateLocal]);

  const deleteTestSeed = useCallback(async (id: string) => {
    if (!state.currentUser) return;

    const relatedItems = state.testSeedItems.filter((item) => item.test_seed_id === id);
    const relatedItemIds = new Set(relatedItems.map((item) => item.id));
    const relatedEvaluations = state.testSeedEvaluations.filter((evaluation) => evaluation.test_seed_id === id);
    const relatedTasks = state.postmasterTasks.filter((task) => relatedItemIds.has(task.test_seed_item_id));

    await apiDelete('testSeeds', id, state.currentUser.uid);

    removeLocal('testSeeds', id);
    relatedItems.forEach((item) => removeLocal('testSeedItems', item.id));
    relatedEvaluations.forEach((evaluation) => removeLocal('testSeedEvaluations', evaluation.id));
    relatedTasks.forEach((task) => removeLocal('postmasterTasks', task.id));
  }, [removeLocal, state.currentUser, state.postmasterTasks, state.testSeedEvaluations, state.testSeedItems]);

  const createTestSeedItem = useCallback(async (data: Omit<TestSeedItem, 'id' | 'userId' | 'created_at' | 'updated_at'>) => {
    if (!state.currentUser) return;
    const now = new Date().toISOString();
    const payload = { ...data, userId: state.currentUser.uid, created_at: now, updated_at: now };
    const created = await apiCreate<TestSeedItem>('testSeedItems', payload, state.currentUser.uid);
    updateLocal('testSeedItems', created);
    return created;
  }, [state.currentUser, updateLocal]);

  const createTestSeedEvaluation = useCallback(async (data: Omit<TestSeedEvaluation, 'id' | 'userId' | 'created_at' | 'updated_at'>) => {
    if (!state.currentUser) return;
    const now = new Date().toISOString();
    const payload = { ...data, userId: state.currentUser.uid, created_at: now, updated_at: now };
    const created = await apiCreate<TestSeedEvaluation>('testSeedEvaluations', payload, state.currentUser.uid);
    updateLocal('testSeedEvaluations', created);
    return created;
  }, [state.currentUser, updateLocal]);

  const createPostmasterTask = useCallback(async (data: Omit<PostmasterTask, 'id' | 'userId' | 'created_at' | 'updated_at'>) => {
    if (!state.currentUser) return;
    const now = new Date().toISOString();
    const payload = { ...data, userId: state.currentUser.uid, created_at: now, updated_at: now };
    const created = await apiCreate<PostmasterTask>('postmasterTasks', payload, state.currentUser.uid);
    updateLocal('postmasterTasks', created);
    return created;
  }, [state.currentUser, updateLocal]);

  const updateTestSeedItem = useCallback(async (id: string, data: Partial<TestSeedItem>) => {
    if (!state.currentUser) return;
    const updated = await apiUpdate<TestSeedItem>('testSeedItems', id, data, state.currentUser.uid);
    updateLocal('testSeedItems', updated);
  }, [state.currentUser, updateLocal]);

  const upsertWarmup = useCallback(async (ipId: string, sent: number, date?: string) => {
    if (!state.currentUser) return;
    const d = date ?? todayStr();
    const key = `${ipId}-${d}`;
    if (pendingWarmupUpserts.current.has(key)) return;
    pendingWarmupUpserts.current.add(key);
    const existing = state.warmups.find(w => w.ipId === ipId && w.date === d);
    try {
      if (existing) {
        const updated = await apiUpdate<Warmup>('warmups', existing.id, { sent }, state.currentUser.uid);
        updateLocal('warmups', updated);
      } else {
        await addWarmup(ipId, sent, d);
      }
    } finally {
      pendingWarmupUpserts.current.delete(key);
    }
  }, [state.currentUser, state.warmups, addWarmup, updateLocal]);

  const createDelivery = useCallback(async (
    name: string, totalBoxes: number, serverId: string, notes = ''
  ) => {
    if (!state.currentUser) return;
    const now = new Date().toISOString();
    const payload = {
      userId: state.currentUser.uid,
      name: name.trim(),
      totalBoxes,
      currentBoxes: totalBoxes,
      serverId,
      notes,
      createdAt: now,
      lastActivityAt: now,
    };
    const created = await apiCreate<Delivery>('deliveries', payload, state.currentUser.uid);
    updateLocal('deliveries', created);
  }, [state.currentUser, updateLocal]);

  const updateDelivery = useCallback(async (id: string, data: Partial<Delivery>) => {
    if (!state.currentUser) return;
    const updated = await apiUpdate<Delivery>('deliveries', id, data, state.currentUser.uid);
    updateLocal('deliveries', updated);
  }, [state.currentUser, updateLocal]);

  const deleteDelivery = useCallback(async (id: string) => {
    if (!state.currentUser) return;
    const sessionsToDelete = state.deliverySessions.filter(s => s.deliveryId === id);
    await Promise.all([
      apiDelete('deliveries', id, state.currentUser.uid),
      ...sessionsToDelete.map(s => apiDelete('deliverySessions', s.id, state.currentUser.uid)),
    ]);
    removeLocal('deliveries', id);
    sessionsToDelete.forEach(s => removeLocal('deliverySessions', s.id));
  }, [state, state.currentUser, removeLocal]);

  const addDeliverySession = useCallback(async (
    deliveryId: string,
    session: Omit<DeliverySession, 'id' | 'userId' | 'deliveryId' | 'createdAt'>
  ) => {
    if (!state.currentUser) return;
    const now = new Date().toISOString();
    const payload = {
      ...session,
      deliveryId,
      userId: state.currentUser.uid,
      createdAt: now,
    };

    const created = await apiCreate<DeliverySession>('deliverySessions', payload, state.currentUser.uid);
    updateLocal('deliverySessions', created);

    const delivery = state.deliveries.find(d => d.id === deliveryId);
    if (delivery) {
      const newCurrent = Math.max(0, delivery.currentBoxes - session.deleted);
      const updatedDelivery = await apiUpdate<Delivery>('deliveries', deliveryId, {
        currentBoxes: newCurrent,
        lastActivityAt: now,
      }, state.currentUser.uid);
      updateLocal('deliveries', updatedDelivery);
    }
  }, [state.currentUser, state.deliveries, updateLocal]);

  const updateDeliverySession = useCallback(async (id: string, data: Partial<DeliverySession>) => {
    if (!state.currentUser) return;
    const updated = await apiUpdate<DeliverySession>('deliverySessions', id, data, state.currentUser.uid);
    updateLocal('deliverySessions', updated);
  }, [state.currentUser, updateLocal]);

  const deleteDeliverySession = useCallback(async (id: string) => {
    if (!state.currentUser) return;
    const session = state.deliverySessions.find(s => s.id === id);
    if (session) {
      const delivery = state.deliveries.find(d => d.id === session.deliveryId);
      if (delivery) {
        const updatedDelivery = await apiUpdate<Delivery>('deliveries', session.deliveryId, {
          currentBoxes: delivery.currentBoxes + session.deleted,
        }, state.currentUser.uid);
        updateLocal('deliveries', updatedDelivery);
      }
    }
    await apiDelete('deliverySessions', id, state.currentUser.uid);
    removeLocal('deliverySessions', id);
  }, [state.currentUser, state.deliverySessions, state.deliveries, removeLocal, updateLocal]);

  const addAction = useCallback(async (code: string, label: string, special: boolean) => {
    if (!state.currentUser) return;
    const payload = { userId: state.currentUser.uid, code, label, special };
    const created = await apiCreate<DBAction>('actions', payload, state.currentUser.uid);
    updateLocal('actions', created);
  }, [state.currentUser, updateLocal]);

  const updateAction = useCallback(async (id: string, data: Partial<DBAction>) => {
    if (!state.currentUser) return;
    const updated = await apiUpdate<DBAction>('actions', id, data, state.currentUser.uid);
    updateLocal('actions', updated);
  }, [state.currentUser, updateLocal]);

  const deleteAction = useCallback(async (id: string) => {
    if (!state.currentUser) return;
    await apiDelete('actions', id, state.currentUser.uid);
    removeLocal('actions', id);
  }, [state.currentUser, removeLocal]);

  const addFolder = useCallback(async (name: string) => {
    if (!state.currentUser) return;
    const payload = { userId: state.currentUser.uid, name };
    const created = await apiCreate<Folder>('folders', payload, state.currentUser.uid);
    updateLocal('folders', created);
  }, [state.currentUser, updateLocal]);

  const deleteFolder = useCallback(async (id: string) => {
    if (!state.currentUser) return;
    await apiDelete('folders', id, state.currentUser.uid);
    removeLocal('folders', id);
  }, [state.currentUser, removeLocal]);

  const addDeliveryPreset = useCallback(async (name: string) => {
    if (!state.currentUser) return;
    const payload = { userId: state.currentUser.uid, name };
    const created = await apiCreate<DeliveryPreset>('deliveryPresets', payload, state.currentUser.uid);
    updateLocal('deliveryPresets', created);
  }, [state.currentUser, updateLocal]);

  const deleteDeliveryPreset = useCallback(async (id: string) => {
    if (!state.currentUser) return;
    await apiDelete('deliveryPresets', id, state.currentUser.uid);
    removeLocal('deliveryPresets', id);
  }, [state.currentUser, removeLocal]);

  const savePostmasterCredential = useCallback(async (
    data: Omit<PostmasterCredential, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!state.currentUser) return null;
    const existing = state.postmasterCredentials[0];
    if (existing) {
      const updated = await apiUpdate<PostmasterCredential>('postmasterCredentials', existing.id, data, state.currentUser.uid);
      updateLocal('postmasterCredentials', updated);
      return updated;
    }
    const created = await apiCreate<PostmasterCredential>('postmasterCredentials', {
      ...data,
      userId: state.currentUser.uid,
    }, state.currentUser.uid);
    updateLocal('postmasterCredentials', created);
    return created;
  }, [state.currentUser, state.postmasterCredentials, updateLocal]);

  const deletePostmasterCredential = useCallback(async (id: string) => {
    if (!state.currentUser) return;
    await apiDelete('postmasterCredentials', id, state.currentUser.uid);
    removeLocal('postmasterCredentials', id);
  }, [state.currentUser, removeLocal]);

  const initDefaultData = useCallback(async () => {
    if (!state.currentUser || state.actions.length > 0) return;
    const createdActions = await Promise.all(
      DEFAULT_ACTIONS.map(a => apiCreate<DBAction>('actions', { ...a, userId: state.currentUser!.uid }, state.currentUser!.uid))
    );
    const createdFolders = await Promise.all(
      DEFAULT_FOLDERS.map(name => apiCreate<Folder>('folders', { name, userId: state.currentUser!.uid }, state.currentUser!.uid))
    );
    const createdPresets = await Promise.all(
      DEFAULT_DELIVERIES.map(name => apiCreate<DeliveryPreset>('deliveryPresets', { name, userId: state.currentUser!.uid }, state.currentUser!.uid))
    );

    setState(prev => ({
      ...prev,
      actions: [...prev.actions, ...createdActions],
      folders: [...prev.folders, ...createdFolders],
      deliveryPresets: [...prev.deliveryPresets, ...createdPresets],
    }));
  }, [state.currentUser, state.actions.length]);

  // --- SHADOW INTELLIGENCE LAYER ---
  const logSending = useCallback(async (data: any) => {
    if (!FEATURES.IP_TRACKING || !state.currentUser) return;
    await apiLogSending(data, state.currentUser.uid);
  }, [state.currentUser]);

  const getIPStats = useCallback(async (ipId: string) => {
    if (!FEATURES.SMART_STATS || !state.currentUser) return { total_sent: 0, success_rate: 0, fail_rate: 0 };
    return await apiGetIPStats(ipId, state.currentUser.uid);
  }, [state.currentUser]);

  const getDeliveryHealth = useCallback(async (deliveryId: string) => {
    if (!FEATURES.SMART_STATS || !state.currentUser) return { active: 0, disabled: 0, ratio: 0, health_score: 0 };
    return await apiGetDeliveryHealth(deliveryId, state.currentUser.uid);
  }, [state.currentUser]);

  const markIpReady = useCallback(async (ipId: string) => {
    if (!state.currentUser) return;
    try {
      const updated = await apiUpdate<IP>('ips', ipId, { manually_marked_ready: true, status: 'scaled' }, state.currentUser.uid);
      updateLocal('ips', updated);
    } catch {}
  }, [state.currentUser, updateLocal]);

  const markIpBurned = useCallback(async (ipId: string) => {
    if (!state.currentUser) return;
    try {
      const updated = await apiUpdate<IP>('ips', ipId, { status: 'burned' }, state.currentUser.uid);
      updateLocal('ips', updated);
    } catch {}
  }, [state.currentUser, updateLocal]);
  // --- END SHADOW LAYER ---

  return {
    ...state,
    login,
    logout,
    // tasks
    createTask, updateTask, deleteTask, duplicateTask,
    // servers
    createServer, updateServer, deleteServer,
    // domains
    importDomains, updateDomain, deleteDomain,
    // warmup / rep
    addWarmup, updateWarmup, deleteWarmup, upsertWarmup,
    addReputation, updateReputation, deleteReputation, upsertReputation, cleanupReputation,
    // deliveries
    createDelivery, updateDelivery, deleteDelivery,
    addDeliverySession, updateDeliverySession, deleteDeliverySession,
    // settings
    addAction, updateAction, deleteAction,
    addFolder, deleteFolder,
    addDeliveryPreset, deleteDeliveryPreset,
    savePostmasterCredential, deletePostmasterCredential,
    initDefaultData,
    refreshData,
    logSending, getIPStats, getDeliveryHealth, markIpReady, markIpBurned,
    createTestSeed, updateTestSeed, deleteTestSeed, createTestSeedItem, updateTestSeedItem, createTestSeedEvaluation, createPostmasterTask,
  };
}
