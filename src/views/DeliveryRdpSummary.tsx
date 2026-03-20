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
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs font-mono text-[#5a6478] flex-wrap">
        <button onClick={() => navigate('/deliveries')} className="hover:text-[#4df0a0] transition-colors">Deliveries</button>
        <span>/</span>
        <span className="text-[#e2e8f0]">{normalizedRdp === 'No RDP' ? 'No RDP' : `RDP ${normalizedRdp}`}</span>
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-['Syne',sans-serif] font-bold text-[#e2e8f0] text-lg">
              {normalizedRdp === 'No RDP' ? 'No RDP Summary' : `RDP ${normalizedRdp} Summary`}
            </h1>
            <span className="text-[10px] bg-[#0d1e3e] text-[#4d8ff0] border border-[#1a3a6e] px-2 py-0.5 rounded font-mono">
              {rdpDeliveries.length} deliver{rdpDeliveries.length !== 1 ? 'ies' : 'y'}
            </span>
          </div>
          <p className="text-xs text-[#5a6478] font-mono mt-1">
            Combined view of all deliveries and sessions running on this device
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Boxes', val: currentBoxes.toLocaleString(), color: '#4df0a0' },
          { label: 'Lost Boxes', val: lostBoxes.toLocaleString(), color: '#f04d4d' },
          { label: 'Survival Rate', val: `${survival}%`, color: '#4d8ff0' },
          { label: 'Sessions', val: sessions.length, color: '#f09a4d' },
        ].map(card => (
          <div key={card.label} className="bg-[#131619] border border-[#252b32] rounded-lg px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-[#5a6478] mb-1">{card.label}</div>
            <div className="text-xl font-bold font-mono" style={{ color: card.color }}>{card.val}</div>
          </div>
        ))}
      </div>

      {/* --- BEGIN SHADOW UI INJECTION --- */}
      {FEATURES.IP_TRACKING && (
        <div className="bg-[#131619] border border-[#252b32] rounded-lg p-4">
          <div className="text-[11px] uppercase tracking-widest text-[#5a6478] mb-3 font-medium">Usage Summary</div>
          <div className="flex gap-6 text-[12px] font-mono flex-wrap">
            <span className="text-[#4df0a0]">Total Sent: {rdpTotalSent.toLocaleString()}</span>
            <span className="text-[#4d8ff0]">Active Deliveries: {rdpDeliveries.filter(d => d.currentBoxes > 0).length}</span>
            <span className="text-[#f09a4d]">Linked IPs: {rdpIps.length}</span>
          </div>
        </div>
      )}
      {/* --- END SHADOW UI INJECTION --- */}

      <div className="bg-[#131619] border border-[#252b32] rounded-lg p-4">
        <div className="text-[11px] uppercase tracking-widest text-[#5a6478] mb-3 font-medium">Deliveries on this RDP</div>
        <div className="space-y-3">
          {rdpDeliveries.map(delivery => {
            const lost = delivery.totalBoxes - delivery.currentBoxes;
            const survPct = delivery.totalBoxes > 0 ? Math.round((delivery.currentBoxes / delivery.totalBoxes) * 100) : 0;
            return (
              <button
                key={delivery.id}
                onClick={() => navigate(`/deliveries/${delivery.id}`)}
                className="w-full text-left bg-[#0d0f11] border border-[#252b32] rounded-lg p-4 hover:border-[#4df0a0]/50 transition-all"
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-['Syne',sans-serif] font-bold text-[#e2e8f0] text-sm">{delivery.name}</div>
                    <div className="text-[11px] font-mono text-[#5a6478] mt-1">
                      {delivery.currentBoxes.toLocaleString()} active · {lost.toLocaleString()} lost · {survPct}% survival
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-[#5a6478]">{fmtDate(delivery.lastActivityAt.slice(0, 10))}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-[#131619] border border-[#252b32] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#252b32] text-[11px] uppercase tracking-widest text-[#5a6478] font-medium">
          Session Timeline — {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </div>
        <div className="overflow-auto max-h-[420px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#252b32] sticky top-0 bg-[#131619]">
                {['Date', 'Delivery', 'Action', 'Succeeded', 'Bad Proxy', 'Deleted', 'Untouched'].map(header => (
                  <th key={header} className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-[#5a6478] font-medium whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map(session => {
                const delivery = rdpDeliveries.find(item => item.id === session.deliveryId);
                return (
                  <tr
                    key={session.id}
                    className="border-b border-[#252b32] last:border-0 hover:bg-[#1a1e22] transition-colors cursor-pointer"
                    onClick={() => navigate(`/deliveries/${session.deliveryId}`)}
                  >
                    <td className="px-4 py-3 text-[#9aa5b4] font-mono">{fmtDate(session.date)}</td>
                    <td className="px-4 py-3 text-[#e2e8f0] font-medium">{delivery?.name ?? 'Unknown'}</td>
                    <td className="px-4 py-3 text-[#5a6478] font-mono">{session.actionCode}</td>
                    <td className="px-4 py-3 text-[#4df0a0] font-mono">{session.succeeded}</td>
                    <td className="px-4 py-3 text-[#f09a4d] font-mono">{session.badProxy}</td>
                    <td className="px-4 py-3 text-[#f04d4d] font-mono">{session.deleted}</td>
                    <td className="px-4 py-3 text-[#5a6478] font-mono">{session.untouched}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
