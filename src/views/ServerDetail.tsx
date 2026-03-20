import {
  useEffect,
  useRef,
  useState,
} from 'react';

//import { useEffect, useRef, useState } from 'react';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import { useAppContext } from '../App';
import { getServerRdp } from '../lib/server';
import Modal, {
  Field,
  Input,
  ModalFooter,
  Select,
} from '../components/Modal';
import type { PMDayStats } from '../components/PostmasterConnect';
import PostmasterConnect, {
  fetchDomainStats,
  persistFetchInfo,
  usePostmaster,
} from '../components/PostmasterConnect';
import {
  fmtDate,
  todayStr,
} from '../lib/constants';
import type {
  Domain,
  IP,
  Reputation,
  Warmup,
} from '../lib/types';
import {
  domainHealthScore,
  healthColor,
  healthLabel,
} from '../lib/types';

// ─────────────────────────────────────────────────────────────────
// Main view — three nested levels: Server → Domain → IP
// ─────────────────────────────────────────────────────────────────

type Panel = 'server' | 'domain' | 'ip';

export default function ServerDetail() {
  const { id: serverId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ctx = useAppContext();
  const { servers, domains, ips, warmups, reputation, showToast } = ctx;

  const [panel,        setPanel]       = useState<Panel>('server');
  const [activeDomain, setActiveDomain]= useState<Domain | null>(null);
  const [activeIP,     setActiveIP]    = useState<IP | null>(null);
  const [importOpen,   setImportOpen]  = useState(false);
  const [addDomOpen,   setAddDomOpen]  = useState(false);
  const [importText,   setImportText]  = useState('');
  const [newDomain,    setNewDomain]   = useState('');
  const [newIP,        setNewIP]       = useState('');
  const [saving,       setSaving]      = useState(false);
  const [selected,     setSelected]    = useState<Set<string>>(new Set());
  const [bulkStatus,   setBulkStatus]  = useState('');
  const [bulkSent,     setBulkSent]    = useState('');
  const [bulkDate,     setBulkDate]    = useState(todayStr());
  const [bulkSaving,   setBulkSaving]  = useState(false);
  const [pmFetching,   setPmFetching]  = useState(false);
  const pmFetchedRef = useRef(false);

  const server       = servers.find(s => s.id === serverId);
  const serverDomains= domains.filter(d => d.serverId === serverId && !d.archived);

  // ── Postmaster bulk-fetch (auto on mount + manual refresh) ──────
  const { token: pmToken, connected: pmConnected } = usePostmaster(ctx.currentUser?.uid);

  // Walk stats newest→oldest (stats is sorted oldest→newest by fetchDomainStats),
  // return first non-null non-N/A value for a field.
  const latestVal = (stats: any[], key: string): string | null => {
    for (let i = stats.length - 1; i >= 0; i--) {
      const v = stats[i][key];
      if (v && v !== 'N/A') return v as string;
    }
    return null;
  };

  const debugPmStats = (domain: string, stats: any[]) => {
    if (stats.length === 0) return;
    const last3 = stats.slice(-3);
    console.log(`[PM] ${domain} — last 3 entries:`, JSON.stringify(last3, null, 2));
    console.log(`[PM] ${domain} — picked domainRep: ${latestVal(stats, 'domainRep')}, ipRep: ${latestVal(stats, 'ipRep')}`);
  };

  const runPmFetch = async (domains: typeof serverDomains, token: typeof pmToken) => {
    if (!token) return;
    setPmFetching(true);
    const results = await Promise.allSettled(
      domains.map(async (d) => {
        const { stats, error } = await fetchDomainStats(token, d.domain);
        debugPmStats(d.domain, stats);
        // Always write — even 'N/A' — so stale incorrect values get cleared
        const domRep   = error || stats.length === 0 ? null : latestVal(stats, 'domainRep');
        const ipRep    = error || stats.length === 0 ? null : latestVal(stats, 'ipRep');
        const latest   = stats[stats.length - 1] ?? null;
        const spamRate = latest?.spamRate != null ? latest.spamRate.toFixed(4) + '%' : null;
        await ctx.updateDomain(d.id, {
          domainRep: domRep ?? '',
          ipRep:     ipRep  ?? '',
          ...(spamRate && { spamRate }),
        });
        return domRep || ipRep ? d.domain : null;
      })
    );
    setPmFetching(false);
    const saved = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
    if (saved > 0 && ctx.currentUser?.uid) persistFetchInfo(ctx.currentUser.uid, saved);
    showToast(saved > 0
      ? `Postmaster: updated ${saved} domain${saved > 1 ? 's' : ''} ✓`
      : 'Postmaster: no new data found'
    );
  };

  useEffect(() => {
    if (!pmConnected || !pmToken || pmFetchedRef.current || serverDomains.length === 0) return;
    pmFetchedRef.current = true;
    runPmFetch(serverDomains, pmToken);
  }, [pmConnected, pmToken, serverId, serverDomains.length]);

  if (!server) return (
    <div className="text-center py-20">
      <p className="text-[#5a6478] font-mono text-sm">Server not found.</p>
      <button onClick={() => navigate('/servers')} className="mt-4 text-[#4df0a0] text-sm font-mono hover:underline">← Back to Servers</button>
    </div>
  );

  // ── helpers ──────────────────────────────────────────────────
  const getIP     = (domainId: string) => ips.find(ip => ip.domainId === domainId);
  const sentToday = (ipId: string) => {
    const today = todayStr();
    return warmups.filter(w => w.ipId === ipId && w.date === today).reduce((s, w) => s + w.sent, 0);
  };
  const latestRep = (domainId: string): Reputation | null => {
    const recs = reputation.filter(r => r.domainId === domainId);
    return recs.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  };

  // ── mutations ─────────────────────────────────────────────────
  const handleImport = async () => {
    if (!importText.trim() || !serverId) return;
    setSaving(true);
    try { await ctx.importDomains(serverId, importText); showToast('Imported ✓'); setImportOpen(false); setImportText(''); }
    catch { showToast('Import failed', true); }
    setSaving(false);
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim() || !serverId) return;
    setSaving(true);
    try {
      await ctx.importDomains(serverId, `${newDomain.trim()};${newIP.trim() || '0.0.0.0'}`);
      showToast('Domain added ✓'); setAddDomOpen(false); setNewDomain(''); setNewIP('');
    } catch { showToast('Error', true); }
    setSaving(false);
  };

  const handleDeleteDomain = async (domainId: string) => {
    if (!confirm('Delete domain and all its IPs, warmups and reputation records?')) return;
    try { await ctx.deleteDomain(domainId); showToast('Deleted'); }
    catch { showToast('Error', true); }
  };

  const handleStatusChange = async (domainId: string, status: string) => {
    try { await ctx.updateDomain(domainId, { status: status as 'inbox' | 'spam' | 'blocked' }); }
    catch { showToast('Error', true); }
  };

  // ── Bulk selection helpers ────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === serverDomains.length) setSelected(new Set());
    else setSelected(new Set(serverDomains.map(d => d.id)));
  };
  const handleBulkStatus = async () => {
    if (!bulkStatus || selected.size === 0) return;
    setBulkSaving(true);
    try {
      await Promise.all([...selected].map(id =>
        ctx.updateDomain(id, { status: bulkStatus as 'inbox' | 'spam' | 'blocked' })
      ));
      showToast(`Updated ${selected.size} domain${selected.size > 1 ? 's' : ''} to ${bulkStatus} ✓`);
      setSelected(new Set()); setBulkStatus('');
    } catch { showToast('Bulk update failed', true); }
    setBulkSaving(false);
  };

  const selectedDomainsWithIps = [...selected]
    .map(id => {
      const domain = serverDomains.find(d => d.id === id);
      const ip = domain ? getIP(domain.id) : null;
      return domain && ip ? { domain, ip } : null;
    })
    .filter(Boolean) as { domain: Domain; ip: IP }[];

  const handleBulkWarmup = async () => {
    const sent = Number(bulkSent);
    if (!sent || sent < 0 || selectedDomainsWithIps.length === 0) return;
    setBulkSaving(true);
    try {
      await Promise.all(selectedDomainsWithIps.map(({ ip }) => {
        const existing = warmups.find(w => w.ipId === ip.id && w.date === bulkDate);
        return existing
          ? ctx.updateWarmup(existing.id, sent)
          : ctx.addWarmup(ip.id, sent, bulkDate);
      }));
      showToast(`Logged ${sent.toLocaleString()} sent for ${selectedDomainsWithIps.length} IP${selectedDomainsWithIps.length > 1 ? 's' : ''} ✓`);
      setBulkSent('');
    } catch { showToast('Bulk warmup failed', true); }
    setBulkSaving(false);
  };

  // ── nav ───────────────────────────────────────────────────────
  const openDomain = (d: Domain) => { setActiveDomain(d); setPanel('domain'); };
  const openIP     = (ip: IP)    => { setActiveIP(ip);     setPanel('ip'); };
  const goServer   = ()          => { setPanel('server'); setActiveDomain(null); setActiveIP(null); };
  const goDomain   = ()          => { setPanel('domain'); setActiveIP(null); };

  return (
    <div className="space-y-5">
      {/* breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-mono text-[#5a6478] flex-wrap">
        <button onClick={() => navigate('/servers')} className="hover:text-[#4df0a0] transition-colors">Servers</button>
        <span>/</span>
        <button onClick={goServer} className={`transition-colors ${panel === 'server' ? 'text-[#e2e8f0]' : 'hover:text-[#4df0a0]'}`}>{server.name}</button>
        {activeDomain && <>
          <span>/</span>
          <button onClick={goDomain} className={`transition-colors ${panel === 'domain' ? 'text-[#e2e8f0]' : 'hover:text-[#4df0a0]'}`}>{activeDomain.domain}</button>
        </>}
        {activeIP && <>
          <span>/</span>
          <span className="text-[#4d8ff0]">{activeIP.ip}</span>
        </>}
      </div>

      {/* ── PANEL: SERVER ─────────────────────────────────────── */}
      {panel === 'server' && (
        <>
          {/* header row */}
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-bold text-[#e2e8f0] text-base flex items-center gap-2">
              <span className="text-[#4df0a0]">🖥</span> {server.name}
            </h2>
            {getServerRdp(server) && <span className="text-[10px] bg-[#0d1e3e] text-[#4d8ff0] px-2 py-0.5 rounded font-mono">{getServerRdp(server)}</span>}
            {pmConnected && (
              pmFetching
                ? <span className="text-[10px] font-mono text-[#4d8ff0] animate-pulse flex items-center gap-1">
                    <span className="animate-spin inline-block">⟳</span> Fetching Postmaster…
                  </span>
                : <button
                    onClick={() => { pmFetchedRef.current = false; runPmFetch(serverDomains, pmToken); }}
                    className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#1a3a6e] text-[#4d8ff0] hover:border-[#4d8ff0] hover:bg-[#0d1e3e] transition-all"
                  >
                    ⟳ Refresh Postmaster
                  </button>
            )}
            <div className="ml-auto flex gap-2">
              <button onClick={() => setImportOpen(true)}
                className="text-sm font-mono px-3 py-1.5 rounded bg-[#1a1e22] border border-[#252b32] text-[#9aa5b4] hover:border-[#4df0a0] hover:text-[#4df0a0] transition-all">
                ⬆ Import
              </button>
              <button onClick={() => setAddDomOpen(true)}
                className="bg-[#4df0a0] text-black text-sm font-bold font-mono px-4 py-1.5 rounded hover:opacity-85 transition-opacity">
                + Domain
              </button>
            </div>
          </div>

          {/* bulk action bar — shown when selections are made */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 bg-[#0d1e3e] border border-[#1a3a6e] rounded-lg px-4 py-2.5 flex-wrap">
              <span className="text-sm font-mono text-[#4d8ff0] font-bold">
                {selected.size} domain{selected.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2 flex-1">
                <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
                  className="bg-[#131619] border border-[#252b32] rounded text-sm font-mono text-[#e2e8f0] px-3 py-1.5 outline-none focus:border-[#4d8ff0]">
                  <option value="">— set status —</option>
                  <option value="inbox">inbox</option>
                  <option value="spam">spam</option>
                  <option value="blocked">blocked</option>
                </select>
                <button onClick={handleBulkStatus} disabled={!bulkStatus || bulkSaving}
                  className="bg-[#4d8ff0] text-white text-sm font-bold font-mono px-4 py-1.5 rounded hover:opacity-85 transition-opacity disabled:opacity-40">
                  {bulkSaving ? 'Updating…' : 'Apply'}
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="number"
                  min="0"
                  value={bulkSent}
                  onChange={e => setBulkSent(e.target.value)}
                  placeholder="Sent/day"
                  className="bg-[#131619] border border-[#252b32] rounded text-sm font-mono text-[#e2e8f0] px-3 py-1.5 outline-none focus:border-[#4d8ff0] w-28"
                />
                <input
                  type="date"
                  value={bulkDate}
                  onChange={e => setBulkDate(e.target.value)}
                  className="bg-[#131619] border border-[#252b32] rounded text-sm font-mono text-[#e2e8f0] px-3 py-1.5 outline-none focus:border-[#4d8ff0]"
                />
                <button
                  onClick={handleBulkWarmup}
                  disabled={!bulkSent || selectedDomainsWithIps.length === 0 || bulkSaving}
                  className="bg-[#4df0a0] text-black text-sm font-bold font-mono px-4 py-1.5 rounded hover:opacity-85 transition-opacity disabled:opacity-40"
                >
                  {bulkSaving ? 'Saving…' : `Log sent for ${selectedDomainsWithIps.length}`}
                </button>
              </div>
              {selected.size > selectedDomainsWithIps.length && (
                <span className="text-[10px] font-mono text-[#f09a4d]">
                  {selected.size - selectedDomainsWithIps.length} selected domain{selected.size - selectedDomainsWithIps.length > 1 ? 's have' : ' has'} no IP yet
                </span>
              )}
              <button onClick={() => setSelected(new Set())}
                className="text-[11px] font-mono text-[#5a6478] hover:text-[#f04d4d] transition-colors ml-auto">
                Clear ✕
              </button>
            </div>
          )}

          {/* server summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Domains',  val: serverDomains.length },
              { label: 'Inbox',    val: serverDomains.filter(d => d.status === 'inbox').length,   color: '#4df0a0' },
              { label: 'Spam',     val: serverDomains.filter(d => d.status === 'spam').length,    color: '#f09a4d' },
              { label: 'Blocked',  val: serverDomains.filter(d => d.status === 'blocked').length, color: '#f04d4d' },
            ].map(s => (
              <div key={s.label} className="bg-[#131619] border border-[#252b32] rounded-lg px-4 py-3">
                <div className="text-[10px] uppercase tracking-widest text-[#5a6478] mb-1">{s.label}</div>
                <div className="text-xl font-bold" style={{ color: s.color ?? '#e2e8f0' }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* domains table */}
          <div className="bg-[#131619] border border-[#252b32] rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-[#252b32]">
                  <th className="px-3 py-3 w-8">
                    <input type="checkbox"
                      checked={selected.size === serverDomains.length && serverDomains.length > 0}
                      onChange={toggleAll}
                      className="accent-[#4d8ff0] cursor-pointer" />
                  </th>
                  {['Domain','IP','Sent Today','Health','Domain Rep','IP Rep','Status','Spam Rate',''].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-[10px] uppercase tracking-widest text-[#5a6478] font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {serverDomains.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-[#5a6478] font-mono text-sm">
                    No domains yet — use "Import" or "+ Domain".
                  </td></tr>
                )}
                {serverDomains.map(d => {
                  const ip    = getIP(d.id);
                  const sent  = ip ? sentToday(ip.id) : 0;
                  const rep   = latestRep(d.id);
                  const dRep  = d.domainRep ?? rep?.domainRep ?? '—';
                  const iRep  = d.ipRep     ?? rep?.ipRep     ?? '—';
                  const score = domainHealthScore(d, rep);
                  const hc    = healthColor(score);

                  return (
                    <tr key={d.id}
                      className={`border-b border-[#252b32] last:border-0 hover:bg-[#1a1e22] transition-colors group
                        ${selected.has(d.id) ? 'bg-[#0d1e3e]/40' : ''}`}>
                      {/* checkbox */}
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox"
                          checked={selected.has(d.id)}
                          onChange={() => toggleSelect(d.id)}
                          className="accent-[#4d8ff0] cursor-pointer" />
                      </td>
                      {/* domain — clickable */}
                      <td className="px-3 py-3">
                        <button onClick={() => openDomain(d)}
                          className="font-mono text-[#4df0a0] text-[13px] font-medium hover:underline text-left">
                          {d.domain}
                        </button>
                      </td>
                      {/* IP — clickable */}
                      <td className="px-3 py-3">
                        {ip
                          ? <button onClick={() => openIP(ip)} className="font-mono text-[#4d8ff0] text-xs hover:underline">{ip.ip}</button>
                          : <span className="text-[#5a6478]">—</span>}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-[#e2e8f0]">
                        {sent > 0 ? sent.toLocaleString() : <span className="text-[#5a6478]">—</span>}
                      </td>
                      {/* health score badge */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="relative w-8 h-8">
                            <svg viewBox="0 0 32 32" className="w-8 h-8 -rotate-90">
                              <circle cx="16" cy="16" r="13" fill="none" stroke="#252b32" strokeWidth="3" />
                              <circle cx="16" cy="16" r="13" fill="none" stroke={hc} strokeWidth="3"
                                strokeDasharray={`${(score / 100) * 81.7} 81.7`}
                                strokeLinecap="round" />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold font-mono" style={{ color: hc }}>{score}</span>
                          </div>
                          <span className="text-[10px] font-mono" style={{ color: hc }}>{healthLabel(score)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3"><RepBadge val={dRep} /></td>
                      <td className="px-3 py-3"><RepBadge val={iRep} /></td>
                      <td className="px-3 py-3">
                        <select value={d.status} onChange={e => handleStatusChange(d.id, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="bg-transparent text-xs font-mono outline-none cursor-pointer"
                          style={{ color: d.status === 'inbox' ? '#4df0a0' : d.status === 'spam' ? '#f09a4d' : '#f04d4d' }}>
                          <option value="inbox">inbox</option>
                          <option value="spam">spam</option>
                          <option value="blocked">blocked</option>
                        </select>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">
                        <SpamRateBadge rate={d.spamRate} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openDomain(d)}
                            className="text-[11px] font-mono px-2 py-0.5 rounded border border-[#252b32] text-[#5a6478] hover:text-[#4df0a0] hover:border-[#4df0a0] transition-all">
                            Open
                          </button>
                          <button onClick={() => handleDeleteDomain(d.id)}
                            className="text-[11px] font-mono px-2 py-0.5 rounded border border-[#252b32] text-[#5a6478] hover:text-[#f04d4d] hover:border-[#f04d4d] transition-all">
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── PANEL: DOMAIN (Postmaster + IP list) ──────────────── */}
      {panel === 'domain' && activeDomain && (
        <DomainPanel
          domain={activeDomain}
          ip={getIP(activeDomain.id) ?? null}
          userId={ctx.currentUser?.uid}
          repHistory={reputation.filter(r => r.domainId === activeDomain.id).sort((a,b) => b.date.localeCompare(a.date))}
          onOpenIP={(ip) => openIP(ip)}
          onSaveRep={async (date, dRep, iRep, spamRate) => {
            try {
              await ctx.addReputation(activeDomain.id, date, dRep, iRep, spamRate);
              // also update quick fields on domain doc
              await ctx.updateDomain(activeDomain.id, { domainRep: dRep, ipRep: iRep, spamRate });
              showToast('Postmaster data saved ✓');
            } catch { showToast('Error saving', true); }
          }}
          onDeleteRep={async (id) => {
            try { await ctx.deleteReputation(id); showToast('Deleted'); }
            catch { showToast('Error', true); }
          }}
        />
      )}

      {/* ── PANEL: IP (Warmup tracker) ─────────────────────────── */}
      {panel === 'ip' && activeIP && (
        <IPPanel
          ip={activeIP}
          domain={activeDomain}
          warmupHistory={warmups.filter(w => w.ipId === activeIP.id).sort((a,b) => b.date.localeCompare(a.date))}
          onSave={async (date, sent) => {
            // if record for that date already exists, update it
            const existing = warmups.find(w => w.ipId === activeIP.id && w.date === date);
            try {
              if (existing) { await ctx.updateWarmup(existing.id, sent); }
              else          { await ctx.addWarmup(activeIP.id, sent, date); }
              showToast('Warmup logged ✓');
            } catch { showToast('Error saving', true); }
          }}
          onDelete={async (id) => {
            try { await ctx.deleteWarmup(id); showToast('Deleted'); }
            catch { showToast('Error', true); }
          }}
        />
      )}

      {/* Import modal */}
      {importOpen && (
        <Modal title="Import Domains / IPs" onClose={() => setImportOpen(false)} size="md">
          <p className="text-[#5a6478] text-xs font-mono mb-3">
            One per line: <code className="text-[#4df0a0]">domain;ip;provider;status;unsubscribe;spamRate;lastCheck</code>
          </p>
          <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={8}
            placeholder="villarigatti.com;134.195.89.5&#10;nuyoungevity.com;134.195.89.228;Namecheap;inbox;NO;0%"
            className="w-full bg-[#1a1e22] border border-[#252b32] rounded-md text-[#e2e8f0] text-xs font-mono px-3 py-2 outline-none focus:border-[#4df0a0] resize-y transition-colors placeholder:text-[#5a6478]" />
          <ModalFooter onCancel={() => setImportOpen(false)} onSave={handleImport} saving={saving} />
        </Modal>
      )}

      {/* Add domain modal */}
      {addDomOpen && (
        <Modal title="Add Domain" onClose={() => setAddDomOpen(false)} size="sm">
          <Field label="Domain Name" required>
            <Input value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="example.com" autoFocus />
          </Field>
          <Field label="IP Address">
            <Input value={newIP} onChange={e => setNewIP(e.target.value)} placeholder="134.195.89.5" />
          </Field>
          <ModalFooter onCancel={() => setAddDomOpen(false)} onSave={handleAddDomain} saving={saving} />
        </Modal>
      )}
    </div>
  );
}

// Rep color map
const REP_COLORS: Record<string, string> = {
  HIGH: '#4df0a0', MEDIUM: '#4d8ff0', LOW: '#f09a4d', BAD: '#f04d4d', 'N/A': '#5a6478',
};

function LiveRepCard({ label, val, icon }: { label: string; val: string; icon: string }) {
  const color = REP_COLORS[val] ?? '#5a6478';
  return (
    <div className="bg-[#0d1e3e]/50 border border-[#1a3a6e] rounded-lg px-4 py-3 flex items-center justify-between">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-[#5a6478] mb-1 font-mono">{label}</div>
        <div className="text-base font-bold font-mono" style={{ color }}>{val}</div>
      </div>
      <span className="text-xl opacity-60">{icon}</span>
    </div>
  );
}

function DomainPanel({ domain, ip, repHistory, onOpenIP, onSaveRep, onDeleteRep, userId }: {
  domain: Domain;
  ip: IP | null;
  repHistory: Reputation[];
  userId?: string;
  onOpenIP: (ip: IP) => void;
  onSaveRep: (date: string, dRep: string, iRep: string, spamRate: string) => Promise<void>;
  onDeleteRep: (id: string) => Promise<void>;
}) {
  const [date,     setDate]    = useState(todayStr());
  const [domRep,   setDomRep]  = useState('');
  const [ipRep,    setIpRep]   = useState('');
  const [spamRate, setSpamRate]= useState('');
  const [saving,   setSaving]  = useState(false);

  // ── Live Postmaster state ─────────────────────────────────────────────────
  const { token, connected, connect, connecting, handleExpired } = usePostmaster(userId);
  const [liveStats,    setLiveStats]    = useState<PMDayStats[]>([]);
  const [liveLoading,  setLiveLoading]  = useState(false);
  const [liveError,    setLiveError]    = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const latest     = repHistory[0] ?? null;
  const latestDRep = domain.domainRep ?? latest?.domainRep ?? '—';
  const latestIRep = domain.ipRep     ?? latest?.ipRep     ?? '—';
  const score      = domainHealthScore(domain, latest);
  const hc         = healthColor(score);

  // Latest live stat (most recent day with actual data per field)
  const liveLatest = liveStats.length > 0 ? liveStats[liveStats.length - 1] : null;
  const liveLatestDomRep = [...liveStats].reverse().find(s => s.domainRep && s.domainRep !== 'N/A')?.domainRep ?? liveLatest?.domainRep ?? null;
  const liveLatestIpRep  = [...liveStats].reverse().find(s => s.ipRep     && s.ipRep     !== 'N/A')?.ipRep     ?? liveLatest?.ipRep     ?? null;

  // ── Auto-fetch on mount when connected ───────────────────────────────────
  useEffect(() => {
    if (!connected || !token || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchLive();
  }, [connected, token, domain.domain]);

  const fetchLive = async () => {
    if (!token) return;
    setLiveLoading(true);
    setLiveError(null);
    const { stats, error } = await fetchDomainStats(token, domain.domain);
    setLiveLoading(false);
    if (error === '__expired__') { handleExpired(); return; }
    if (error) { setLiveError(error); return; }
    setLiveStats(stats);
  };

  const handleSave = async () => {
    if (!domRep && !ipRep) return;
    setSaving(true);
    await onSaveRep(date, domRep, ipRep, spamRate ? spamRate + '%' : '0%');
    setDomRep(''); setIpRep(''); setSpamRate('');
    setSaving(false);
  };

  // Auto-fill manual form from live data when available
  const handleAutoFill = () => {
    if (!liveLatest) return;
    if (liveLatestDomRep) setDomRep(liveLatestDomRep);
    if (liveLatestIpRep)  setIpRep(liveLatestIpRep);
    setSpamRate(liveLatest.spamRate.toFixed(4));
  };

  return (
    <div className="space-y-5">
      {/* Postmaster connection banner */}
      <PostmasterConnect />

      {/* ── LIVE POSTMASTER METRICS (shown when connected) ─────────────── */}
      {connected && (
        <div className="bg-[#131619] border border-[#1a3a6e] rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[11px] uppercase tracking-widest text-[#4d8ff0] font-medium">
              📡 Live Postmaster Data
            </div>
            <div className="flex items-center gap-2">
              {liveLatest && (
                <button
                  onClick={handleAutoFill}
                  className="text-[11px] font-mono px-3 py-1 rounded bg-[#0d2e1e] border border-[#4df0a0]/30 text-[#4df0a0] hover:bg-[#0d2e1e]/80 transition-all"
                >
                  ↓ Auto-fill form
                </button>
              )}
              <button
                onClick={() => { hasFetchedRef.current = false; fetchLive(); }}
                disabled={liveLoading}
                className="text-[11px] font-mono px-3 py-1 rounded bg-[#1a1e22] border border-[#252b32] text-[#9aa5b4] hover:text-[#4df0a0] hover:border-[#4df0a0] transition-all disabled:opacity-40"
              >
                {liveLoading ? '⟳ Loading…' : '⟳ Refresh'}
              </button>
            </div>
          </div>

          {liveLoading && (
            <div className="flex items-center gap-2 text-[#5a6478] text-xs font-mono py-4 justify-center">
              <span className="animate-spin inline-block text-[#4d8ff0]">⟳</span>
              Fetching Postmaster data…
            </div>
          )}

          {liveError && (
            <div className="text-xs font-mono text-[#f09a4d] bg-[#2e1e0d]/50 border border-[#f09a4d]/20 rounded px-3 py-2">
              ⚠ {liveError}
            </div>
          )}

          {!liveLoading && !liveError && liveStats.length === 0 && (
            <div className="text-xs font-mono text-[#5a6478] text-center py-4">
              No data available — domain may not have enough Gmail traffic yet,
              or isn't registered at <a href="https://postmaster.google.com" target="_blank" rel="noopener noreferrer" className="text-[#4d8ff0] hover:underline">postmaster.google.com</a>.
            </div>
          )}

          {!liveLoading && liveLatest && (
            <>
              {/* Latest metrics cards */}
              <div className="grid grid-cols-3 gap-3">
                <LiveRepCard label="Domain Rep"   val={liveLatestDomRep ?? liveLatest.domainRep} icon="🛡" />
                <LiveRepCard label="IP Rep"        val={liveLatestIpRep  ?? liveLatest.ipRep}     icon="📡" />
                <div className="bg-[#0d1e3e]/50 border border-[#1a3a6e] rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-[#5a6478] mb-1 font-mono">Spam Rate</div>
                    <div
                      className="text-base font-bold font-mono"
                      style={{ color: liveLatest.spamRate === 0 ? '#4df0a0' : liveLatest.spamRate < 0.1 ? '#4df0a0' : liveLatest.spamRate < 0.3 ? '#f09a4d' : '#f04d4d' }}
                    >
                      {liveLatest.spamRate.toFixed(4)}%
                    </div>
                  </div>
                  <span className="text-xl opacity-60">📊</span>
                </div>
              </div>

              {/* Mini spark chart — last 14 days spam rate */}
              {liveStats.length > 1 && (
                <div>
                  <div className="text-[10px] text-[#5a6478] font-mono mb-1.5">Spam rate — last {Math.min(liveStats.length, 14)} days</div>
                  <SparkChart data={liveStats.slice(-14)} />
                </div>
              )}

              <div className="text-[10px] text-[#5a6478] font-mono text-right">
                Latest: {liveLatest.date}
              </div>
            </>
          )}
        </div>
      )}

      {/* domain header */}
      <div className="flex items-start gap-4 flex-wrap">
        <div>
          <h2 className="font-bold text-[#e2e8f0] text-base font-mono">{domain.domain}</h2>
          <div className="flex items-center gap-3 mt-1 text-xs text-[#5a6478] font-mono flex-wrap">
            {ip && (
              <button onClick={() => onOpenIP(ip)} className="text-[#4d8ff0] hover:underline">{ip.ip}</button>
            )}
            <span style={{ color: domain.status === 'inbox' ? '#4df0a0' : domain.status === 'spam' ? '#f09a4d' : '#f04d4d' }}>
              {domain.status}
            </span>
            <span>{domain.provider || '—'}</span>
          </div>
        </div>
        {/* health score ring */}
        <div className="ml-auto flex items-center gap-3">
          <div className="relative w-16 h-16">
            <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
              <circle cx="32" cy="32" r="27" fill="none" stroke="#252b32" strokeWidth="5" />
              <circle cx="32" cy="32" r="27" fill="none" stroke={hc} strokeWidth="5"
                strokeDasharray={`${(score / 100) * 169.6} 169.6`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold font-mono leading-none" style={{ color: hc }}>{score}</span>
              <span className="text-[9px] text-[#5a6478]">/100</span>
            </div>
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: hc }}>{healthLabel(score)}</div>
            <div className="text-[10px] text-[#5a6478] mt-0.5">Domain Health</div>
          </div>
        </div>
      </div>

      {/* health breakdown */}
      <HealthBreakdown domain={domain} latest={latest} score={score} />

      {/* two-column: postmaster form + latest data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Postmaster form ── */}
        <div className="bg-[#131619] border border-[#252b32] rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] uppercase tracking-widest text-[#5a6478] font-medium">
              📊 Record Google Postmaster Data
            </div>
            {liveLatest && (
              <button
                onClick={handleAutoFill}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0d2e1e] border border-[#4df0a0]/30 text-[#4df0a0] hover:opacity-80 transition-opacity"
              >
                Auto-fill ↑
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Domain Reputation">
              <Select value={domRep} onChange={e => setDomRep(e.target.value)}>
                <option value="">— select —</option>
                {['HIGH','MEDIUM','LOW','BAD'].map(v => <option key={v} value={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="IP Reputation">
              <Select value={ipRep} onChange={e => setIpRep(e.target.value)}>
                <option value="">— select —</option>
                {['HIGH','MEDIUM','LOW','BAD'].map(v => <option key={v} value={v}>{v}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Field label="Spam Rate (%)">
              <Input type="number" value={spamRate} onChange={e => setSpamRate(e.target.value)}
                placeholder="0.10" step="0.0001" min="0" max="100" />
            </Field>
            <Field label="Date">
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </Field>
          </div>
          <button onClick={handleSave} disabled={saving || (!domRep && !ipRep)}
            className="w-full bg-[#4df0a0] text-black font-bold text-sm font-mono py-2 rounded hover:opacity-85 transition-opacity disabled:opacity-40">
            {saving ? 'Saving…' : 'Save Postmaster Data'}
          </button>
        </div>

        {/* ── Current snapshot ── */}
        <div className="bg-[#131619] border border-[#252b32] rounded-lg p-4">
          <div className="text-[11px] uppercase tracking-widest text-[#5a6478] mb-4 font-medium">
            Current Snapshot
          </div>
          <div className="space-y-3">
            {[
              { label: 'Domain Rep', val: latestDRep },
              { label: 'IP Rep',     val: latestIRep },
              { label: 'Spam Rate',  val: domain.spamRate || latest?.spamRate || '—' },
              { label: 'Status',     val: domain.status },
              { label: 'Last Check', val: domain.lastCheck || '—' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-xs text-[#5a6478] font-mono">{row.label}</span>
                <RepBadge val={row.val} />
              </div>
            ))}
          </div>
          {ip && (
            <button onClick={() => onOpenIP(ip)}
              className="mt-4 w-full text-sm font-mono px-3 py-2 rounded bg-[#0d1e3e] border border-[#1a3a6e] text-[#4d8ff0] hover:border-[#4d8ff0] transition-all">
              📈 Open IP Warmup Tracker → {ip.ip}
            </button>
          )}
        </div>
      </div>

      {/* reputation history — unchanged */}
      {repHistory.length > 0 && (
        <div className="bg-[#131619] border border-[#252b32] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#252b32] text-[11px] uppercase tracking-widest text-[#5a6478] font-medium">
            Postmaster History — {repHistory.length} records
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#252b32]">
                  {['Date','Domain Rep','IP Rep','Spam Rate',''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-[#5a6478] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {repHistory.map(r => (
                  <tr key={r.id} className="border-b border-[#252b32] last:border-0 hover:bg-[#1a1e22] transition-colors group">
                    <td className="px-4 py-3 font-mono text-xs text-[#9aa5b4]">{fmtDate(r.date)}</td>
                    <td className="px-4 py-3"><RepBadge val={r.domainRep} /></td>
                    <td className="px-4 py-3"><RepBadge val={r.ipRep} /></td>
                    <td className="px-4 py-3"><SpamRateBadge rate={r.spamRate} /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => onDeleteRep(r.id)}
                        className="opacity-0 group-hover:opacity-100 text-[11px] font-mono px-2 py-0.5 rounded border border-transparent text-[#5a6478] hover:text-[#f04d4d] hover:border-[#f04d4d] transition-all">
                        Del
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mini spark chart ─────────────────────────────────────────────────────────

function SparkChart({ data }: { data: PMDayStats[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.parentElement!.clientWidth;
    const H   = 40;
    canvas.width  = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const vals = data.map(d => d.spamRate);
    const maxV = Math.max(...vals, 0.001);
    const n    = data.length;
    const padX = 4;

    const x = (i: number) => padX + (i / (n - 1)) * (W - padX * 2);
    const y = (v: number) => H - 4 - ((v / maxV) * (H - 8));

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(77,143,240,0.3)');
    grad.addColorStop(1, 'rgba(77,143,240,0)');

    ctx.beginPath();
    ctx.moveTo(x(0), y(vals[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(x(i), y(vals[i]));
    ctx.lineTo(x(n - 1), H);
    ctx.lineTo(x(0), H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(x(0), y(vals[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(x(i), y(vals[i]));
    ctx.strokeStyle = '#4d8ff0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Latest dot
    ctx.beginPath();
    ctx.arc(x(n - 1), y(vals[n - 1]), 3, 0, Math.PI * 2);
    ctx.fillStyle = '#4df0a0';
    ctx.fill();
  }, [data]);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} height={40} />;
}

// ─────────────────────────────────────────────────────────────────
// IP PANEL — warmup tracker with chart
// ─────────────────────────────────────────────────────────────────

function IPPanel({ ip, domain, warmupHistory, onSave, onDelete }: {
  ip: IP;
  domain: Domain | null;
  warmupHistory: Warmup[];
  onSave: (date: string, sent: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [date,    setDate]    = useState(todayStr());
  const [sent,    setSent]    = useState('');
  const [saving,  setSaving]  = useState(false);

  const totalSent   = warmupHistory.reduce((s, w) => s + w.sent, 0);
  const todaySent   = warmupHistory.find(w => w.date === todayStr())?.sent ?? 0;
  const last30      = warmupHistory.slice(0, 30);
  const avgDaily    = last30.length ? Math.round(last30.reduce((s, w) => s + w.sent, 0) / last30.length) : 0;

  const handleSave = async () => {
    const n = Number(sent);
    if (!n || n < 0) return;
    setSaving(true);
    await onSave(date, n);
    setSent('');
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* IP header */}
      <div>
        <h2 className="font-bold text-[#4d8ff0] text-base font-mono">{ip.ip}</h2>
        {domain && <p className="text-xs text-[#5a6478] font-mono mt-0.5">on {domain.domain}</p>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Sent',  val: totalSent.toLocaleString(),  color: '#4d8ff0' },
          { label: 'Today',       val: todaySent.toLocaleString(),  color: '#4df0a0' },
          { label: 'Avg / Day',   val: avgDaily.toLocaleString(),   color: '#f09a4d' },
          { label: 'Days Logged', val: warmupHistory.length,        color: '#e2e8f0' },
        ].map(k => (
          <div key={k.label} className="bg-[#131619] border border-[#252b32] rounded-lg px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-[#5a6478] mb-1">{k.label}</div>
            <div className="text-xl font-bold font-mono" style={{ color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* chart + form side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* warmup chart */}
        <div className="bg-[#131619] border border-[#252b32] rounded-lg p-4">
          <div className="text-[11px] uppercase tracking-widest text-[#5a6478] mb-3 font-medium">
            Warmup Progress — last 30 days
          </div>
          <WarmupChart records={[...warmupHistory].reverse().slice(0, 30)} />
        </div>

        {/* log form */}
        <div className="bg-[#131619] border border-[#252b32] rounded-lg p-4">
          <div className="text-[11px] uppercase tracking-widest text-[#5a6478] mb-4 font-medium">
            📬 Log Warmup Volume
          </div>
          <Field label="Emails Sent">
            <Input type="number" value={sent} onChange={e => setSent(e.target.value)}
              placeholder="e.g. 1000" min="0" autoFocus />
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </Field>
          <button onClick={handleSave} disabled={saving || !sent}
            className="w-full mt-2 bg-[#4d8ff0] text-white font-bold text-sm font-mono py-2 rounded hover:opacity-85 transition-opacity disabled:opacity-40">
            {saving ? 'Saving…' : 'Log Volume'}
          </button>
          <p className="text-[10px] text-[#5a6478] font-mono mt-2 text-center">
            If a record for that date already exists, it will be overwritten.
          </p>
        </div>
      </div>

      {/* warmup table */}
      {warmupHistory.length > 0 && (
        <div className="bg-[#131619] border border-[#252b32] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#252b32] text-[11px] uppercase tracking-widest text-[#5a6478] font-medium">
            Warmup History — {warmupHistory.length} records
          </div>
          <div className="overflow-auto max-h-64">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#252b32] sticky top-0 bg-[#131619]">
                  {['Date','Emails Sent','Bar',''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-[#5a6478] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {warmupHistory.map(w => {
                  const maxSent = Math.max(...warmupHistory.map(x => x.sent), 1);
                  const pct = Math.round((w.sent / maxSent) * 100);
                  return (
                    <tr key={w.id} className="border-b border-[#252b32] last:border-0 hover:bg-[#1a1e22] transition-colors group">
                      <td className="px-4 py-3 font-mono text-xs text-[#9aa5b4]">{fmtDate(w.date)}</td>
                      <td className="px-4 py-3 font-bold font-mono text-[#e2e8f0]">{w.sent.toLocaleString()}</td>
                      <td className="px-4 py-3 w-32">
                        <div className="h-1.5 bg-[#252b32] rounded-full overflow-hidden">
                          <div className="h-full bg-[#4d8ff0] rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => onDelete(w.id)}
                          className="opacity-0 group-hover:opacity-100 text-[11px] font-mono px-2 py-0.5 rounded border border-transparent text-[#5a6478] hover:text-[#f04d4d] hover:border-[#f04d4d] transition-all">
                          Del
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// WARMUP CANVAS CHART
// ─────────────────────────────────────────────────────────────────

function WarmupChart({ records }: { records: Warmup[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || records.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.parentElement!.clientWidth;
    const H   = 140;
    canvas.width  = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const vals = records.map(r => r.sent);
    const maxV = Math.max(...vals, 1);
    const n    = records.length;
    const P    = { t: 8, r: 8, b: 22, l: 50 };
    const cW   = W - P.l - P.r;
    const cH   = H - P.t - P.b;
    const barW = Math.max(3, Math.min(18, cW / Math.max(n, 1) - 2));

    // grid
    [0.25, 0.5, 0.75, 1].forEach(f => {
      const y = P.t + cH * (1 - f);
      ctx.strokeStyle = '#252b32'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(P.l, y); ctx.lineTo(W - P.r, y); ctx.stroke();
      ctx.fillStyle = '#5a6478'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
      const label = maxV * f >= 1000 ? `${((maxV * f) / 1000).toFixed(0)}k` : String(Math.round(maxV * f));
      ctx.fillText(label, P.l - 4, y + 3);
    });

    // gradient bars
    const grad = ctx.createLinearGradient(0, P.t, 0, P.t + cH);
    grad.addColorStop(0, '#4d8ff0'); grad.addColorStop(1, '#0d1e3e');

    records.forEach((r, i) => {
      const x  = P.l + (i / Math.max(n - 1, 1)) * cW - barW / 2;
      const bH = Math.max(2, (r.sent / maxV) * cH);
      ctx.fillStyle = r.date === todayStr() ? '#4df0a0' : grad;
      ctx.beginPath(); ctx.roundRect(x, P.t + cH - bH, barW, bH, 2); ctx.fill();
    });

    // x-axis labels
    ctx.fillStyle = '#5a6478'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(n / 5));
    records.forEach((r, i) => {
      if (i % step === 0 || i === n - 1) {
        const x = P.l + (i / Math.max(n - 1, 1)) * cW;
        ctx.fillText(new Date(r.date + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), x, H - 3);
      }
    });
  }, [records]);

  if (records.length === 0) {
    return <div className="h-[140px] flex items-center justify-center text-[#5a6478] text-xs font-mono">No data yet</div>;
  }
  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} height={140} />;
}

// ─────────────────────────────────────────────────────────────────
// HEALTH SCORE BREAKDOWN BAR
// ─────────────────────────────────────────────────────────────────

function HealthBreakdown({ domain, latest, score }: {
  domain: Domain;
  latest: Reputation | null;
  score: number;
}) {
  const dRep = domain.domainRep ?? latest?.domainRep ?? '';
  const iRep = domain.ipRep     ?? latest?.ipRep     ?? '';
  const rawRate = parseFloat((domain.spamRate ?? latest?.spamRate ?? '').replace('%', ''));
  const rate = isNaN(rawRate) ? 0 : rawRate;

  const items = [
    {
      label: 'Inbox Status',
      score: domain.status === 'inbox' ? 30 : domain.status === 'spam' ? 10 : 0,
      max: 30,
      val: domain.status,
    },
    {
      label: 'Domain Rep',
      score: dRep === 'HIGH' ? 30 : dRep === 'MEDIUM' ? 20 : dRep === 'LOW' ? 8 : 0,
      max: 30,
      val: dRep || '—',
    },
    {
      label: 'IP Rep',
      score: iRep === 'HIGH' ? 20 : iRep === 'MEDIUM' ? 13 : iRep === 'LOW' ? 5 : 0,
      max: 20,
      val: iRep || '—',
    },
    {
      label: 'Spam Rate',
      score: rate === 0 ? 20 : rate < 0.1 ? 16 : rate < 0.3 ? 10 : rate < 1 ? 4 : 0,
      max: 20,
      val: domain.spamRate || '0%',
    },
  ];

  return (
    <div className="bg-[#131619] border border-[#252b32] rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-widest text-[#5a6478] mb-3 font-medium">Health Score Breakdown</div>
      <div className="space-y-2.5">
        {items.map(item => {
          const pct = Math.round((item.score / item.max) * 100);
          const col = pct >= 80 ? '#4df0a0' : pct >= 50 ? '#4d8ff0' : pct >= 25 ? '#f09a4d' : '#f04d4d';
          return (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-xs text-[#5a6478] font-mono w-28 shrink-0">{item.label}</span>
              <div className="flex-1 h-2 bg-[#252b32] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col }} />
              </div>
              <span className="text-xs font-mono font-bold w-8 text-right" style={{ color: col }}>{item.score}</span>
              <span className="text-[10px] text-[#5a6478] font-mono w-6">/{item.max}</span>
              <span className="text-xs font-mono text-[#9aa5b4] w-16 text-right">{item.val}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-3 pt-1 border-t border-[#252b32]">
          <span className="text-xs font-bold text-[#e2e8f0] font-mono w-28">Total Score</span>
          <div className="flex-1 h-2 bg-[#252b32] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: healthColor(score) }} />
          </div>
          <span className="text-sm font-mono font-bold w-8 text-right" style={{ color: healthColor(score) }}>{score}</span>
          <span className="text-[10px] text-[#5a6478] font-mono w-6">/100</span>
          <span className="text-xs font-mono font-bold w-16 text-right" style={{ color: healthColor(score) }}>{healthLabel(score)}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SHARED MICRO-COMPONENTS
// ─────────────────────────────────────────────────────────────────

function RepBadge({ val }: { val: string }) {
  const map: Record<string, string> = {
    HIGH:    'bg-[#0d2e1e] text-[#4df0a0]',
    MEDIUM:  'bg-[#0d1e3e] text-[#4d8ff0]',
    LOW:     'bg-[#2e1e0d] text-[#f09a4d]',
    BAD:     'bg-[#2e0d0d] text-[#f04d4d]',
    inbox:   'bg-[#0d2e1e] text-[#4df0a0]',
    spam:    'bg-[#2e1e0d] text-[#f09a4d]',
    blocked: 'bg-[#2e0d0d] text-[#f04d4d]',
  };
  const cls = map[val] ?? 'text-[#5a6478]';
  return <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded font-mono ${cls}`}>{val || '—'}</span>;
}

function SpamRateBadge({ rate }: { rate: string }) {
  const n = parseFloat((rate ?? '').replace('%', ''));
  if (isNaN(n)) return <span className="text-[#5a6478] font-mono text-xs">—</span>;
  const color = n === 0 ? '#4df0a0' : n < 0.1 ? '#4df0a0' : n < 0.5 ? '#f09a4d' : '#f04d4d';
  return <span className="font-mono text-xs font-bold" style={{ color }}>{rate}</span>;
}
