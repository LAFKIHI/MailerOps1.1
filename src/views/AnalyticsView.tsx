import { useMemo, useState } from 'react';
import { useAppContext } from '../App';
import ScreenContainer from '../components/ScreenContainer';
import { domainHealthScore } from '../lib/types';
import { n2s, parseSafeDate, fmtDate } from '../lib/constants';

type Period = 'today' | '7' | '30' | '90';

export default function AnalyticsView() {
  const { tasks, servers, domains, ips, reputation } = useAppContext();
  const [period, setPeriod] = useState<Period>('7');

  const filterByPeriod = <T extends { date?: string; createdAt?: string }>(items: T[]) => {
    if (period === 'today') {
      const today = new Date().toISOString().slice(0, 10);
      return items.filter(item => (item.date || item.createdAt?.slice(0, 10)) === today);
    }
    const days = Number(period);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days + 1);
    cutoff.setHours(0, 0, 0, 0);
    return items.filter(item => {
      const d = item.date || item.createdAt?.slice(0, 10);
      const parsed = parseSafeDate(d);
      return parsed ? parsed >= cutoff : false;
    });
  };

  const filteredTasks = useMemo(() => filterByPeriod(tasks), [tasks, period]);

  // ─── Key Metrics ──────────────────────────────────────────
  const totalSent = filteredTasks.reduce((s, t) => s + t.seedCount, 0);
  const doneTasks = filteredTasks.filter(t => t.status === 'Done').length;
  const successRate = filteredTasks.length > 0 ? Math.round((doneTasks / filteredTasks.length) * 100) : 0;
  
  const activeDomains = domains.filter(d => !d.archived && d.status === 'inbox').length;
  const healthyIps = ips.filter(ip => (ip.health_score || 0) >= 80).length;

  // ─── 7-day Trend ──────────────────────────────────────────
  const trendData = useMemo(() => {
    const days: { date: string; label: string; value: number }[] = [];
    const numDays = period === 'today' ? 1 : Number(period);
    const displayDays = Math.min(numDays, 14); // show max 14 bars
    for (let i = displayDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      const value = tasks
        .filter(t => t.date === ds && !t.archived)
        .reduce((sum, t) => sum + t.seedCount, 0);
      days.push({ date: ds, label, value });
    }
    return days;
  }, [tasks, period]);

  const maxTrend = Math.max(...trendData.map(d => d.value), 1);

  // ─── Top Servers ──────────────────────────────────────────
  const topServers = useMemo(() => {
    const map: Record<string, { name: string; count: number }> = {};
    const activeServers = servers.filter(s => !s.archived);
    activeServers.forEach(s => {
      const serverDomains = domains.filter(d => d.serverId === s.id && !d.archived);
      map[s.id] = { name: s.name, count: serverDomains.length };
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [servers, domains]);

  const maxServerCount = Math.max(...topServers.map(s => s.count), 1);

  // ─── Top Domains ──────────────────────────────────────────
  const topDomains = useMemo(() => {
    return domains
      .filter(d => !d.archived)
      .map(d => {
        const latestRep = reputation
          .filter(r => r.domainId === d.id)
          .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
        return { domain: d.domain, score: domainHealthScore(d, latestRep) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [domains, reputation]);

  const PERIODS: { label: string; val: Period }[] = [
    { label: "Aujourd'hui", val: 'today' },
    { label: '7 jours', val: '7' },
    { label: '30 jours', val: '30' },
    { label: '90 jours', val: '90' },
  ];

  return (
    <ScreenContainer title="Analyses" subtitle="Métriques de performance">
      {/* Period Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {PERIODS.map(p => (
          <button
            key={p.val}
            onClick={() => setPeriod(p.val)}
            className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all ${
              period === p.val
                ? 'bg-primary text-white shadow-md shadow-primary/25'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-border/50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Envoyé', value: totalSent.toLocaleString(), icon: '📨', color: '#3b82f6' },
          { label: 'Taux de Succès', value: `${successRate}%`, icon: '✅', color: '#10b981' },
          { label: 'Domaines Actifs', value: activeDomains, icon: '🌐', color: '#8b5cf6' },
          { label: 'IPs Saines', value: healthyIps, icon: '🛡️', color: '#f59e0b' },
        ].map(m => (
          <div key={m.label} className="kt-card p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full opacity-50" style={{ backgroundColor: m.color }} />
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm">{m.icon}</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-70">{m.label}</span>
            </div>
            <div className="text-2xl font-extrabold text-foreground leading-none">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Trend Chart */}
      <div className="kt-card p-5 overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-1.5 h-4 bg-primary rounded-full" />
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tendance d'envoi</span>
        </div>
        <div className="flex items-end justify-between gap-1 h-32 pt-6">
          {trendData.map((day, i) => {
            const pct = maxTrend > 0 ? (day.value / maxTrend) * 100 : 0;
            const isLast = i === trendData.length - 1;
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div className="relative w-full flex items-end justify-center h-24">
                  {day.value > 0 && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-muted-foreground whitespace-nowrap">
                      {n2s(day.value)}
                    </span>
                  )}
                  <div
                    className={`w-full max-w-[16px] rounded-t-sm transition-all duration-700 ${
                      isLast ? 'bg-primary shadow-sm shadow-primary/30' : 'bg-primary/25'
                    }`}
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                {trendData.length <= 10 && (
                  <span className="text-[7px] font-bold text-muted-foreground opacity-60 truncate w-full text-center">
                    {day.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Servers */}
      <div className="kt-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-1.5 h-4 bg-info rounded-full" />
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Top Serveurs</span>
        </div>
        {topServers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Aucun serveur</p>
        ) : (
          <div className="space-y-3">
            {topServers.map((s, i) => (
              <div key={s.name} className="group">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}</span>
                  <span className="flex-1 text-xs font-bold text-foreground truncate">{s.name}</span>
                  <span className="text-xs font-bold text-info">{s.count} domaines</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden ml-7">
                  <div
                    className="h-full rounded-full bg-info transition-all duration-700"
                    style={{ width: `${(s.count / maxServerCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Domains */}
      <div className="kt-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-1.5 h-4 bg-success rounded-full" />
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Top Domaines</span>
        </div>
        {topDomains.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Aucun domaine</p>
        ) : (
          <div className="space-y-3">
            {topDomains.map((d, i) => (
              <div key={d.domain} className="group">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}</span>
                  <span className="flex-1 text-xs font-bold text-foreground truncate">{d.domain}</span>
                  <span className="text-xs font-bold" style={{ color: d.score >= 80 ? '#10b981' : d.score >= 55 ? '#3b82f6' : '#f59e0b' }}>
                    {d.score}/100
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden ml-7">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${d.score}%`,
                      backgroundColor: d.score >= 80 ? '#10b981' : d.score >= 55 ? '#3b82f6' : '#f59e0b',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScreenContainer>
  );
}
