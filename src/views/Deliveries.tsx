import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import Drawer, { DField, DFooter, DInput } from '../components/Drawer';
import type { Delivery } from '../lib/types';
import { todayStr } from '../lib/constants';
import { useConfirm } from '../hooks/useConfirm';

export default function Deliveries() {
  const { deliveries, deliverySessions, showToast, createDelivery, deleteDelivery } = useAppContext();
  const navigate = useNavigate();
  const { confirm } = useConfirm();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [name, setName] = useState('');
  const [total, setTotal] = useState('');
  const [rdpId, setRdpId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsedRdp, setCollapsedRdp] = useState<Record<string, boolean>>({});

  const latestSession = (deliveryId: string) =>
    [...deliverySessions]
      .filter(s => s.deliveryId === deliveryId)
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

  const sessionCount = (deliveryId: string) =>
    deliverySessions.filter(s => s.deliveryId === deliveryId).length;

  const isSessionDone = (s: ReturnType<typeof latestSession>) =>
    s && (s.notes?.startsWith('__status:done') || s.succeeded > 0 || s.deleted > 0 || s.badProxy > 0);

  const filtered = useMemo(() => (
    deliveries.filter(d =>
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.serverId.toLowerCase().includes(search.toLowerCase())
    )
  ), [deliveries, search]);

  const grouped = useMemo(() => {
    const map: Record<string, Delivery[]> = {};
    filtered.forEach(delivery => {
      const key = delivery.serverId?.trim() || 'No RDP';
      map[key] = map[key] ?? [];
      map[key].push(delivery);
    });

    Object.values(map).forEach(items =>
      items.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())
    );

    return Object.entries(map).sort((a, b) => {
      const aBoxes = a[1].reduce((sum, delivery) => sum + delivery.currentBoxes, 0);
      const bBoxes = b[1].reduce((sum, delivery) => sum + delivery.currentBoxes, 0);
      return bBoxes - aBoxes;
    });
  }, [filtered]);

  const totalBoxesAll = deliveries.reduce((sum, d) => sum + d.totalBoxes, 0);
  const currentBoxesAll = deliveries.reduce((sum, d) => sum + d.currentBoxes, 0);
  const lostAll = totalBoxesAll - currentBoxesAll;
  const todaySessions = deliverySessions.filter(s => s.date === todayStr()).length;
  const inProgressCount = deliverySessions.filter(s =>
    s.notes?.startsWith('__status:in_progress') && !s.succeeded && !s.deleted && !s.badProxy
  ).length;

  const knownRDPs = useMemo(() =>
    [...new Set(deliveries.map(d => d.serverId).filter(Boolean))].sort(),
    [deliveries]
  );

  const handleCreate = async () => {
    if (!name.trim() || !total) return;
    setSaving(true);
    try {
      await createDelivery(name.trim(), Number(total), rdpId.trim(), notes.trim());
      showToast('Delivery created ✓');
      setDrawerOpen(false);
      setName('');
      setTotal('');
      setRdpId('');
      setNotes('');
    } catch {
      showToast('Error creating delivery', true);
    }
    setSaving(false);
  };

  const handleDelete = async (delivery: Delivery, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!await confirm({ title: 'Delete Delivery', message: `Delete "${delivery.name}" and all its sessions?`, danger: true })) return;
    try {
      await deleteDelivery(delivery.id);
      showToast('Deleted');
    } catch {
      showToast('Error', true);
    }
  };

  const toggleGroup = (rdp: string) => {
    setCollapsedRdp(prev => ({ ...prev, [rdp]: !prev[rdp] }));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-['Syne',sans-serif] font-bold text-[#e2e8f0] text-base">Seed Deliveries</h1>
          <p className="text-[#5a6478] text-xs font-mono mt-0.5">
            {deliveries.length} deliveries · {currentBoxesAll.toLocaleString()} active boxes
            {inProgressCount > 0 && <span className="ml-2 text-[#f09a4d]">· {inProgressCount} in progress</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or RDP…"
            className="text-xs font-mono bg-[#1a1e22] border border-[#252b32] rounded px-3 py-1.5 text-[#e2e8f0] outline-none focus:border-[#4df0a0] w-48 placeholder:text-[#5a6478]"
          />
          <button
            onClick={() => setDrawerOpen(true)}
            className="bg-[#4df0a0] text-black text-sm font-bold font-mono px-4 py-1.5 rounded hover:opacity-85 transition-opacity whitespace-nowrap"
          >
            + New Delivery
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Deliveries', val: deliveries.length, color: '#e2e8f0' },
          { label: 'Active Boxes', val: currentBoxesAll.toLocaleString(), color: '#4df0a0' },
          { label: 'Lost Total', val: lostAll.toLocaleString(), color: '#f04d4d' },
          { label: 'Today Sessions', val: todaySessions, color: '#f09a4d' },
        ].map(item => (
          <div key={item.label} className="bg-[#131619] border border-[#252b32] rounded-lg px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-[#5a6478] mb-1">{item.label}</div>
            <div className="text-xl font-bold font-mono" style={{ color: item.color }}>{item.val}</div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-[#252b32] rounded-lg p-12 text-center">
          <div className="text-3xl mb-3">📬</div>
          <p className="text-[#5a6478] text-sm font-mono">
            {search ? 'No deliveries match your search.' : 'No deliveries yet. Click "+ New Delivery" to start.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([rdp, rdpDeliveries]) => {
            const rdpActive = rdpDeliveries.reduce((sum, d) => sum + d.currentBoxes, 0);
            const rdpTotal = rdpDeliveries.reduce((sum, d) => sum + d.totalBoxes, 0);
            const rdpLost = rdpTotal - rdpActive;
            const rdpSurv = rdpTotal > 0 ? Math.round((rdpActive / rdpTotal) * 100) : 0;
            const isCollapsed = !!collapsedRdp[rdp];

            return (
              <section key={rdp} className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => toggleGroup(rdp)}
                    className="text-[11px] font-bold font-mono bg-[#1a1e22] text-[#9aa5b4] border border-[#252b32] px-2 py-1 rounded hover:border-[#4d8ff0] hover:text-[#4d8ff0] transition-all"
                  >
                    {isCollapsed ? '+' : '−'}
                  </button>
                  <button
                    onClick={() => navigate(`/deliveries/rdp/${encodeURIComponent(rdp)}`)}
                    className="flex items-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    <span className="text-[11px] font-bold font-mono bg-[#0d1e3e] text-[#4d8ff0] border border-[#1a3a6e] px-3 py-1 rounded-full">
                      {rdp === 'No RDP' ? 'No RDP' : `RDP ${rdp}`}
                    </span>
                    <span className="text-[11px] text-[#5a6478] font-mono">
                      {rdpDeliveries.length} deliver{rdpDeliveries.length !== 1 ? 'ies' : 'y'} · View summary
                    </span>
                  </button>
                  <div className="flex-1 h-px bg-[#252b32]" />
                  <div className="flex gap-3 text-[11px] font-mono shrink-0">
                    <span className="text-[#4df0a0]">{rdpActive.toLocaleString()} active</span>
                    <span className="text-[#f04d4d]">{rdpLost.toLocaleString()} lost</span>
                    <span className="text-[#5a6478]">{rdpSurv}% survival</span>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="space-y-2 pl-2 border-l-2 border-[#0d1e3e]">
                    {rdpDeliveries.map(delivery => {
                      const last = latestSession(delivery.id);
                      const sessionTotal = sessionCount(delivery.id);
                      const lost = delivery.totalBoxes - delivery.currentBoxes;
                      const survPct = delivery.totalBoxes > 0 ? Math.round((delivery.currentBoxes / delivery.totalBoxes) * 100) : 0;
                      const done = isSessionDone(last);
                      const hasInProgress = last && !done;

                      return (
                        <div
                          key={delivery.id}
                          onClick={() => navigate(`/deliveries/${delivery.id}`)}
                          className="bg-[#131619] border border-[#252b32] rounded-lg p-4 cursor-pointer hover:border-[#4df0a0]/50 hover:bg-[#0d0f11] transition-all group"
                        >
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <span className="font-['Syne',sans-serif] font-bold text-[#e2e8f0] text-sm">{delivery.name}</span>
                                <span className="text-[10px] bg-[#0d1e3e] text-[#4d8ff0] border border-[#1a3a6e] px-2 py-0.5 rounded font-mono">
                                  {delivery.serverId ? `RDP ${delivery.serverId}` : 'No RDP'}
                                </span>
                                <span className="text-[10px] text-[#5a6478] font-mono">
                                  {sessionTotal} session{sessionTotal !== 1 ? 's' : ''}
                                </span>
                                {hasInProgress && (
                                  <span className="text-[10px] bg-[#2e1e0d] text-[#f09a4d] border border-[#f09a4d]/30 px-2 py-0.5 rounded font-mono animate-pulse">
                                    ⏳ In Progress
                                  </span>
                                )}
                              </div>

                              <div className="flex h-1.5 rounded-full overflow-hidden bg-[#252b32] gap-px mb-1.5">
                                <div className="bg-[#4df0a0]" style={{ width: `${survPct}%` }} />
                                <div className="bg-[#f04d4d]" style={{ width: `${100 - survPct}%` }} />
                              </div>

                              <div className="flex gap-4 text-[11px] font-mono">
                                <span className="text-[#4df0a0]">✓ {delivery.currentBoxes.toLocaleString()}</span>
                                <span className="text-[#f04d4d]">✕ {lost.toLocaleString()} lost</span>
                                <span className="text-[#5a6478]">/ {delivery.totalBoxes.toLocaleString()}</span>
                                <span className="text-[#5a6478]">{survPct}%</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {last ? (
                                <div className="text-right">
                                  <div className="text-[10px] text-[#5a6478] font-mono mb-1">{last.date}</div>
                                  {done ? (
                                    <div className="flex gap-1.5 justify-end font-mono text-[11px]">
                                      {last.succeeded > 0 && <span className="text-[#4df0a0]">✓{last.succeeded}</span>}
                                      {last.badProxy > 0 && <span className="text-[#f09a4d]">⟳{last.badProxy}</span>}
                                      {last.deleted > 0 && <span className="text-[#f04d4d]">✕{last.deleted}</span>}
                                      {last.untouched > 0 && <span className="text-[#5a6478]">…{last.untouched}</span>}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-[#f09a4d] font-mono">running…</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-[#5a6478] font-mono">no sessions</span>
                              )}

                              <button
                                onClick={e => handleDelete(delivery, e)}
                                className="opacity-0 group-hover:opacity-100 text-[11px] font-mono px-2 py-1 rounded border border-transparent text-[#5a6478] hover:border-[#f04d4d] hover:text-[#f04d4d] transition-all"
                              >
                                Del
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="New Delivery"
        subtitle="Create a new seed delivery to start tracking"
      >
        <DField label="Delivery Name" required>
          <DInput value={name} onChange={e => setName(e.target.value)} placeholder="e.g. nv-sd07-03" autoFocus />
        </DField>

        <DField label="Total Mailboxes" required>
          <DInput type="number" value={total} onChange={e => setTotal(e.target.value)} placeholder="e.g. 500" min="1" />
          <p className="text-[10px] text-[#5a6478] font-mono mt-1">The number of boxes on day 1. This is your starting point.</p>
        </DField>

        <DField label="RDP ID">
          <DInput value={rdpId} onChange={e => setRdpId(e.target.value)} list="rdpList" placeholder="e.g. 178" />
          <datalist id="rdpList">
            {knownRDPs.map(rdp => <option key={rdp} value={rdp} />)}
          </datalist>
          <p className="text-[10px] text-[#5a6478] font-mono mt-1">
            The RDP machine running this delivery, for example `178`
          </p>
        </DField>

        {knownRDPs.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 -mt-2">
            {knownRDPs.map(rdp => (
              <button
                key={rdp}
                onClick={() => setRdpId(rdp)}
                className={`text-[11px] font-mono px-2.5 py-1 rounded border transition-all ${
                  rdpId === rdp
                    ? 'bg-[#0d1e3e] border-[#4d8ff0] text-[#4d8ff0]'
                    : 'bg-[#1a1e22] border-[#252b32] text-[#5a6478] hover:border-[#4d8ff0] hover:text-[#4d8ff0]'
                }`}
              >
                RDP {rdp}
              </button>
            ))}
          </div>
        )}

        <DField label="Notes (optional)">
          <DInput value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Provider X accounts, batch C…" />
        </DField>

        {name && total && (
          <div className="mt-2 mb-4 bg-[#0d0f11] border border-[#252b32] rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-widest text-[#5a6478] mb-2">Preview</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[#e2e8f0] font-mono text-sm">{name}</span>
              {rdpId && (
                <span className="text-[10px] bg-[#0d1e3e] text-[#4d8ff0] border border-[#1a3a6e] px-2 py-0.5 rounded font-mono">
                  RDP {rdpId}
                </span>
              )}
            </div>
            <div className="mt-2 text-[11px] font-mono text-[#5a6478]">
              Starting with <span className="text-[#4df0a0]">{Number(total).toLocaleString()}</span> mailboxes
            </div>
          </div>
        )}

        <DFooter
          onCancel={() => setDrawerOpen(false)}
          onSave={handleCreate}
          saving={saving}
          disabled={!name.trim() || !total}
          saveLabel="Create Delivery"
        />
      </Drawer>
    </div>
  );
}
