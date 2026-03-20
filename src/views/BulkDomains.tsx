import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import { getServerRdp } from '../lib/server';

const DEFAULT_FUNCTIONS_BASE = 'https://us-central1-mailer-ops.cloudfunctions.net';

function getFunctionsBase() {
  const fromEnv = import.meta.env.VITE_FUNCTIONS_BASE as string | undefined;
  return (fromEnv && fromEnv.trim()) ? fromEnv.trim().replace(/\/$/, '') : DEFAULT_FUNCTIONS_BASE;
}

type ParsedLine = { domain: string; ip: string; raw: string };

function parseBulk(text: string): { rows: ParsedLine[]; invalid: string[] } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const rows: ParsedLine[] = [];
  const invalid: string[] = [];
  for (const raw of lines) {
    const parts = raw.split(';');
    const domain = (parts[0] ?? '').trim();
    const ip = (parts[1] ?? '').trim();
    if (!domain || !ip) invalid.push(raw);
    else rows.push({ domain, ip, raw });
  }
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
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => navigate('/servers')}
          className="text-xs font-mono px-3 py-1.5 rounded border border-[#252b32] text-[#5a6478] hover:text-[#e2e8f0] hover:border-[#4df0a0] transition-all"
        >
          ← Back
        </button>
        <h1 className="font-['Syne',sans-serif] font-bold text-[#e2e8f0] text-base flex-1">Bulk Domain Upload</h1>
        <span className="text-[11px] font-mono text-[#5a6478]">
          Postmaster: {checking ? 'checking…' : connected ? 'connected ✓' : 'not connected'}
        </span>
      </div>

      <div className="bg-[#131619] border border-[#252b32] rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-[#9aa5b4] mb-1.5 uppercase tracking-wide">
              Target Server
            </label>
            <select
              value={serverId}
              onChange={e => setServerId(e.target.value)}
              className="w-full bg-[#1a1e22] border border-[#252b32] rounded-md text-[#e2e8f0] text-sm px-3 py-2 font-mono outline-none focus:border-[#4df0a0] transition-colors"
            >
              {activeServers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{getServerRdp(s) ? ` (${getServerRdp(s)})` : ''}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-[#5a6478] font-mono mt-2">
              Each line: <span className="text-[#9aa5b4]">domain.com;1.2.3.4</span> (additional fields after IP are OK).
            </p>
          </div>

          <div className="flex items-start gap-3">
            <label className="flex items-start gap-2 cursor-pointer mt-6 select-none">
              <input
                type="checkbox"
                checked={runPostmaster}
                onChange={e => setRunPostmaster(e.target.checked)}
                className="accent-[#4df0a0] mt-0.5"
              />
              <span className="text-xs text-[#9aa5b4] font-mono">
                Run Postmaster sync after import (links domains if they already exist in your Postmaster Tools account)
              </span>
            </label>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-[11px] font-medium text-[#9aa5b4] mb-1.5 uppercase tracking-wide">
            Domains (Bulk)
          </label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={10}
            placeholder={[
              'example.com;203.0.113.10',
              'example.net;203.0.113.11',
              '',
              'Format matches the existing importer: domain;ip;provider;status;unsubscribe;spamRate;lastCheck',
            ].join('\n')}
            className="w-full bg-[#0d0f11] border border-[#252b32] rounded-md text-[#e2e8f0] text-sm px-3 py-2 font-mono outline-none focus:border-[#4df0a0] transition-colors placeholder:text-[#3b4452]"
          />

          <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
            <div className="text-[11px] font-mono text-[#5a6478]">
              Valid: <span className="text-[#e2e8f0]">{parsed.rows.length}</span>
              {parsed.invalid.length > 0 && (
                <> · Invalid: <span className="text-[#f04d4d]">{parsed.invalid.length}</span></>
              )}
            </div>
            <button
              onClick={handleUpload}
              disabled={saving}
              className="bg-[#4df0a0] text-black text-sm font-bold font-mono px-5 py-2 rounded hover:opacity-85 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Importing…' : 'Import Domains'}
            </button>
          </div>

          {parsed.invalid.length > 0 && (
            <div className="mt-3 bg-[#2e0d0d]/30 border border-[#f04d4d]/20 rounded-md p-3">
              <div className="text-[10px] uppercase tracking-widest text-[#f04d4d] mb-2 font-medium">
                Invalid lines
              </div>
              <ul className="text-xs font-mono text-[#9aa5b4] space-y-1">
                {parsed.invalid.slice(0, 8).map((l, i) => <li key={i}>{l}</li>)}
                {parsed.invalid.length > 8 && <li>…and {parsed.invalid.length - 8} more</li>}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
