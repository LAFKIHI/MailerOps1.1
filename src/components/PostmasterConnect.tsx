import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../App';
import { apiJsonUpload } from '../lib/api';
import JSONUploadModal from './JSONUploadModal';

const ENV_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';
const SCOPE = 'https://www.googleapis.com/auth/postmaster.readonly';
const PM_API = 'https://gmailpostmastertools.googleapis.com/v1';

function getTokenKey(uid?: string) {
  return uid ? `pm_token_v2_${uid}` : null;
}

export interface PMToken {
  access_token: string;
  expires_at: number;
}

export interface PMDayStats {
  date: string;
  spamRate: number;
  domainRep: string;
  ipRep: string;
}

type ParsedCredential = {
  clientId: string;
  clientEmail?: string;
  projectId?: string;
  rawJson: string;
};

declare global { interface Window { google?: any; __gisReady?: boolean } }

function loadGIS(): Promise<void> {
  if (window.__gisReady) return Promise.resolve();
  return new Promise(resolve => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => { window.__gisReady = true; resolve(); };
    document.head.appendChild(s);
  });
}

function readToken(uid?: string): PMToken | null {
  try {
    const key = getTokenKey(uid);
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const t: PMToken = JSON.parse(raw);
    return t.expires_at > Date.now() + 60_000 ? t : null;
  } catch {
    return null;
  }
}

function saveToken(uid: string, t: PMToken) {
  const key = getTokenKey(uid);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(t));
}

function clearToken(uid?: string) {
  const key = getTokenKey(uid);
  if (!key) return;
  localStorage.removeItem(key);
}

function getFetchInfoKey(uid: string) {
  return `mailerops_pm_fetch_${uid}`;
}

export function persistFetchInfo(uid: string, count: number) {
  try {
    const payload = {
      lastFetchAt: new Date().toISOString(),
      lastFetchDomains: count,
    };
    localStorage.setItem(getFetchInfoKey(uid), JSON.stringify(payload));
  } catch {
    // non-critical
  }
}

async function readFetchInfo(uid: string): Promise<{ lastFetchAt?: string; lastFetchDomains?: number }> {
  try {
    const raw = localStorage.getItem(getFetchInfoKey(uid));
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function parsePostmasterCredentialJson(rawJson: string): ParsedCredential {
  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Invalid JSON format');
  }

  const source = parsed.web ?? parsed.installed ?? parsed;
  const clientId = source?.client_id;

  if (!clientId || typeof clientId !== 'string') {
    throw new Error('No Google OAuth client_id found in the pasted JSON');
  }

  return {
    clientId,
    clientEmail: source?.client_email,
    projectId: source?.project_id,
    rawJson: JSON.stringify(parsed, null, 2),
  };
}

export async function fetchDomainStats(
  token: PMToken,
  domainName: string
): Promise<{ stats: PMDayStats[]; error?: string }> {
  const url = `${PM_API}/domains/${encodeURIComponent(domainName)}/trafficStats?pageSize=30`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token.access_token}` } });
  } catch (e: any) {
    return { stats: [], error: 'Network error: ' + e.message };
  }

  if (res.status === 401) return { stats: [], error: '__expired__' };
  if (res.status === 403) return { stats: [], error: `Access denied for "${domainName}". Ensure you have Postmaster Tools access and the domain is verified.` };
  if (res.status === 404) return { stats: [], error: `"${domainName}" is not registered in Google Postmaster Tools. Add it at postmaster.google.com first.` };
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { stats: [], error: body?.error?.message ?? `API error ${res.status}` };
  }

  const data = await res.json();
  const raw: any[] = data.trafficStats ?? [];
  const REP_ORDER: Record<string, number> = { HIGH: 4, MEDIUM: 3, LOW: 2, BAD: 1 };

  function dominantIpRep(ipReputations: any[] | undefined): string {
    if (!ipReputations || ipReputations.length === 0) return 'N/A';
    const sorted = [...ipReputations].sort((a, b) => {
      const countDiff = Number(b.ipCount ?? 0) - Number(a.ipCount ?? 0);
      if (countDiff !== 0) return countDiff;
      return (REP_ORDER[b.reputation] ?? 0) - (REP_ORDER[a.reputation] ?? 0);
    });
    return sorted[0]?.reputation ?? 'N/A';
  }

  const parsed = raw.map(s => {
    const datePart = (s.name as string).split('/').pop() ?? '';
    const iso = datePart.length === 8
      ? `${datePart.slice(0,4)}-${datePart.slice(4,6)}-${datePart.slice(6,8)}`
      : datePart;
    const rawDomRep = s.domainReputation ?? '';
    const domainRep = rawDomRep
      ? rawDomRep.replace('_REPUTATION', '').replace('REPUTATION_CATEGORY_UNSPECIFIED', 'N/A') || 'N/A'
      : 'N/A';
    return {
      _iso: iso,
      date: new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      spamRate: parseFloat(((s.userReportedSpamRatio ?? 0) * 100).toFixed(4)),
      domainRep,
      ipRep: dominantIpRep(s.ipReputations),
    };
  });

  parsed.sort((a, b) => a._iso.localeCompare(b._iso));
  const stats: PMDayStats[] = parsed.map(({ _iso: _unused, ...rest }) => rest);
  return { stats };
}

export function usePostmaster(uid?: string) {
  const { postmasterCredentials } = useAppContext();
  const config = postmasterCredentials[0];
  const clientId = useMemo(
    () => config?.clientId?.trim() || ENV_CLIENT_ID,
    [config]
  );
  const [token, setToken] = useState<PMToken | null>(() => readToken(uid));
  const [initing, setIniting] = useState(false);
  const clientRef = useRef<any>(null);

  useEffect(() => {
    setToken(readToken(uid));
  }, [uid]);

  useEffect(() => {
    clientRef.current = null;
    if (!clientId) return;
    loadGIS().then(() => {
      clientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (resp: any) => {
          setIniting(false);
          if (resp.error || !resp.access_token || !uid) return;
          const t: PMToken = {
            access_token: resp.access_token,
            expires_at: Date.now() + (resp.expires_in ?? 3600) * 1000,
          };
          saveToken(uid, t);
          setToken(t);
        },
      });
    });
  }, [clientId, uid]);

  const connect = useCallback(() => {
    if (!uid || !clientRef.current) return;
    setIniting(true);
    clientRef.current.requestAccessToken({ prompt: 'consent' });
  }, [uid]);

  const disconnect = useCallback(() => {
    if (token && uid) window.google?.accounts.oauth2.revoke(token.access_token, () => {});
    clearToken(uid);
    setToken(null);
  }, [token, uid]);

  const handleExpired = useCallback(() => {
    clearToken(uid);
    setToken(null);
  }, [uid]);

  return { token, connected: !!token, connecting: initing, connect, disconnect, handleExpired, clientId, config };
}

export default function PostmasterConnect() {
  const {
    currentUser,
    postmasterCredentials,
    savePostmasterCredential,
    deletePostmasterCredential,
    showToast,
  } = useAppContext();
  const { connected, connecting, connect, disconnect, clientId } = usePostmaster(currentUser?.uid);
  const savedCredential = postmasterCredentials[0] ?? null;
  const [fetchInfo, setFetchInfo] = useState<{ lastFetchAt?: string; lastFetchDomains?: number }>({});
  const [jsonInput, setJsonInput] = useState(savedCredential?.rawJson ?? '');
  const [savingJson, setSavingJson] = useState(false);
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [rawJsonUploading, setRawJsonUploading] = useState(false);

  useEffect(() => {
    setJsonInput(savedCredential?.rawJson ?? '');
  }, [savedCredential?.id, savedCredential?.rawJson]);

  useEffect(() => {
    if (currentUser && connected) {
      readFetchInfo(currentUser.uid).then(setFetchInfo);
    }
  }, [currentUser, connected]);

  const handleSaveJson = async () => {
    if (!jsonInput.trim()) {
      showToast('Paste the Google client JSON first', true);
      return;
    }
    setSavingJson(true);
    try {
      const parsed = parsePostmasterCredentialJson(jsonInput);
      await savePostmasterCredential({
        source: 'manual_json',
        clientId: parsed.clientId,
        clientEmail: parsed.clientEmail,
        projectId: parsed.projectId,
        rawJson: parsed.rawJson,
      });
      showToast('Postmaster JSON saved');
    } catch (error: any) {
      showToast(error?.message ?? 'Invalid JSON', true);
    }
    setSavingJson(false);
  };

  const handleRemoveJson = async () => {
    if (!savedCredential) return;
    await deletePostmasterCredential(savedCredential.id);
    disconnect();
    setJsonInput('');
    showToast('Stored Postmaster JSON removed');
  };

  const handleClientJsonFileSelect = async (file: File) => {
    const text = await file.text();
    setJsonInput(text);
  };

  const handleRawJsonFileSelect = async (file: File) => {
    setRawJsonUploading(true);

    try {
      const text = await file.text();
      let parsed: unknown;

      try {
        parsed = JSON.parse(text);
      } catch {
        showToast('Invalid JSON format', true);
        return;
      }

      if (!Array.isArray(parsed)) {
        showToast('Invalid JSON format', true);
        return;
      }

      await apiJsonUpload(parsed, currentUser?.uid);
      showToast('Raw Postmaster JSON uploaded');
      setJsonModalOpen(false);
    } catch (error: any) {
      showToast(error?.message || 'Upload failed', true);
    } finally {
      setRawJsonUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#131619] border border-[#252b32] rounded-lg p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-bold text-[#e2e8f0]">Google Postmaster Connect</div>
            <div className="text-[11px] text-[#5a6478] font-mono mt-0.5">
              Direct Google auth is the primary flow. JSON upload stays available as an optional fallback when needed.
            </div>
          </div>
          <button
            onClick={() => setJsonModalOpen(true)}
            className="bg-[#1a1e22] border border-[#252b32] text-[#9aa5b4] text-sm font-mono px-4 py-2 rounded hover:border-[#4d8ff0] hover:text-[#4d8ff0] transition-all"
          >
            Upload JSON (optional)
          </button>
          <div className="flex flex-wrap gap-2">
            {clientId && (
              <span className="text-[10px] font-mono bg-[#0d1e3e] text-[#4d8ff0] border border-[#1a3a6e] px-2 py-0.5 rounded">
                client_id ready
              </span>
            )}
            {savedCredential?.projectId && (
              <span className="text-[10px] font-mono bg-[#141b2a] text-[#9fb8f4] border border-[#2f3e5d] px-2 py-0.5 rounded">
                project {savedCredential.projectId}
              </span>
            )}
          </div>
        </div>
      </div>

      {!clientId ? (
        <div className="bg-[#2e1e0d]/60 border border-[#f09a4d]/30 rounded-lg px-4 py-3">
          <div className="text-sm font-bold text-[#f09a4d] mb-0.5">Google client JSON not configured yet</div>
          <div className="text-[11px] text-[#5a6478] font-mono">
            Open "Upload JSON (optional)" only if the direct Gmail/Postmaster auth flow still needs a client JSON fallback.
          </div>
        </div>
      ) : !connected ? (
        <div className="bg-[#0d1e3e]/60 border border-[#1a3a6e] rounded-lg px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-bold text-[#4d8ff0] mb-0.5">
              Connect Google Postmaster Tools
            </div>
            <div className="text-[11px] text-[#5a6478] font-mono">
              Automatically fetch domain reputation, spam rate and IP reputation daily
            </div>
          </div>
          <button
            onClick={connect}
            disabled={connecting}
            className="bg-[#4d8ff0] text-white text-sm font-bold font-mono px-4 py-2 rounded hover:opacity-85 transition-opacity disabled:opacity-50 whitespace-nowrap flex items-center gap-2"
          >
            {connecting ? 'Connecting…' : 'Connect with Google →'}
          </button>
        </div>
      ) : (
        <div className="bg-[#0d2e1e]/40 border border-[#4df0a0]/20 rounded-lg px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[#4df0a0] text-sm font-bold">Postmaster Connected</span>
              <span className="text-[10px] text-[#5a6478] font-mono bg-[#131619] border border-[#252b32] px-2 py-0.5 rounded">
                Live data fetched per domain on open
              </span>
            </div>
            {fetchInfo.lastFetchAt && (
              <div className="text-[11px] text-[#5a6478] font-mono mt-0.5">
                Last fetch: {new Date(fetchInfo.lastFetchAt).toLocaleString('en-GB')}
                {fetchInfo.lastFetchDomains ? ` · ${fetchInfo.lastFetchDomains} domains` : ''}
              </div>
            )}
          </div>
          <button
            onClick={() => { disconnect(); showToast('Postmaster disconnected'); }}
            className="text-sm font-mono px-3 py-1.5 rounded bg-[#1a1e22] border border-[#252b32] text-[#5a6478] hover:text-[#f04d4d] hover:border-[#f04d4d] transition-all whitespace-nowrap"
          >
            Disconnect
          </button>
        </div>
      )}

      <JSONUploadModal
        open={jsonModalOpen}
        onClose={() => setJsonModalOpen(false)}
        clientJsonInput={jsonInput}
        savedProjectId={savedCredential?.projectId}
        savingClientJson={savingJson}
        rawJsonUploading={rawJsonUploading}
        hasSavedClientJson={!!savedCredential}
        onClientJsonInputChange={setJsonInput}
        onClientJsonFileSelect={handleClientJsonFileSelect}
        onSaveClientJson={handleSaveJson}
        onRemoveClientJson={handleRemoveJson}
        onRawJsonFileSelect={handleRawJsonFileSelect}
      />
    </div>
  );
}
