import { useState } from 'react';
import type { Server } from '../lib/types';
import { getServerRdp } from '../lib/server';
import { useAppContext } from '../App';
import { FEATURES } from '../lib/features';
import Modal, { Input } from './Modal';
import { todayStr } from '../lib/constants';
import { domainHealthScore, healthColor } from '../lib/types';

type ServerStats = {
  domains: number;
  ips: number;
  inbox: number;
  spam: number;
  blocked: number;
};

export default function ServerCard({
  server,
  stats,
  selected,
  onToggle,
  onOpen,
  onEdit,
  onDelete,
  onWarmupIP,
  onClickDomain,
}: {
  server: Server;
  stats: ServerStats;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onWarmupIP?: (ipId: string) => void;
  onClickDomain?: (domainId: string) => void;
}) {
  const [showIps, setShowIps] = useState(false);
  const [showDomainsModal, setShowDomainsModal] = useState(false);
  const { domains, ips, warmups, reputation, markIpReady, markIpBurned } = useAppContext();
  
  const serverDomains = domains.filter(d => d.serverId === server.id && !d.archived);
  const serverIps = ips.filter(ip => serverDomains.some(d => d.id === ip.domainId));

  const ipLastSent = (ipId: string) => {
    const records = warmups.filter(w => w.ipId === ipId)
      .sort((a, b) => b.date.localeCompare(a.date));
    return records.length > 0 ? { sent: records[0].sent, date: records[0].date } : null;
  };

  const ipSentToday = (ipId: string) => {
    return warmups.filter(w => w.ipId === ipId && w.date === todayStr()).reduce((s, w) => s + w.sent, 0);
  };

  const todaySent = warmups
    .filter(w => {
      const isServerIp = serverIps.some(ip => ip.id === w.ipId);
      return isServerIp && w.date === todayStr();
    })
    .reduce((sum, w) => sum + w.sent, 0);

  const total = stats.inbox + stats.spam + stats.blocked || 1;
  const rdp = getServerRdp(server);

  return (
    <>
    <div
      className={`kt-card group transition-all duration-300 relative overflow-hidden flex flex-col h-full
        ${selected
          ? 'ring-2 ring-primary shadow-lg border-primary/50 translate-y-[-2px]'
          : 'hover:shadow-xl hover:translate-y-[-4px] cursor-pointer'}`}
      onClick={onOpen}
    >
      {/* Accent Header Stripe */}
      <div className={`absolute top-0 left-0 w-full h-[4px] transition-colors duration-300 ${
        server.status === 'active' ? 'bg-success' : server.status === 'paused' ? 'bg-warning' : 'bg-destructive'
      }`} />

      <div className="p-5 flex flex-col flex-1">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="pt-1" onClick={e => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
              />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                {server.name}
              </h3>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="kt-badge kt-badge-light px-2 py-0.5 font-bold text-[10px] uppercase tracking-wider">
                  {rdp ? `RDP ${rdp}` : 'UNSET RDP'}
                </span>
                <span className={`kt-badge px-2 py-0.5 font-bold text-[10px] uppercase tracking-wider ${
                  server.runtimeStatus === 'running' ? 'kt-badge-success' : 'kt-badge-destructive'
                }`}>
                  {server.runtimeStatus === 'running' ? 'Running' : 'Stopped'}
                </span>
                <span className={`kt-badge px-2 py-0.5 font-bold text-[10px] uppercase tracking-wider ${
                  server.status === 'active' ? 'kt-badge-info' : 'kt-badge-warning'
                }`}>
                  {server.status}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
              title="Edit Server"
            >
              ⚙️
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
              title="Delete Server"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Rapid Metrics */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Domains</div>
            <div className="text-lg font-bold text-foreground flex items-baseline gap-1"
                 onClick={e => { e.stopPropagation(); setShowDomainsModal(true); }}>
              {stats.domains}
              <span className="text-[10px] text-primary hover:underline cursor-pointer">View</span>
            </div>
          </div>
          <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Traffic</div>
            <div className="text-lg font-bold text-foreground flex items-baseline gap-1">
              {todaySent.toLocaleString()}
              <span className="text-[10px] text-muted-foreground">/ {server.sendPerDay || 0}</span>
            </div>
          </div>
        </div>

        {/* Reputation Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2">
             <span className="text-muted-foreground">Reputation Mix</span>
             <span className="text-foreground">{Math.round((stats.inbox / total) * 100)}% Success</span>
          </div>
          <div className="h-2 flex rounded-full overflow-hidden bg-muted/50 ring-1 ring-border/50 shadow-inner">
            <div className="h-full bg-success transition-all duration-500 shadow-[inset_-2px_0_4px_rgba(0,0,0,0.1)]" style={{ width: `${(stats.inbox / total) * 100}%` }} />
            <div className="h-full bg-warning transition-all duration-500 shadow-[inset_-2px_0_4px_rgba(0,0,0,0.1)]" style={{ width: `${(stats.spam / total) * 100}%` }} />
            <div className="h-full bg-destructive transition-all duration-500" style={{ width: `${(stats.blocked / total) * 100}%` }} />
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
               <div className="w-2 h-2 rounded-full bg-success" />
               <span className="text-[10px] font-bold text-muted-foreground">{stats.inbox} INBOX</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-2 h-2 rounded-full bg-warning" />
               <span className="text-[10px] font-bold text-muted-foreground">{stats.spam} SPAM</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-2 h-2 rounded-full bg-destructive" />
               <span className="text-[10px] font-bold text-muted-foreground">{stats.blocked} LOST</span>
            </div>
          </div>
        </div>

        {/* Tags */}
        {server.tags && server.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
            {server.tags.map(tag => (
              <span key={tag} className="text-[10px] font-bold bg-primary/5 text-primary border border-primary/10 px-2 py-0.5 rounded-md hover:bg-primary/10 transition-colors">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Domain list (quick rep) */}
        {serverDomains.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/50">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
              Domains — click for reputation
            </div>
            <div className="flex flex-wrap gap-1.5">
              {serverDomains.slice(0, 8).map(d => {
                const rep = reputation
                  .filter(r => r.domainId === d.id)
                  .sort((a, b) => b.date.localeCompare(a.date))[0];
                const score = domainHealthScore(d, rep ?? null);
                const hc = healthColor(score);
                return (
                  <button key={d.id}
                    onClick={(e) => { e.stopPropagation(); onClickDomain?.(d.id); }}
                    className="text-[11px] font-mono px-2 py-1 rounded-lg border transition-all hover:shadow-sm"
                    style={{
                      background: 'var(--surface2)',
                      border: `1px solid ${hc}40`,
                      color: 'var(--text2)',
                    }}>
                    <span style={{ color: hc }}>●</span> {d.domain}
                  </button>
                );
              })}
              {serverDomains.length > 8 && (
                <button onClick={(e) => { e.stopPropagation(); setShowDomainsModal(true); }}
                  className="text-[11px] px-2 py-1 rounded-lg border"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--primary)' }}>
                  +{serverDomains.length - 8} more →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* IP Tracking Section */}
      {FEATURES.IP_TRACKING && serverIps.length > 0 && (
        <div className="px-5 pb-5 pt-2 border-t border-border bg-muted/20" onClick={e => e.stopPropagation()}>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowIps(!showIps); }}
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
          >
            {showIps ? '▼' : '▶'} IP Network Status ({serverIps.length})
          </button>
          
          {showIps && (
            <div className="mt-4 space-y-2">
              {serverIps.map(ip => {
                const isRisky = FEATURES.SUGGESTIONS && (ip.health_score ?? 100) < 50;
                return (
                  <div key={ip.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-background border border-border group/ip">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-foreground font-mono">{ip.ip}</span>
                        <span className={`kt-badge px-1.5 py-0.5 text-[9px] uppercase font-bold
                          ${ip.status === 'scaled' ? 'kt-badge-success' : ip.status === 'burned' ? 'kt-badge-destructive' : 'kt-badge-light'}`}>
                          {ip.status || 'Fresh'}
                        </span>
                      </div>
                      
                      {/* FIX 1: IP Last Sent Data */}
                      <div className="flex items-center gap-2 mt-0.5">
                        {ipSentToday(ip.id) > 0 ? (
                          <span className="text-[10px] font-mono font-bold text-primary">
                            {ipSentToday(ip.id).toLocaleString()} today
                          </span>
                        ) : ipLastSent(ip.id) ? (
                          <span className="text-[10px] font-mono font-medium text-muted-foreground">
                            {ipLastSent(ip.id)?.sent.toLocaleString()} on {ipLastSent(ip.id)?.date}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-muted-foreground uppercase opacity-60 tracking-wider">no data</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-1.5 opacity-0 group-hover/ip:opacity-100 transition-opacity">
                      {ip.status !== 'scaled' && (
                        <button onClick={(e) => { e.stopPropagation(); markIpReady(ip.id); }} 
                          className="kt-btn kt-btn-xs kt-btn-outline px-2 h-7 border-border text-[10px] font-bold">READY</button>
                      )}
                      
                      {/* BURN Button -> Warmup Drawer */}
                      {ip.status !== 'burned' && (
                        <button onClick={(e) => { 
                            e.stopPropagation(); 
                            if (onWarmupIP) onWarmupIP(ip.id);
                            else markIpBurned(ip.id);
                          }} 
                          className="kt-btn kt-btn-xs kt-btn-outline px-2 h-7 border-primary text-primary hover:bg-primary/5 text-[10px] font-bold shadow-sm shadow-primary/10">{onWarmupIP ? 'WARMUP' : 'BURN'}</button>
                      )}
                    </div>
                    {isRisky && <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" title="Action required: Risky IP" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
      
      {showDomainsModal && (
        <Modal title={`Domains on ${server.name}`} onClose={() => setShowDomainsModal(false)} size="lg">
          <div className="overflow-x-auto">
            <table className="kt-table">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Domain</th>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Network</th>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Outcome</th>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Rating</th>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {domains
                  .filter(d => d.serverId === server.id && !d.archived)
                  .map(d => {
                    const ip = serverIps.find(ip => ip.domainId === d.id);
                    const rep = reputation
                      .filter(r => r.domainId === d.id)
                      .sort((a,b) => b.date.localeCompare(a.date))[0];
                    const score = domainHealthScore(d, rep ?? null);
                    return (
                      <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-foreground font-mono text-xs">{d.domain}</td>
                        <td className="px-4 py-3 font-medium text-primary font-mono text-[11px]">{ip?.ip || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`kt-badge px-2 py-0.5 text-[10px] font-bold uppercase ${
                            d.status === 'inbox' ? 'kt-badge-success' : d.status === 'spam' ? 'kt-badge-warning' : 'kt-badge-destructive'
                          }`}>
                            {d.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <RepBadge val={d.domainRep ?? rep?.domainRep} label="DOM" />
                            <RepBadge val={d.ipRep ?? rep?.ipRep} label="IP" />
                          </div>
                        </td>
                        <td className="px-4 py-3 w-20">
                           <div className="flex items-center gap-2 font-bold font-mono text-xs" style={{ color: healthColor(score) }}>
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: healthColor(score) }} />
                              {score}
                           </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </>
  );
}

function RepBadge({ val, label }: { val?: string; label: string }) {
  if (!val) return <span className="text-muted-foreground text-[10px] font-bold">— {label}</span>;
  const map: Record<string, string> = {
    HIGH:    'text-success',
    MEDIUM:  'text-info',
    LOW:     'text-warning',
    BAD:     'text-destructive',
  };
  const cls = map[val] ?? 'text-muted-foreground';
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1 h-3 rounded-full bg-current ${cls}`} />
      <span className={`text-[10px] font-bold uppercase tracking-wider ${cls}`}>{val}</span>
      <span className="text-[9px] font-bold text-muted-foreground opacity-50">{label}</span>
    </div>
  );
}

function SpamRateBadge({ rate }: { rate?: string }) {
  if (!rate) return <span className="text-muted-foreground text-[10px]">—</span>;
  const n = parseFloat(rate.replace('%', ''));
  if (isNaN(n)) return <span className="text-muted-foreground text-[10px]">—</span>;
  const colorClass = n === 0 ? 'text-success' : n < 0.1 ? 'text-success' : n < 1.0 ? 'text-warning' : 'text-destructive';
  return <span className={`text-xs font-bold ${colorClass}`}>{rate}</span>;
}
