import {
  useCallback,
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

  // ── helpers ──────────────────────────────────────────────────
  const getIP     = (domainId: string) => ips.find(ip => ip.domainId === domainId);
  const sentToday = (ipId: string) => {
    const today = todayStr();
    return warmups.filter(w => w.ipId === ipId && w.date === today).reduce((s, w) => s + w.sent, 0);
  };
  const latestRep = (domainId: string): Reputation | null => {
    const recs = reputation.filter(
      r => r.domainId === domainId && typeof r.date === 'string' && r.date.length > 0
    );
    return recs.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  };

  // ── callbacks moved to top level to avoid hook order errors ──
  const onSaveRep = useCallback(async (date: string, dRep: string, iRep: string, spamRate: string) => {
    if (!activeDomain) return;
    try {
      await ctx.upsertReputation(activeDomain.id, date, dRep, iRep, spamRate);
      // also update quick fields on domain doc
      await ctx.updateDomain(activeDomain.id, { domainRep: dRep, ipRep: iRep, spamRate });
      showToast('Postmaster data saved ✓');
    } catch { showToast('Error saving', true); }
  }, [activeDomain?.id, ctx, showToast]);

  const onSaveWarmup = useCallback(async (date: string, sent: number) => {
    if (!activeIP) return;
    try {
      await ctx.upsertWarmup(activeIP.id, sent, date);
      showToast('Warmup logged ✓');
    } catch { showToast('Error saving', true); }
  }, [activeIP?.id, ctx, showToast]);

  if (!server) return (
    <div className="text-center py-20">
      <p className="text-[#5a6478] font-mono text-sm">Server not found.</p>
      <button onClick={() => navigate('/servers')} className="mt-4 text-[#4df0a0] text-sm font-mono hover:underline">← Back to Servers</button>
    </div>
  );

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
    const existingDomain = serverDomains.find(d => d.domain.toLowerCase() === newDomain.trim().toLowerCase() && !d.archived);
    if (existingDomain) { showToast('Domain already exists on this server', true); setSaving(false); return; }
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
    <div className="space-y-6">
      {/* breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <button onClick={() => navigate('/servers')} className="hover:text-primary transition-colors">Servers</button>
        <span className="opacity-50">/</span>
        <button onClick={goServer} className={`transition-colors ${panel === 'server' ? 'text-foreground font-semibold' : 'hover:text-primary'}`}>{server.name}</button>
        {activeDomain && <>
          <span className="opacity-50">/</span>
          <button onClick={goDomain} className={`transition-colors ${panel === 'domain' ? 'text-foreground font-semibold' : 'hover:text-primary'}`}>{activeDomain.domain}</button>
        </>}
        {activeIP && <>
          <span className="opacity-50">/</span>
          <span className="text-primary font-semibold">{activeIP.ip}</span>
        </>}
      </div>

      {/* ── PANEL: SERVER ─────────────────────────────────────── */}
      {panel === 'server' && (
        <>
          {/* header row */}
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-bold text-foreground text-xl flex items-center gap-2">
              <span className="text-success">🖥</span> {server.name}
            </h2>
            {getServerRdp(server) && <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{getServerRdp(server)}</span>}
            {pmConnected && (
              pmFetching
                ? <span className="text-xs text-primary animate-pulse flex items-center gap-1">
                    <span className="animate-spin inline-block">⟳</span> Fetching Postmaster…
                  </span>
                : <button
                    onClick={() => { pmFetchedRef.current = false; runPmFetch(serverDomains, pmToken); }}
                    className="kt-btn kt-btn-outline px-2 py-1 text-xs"
                  >
                    ⟳ Refresh Postmaster
                  </button>
            )}
            <div className="ml-auto flex gap-2">
              <button onClick={() => setImportOpen(true)}
                className="kt-btn kt-btn-outline">
                ⬆ Import
              </button>
              <button onClick={() => setAddDomOpen(true)}
                className="kt-btn kt-btn-primary">
                + Domain
              </button>
            </div>
          </div>

          {/* bulk action bar — shown when selections are made */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5 flex-wrap">
              <span className="text-sm text-primary font-bold">
                {selected.size} domain{selected.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2 flex-1 min-w-[300px]">
                <div className="kt-input flex-1">
                  <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
                    className="bg-transparent outline-none w-full border-none focus:ring-0">
                    <option value="">— set status —</option>
                    <option value="inbox">inbox</option>
                    <option value="spam">spam</option>
                    <option value="blocked">blocked</option>
                  </select>
                </div>
                <button onClick={handleBulkStatus} disabled={!bulkStatus || bulkSaving}
                  className="kt-btn kt-btn-primary whitespace-nowrap">
                  {bulkSaving ? 'Updating…' : 'Apply'}
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="kt-input w-28">
                  <input
                    type="number"
                    min="0"
                    value={bulkSent}
                    onChange={e => setBulkSent(e.target.value)}
                    placeholder="Sent/day"
                    className="bg-transparent outline-none w-full border-none focus:ring-0"
                  />
                </div>
                <div className="kt-input">
                  <input
                    type="date"
                    value={bulkDate}
                    onChange={e => setBulkDate(e.target.value)}
                    className="bg-transparent outline-none border-none focus:ring-0"
                  />
                </div>
                <button
                  onClick={handleBulkWarmup}
                  disabled={!bulkSent || selectedDomainsWithIps.length === 0 || bulkSaving}
                  className="kt-btn kt-btn-success whitespace-nowrap"
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
              { label: 'Inbox',    val: serverDomains.filter(d => d.status === 'inbox').length,   color: 'text-success' },
              { label: 'Spam',     val: serverDomains.filter(d => d.status === 'spam').length,    color: 'text-warning' },
              { label: 'Blocked',  val: serverDomains.filter(d => d.status === 'blocked').length, color: 'text-destructive' },
            ].map(s => (
              <div key={s.label} className="kt-card px-4 py-3">
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{s.label}</div>
                <div className={`text-xl font-bold ${s.color ?? 'text-foreground'}`}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* domains table */}
          <div className="kt-card overflow-hidden overflow-x-auto">
            <table className="kt-table min-w-[900px]">
              <thead>
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input type="checkbox"
                      checked={selected.size === serverDomains.length && serverDomains.length > 0}
                      onChange={toggleAll}
                      className="accent-primary cursor-pointer" />
                  </th>
                  {['Domain','IP','Sent Today','Health','Domain Rep','IP Rep','Status','Spam Rate',''].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium whitespace-nowrap">{h}</th>
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
                      className={`hover:bg-muted/30 transition-colors group
                        ${selected.has(d.id) ? 'bg-primary/5' : ''}`}>
                      {/* checkbox */}
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox"
                          checked={selected.has(d.id)}
                          onChange={() => toggleSelect(d.id)}
                          className="accent-primary cursor-pointer" />
                      </td>
                      {/* domain — clickable */}
                      <td className="px-3 py-3">
                        <button onClick={() => openDomain(d)}
                          className="font-mono text-success text-[13px] font-medium hover:underline text-left">
                          {d.domain}
                        </button>
                      </td>
                      {/* IP — clickable */}
                      <td className="px-3 py-3">
                        {ip
                          ? <button onClick={() => openIP(ip)} className="font-mono text-primary text-xs hover:underline">{ip.ip}</button>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-foreground">
                        {sent > 0 ? sent.toLocaleString() : <span className="text-muted-foreground">—</span>}
                      </td>
                      {/* health score badge */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="relative w-8 h-8">
                            <svg viewBox="0 0 32 32" className="w-8 h-8 -rotate-90">
                              <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" className="text-border" strokeWidth="3" />
                              <circle cx="16" cy="16" r="13" fill="none" stroke={hc} strokeWidth="3"
                                strokeDasharray={`${(score / 100) * 81.7} 81.7`}
                                strokeLinecap="round" />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold font-mono" style={{ color: hc }}>{score}</span>
                          </div>
                          <span className="text-xs font-mono" style={{ color: hc }}>{healthLabel(score)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3"><RepBadge val={dRep} /></td>
                      <td className="px-3 py-3"><RepBadge val={iRep} /></td>
                      <td className="px-3 py-3">
                        <select value={d.status} onChange={e => handleStatusChange(d.id, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="bg-transparent text-xs font-mono outline-none cursor-pointer"
                          style={{ color: d.status === 'inbox' ? 'var(--success)' : d.status === 'spam' ? 'var(--warning)' : 'var(--destructive)' }}>
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
                            className="kt-btn kt-btn-outline px-2 py-1 text-xs">
                            Open
                          </button>
                          <button onClick={() => handleDeleteDomain(d.id)}
                            className="kt-btn kt-btn-outline px-2 py-1 text-xs text-muted-foreground hover:text-destructive hover:border-destructive">
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
          repHistory={reputation
            .filter(r => r.domainId === activeDomain.id && typeof r.date === 'string' && r.date.length > 0)
            .sort((a, b) => b.date.localeCompare(a.date))}
          onOpenIP={(ip) => openIP(ip)}
          onSaveRep={onSaveRep}
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
          onSave={onSaveWarmup}
          onDelete={async (id) => {
            try { await ctx.deleteWarmup(id); showToast('Deleted'); }
            catch { showToast('Error', true); }
          }}
        />
      )}

      {/* Import modal */}
      {importOpen && (
        <Modal title="Import Domains / IPs" onClose={() => setImportOpen(false)} size="md">
          <p className="text-muted-foreground text-xs font-medium mb-4 bg-muted p-3 rounded-lg border border-border">
            Bulk Upload: One per line → <code className="text-primary font-bold">domain;ip;provider;status;unsubscribe;spamRate;lastCheck</code>
          </p>
          <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={8}
            placeholder="villarigatti.com;134.195.89.5&#10;nuyoungevity.com;134.195.89.228;Namecheap;inbox;NO;0%"
            className="kt-input w-full min-h-[200px] font-mono" />
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
  HIGH: 'var(--success)', MEDIUM: 'var(--info)', LOW: 'var(--warning)', BAD: 'var(--destructive)', 'N/A': 'var(--muted-foreground)',
};

function LiveRepCard({ label, val, icon }: { label: string; val: string; icon: string }) {
  const color = REP_COLORS[val] ?? 'var(--muted-foreground)';
  return (
    <div className="kt-card px-4 py-3 flex items-center justify-between">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
        <div className="text-lg font-bold" style={{ color }}>{val}</div>
      </div>
      <span className="text-2xl opacity-50">{icon}</span>
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
  const [autoSave, setAutoSave] = useState(true);
  const [historyLimit, setHistoryLimit] = useState(7);
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
  }, [connected, token, domain.domain, historyLimit]);

  const formatSpamRate = (val: number | null | undefined) => {
    return typeof val === 'number' ? val.toFixed(4) : '—';
  };

  const fetchLive = async () => {
    if (!token) return;
    setLiveLoading(true);
    setLiveError(null);
    const { stats, error } = await fetchDomainStats(token, domain.domain, historyLimit);
    setLiveLoading(false);
    if (error === '__expired__') { handleExpired(); return; }
    if (error) { setLiveError(error); return; }
    setLiveStats(stats);
  };

  const lastAutoSaveRef = useRef<string | null>(null);
  useEffect(() => {
    if (!autoSave || liveStats.length === 0) return;
    const latest = liveStats[liveStats.length - 1];
    const latestDomRep = [...liveStats].reverse().find(s => s.domainRep && s.domainRep !== 'N/A')?.domainRep ?? latest.domainRep;
    const latestIpRep = [...liveStats].reverse().find(s => s.ipRep && s.ipRep !== 'N/A')?.ipRep ?? latest.ipRep;
    
    // session-level check to avoid spamming saves
    const saveKey = `${latest.date}-${latestDomRep}-${latestIpRep}-${latest.spamRate}`;
    if (lastAutoSaveRef.current === saveKey) return;
    
    if (latestDomRep || latestIpRep) {
      lastAutoSaveRef.current = saveKey;
      onSaveRep(latest.date, latestDomRep || '', latestIpRep || '', (latest.spamRate ?? 0).toFixed(4) + '%');
    }
  }, [liveStats, autoSave, onSaveRep]);

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
    setSpamRate(typeof liveLatest.spamRate === 'number' ? liveLatest.spamRate.toFixed(4) : '0.0000');
    setDate(liveLatest.date);
  };

  return (
    <div className="space-y-6">
      {/* Postmaster connection banner */}
      <PostmasterConnect />

      {/* ── LIVE POSTMASTER METRICS (shown when connected) ─────────────── */}
      {connected && (
        <div className="kt-card p-5 space-y-4 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs uppercase tracking-widest text-primary font-bold">
              📡 Live Postmaster Data
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer group">
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={e => setAutoSave(e.target.checked)}
                  className="accent-primary"
                />
                <span className="group-hover:text-foreground transition-colors">Auto‑save</span>
              </label>
              {liveLatest && (
                <button
                  onClick={handleAutoFill}
                  className="kt-btn kt-btn-success px-3 py-1 text-xs"
                >
                  ↓ Auto-fill form
                </button>
              )}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest whitespace-nowrap">History:</span>
                <select
                  value={historyLimit}
                  onChange={e => setHistoryLimit(Number(e.target.value))}
                  className="bg-background border border-border/50 text-[10px] font-bold px-2 py-1 rounded cursor-pointer outline-none focus:border-primary/50"
                >
                  <option value={1}>Latest</option>
                  <option value={7}>7 Days</option>
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days</option>
                </select>
              </div>
              <button
                onClick={() => { hasFetchedRef.current = false; fetchLive(); }}
                disabled={liveLoading}
                className="kt-btn kt-btn-outline px-3 py-1 text-xs disabled:opacity-40"
              >
                {liveLoading ? 'Loading…' : '⟳ Refresh'}
              </button>
            </div>
          </div>

          {liveLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
              <span className="animate-spin inline-block text-primary">⟳</span>
              Fetching Postmaster data…
            </div>
          )}

          {liveError && (
            <div className="text-xs font-mono text-warning bg-warning/10 border border-warning/20 rounded-lg px-4 py-3">
              ⚠ {liveError}
            </div>
          )}

          {!liveLoading && !liveError && liveStats.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">
              No data available — domain may not have enough Gmail traffic yet Or isn't registered at <a href="https://postmaster.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">postmaster.google.com</a>.
            </div>
          )}

          {!liveLoading && liveLatest && (
            <>
              {/* Latest metrics cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <LiveRepCard label="Domain Rep"   val={liveLatestDomRep ?? liveLatest.domainRep} icon="🛡" />
                <LiveRepCard label="IP Rep"        val={liveLatestIpRep  ?? liveLatest.ipRep}     icon="📡" />
                <div className="kt-card px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Spam Rate</div>
                    <div
                      className="text-lg font-bold font-mono"
                      style={{ 
                        color: typeof liveLatest.spamRate !== 'number' ? 'var(--muted-foreground)' 
                             : liveLatest.spamRate < 0.1 ? 'var(--success)' 
                             : liveLatest.spamRate < 0.3 ? 'var(--warning)' 
                             : 'var(--destructive)' 
                      }}
                    >
                      {formatSpamRate(liveLatest.spamRate)}{typeof liveLatest.spamRate === 'number' ? '%' : ''}
                    </div>
                  </div>
                  <span className="text-2xl opacity-50">📊</span>
                </div>
              </div>

              {/* Mini spark chart — last 14 days spam rate */}
              {liveStats.length > 1 && (
                <div className="pt-2">
                  <div className="text-xs text-muted-foreground mb-2 flex justify-between">
                    <span>Spam rate — last {Math.min(liveStats.length, 14)} days</span>
                    <span className="font-mono">Latest: {liveLatest.date}</span>
                  </div>
                  <SparkChart data={liveStats.slice(-14)} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* domain header */}
      <div className="flex items-start gap-4 flex-wrap border-b border-border pb-6">
        <div className="space-y-1">
          <h2 className="font-bold text-foreground text-2xl">{domain.domain}</h2>
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            {ip && (
              <button onClick={() => onOpenIP(ip)} className="text-primary hover:underline font-mono">{ip.ip}</button>
            )}
            <span className="font-semibold" style={{ color: domain.status === 'inbox' ? 'var(--success)' : domain.status === 'spam' ? 'var(--warning)' : 'var(--destructive)' }}>
              {domain.status}
            </span>
            <span className="opacity-50">|</span>
            <span>{domain.provider || 'No Provider'}</span>
          </div>
        </div>
        {/* health score ring */}
        <div className="ml-auto flex items-center gap-4">
          <div className="relative w-20 h-20">
            <svg viewBox="0 0 64 64" className="w-20 h-20 -rotate-90">
              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" className="text-border" strokeWidth="4" />
              <circle cx="32" cy="32" r="28" fill="none" stroke={hc} strokeWidth="4"
                strokeDasharray={`${(score / 100) * 175.9} 175.9`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold font-mono leading-none" style={{ color: hc }}>{score}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Score</span>
            </div>
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: hc }}>{healthLabel(score)}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest">Health Level</div>
          </div>
        </div>
      </div>

      {/* health breakdown */}
      <HealthBreakdown domain={domain} latest={latest} score={score} />

      {/* two-column: postmaster form + latest data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Postmaster form ── */}
        <div className="kt-card p-5">
          <div className="flex items-center justify-between mb-6">
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
              📊 Record Postmaster Data
            </div>
            {liveLatest && (
              <button
                onClick={handleAutoFill}
                className="kt-btn kt-btn-success px-2 py-1 text-[10px]"
              >
                Auto-fill ↑
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
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
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Field label="Spam Rate (%)">
              <Input type="number" value={spamRate} onChange={e => setSpamRate(e.target.value)}
                placeholder="0.10" step="0.0001" min="0" max="100" />
            </Field>
            <Field label="Date">
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </Field>
          </div>
          <button onClick={handleSave} disabled={saving || (!domRep && !ipRep)}
            className="kt-btn kt-btn-primary w-full py-2.5 font-bold">
            {saving ? 'Saving…' : 'Save Postmaster Data'}
          </button>
        </div>

        {/* ── Current snapshot ── */}
        <div className="kt-card p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-6 font-bold">
            Current Snapshot
          </div>
          <div className="space-y-4">
            {[
              { label: 'Domain Rep', val: latestDRep },
              { label: 'IP Rep',     val: latestIRep },
              { label: 'Spam Rate',  val: domain.spamRate || latest?.spamRate || '—' },
              { label: 'Status',     val: domain.status },
              { label: 'Last Check', val: domain.lastCheck || '—' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <RepBadge val={row.val} />
              </div>
            ))}
          </div>
          {ip && (
            <button onClick={() => onOpenIP(ip)}
              className="mt-6 kt-btn kt-btn-outline w-full py-2 flex items-center justify-center gap-2">
              📈 Open IP Warmup Tracker → <span className="font-mono">{ip.ip}</span>
            </button>
          )}
        </div>
      </div>

      {/* reputation history */}
      {repHistory.length > 0 && (
        <div className="kt-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border text-xs uppercase tracking-widest text-muted-foreground font-bold">
            Postmaster History — {repHistory.length} records
          </div>
          <div className="overflow-x-auto">
            <table className="kt-table">
              <thead>
                <tr>
                  {['Date','Domain Rep','IP Rep','Spam Rate',''].map(h => (
                    <th key={h} className="text-left px-5 py-4 text-xs uppercase tracking-widest text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {repHistory.map(r => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{fmtDate(r.date)}</td>
                    <td className="px-5 py-4"><RepBadge val={r.domainRep} /></td>
                    <td className="px-5 py-4"><RepBadge val={r.ipRep} /></td>
                    <td className="px-5 py-4"><SpamRateBadge rate={r.spamRate} /></td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => onDeleteRep(r.id)}
                        className="opacity-0 group-hover:opacity-100 kt-btn kt-btn-outline px-2 py-1 text-xs text-muted-foreground hover:text-destructive hover:border-destructive">
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

    const padY = 6;
    const x = (i: number) => padX + (i / (n - 1)) * (W - padX * 2);
    const y = (v: number) => H - padY - ((v / maxV) * (H - padY * 2));

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
    ctx.strokeStyle = '#3b82f6'; // primary
    ctx.lineWidth = 2;
    ctx.stroke();

    // Latest dot
    ctx.beginPath();
    ctx.arc(x(n - 1), y(vals[n - 1]), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981'; // success
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1.5;
    ctx.stroke();
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
    <div className="space-y-6">
      {/* IP header */}
      <div className="border-b border-border pb-6">
        <h2 className="font-bold text-primary text-2xl font-mono">{ip.ip}</h2>
        {domain && <p className="text-sm text-muted-foreground mt-1">Allocation for <span className="font-semibold text-foreground">{domain.domain}</span></p>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Sent',  val: totalSent.toLocaleString(),  color: 'var(--info)' },
          { label: 'Today',       val: todaySent.toLocaleString(),  color: 'var(--success)' },
          { label: 'Avg / Day',   val: avgDaily.toLocaleString(),   color: 'var(--warning)' },
          { label: 'Days Logged', val: warmupHistory.length,        color: 'var(--foreground)' },
        ].map(k => (
          <div key={k.label} className="kt-card px-4 py-3">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1 font-bold">{k.label}</div>
            <div className="text-xl font-bold font-mono" style={{ color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* chart + form side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* warmup chart */}
        <div className="kt-card p-5 overflow-hidden">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-bold">
            Warmup Progress — last 30 days
          </div>
          <WarmupChart records={[...warmupHistory].reverse().slice(0, 30)} />
        </div>

        {/* log form */}
        <div className="kt-card p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-6 font-bold">
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
            className="kt-btn kt-btn-primary w-full mt-4 py-2.5 font-bold">
            {saving ? 'Saving…' : 'Log Volume'}
          </button>
          <p className="text-xs text-muted-foreground mt-3 text-center italic">
            Existing records for the same date will be overwritten.
          </p>
        </div>
      </div>

      {/* warmup table */}
      {warmupHistory.length > 0 && (
        <div className="kt-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border text-xs uppercase tracking-widest text-muted-foreground font-bold">
            Warmup History — {warmupHistory.length} records
          </div>
          <div className="overflow-auto max-h-80">
            <table className="kt-table">
              <thead>
                <tr className="sticky top-0 bg-background shadow-sm">
                  {['Date','Emails Sent','Progression',''].map(h => (
                    <th key={h} className="text-left px-5 py-4 text-xs uppercase tracking-widest text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {warmupHistory.map(w => {
                  const maxSent = Math.max(...warmupHistory.map(x => x.sent), 1);
                  const pct = Math.round((w.sent / maxSent) * 100);
                  return (
                    <tr key={w.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{fmtDate(w.date)}</td>
                      <td className="px-5 py-4 font-bold font-mono text-foreground">{w.sent.toLocaleString()}</td>
                      <td className="px-5 py-4 w-40">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => onDelete(w.id)}
                          className="opacity-0 group-hover:opacity-100 kt-btn kt-btn-outline px-2 py-1 text-xs text-muted-foreground hover:text-destructive hover:border-destructive">
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
    const P    = { t: 8, r: 8, b: 40, l: 50 };
    const padX = 50;
    const cW   = W - padX - 10;
    const cH   = H - P.t - P.b;
    
    // Better bar spacing logic
    const barW = Math.max(4, Math.min(18, (cW / Math.max(n, 1)) * 0.7));
    const xPos = (i: number) => padX + (n <= 1 ? cW/2 : (i / (n - 1)) * (cW - barW));

    // grid
    [0.25, 0.5, 0.75, 1].forEach(f => {
      const y = P.t + cH * (1 - f);
      ctx.strokeStyle = '#252b32'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(W - 10, y); ctx.stroke();
      ctx.fillStyle = '#5a6478'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
      const label = maxV * f >= 1000 ? `${((maxV * f) / 1000).toFixed(0)}k` : String(Math.round(maxV * f));
      ctx.fillText(label, padX - 6, y + 3);
    });

    // gradient bars
    const grad = ctx.createLinearGradient(0, P.t, 0, P.t + cH);
    grad.addColorStop(0, '#4d8ff0'); grad.addColorStop(1, '#0d1e3e');

    records.forEach((r, i) => {
      const x  = xPos(i);
      const bH = Math.max(2, (r.sent / maxV) * cH);
      ctx.fillStyle = r.date === todayStr() ? '#4df0a0' : grad;
      ctx.beginPath(); ctx.roundRect(x, P.t + cH - bH, barW, bH, 2); ctx.fill();
    });

    // x-axis labels
    ctx.fillStyle = '#5a6478'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(n / 6));
    records.forEach((r, i) => {
      if (i % step === 0 || i === n - 1) {
        const x = xPos(i) + barW / 2;
        const label = fmtDate(r.date);
        ctx.save();
        ctx.translate(x, H - 25);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    });
  }, [records]);

  if (records.length === 0) {
    return <div className="h-[140px] flex items-center justify-center text-[#5a6478] text-xs font-mono">No data yet</div>;
  }
  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', maxWidth: '100%' }} height={140} />;
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
  const spamRaw = (domain.spamRate ?? latest?.spamRate ?? '').trim();
  const parsedRate = spamRaw ? parseFloat(spamRaw.replace('%', '')) : NaN;
  const hasRate = !isNaN(parsedRate);
  const rate = hasRate ? parsedRate : 0;

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
      score: hasRate ? (rate === 0 ? 20 : rate < 0.1 ? 16 : rate < 0.3 ? 10 : rate < 1 ? 4 : 0) : 0,
      max: 20,
      val: domain.spamRate || '—',
    },
  ];

  return (
    <div className="kt-card p-5">
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-5 font-bold">Health Score Breakdown</div>
      <div className="space-y-4">
        {items.map(item => {
          const pct = Math.round((item.score / item.max) * 100);
          const col = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--info)' : pct >= 25 ? 'var(--warning)' : 'var(--destructive)';
          return (
            <div key={item.label} className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground w-28 shrink-0 font-medium">{item.label}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col }} />
              </div>
              <div className="flex items-center gap-1.5 w-32 justify-end">
                <span className="text-xs font-bold font-mono" style={{ color: col }}>{item.score}</span>
                <span className="text-[10px] text-muted-foreground font-mono">/{item.max}</span>
                <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[60px]">{item.val}</span>
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-4 pt-4 border-t border-border mt-2">
          <span className="text-xs font-bold text-foreground w-28 uppercase tracking-widest">Total Result</span>
          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all shadow-sm" style={{ width: `${score}%`, background: healthColor(score) }} />
          </div>
          <div className="flex items-center gap-2 w-32 justify-end font-mono">
            <span className="text-sm font-bold" style={{ color: healthColor(score) }}>{score}</span>
            <span className="text-[10px] text-muted-foreground">/100</span>
            <span className="text-[10px] font-bold uppercase py-0.5 px-2 rounded" style={{ backgroundColor: `${healthColor(score)}20`, color: healthColor(score) }}>{healthLabel(score)}</span>
          </div>
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
    HIGH:    'bg-success/10 text-success border-success/20',
    MEDIUM:  'bg-info/10 text-info border-info/20',
    LOW:     'bg-warning/10 text-warning border-warning/20',
    BAD:     'bg-destructive/10 text-destructive border-destructive/20',
    inbox:   'bg-success/10 text-success border-success/20',
    spam:    'bg-warning/10 text-warning border-warning/20',
    blocked: 'bg-destructive/10 text-destructive border-destructive/20',
  };
  const cls = map[val] ?? 'text-muted-foreground border-border/50';
  return <span className={`inline-block text-[10px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded border ${cls}`}>{val || '—'}</span>;
}

function SpamRateBadge({ rate }: { rate: string }) {
  const n = parseFloat((rate ?? '').replace('%', ''));
  if (isNaN(n)) return <span className="text-muted-foreground font-mono text-xs">—</span>;
  const color = n < 0.1 ? 'text-success' : n < 0.5 ? 'text-warning' : 'text-destructive';
  return <span className={`font-mono text-xs font-bold ${color}`}>{rate}</span>;
}
