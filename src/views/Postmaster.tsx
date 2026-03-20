import { useMemo, useRef, useState } from 'react';
import { useAppContext } from '../App';
import PostmasterConnect, {
  fetchDomainStats,
  usePostmaster,
} from '../components/PostmasterConnect';
import { domainHealthScore, healthColor, healthLabel } from '../lib/types';

// ── Rep badge ─────────────────────────────────────────────────────
const REP_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  HIGH:   { bg: '#0d2e1e', text: '#4df0a0', border: '#1f5c3e' },
  MEDIUM: { bg: '#0d1e3e', text: '#4d8ff0', border: '#1a3a6e' },
  LOW:    { bg: '#2e1e0d', text: '#f09a4d', border: '#5c3a1a' },
  BAD:    { bg: '#2e0d0d', text: '#f04d4d', border: '#5c1a1a' },
};

function RepBadge({ val }: { val?: string }) {
  if (!val || val === 'N/A' || val === '—' || val === '') {
    return <span className="text-[#3a4252] font-mono text-xs">—</span>;
  }
  const c = REP_COLORS[val] ?? { bg: '#1a1e22', text: '#9aa5b4', border: '#252b32' };
  return (
    <span
      className="inline-block text-[10px] font-bold font-mono px-2 py-0.5 rounded"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {val}
    </span>
  );
}

function SpamBadge({ rate }: { rate?: string }) {
  const raw = parseFloat((rate ?? '0').replace('%', ''));
  const color = isNaN(raw) || raw === 0
    ? '#4df0a0'
    : raw < 0.1 ? '#4df0a0'
    : raw < 0.3 ? '#f09a4d'
    : '#f04d4d';
  return (
    <span className="font-mono text-xs" style={{ color }}>
      {isNaN(raw) ? '0.0000%' : raw.toFixed(4) + '%'}
    </span>
  );
}

function HealthRing({ score }: { score: number }) {
  const c = healthColor(score);
  const circ = 81.7;
  return (
    <div className="relative w-8 h-8 shrink-0">
      <svg viewBox="0 0 32 32" className="w-8 h-8 -rotate-90">
        <circle cx="16" cy="16" r="13" fill="none" stroke="#252b32" strokeWidth="3" />
        <circle cx="16" cy="16" r="13" fill="none" stroke={c} strokeWidth="3"
          strokeDasharray={`${(score / 100) * circ} ${circ}`}
          strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold font-mono"
        style={{ color: c }}>{score}</span>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────
type SortKey = 'domain' | 'server' | 'domainRep' | 'ipRep' | 'spamRate' | 'health' | 'status';
type SortDir = 'asc' | 'desc';

const REP_RANK: Record<string, number> = { HIGH: 4, MEDIUM: 3, LOW: 2, BAD: 1 };

export default function Postmaster() {
  const ctx = useAppContext();
  const { domains, servers, reputation } = ctx;
  const { token: pmToken, connected: pmConnected } = usePostmaster(ctx.currentUser?.uid);

  const [search,    setSearch]    = useState('');
  const [serverFilter, setServerFilter] = useState('');
  const [repFilter, setRepFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort,      setSort]      = useState<SortKey>('health');
  const [sortDir,   setSortDir]   = useState<SortDir>('desc');
  const [fetching,  setFetching]  = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ done: 0, total: 0 });
  const fetchedRef = useRef(false);

  const latestRep = (domainId: string) => {
    const recs = reputation.filter(r => r.domainId === domainId);
    return recs.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  };

  // ── Active domains enriched ────────────────────────────────────
  const allDomains = useMemo(() =>
    domains
      .filter(d => !d.archived)
      .map(d => {
        const server = servers.find(s => s.id === d.serverId);
        const rep    = latestRep(d.id);
        const score  = domainHealthScore(d, rep);
        return { ...d, serverName: server?.name ?? '—', score };
      }),
    [domains, servers, reputation]
  );

  const serverOptions = useMemo(() =>
    [...new Set(allDomains.map(d => d.serverName))].sort(),
    [allDomains]
  );

  // ── Summary stats ──────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:   allDomains.length,
    inbox:   allDomains.filter(d => d.status === 'inbox').length,
    spam:    allDomains.filter(d => d.status === 'spam').length,
    blocked: allDomains.filter(d => d.status === 'blocked').length,
    highRep: allDomains.filter(d => d.domainRep === 'HIGH').length,
    avgScore: allDomains.length
      ? Math.round(allDomains.reduce((s, d) => s + d.score, 0) / allDomains.length)
      : 0,
  }), [allDomains]);

  // ── Filter + sort ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = allDomains;
    if (search)       list = list.filter(d => d.domain.toLowerCase().includes(search.toLowerCase()));
    if (serverFilter) list = list.filter(d => d.serverName === serverFilter);
    if (repFilter)    list = list.filter(d => d.domainRep === repFilter);
    if (statusFilter) list = list.filter(d => d.status === statusFilter);

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sort === 'domain')    cmp = a.domain.localeCompare(b.domain);
      else if (sort === 'server') cmp = a.serverName.localeCompare(b.serverName);
      else if (sort === 'health') cmp = a.score - b.score;
      else if (sort === 'domainRep') cmp = (REP_RANK[a.domainRep ?? ''] ?? 0) - (REP_RANK[b.domainRep ?? ''] ?? 0);
      else if (sort === 'ipRep')     cmp = (REP_RANK[a.ipRep ?? '']     ?? 0) - (REP_RANK[b.ipRep ?? '']     ?? 0);
      else if (sort === 'spamRate')  cmp = parseFloat(a.spamRate ?? '0') - parseFloat(b.spamRate ?? '0');
      else if (sort === 'status')    cmp = a.status.localeCompare(b.status);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [allDomains, search, serverFilter, repFilter, statusFilter, sort, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSort(key); setSortDir('desc'); }
  };

  const SortTh = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      onClick={() => toggleSort(col)}
      className="text-left px-3 py-3 text-[10px] uppercase tracking-widest text-[#5a6478] font-medium whitespace-nowrap cursor-pointer hover:text-[#9aa5b4] select-none"
    >
      {label}
      {sort === col && (
        <span className="ml-1 text-[#4df0a0]">{sortDir === 'desc' ? '↓' : '↑'}</span>
      )}
    </th>
  );

  // ── Bulk refresh all domains ────────────────────────────────────
  const latestVal = (stats: any[], key: string): string | null => {
    for (let i = stats.length - 1; i >= 0; i--) {
      const v = stats[i][key];
      if (v && v !== 'N/A') return v as string;
    }
    return null;
  };

  const handleRefreshAll = async () => {
    if (!pmToken || fetching) return;
    setFetching(true);
    fetchedRef.current = true;
    const total = allDomains.length;
    setFetchProgress({ done: 0, total });

    const BATCH = 5;
    let done = 0;
    for (let i = 0; i < allDomains.length; i += BATCH) {
      const batch = allDomains.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(async (d) => {
          try {
            const { stats, error } = await fetchDomainStats(pmToken, d.domain);
            if (!error && stats.length > 0) {
              const domRep   = latestVal(stats, 'domainRep');
              const ipRep    = latestVal(stats, 'ipRep');
              const latest   = stats[stats.length - 1];
              const spamRate = latest?.spamRate != null ? latest.spamRate.toFixed(4) + '%' : null;
              await ctx.updateDomain(d.id, {
                domainRep: domRep ?? '',
                ipRep:     ipRep  ?? '',
                ...(spamRate && { spamRate }),
              });
            }
          } catch { /* skip */ }
        })
      );
      done += batch.length;
      setFetchProgress({ done, total });
    }
    setFetching(false);
    ctx.showToast(`Postmaster: refreshed ${total} domains ✓`);
  };

  // ── Rep distribution bar ───────────────────────────────────────
  const repDist = useMemo(() => {
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0, BAD: 0, NA: 0 };
    allDomains.forEach(d => {
      const r = d.domainRep as keyof typeof counts;
      if (r in counts) counts[r]++;
      else counts.NA++;
    });
    return counts;
  }, [allDomains]);

  const pct = (n: number) => allDomains.length ? Math.round((n / allDomains.length) * 100) : 0;

  return (
    <div className="space-y-5">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-bold text-[#e2e8f0] text-base flex items-center gap-2">
          <span className="text-[#4d8ff0]">📡</span> Postmaster Overview
        </h2>
        <span className="text-[10px] font-mono text-[#5a6478] bg-[#131619] border border-[#252b32] px-2 py-0.5 rounded">
          {allDomains.length} domains across {servers.length} servers
        </span>
        <div className="ml-auto flex items-center gap-2">
          {fetching ? (
            <span className="text-[10px] font-mono text-[#4d8ff0] animate-pulse flex items-center gap-1">
              <span className="animate-spin inline-block">⟳</span>
              {fetchProgress.done}/{fetchProgress.total} domains…
            </span>
          ) : (
            pmConnected && (
              <button
                onClick={handleRefreshAll}
                className="text-[11px] font-mono px-3 py-1.5 rounded border border-[#1a3a6e] text-[#4d8ff0] hover:border-[#4d8ff0] hover:bg-[#0d1e3e] transition-all"
              >
                ⟳ Refresh All
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Postmaster connect banner ─────────────────────────────── */}
      <PostmasterConnect />

      {/* ── Summary cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total',      val: stats.total,   color: '#e2e8f0' },
          { label: 'Inbox',      val: stats.inbox,   color: '#4df0a0' },
          { label: 'Spam',       val: stats.spam,    color: '#f09a4d' },
          { label: 'Blocked',    val: stats.blocked, color: '#f04d4d' },
          { label: 'HIGH Rep',   val: stats.highRep, color: '#4df0a0' },
          { label: 'Avg Health', val: stats.avgScore, color: healthColor(stats.avgScore) },
        ].map(s => (
          <div key={s.label} className="bg-[#131619] border border-[#252b32] rounded-lg px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-[#5a6478] mb-1 font-mono">{s.label}</div>
            <div className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* ── Domain rep distribution bar ──────────────────────────── */}
      {allDomains.length > 0 && (
        <div className="bg-[#131619] border border-[#252b32] rounded-lg px-4 py-3">
          <div className="text-[10px] uppercase tracking-widest text-[#5a6478] mb-3 font-mono">Domain Reputation Distribution</div>
          <div className="flex rounded overflow-hidden h-4 gap-0.5">
            {repDist.HIGH   > 0 && <div style={{ width: pct(repDist.HIGH)   + '%', background: '#1f5c3e' }} title={`HIGH: ${repDist.HIGH}`} />}
            {repDist.MEDIUM > 0 && <div style={{ width: pct(repDist.MEDIUM) + '%', background: '#1a3a6e' }} title={`MEDIUM: ${repDist.MEDIUM}`} />}
            {repDist.LOW    > 0 && <div style={{ width: pct(repDist.LOW)    + '%', background: '#5c3a1a' }} title={`LOW: ${repDist.LOW}`} />}
            {repDist.BAD    > 0 && <div style={{ width: pct(repDist.BAD)    + '%', background: '#5c1a1a' }} title={`BAD: ${repDist.BAD}`} />}
            {repDist.NA     > 0 && <div style={{ width: pct(repDist.NA)     + '%', background: '#1a1e22' }} title={`No data: ${repDist.NA}`} />}
          </div>
          <div className="flex gap-4 mt-2">
            {(['HIGH','MEDIUM','LOW','BAD'] as const).map(r => (
              repDist[r] > 0 && (
                <span key={r} className="text-[10px] font-mono flex items-center gap-1.5">
                  <RepBadge val={r} />
                  <span className="text-[#5a6478]">{repDist[r]} ({pct(repDist[r])}%)</span>
                </span>
              )
            ))}
            {repDist.NA > 0 && (
              <span className="text-[10px] font-mono text-[#3a4252]">
                No data: {repDist.NA}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Search domain…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-[#131619] border border-[#252b32] rounded px-3 py-1.5 text-sm font-mono text-[#e2e8f0] placeholder-[#3a4252] focus:outline-none focus:border-[#4d8ff0] w-48"
        />
        <select value={serverFilter} onChange={e => setServerFilter(e.target.value)}
          className="bg-[#131619] border border-[#252b32] rounded px-3 py-1.5 text-sm font-mono text-[#9aa5b4] focus:outline-none focus:border-[#4d8ff0]">
          <option value="">All servers</option>
          {serverOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={repFilter} onChange={e => setRepFilter(e.target.value)}
          className="bg-[#131619] border border-[#252b32] rounded px-3 py-1.5 text-sm font-mono text-[#9aa5b4] focus:outline-none focus:border-[#4d8ff0]">
          <option value="">All rep</option>
          {['HIGH','MEDIUM','LOW','BAD'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-[#131619] border border-[#252b32] rounded px-3 py-1.5 text-sm font-mono text-[#9aa5b4] focus:outline-none focus:border-[#4d8ff0]">
          <option value="">All status</option>
          {['inbox','spam','blocked'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || serverFilter || repFilter || statusFilter) && (
          <button
            onClick={() => { setSearch(''); setServerFilter(''); setRepFilter(''); setStatusFilter(''); }}
            className="text-[11px] font-mono text-[#5a6478] hover:text-[#f04d4d] transition-colors px-2"
          >
            Clear ✕
          </button>
        )}
        <span className="ml-auto text-[11px] font-mono text-[#3a4252] self-center">
          {filtered.length} / {allDomains.length} domains
        </span>
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      <div className="bg-[#131619] border border-[#252b32] rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#252b32]">
              <SortTh col="domain"    label="Domain" />
              <SortTh col="server"    label="Server" />
              <SortTh col="health"    label="Health" />
              <SortTh col="domainRep" label="Domain Rep" />
              <SortTh col="ipRep"     label="IP Rep" />
              <SortTh col="status"    label="Status" />
              <SortTh col="spamRate"  label="Spam Rate" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-[#5a6478] font-mono text-sm">
                  {allDomains.length === 0
                    ? 'No domains yet — add servers and import domains first.'
                    : 'No domains match your filters.'}
                </td>
              </tr>
            )}
            {filtered.map(d => {
              const statusColor = d.status === 'inbox' ? '#4df0a0' : d.status === 'spam' ? '#f09a4d' : '#f04d4d';
              return (
                <tr key={d.id} className="border-b border-[#252b32] last:border-0 hover:bg-[#1a1e22] transition-colors">
                  <td className="px-3 py-3">
                    <span className="font-mono text-[#4df0a0] text-[13px] font-medium">{d.domain}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-[10px] font-mono bg-[#0d1e3e] text-[#4d8ff0] px-2 py-0.5 rounded border border-[#1a3a6e]">
                      {d.serverName}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <HealthRing score={d.score} />
                      <span className="text-[10px] font-mono" style={{ color: healthColor(d.score) }}>
                        {healthLabel(d.score)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3"><RepBadge val={d.domainRep} /></td>
                  <td className="px-3 py-3"><RepBadge val={d.ipRep} /></td>
                  <td className="px-3 py-3">
                    <span className="text-xs font-mono font-bold" style={{ color: statusColor }}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-3 py-3"><SpamBadge rate={d.spamRate} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
