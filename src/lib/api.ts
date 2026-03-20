const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

function withUser(query: string, userId?: string) {
  const url = new URL(query, API_BASE);
  if (userId) url.searchParams.set('userId', userId);
  return url.toString();
}

function normalizeApiPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => normalizeApiPayload(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as Record<string, unknown>;
  const normalized = Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [key, normalizeApiPayload(entry)])
  ) as Record<string, unknown>;

  if (record._id !== undefined && normalized.id === undefined) {
    normalized.id = String(record._id);
  }

  delete normalized._id;

  return normalized;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();

  if (!res.ok) {
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    throw new Error(body?.error || body?.message || text || `HTTP ${res.status}`);
  }

  return (text ? normalizeApiPayload(JSON.parse(text)) : null) as T;
}

export async function apiGet<T = any>(collection: string, userId?: string): Promise<T[]> {
  const url = withUser(`${collection}`, userId);
  const res = await fetch(url);
  return handleResponse<T[]>(res);
}

export async function apiGetById<T = any>(collection: string, id: string, userId?: string): Promise<T> {
  const url = withUser(`${collection}/${encodeURIComponent(id)}`, userId);
  const res = await fetch(url);
  return handleResponse<T>(res);
}

export async function apiCreate<T = any>(collection: string, data: any, userId?: string): Promise<T> {
  const url = withUser(`${collection}`, userId);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<T>(res);
}

export async function apiUpdate<T = any>(collection: string, id: string, data: any, userId?: string): Promise<T> {
  const url = withUser(`${collection}/${encodeURIComponent(id)}`, userId);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<T>(res);
}

export async function apiDelete(collection: string, id: string, userId?: string): Promise<void> {
  const url = withUser(`${collection}/${encodeURIComponent(id)}`, userId);
  const res = await fetch(url, { method: 'DELETE' });
  await handleResponse<void>(res);
}

export async function apiJsonUpload(data: unknown, userId?: string): Promise<{ success: true; inserted: number }> {
  const url = withUser('api/json-upload', userId);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  return handleResponse<{ success: true; inserted: number }>(res);
}

export async function apiBulkServerAction(
  payload: { action: string; serverIds: string[]; value?: unknown },
  userId?: string
): Promise<{ success: true; action: string; matchedCount: number; modifiedCount: number; deletedCount: number }> {
  const url = withUser('servers/bulk-action', userId);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ success: true; action: string; matchedCount: number; modifiedCount: number; deletedCount: number }>(res);
}

// --- SHADOW EXTENSION API ---
export async function apiLogSending(data: any, userId?: string) {
  const url = withUser('api/sending-logs', userId);
  await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).catch(() => {});
}

export async function apiGetIPStats(ipId: string, userId?: string) {
  const url = withUser(`api/ip-stats/${ipId}`, userId);
  const res = await fetch(url).catch(() => null);
  return res ? res.json() : { total_sent: 0, success_rate: 0, fail_rate: 0 };
}

export async function apiGetDeliveryHealth(deliveryId: string, userId?: string) {
  const url = withUser(`api/delivery-health/${deliveryId}`, userId);
  const res = await fetch(url).catch(() => null);
  return res ? res.json() : { active: 0, disabled: 0, ratio: 0, health_score: 0 };
}
