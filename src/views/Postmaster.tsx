import { useMemo, useRef, useState } from 'react';
import { useAppContext } from '../App';
import PostmasterConnect, {
  fetchDomainStats,
  usePostmaster,
} from '../components/PostmasterConnect';
import { domainHealthScore, healthColor, healthLabel } from '../lib/types';
import Badge from '../components/Badge';
import StatCard, { Color } from '../components/StatCard';

// ── Shared Helpers ────────────────────────────────────────────────
function SpamBadge({ rate }: { rate?: string }) {
  if (!rate || rate.trim().length === 0) {
    return <span className="font-mono text-xs text-muted-foreground">—</span>;
  }
  const raw = parseFloat(rate.replace('%', ''));
  const color = isNaN(raw) || raw === 0
    ? 'var(--success)'
    : raw < 0.1 ? 'var(--success)'
      : raw < 0.3 ? 'var(--warning)'
        : 'var(--destructive)';
  return (
    <span className="font-mono text-xs font-bold" style={{ color }}>
      {(isNaN(raw) || raw === null || raw === undefined) ? '—' : raw.toFixed(4) + '%'}
    </span>
  );
}

function HealthRing({ score }: { score: number }) {
  const c = healthColor(score);
  return (
    <div className="relative w-10 h-10">
      <svg viewBox="0 0 32 32" className="w-10 h-10 -rotate-90">
        <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" className="text-border" strokeWidth="3" />
        <circle cx="16" cy="16" r="14" fill="none" stroke={c} strokeWidth="3"
          strokeDasharray={`${(score / 100) * 87.9} 87.9`}
          strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-bold font-mono leading-none" style={{ color: c }}>{score}</span>
      </div>
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

  const [search, setSearch] = useState('');
  const [serverFilter, setServerFilter] = useState('');
  const [repFilter, setRepFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState<SortKey>('health');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [dateRange, setDateRange] = useState(30);
  const [fetching, setFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ done: 0, total: 0 });
  const fetchedRef = useRef(false);

  const latestRep = (domainId: string) => {
    const recs = reputation.filter(
      r => r.domainId === domainId && typeof r.date === 'string' && r.date.length > 0
    );
    return recs.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  };

  // ── Active domains enriched ────────────────────────────────────
  const allDomains = useMemo(() =>
    domains
      .filter(d => !d.archived)
      .map(d => {
        const server = servers.find(s => s.id === d.serverId);
        const rep = latestRep(d.id);
        const score = domainHealthScore(d, rep);
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
    total: allDomains.length,
    inbox: allDomains.filter(d => d.status === 'inbox').length,
    spam: allDomains.filter(d => d.status === 'spam').length,
    blocked: allDomains.filter(d => d.status === 'blocked').length,
    highRep: allDomains.filter(d => d.domainRep === 'HIGH').length,
    avgScore: allDomains.length
      ? Math.round(allDomains.reduce((s, d) => s + d.score, 0) / allDomains.length)
      : 0,
  }), [allDomains]);

  // ── Filter + sort ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = allDomains;
    if (search) list = list.filter(d => d.domain.toLowerCase().includes(search.toLowerCase()));
    if (serverFilter) list = list.filter(d => d.serverName === serverFilter);
    if (repFilter) list = list.filter(d => d.domainRep === repFilter);
    if (statusFilter) list = list.filter(d => d.status === statusFilter);

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sort === 'domain') cmp = a.domain.localeCompare(b.domain);
      else if (sort === 'server') cmp = a.serverName.localeCompare(b.serverName);
      else if (sort === 'health') cmp = a.score - b.score;
      else if (sort === 'domainRep') cmp = (REP_RANK[a.domainRep ?? ''] ?? 0) - (REP_RANK[b.domainRep ?? ''] ?? 0);
      else if (sort === 'ipRep') cmp = (REP_RANK[a.ipRep ?? ''] ?? 0) - (REP_RANK[b.ipRep ?? ''] ?? 0);
      else if (sort === 'spamRate') cmp = parseFloat(a.spamRate ?? '0') - parseFloat(b.spamRate ?? '0');
      else if (sort === 'status') cmp = a.status.localeCompare(b.status);
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
      className="text-left px-5 py-4 text-xs uppercase tracking-widest text-muted-foreground font-medium whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none group"
    >
      <div className="flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${sort === col ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-50'}`}>
          {sortDir === 'desc' ? '↓' : '↑'}
        </span>
      </div>
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
            const { stats, error } = await fetchDomainStats(pmToken, d.domain, dateRange);
            if (!error && stats.length > 0) {
              const domRep = latestVal(stats, 'domainRep');
              const ipRep = latestVal(stats, 'ipRep');
              const latest = stats[stats.length - 1];
              const spamRate = latest?.spamRate != null ? latest.spamRate.toFixed(4) + '%' : null;
              await ctx.updateDomain(d.id, {
                domainRep: domRep ?? '',
                ipRep: ipRep ?? '',
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
    <div className="space-y-6 md:space-y-8">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-bold text-foreground text-2xl flex items-center gap-3">
            <span className="text-primary">📡</span> Postmaster Overview
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Live insights from <a href="https://postmaster.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Postmaster</a> for {allDomains.length} domains.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {fetching ? (
            <div className="kt-badge kt-badge-info animate-pulse px-4 py-2">
              <span className="animate-spin inline-block mr-2">⟳</span>
              Syncing {fetchProgress.done}/{fetchProgress.total}…
            </div>
          ) : (
            pmConnected && (
              <div className="flex items-center gap-3">
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(Number(e.target.value))}
                  className="kt-input px-3 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer"
                >
                  <option value={7}>7 Days</option>
                  <option value={30}>30 Days</option>
                  <option value={60}>60 Days</option>
                  <option value={90}>90 Days</option>
                </select>
                <button
                  onClick={handleRefreshAll}
                  className="kt-btn kt-btn-primary px-5"
                >
                  ⟳ Refresh All
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Postmaster connect banner ─────────────────────────────── */}
      <PostmasterConnect />

      {/* ── Summary cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 xl:gap-6">
        {[
          { label: 'Total', val: stats.total, sub: 'Active domains', color: '' as Color },
          { label: 'Inbox', val: stats.inbox, sub: 'Monitoring status', color: '' as Color },
          { label: 'Spam', val: stats.spam, sub: 'Warning status', color: 'orange' as Color },
          { label: 'Blocked', val: stats.blocked, sub: 'Critical status', color: 'red' as Color },
          { label: 'HIGH Rep', val: stats.highRep, sub: 'Domain Reputation', color: 'blue' as Color },
          { label: 'Avg Health', val: stats.avgScore, sub: healthLabel(stats.avgScore), color: (stats.avgScore > 70 ? '' : stats.avgScore > 40 ? 'orange' : 'red') as Color },
        ].map(s => (
          <StatCard key={s.label} label={s.label} value={s.val} sub={s.sub} color={s.color} />
        ))}
      </div>

      {/* ── Domain rep distribution bar ──────────────────────────── */}
      {allDomains.length > 0 && (
        <div className="kt-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Domain Reputation Distribution</div>
            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest bg-muted px-2 py-1 rounded">Overall Split</div>
          </div>
          <div className="flex rounded-full overflow-hidden h-3 gap-0.5 bg-muted">
            {repDist.HIGH > 0 && <div style={{ width: pct(repDist.HIGH) + '%', background: 'var(--success)' }} title={`HIGH: ${repDist.HIGH}`} />}
            {repDist.MEDIUM > 0 && <div style={{ width: pct(repDist.MEDIUM) + '%', background: 'var(--info)' }} title={`MEDIUM: ${repDist.MEDIUM}`} />}
            {repDist.LOW > 0 && <div style={{ width: pct(repDist.LOW) + '%', background: 'var(--warning)' }} title={`LOW: ${repDist.LOW}`} />}
            {repDist.BAD > 0 && <div style={{ width: pct(repDist.BAD) + '%', background: 'var(--destructive)' }} title={`BAD: ${repDist.BAD}`} />}
            {repDist.NA > 0 && <div style={{ width: pct(repDist.NA) + '%', background: 'var(--muted)' }} title={`No data: ${repDist.NA}`} />}
          </div>
          <div className="flex gap-6 mt-4 flex-wrap">
            {(['HIGH', 'MEDIUM', 'LOW', 'BAD'] as const).map(r => (
              repDist[r] > 0 && (
                <div key={r} className="flex items-center gap-3">
                  <Badge label={r} />
                  <span className="text-xs text-muted-foreground font-bold">{repDist[r]} <span className="opacity-50 font-normal">({pct(repDist[r])}%)</span></span>
                </div>
              )
            ))}
            {repDist.NA > 0 && (
              <div className="flex items-center gap-3">
                <Badge label="N/A" />
                <span className="text-xs text-muted-foreground font-bold">{repDist.NA} <span className="opacity-50 font-normal">({pct(repDist.NA)}%)</span></span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative group flex-1 min-w-[200px] max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground lg:group-focus-within:text-primary transition-colors">🔍</span>
          <input
            type="text"
            placeholder="Search domains..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="kt-input pl-10 w-full px-4 py-2"
          />
        </div>
        <select value={serverFilter} onChange={e => setServerFilter(e.target.value)}
          className="kt-input px-4 py-2 w-48">
          <option value="">All Servers</option>
          {serverOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={repFilter} onChange={e => setRepFilter(e.target.value)}
          className="kt-input px-4 py-2 w-32 text-xs font-bold uppercase tracking-widest">
          <option value="">All Rep</option>
          {['HIGH', 'MEDIUM', 'LOW', 'BAD'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="kt-input px-4 py-2 w-36 text-xs font-bold uppercase tracking-widest">
          <option value="">All Status</option>
          {['inbox', 'spam', 'blocked'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || serverFilter || repFilter || statusFilter) && (
          <button
            onClick={() => { setSearch(''); setServerFilter(''); setRepFilter(''); setStatusFilter(''); }}
            className="kt-btn kt-btn-outline px-4 py-2 text-destructive hover:bg-destructive/5 border-destructive/20"
          >
            Clear Filters
          </button>
        )}
        <div className="ml-auto text-xs font-bold uppercase tracking-widest text-muted-foreground bg-muted px-3 py-1.5 rounded-lg border border-border">
          {filtered.length} / {allDomains.length} domains visible
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      <div className="kt-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="kt-table min-w-[1000px]">
            <thead>
              <tr>
                <SortTh col="domain" label="Domain" />
                <SortTh col="server" label="Server Node" />
                <SortTh col="health" label="Health Score" />
                <SortTh col="domainRep" label="Domain Rep" />
                <SortTh col="ipRep" label="IP Rep" />
                <SortTh col="status" label="Status" />
                <SortTh col="spamRate" label="Spam Rate" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-20">
                    <div className="text-4xl mb-3 opacity-20">📡</div>
                    <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                      {allDomains.length === 0
                        ? 'No domains registered yet'
                        : 'No results found for current filters'}
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map(d => (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="font-bold text-foreground hover:text-primary transition-colors cursor-pointer">{d.domain}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-info/10 text-info px-2 py-1 rounded border border-info/20">
                      {d.serverName}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <HealthRing score={d.score} />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold" style={{ color: healthColor(d.score) }}>{healthLabel(d.score)}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Score: {d.score}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4"><Badge label={d.domainRep ?? 'N/A'} /></td>
                  <td className="px-5 py-4"><Badge label={d.ipRep ?? 'N/A'} /></td>
                  <td className="px-5 py-4"><Badge label={d.status} /></td>
                  <td className="px-5 py-4"><SpamBadge rate={d.spamRate} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
