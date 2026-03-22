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
  spamRate: number | null;
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
  domainName: string,
  limit: number = 30
): Promise<{ stats: PMDayStats[]; error?: string }> {
  const url = `${PM_API}/domains/${encodeURIComponent(domainName)}/trafficStats?pageSize=${limit}`;
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
    const spamRateRaw = s.userReportedSpamRatio;
    const spamRate = (spamRateRaw !== undefined && spamRateRaw !== null)
      ? parseFloat((spamRateRaw * 100).toFixed(4))
      : null;

    return {
      date: iso,
      spamRate,
      domainRep,
      ipRep: dominantIpRep(s.ipReputations),
    };
  });

  parsed.sort((a, b) => a.date.localeCompare(b.date));
  return { stats: parsed as PMDayStats[] };
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
    <div className="space-y-6">
      <div className="kt-card p-8 bg-muted/20 border-border/50 shadow-xl shadow-black/5 rounded-[2.5rem]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Google Postmaster Ingestion</h3>
            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-[0.2em] opacity-60">
              Direct Protocol Synchronization Layer
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex gap-2">
              {clientId && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">ID Configured</span>
                </div>
              )}
              {savedCredential?.projectId && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-info/10 border border-info/20">
                  <span className="text-[10px] font-black uppercase tracking-widest text-info">Project: {savedCredential.projectId}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setJsonModalOpen(true)}
              className="kt-btn kt-btn-light h-11 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
            >
              Protocol Settings
            </button>
          </div>
        </div>
      </div>

      {!clientId ? (
        <div className="bg-warning/5 border border-warning/20 rounded-[2rem] p-8 flex items-start gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
           <div className="w-12 h-12 rounded-2xl bg-warning/20 flex items-center justify-center text-warning text-xl">⚠️</div>
           <div className="space-y-1">
              <h4 className="text-sm font-black text-warning uppercase tracking-widest">Client Identity Missing</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed max-w-md">
                Google OAuth credentials have not been configured. Access to Postmaster Tools requires a valid client JSON fallback to initialize the handshake.
              </p>
           </div>
        </div>
      ) : !connected ? (
        <div className="bg-primary/5 border border-primary/20 rounded-[2rem] p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-start gap-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary text-xl">🔌</div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-primary uppercase tracking-widest">Connect Authorization</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed max-w-sm">
                Grant permission to automatically aggregate domain reputation, spam metrics, and network health data.
              </p>
            </div>
          </div>
          <button
            onClick={connect}
            disabled={connecting}
            className="kt-btn kt-btn-primary h-14 px-8 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
          >
            {connecting ? 'Establishing...' : 'Initialize Connection →'}
          </button>
        </div>
      ) : (
        <div className="bg-success/5 border border-success/20 rounded-[2rem] p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-start gap-6">
            <div className="w-12 h-12 rounded-2xl bg-success/20 flex items-center justify-center text-success text-xl">✅</div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-black text-success uppercase tracking-widest">Cluster Synchronized</h4>
                <div className="px-3 py-1 rounded-lg bg-background/50 border border-border text-[9px] font-black uppercase text-muted-foreground tracking-widest">Live Flow</div>
              </div>
              {fetchInfo.lastFetchAt && (
                <p className="text-[11px] text-muted-foreground font-bold">
                   Data heartbeat: <span className="text-foreground">{new Date(fetchInfo.lastFetchAt).toLocaleString('en-GB')}</span> 
                   {fetchInfo.lastFetchDomains ? ` · Processing ${fetchInfo.lastFetchDomains} domains` : ''}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => { disconnect(); showToast('Postmaster disconnected'); }}
            className="kt-btn kt-btn-light h-12 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all whitespace-nowrap"
          >
            Terminate Sync
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
