import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppContext } from '../App';
import { fmtDate } from '../lib/constants';
import { FEATURES } from '../lib/features';

export default function DeliveryRdpSummary() {
  const { rdpId = '' } = useParams<{ rdpId: string }>();
  const navigate = useNavigate();
  const { deliveries, deliverySessions, ips, domains, warmups } = useAppContext();

  const normalizedRdp = decodeURIComponent(rdpId);
  const rdpDeliveries = useMemo(() => (
    deliveries
      .filter(d => (d.serverId?.trim() || 'No RDP') === normalizedRdp)
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())
  ), [deliveries, normalizedRdp]);

  const sessions = useMemo(() => (
    deliverySessions
      .filter(session => rdpDeliveries.some(delivery => delivery.id === session.deliveryId))
      .sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`))
  ), [deliverySessions, rdpDeliveries]);

  const totalBoxes = rdpDeliveries.reduce((sum, d) => sum + d.totalBoxes, 0);
  const currentBoxes = rdpDeliveries.reduce((sum, d) => sum + d.currentBoxes, 0);
  const lostBoxes = totalBoxes - currentBoxes;
  const survival = totalBoxes > 0 ? Math.round((currentBoxes / totalBoxes) * 100) : 0;

  const rdpDomains = useMemo(() => domains.filter(d => (d.serverId?.trim() || 'No RDP') === normalizedRdp), [domains, normalizedRdp]);
  const rdpIps = useMemo(() => ips.filter(ip => rdpDomains.some(d => d.id === ip.domainId)), [ips, rdpDomains]);
  const rdpTotalSent = useMemo(() => warmups.filter(w => rdpIps.some(ip => ip.id === w.ipId)).reduce((s, w) => s + (Number(w.sent) || 0), 0), [warmups, rdpIps]);

  if (rdpDeliveries.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-[#5a6478] font-mono text-sm">RDP summary not found.</p>
        <button onClick={() => navigate('/deliveries')} className="mt-4 text-[#4df0a0] text-sm font-mono hover:underline">
          ← Back to Deliveries
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <nav className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
        <button onClick={() => navigate('/deliveries')} className="hover:text-primary transition-colors">Deliveries</button>
        <span className="opacity-40">/</span>
        <span className="text-foreground">{normalizedRdp === 'No RDP' ? 'External' : `Node Cluster ${normalizedRdp}`}</span>
      </nav>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-muted/20 p-8 rounded-[2.5rem] border border-border/50 shadow-xl shadow-black/5">
        <div className="space-y-1">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
              {normalizedRdp === 'No RDP' ? 'External Summary' : `Cluster ${normalizedRdp}`}
            </h1>
            <div className="px-3 py-1 rounded-xl bg-primary/10 border border-primary/20 text-[10px] font-black uppercase text-primary tracking-widest">
              {rdpDeliveries.length} Stream{rdpDeliveries.length !== 1 ? 's' : ''}
            </div>
          </div>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">
            Holistic data aggregation Layer
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Operational Nodes', val: currentBoxes.toLocaleString(), theme: 'text-success bg-success/5 border-success/20', icon: '⚡' },
          { label: 'Dropped Signals', val: lostBoxes.toLocaleString(), theme: 'text-destructive bg-destructive/5 border-destructive/20', icon: '📉' },
          { label: 'Resilience Rate', val: `${survival}%`, theme: 'text-primary bg-primary/5 border-primary/20', icon: '🔋' },
          { label: 'Pulse Cycles', val: sessions.length, theme: 'text-warning bg-warning/5 border-warning/20', icon: '🔄' },
        ].map(card => (
          <div key={card.label} className={`kt-card p-6 flex flex-col gap-4 border ${card.theme}`}>
            <div className="flex items-center justify-between">
               <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{card.label}</span>
               <span className="text-lg opacity-40">{card.icon}</span>
            </div>
            <div className="text-3xl font-black tracking-tight">{card.val}</div>
          </div>
        ))}
      </div>

      {/* --- BEGIN SHADOW UI INJECTION --- */}
      {FEATURES.IP_TRACKING && (
        <div className="kt-card py-6 px-8 bg-muted/10 border-border/50 flex flex-wrap items-center gap-12 rounded-[2rem]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-success/10 flex items-center justify-center text-success">📤</div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-50">Volume Sent</span>
              <span className="text-sm font-black text-foreground">{rdpTotalSent.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">🛰️</div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-50">Active Streams</span>
              <span className="text-sm font-black text-foreground">{rdpDeliveries.filter(d => d.currentBoxes > 0).length}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-warning/10 flex items-center justify-center text-warning">🆔</div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-50">Ingested IPs</span>
              <span className="text-sm font-black text-foreground">{rdpIps.length}</span>
            </div>
          </div>
        </div>
      )}
      {/* --- END SHADOW UI INJECTION --- */}

      <section className="space-y-6">
        <div className="flex items-center gap-4 ml-1">
          <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40">Active Data Streams</h4>
          <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {rdpDeliveries.map(delivery => {
            const lost = delivery.totalBoxes - delivery.currentBoxes;
            const survPct = delivery.totalBoxes > 0 ? Math.round((delivery.currentBoxes / delivery.totalBoxes) * 100) : 0;
            return (
              <button
                key={delivery.id}
                onClick={() => navigate(`/deliveries/${delivery.id}`)}
                className="kt-card p-6 bg-background border-border/50 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 transition-all group text-left rounded-[2rem]"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-foreground group-hover:text-primary transition-colors">{delivery.name}</span>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-40">{fmtDate(delivery.lastActivityAt.slice(0, 10))}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-40">Active</span>
                      <span className="text-xs font-black text-success">{delivery.currentBoxes.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-40">Lost</span>
                      <span className="text-xs font-black text-destructive">{lost.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-40">Survival</span>
                      <span className="text-xs font-black text-primary">{survPct}%</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="kt-card border-border/50 overflow-hidden rounded-[2.5rem] shadow-xl shadow-black/5">
        <div className="px-8 py-5 border-b border-border/50 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-xl bg-warning/10 flex items-center justify-center text-warning text-sm">📅</div>
             <h4 className="text-[10px] font-black text-foreground uppercase tracking-widest">Protocol Sync Timeline</h4>
          </div>
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
            {sessions.length} recorded handshake{sessions.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="overflow-auto max-h-[500px]">
          <table className="kt-table w-full">
            <thead className="sticky top-0 bg-muted/90 backdrop-blur-md z-10 border-b border-border/50">
              <tr>
                {['Timestamp', 'Deployment', 'Operation', 'Success', 'Proxy Error', 'Destroyed', 'Idle'].map(header => (
                  <th key={header} className="px-8 py-4 text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60 whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {sessions.map(session => {
                const delivery = rdpDeliveries.find(item => item.id === session.deliveryId);
                return (
                  <tr
                    key={session.id}
                    className="hover:bg-muted/10 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/deliveries/${session.deliveryId}`)}
                  >
                    <td className="px-8 py-4 text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">{fmtDate(session.date)}</td>
                    <td className="px-8 py-4 text-xs font-black text-foreground">{delivery?.name ?? 'Unknown'}</td>
                    <td className="px-8 py-4">
                      <span className="px-2 py-1 rounded-lg bg-muted text-[10px] font-black uppercase tracking-widest opacity-60">{session.actionCode}</span>
                    </td>
                    <td className="px-8 py-4 text-xs font-black text-success">{session.succeeded}</td>
                    <td className="px-8 py-4 text-xs font-black text-warning">{session.badProxy}</td>
                    <td className="px-8 py-4 text-xs font-black text-destructive">{session.deleted}</td>
                    <td className="px-8 py-4 text-xs font-bold text-muted-foreground/40">{session.untouched}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
