import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import { getServerRdp } from '../lib/server';

const DEFAULT_FUNCTIONS_BASE = 'https://us-central1-mailer-ops.cloudfunctions.net';

function getFunctionsBase() {
  const fromEnv = import.meta.env.VITE_FUNCTIONS_BASE as string | undefined;
  return (fromEnv && fromEnv.trim()) ? fromEnv.trim().replace(/\/$/, '') : DEFAULT_FUNCTIONS_BASE;
}

import { parseIngestionText, IngestionPart } from '../lib/ingestion';

function parseBulk(text: string): { rows: IngestionPart[]; invalid: IngestionPart[] } {
  const all = parseIngestionText(text);
  const rows = all.filter(r => !r.error);
  const invalid = all.filter(r => !!r.error);
  return { rows, invalid };
}

export default function BulkDomains() {
  const ctx = useAppContext();
  const { servers, currentUser, showToast, importDomains } = ctx;
  const navigate = useNavigate();

  const [serverId, setServerId] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [runPostmaster, setRunPostmaster] = useState(true);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const functionsBase = useMemo(() => getFunctionsBase(), []);
  const activeServers = useMemo(() => servers.filter(s => !s.archived), [servers]);

  const parsed = useMemo(() => parseBulk(text), [text]);

  useEffect(() => {
    if (!serverId && activeServers.length) setServerId(activeServers[0].id);
  }, [activeServers, serverId]);

  // Check Postmaster connection (optional UX, but helps explain “linking”)
  useEffect(() => {
    if (!currentUser) return;
    let canceled = false;
    (async () => {
      setChecking(true);
      try {
        const res = await fetch(`${functionsBase}/postmasterFetch?uid=${currentUser.uid}&check=true`);
        if (canceled) return;
        setConnected(res.ok);
      } catch {
        if (canceled) return;
        setConnected(false);
      } finally {
        if (!canceled) setChecking(false);
      }
    })();
    return () => { canceled = true; };
  }, [currentUser, functionsBase]);

  const handleUpload = async () => {
    if (!serverId) { showToast('Pick a server first', true); return; }
    if (!text.trim()) { showToast('Paste domains first', true); return; }
    if (parsed.rows.length === 0) { showToast('No valid lines (use: domain;ip)', true); return; }
    if (parsed.invalid.length) { showToast(`Fix ${parsed.invalid.length} invalid line(s)`, true); return; }

    setSaving(true);
    try {
      await importDomains(serverId, text);
      showToast(`Imported ${parsed.rows.length} domain(s) ✓`);

      if (runPostmaster && currentUser) {
        if (!connected) {
          showToast('Imported. Postmaster not connected (skipped fetch).', true);
        } else {
          // Optional: show how many of the uploaded domains exist in Postmaster Tools
          try {
            const res = await fetch(`${functionsBase}/postmasterDomains?uid=${currentUser.uid}`);
            const data = await res.json().catch(() => ({}));
            const pm = new Set<string>((data?.domains ?? []).map((d: unknown) => String(d).toLowerCase()));
            const uploaded = parsed.rows.map(r => r.domain.toLowerCase());
            const matched = uploaded.filter(d => pm.has(d)).length;
            showToast(`Postmaster domains: ${matched}/${uploaded.length} verified`);
          } catch {
            // ignore
          }

          const res = await fetch(`${functionsBase}/postmasterFetch?uid=${currentUser.uid}`);
          const data = await res.json().catch(() => ({}));
          if (res.ok && data?.success) showToast(`Postmaster synced (${data.domainsUpdated} records) ✓`);
          else showToast(data?.error || 'Postmaster fetch failed', true);
        }
      }

      setText('');
    } catch {
      showToast('Import failed', true);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/servers')}
            className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all shadow-sm"
          >
            ←
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bulk Data Ingestion</h1>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Scale your infrastructure rapidly</p>
          </div>
        </div>
        
        <div className={`px-4 py-2 rounded-2xl border flex items-center gap-3 transition-colors ${
          connected ? 'bg-success/5 border-success/20 text-success' : 'bg-muted border-border text-muted-foreground'
        }`}>
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Postmaster: {checking ? 'VERIFYING...' : connected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
      </div>

      <div className="kt-card shadow-2xl shadow-black/5 border-border/50">
        <div className="p-8 border-b border-border bg-muted/20">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                Target Infrastructure Cluster
              </label>
              <select
                value={serverId}
                onChange={e => setServerId(e.target.value)}
                className="w-full bg-background border border-border rounded-xl text-foreground text-sm px-4 py-3 font-mono outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'org.w3.org/2000/svg\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1rem' }}
              >
                {activeServers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{getServerRdp(s) ? ` (${getServerRdp(s)})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-3 opacity-50">
                Pattern: <span className="text-foreground">domain;ip</span> (e.g. google.com;1.1.1.1)
              </p>
            </div>

            <div className="bg-primary/5 rounded-2xl p-5 border border-primary/10 flex items-start gap-4 h-full">
              <input
                type="checkbox"
                id="pm-sync"
                checked={runPostmaster}
                onChange={e => setRunPostmaster(e.target.checked)}
                className="w-5 h-5 rounded border-border text-primary focus:ring-primary/20 cursor-pointer mt-0.5"
              />
              <label htmlFor="pm-sync" className="text-xs text-primary font-bold leading-relaxed cursor-pointer select-none">
                Auto-sync with Postmaster Tools
                <span className="block text-[10px] font-normal text-muted-foreground mt-1 tracking-normal opacity-80 italic">
                  Systems will automatically attempt to link domains to your verified workspace after successful ingestion.
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="p-8">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Domain Dataset (CSV Payload)
          </label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={12}
            placeholder={[
              'example.com;203.0.113.10',
              'example.net;203.0.113.11',
              '',
              'Supports complex payloads: domain;ip;provider;status;unsubscribe;spamRate;lastCheck',
            ].join('\n')}
            className="w-full bg-muted/30 border border-border rounded-2xl text-foreground text-sm px-5 py-4 font-mono outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/50 transition-all placeholder:text-muted-foreground/30 resize-none"
          />

          <div className="flex items-center justify-between gap-4 flex-wrap mt-6">
            <div className="flex items-center gap-4 bg-muted/50 px-4 py-2 rounded-xl">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Verified: <span className="text-foreground">{parsed.rows.length}</span>
              </div>
              {parsed.invalid.length > 0 && (
                <div className="text-[10px] font-bold uppercase tracking-widest text-destructive">
                  Flagged: <span className="text-destructive font-black">{parsed.invalid.length}</span>
                </div>
              )}
            </div>
            
            <button
              onClick={handleUpload}
              disabled={saving}
              className="px-10 py-3 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 h-12 font-bold hover:opacity-90 transition-all disabled:opacity-50"
            >
              {saving ? 'Processing Batch...' : 'Commit Ingestion'}
            </button>
          </div>

          {parsed.rows.length > 0 && (
            <div className="mt-8 border border-border/50 rounded-2xl overflow-hidden bg-muted/10 animate-in fade-in slide-in-from-top-4">
              <div className="px-5 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payload Preview</span>
                <span className="text-[10px] font-medium text-muted-foreground/60 italic">Auto-detection active</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/20 text-muted-foreground font-bold uppercase tracking-tighter">
                    <tr>
                      <th className="px-5 py-3">Domain</th>
                      <th className="px-5 py-3">IP Address</th>
                      <th className="px-5 py-3">Provider</th>
                      <th className="px-5 py-3">Server Hint</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {parsed.rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="hover:bg-primary/5 transition-colors">
                        <td className="px-5 py-3 font-semibold text-foreground">{r.domain}</td>
                        <td className="px-5 py-3 font-mono text-muted-foreground opacity-80">{r.ip}</td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 rounded-md bg-surface2 border border-border text-[10px] font-bold uppercase">
                            {r.provider}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {r.serverHint ? (
                            <span className="text-primary font-bold">@{r.serverHint}</span>
                          ) : (
                            <span className="text-muted-foreground/40 italic">-- fallback --</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.rows.length > 5 && (
                <div className="px-5 py-2 bg-muted/10 text-center border-t border-border">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                    + {parsed.rows.length - 5} additional records in queue
                  </span>
                </div>
              )}
            </div>
          )}

          {parsed.invalid.length > 0 && (
            <div className="mt-8 p-6 rounded-2xl bg-destructive/5 border border-destructive/10 animate-in slide-in-from-top-4">
              <div className="flex items-center gap-3 mb-4">
                 <div className="w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center text-[10px] font-bold">!</div>
                 <h4 className="text-[10px] font-bold text-destructive uppercase tracking-[0.2em]">Rejected Definitions</h4>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 font-mono text-xs text-muted-foreground">
                {parsed.invalid.slice(0, 10).map((l, i) => (
                  <li key={i} className="flex items-center gap-2 truncate">
                    <span className="w-1 h-3 rounded-full bg-destructive opacity-30" />
                    <span className="text-destructive/80 font-bold mr-2">[{l.error}]</span>
                    {l.raw}
                  </li>
                ))}
                {parsed.invalid.length > 10 && (
                  <li className="text-destructive font-bold pt-1">...and {parsed.invalid.length - 10} additional invalid records</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
