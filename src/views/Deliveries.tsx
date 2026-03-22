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
          <h1 className="text-xl font-bold text-foreground">Seed Deliveries</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {deliveries.length} deliveries · {currentBoxesAll.toLocaleString()} active boxes
            {inProgressCount > 0 && <span className="ml-2 text-warning">· {inProgressCount} in progress</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="kt-input max-w-xs">
            <span className="text-muted-foreground mr-1">🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or RDP…"
              className="w-48 text-sm"
            />
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="kt-btn kt-btn-primary whitespace-nowrap"
          >
            + New Delivery
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Deliveries', val: deliveries.length, trendColor: 'text-foreground' },
          { label: 'Active Boxes', val: currentBoxesAll.toLocaleString(), trendColor: 'text-success' },
          { label: 'Lost Total', val: lostAll.toLocaleString(), trendColor: 'text-destructive' },
          { label: 'Today Sessions', val: todaySessions, trendColor: 'text-warning' },
        ].map(item => (
          <div key={item.label} className="kt-card px-4 py-3">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{item.label}</div>
            <div className={`text-xl font-bold ${item.trendColor}`}>{item.val}</div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="kt-card border-dashed p-12 text-center">
          <div className="text-3xl mb-3">📬</div>
          <p className="text-muted-foreground text-sm">
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
                    className="kt-btn kt-btn-outline px-2 py-1 text-xs"
                  >
                    {isCollapsed ? '+' : '−'}
                  </button>
                  <button
                    onClick={() => navigate(`/deliveries/rdp/${encodeURIComponent(rdp)}`)}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    <span className="text-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
                      {rdp === 'No RDP' ? 'No RDP' : `RDP ${rdp}`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {rdpDeliveries.length} deliver{rdpDeliveries.length !== 1 ? 'ies' : 'y'} · View summary
                    </span>
                  </button>
                  <div className="flex-1 h-px bg-border" />
                  <div className="flex gap-3 text-xs shrink-0 font-medium">
                    <span className="text-success">{rdpActive.toLocaleString()} active</span>
                    <span className="text-destructive">{rdpLost.toLocaleString()} lost</span>
                    <span className="text-muted-foreground">{rdpSurv}% survival</span>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="space-y-2 pl-2 border-l-2 border-primary/20">
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
                          className="kt-card p-4 cursor-pointer hover:border-primary/50 hover:bg-accent transition-all group"
                        >
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <span className="font-bold text-foreground text-sm">{delivery.name}</span>
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                  {delivery.serverId ? `RDP ${delivery.serverId}` : 'No RDP'}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {sessionTotal} session{sessionTotal !== 1 ? 's' : ''}
                                </span>
                                {hasInProgress && (
                                  <span className="text-xs bg-warning/10 text-warning border border-warning/30 px-2 py-0.5 rounded animate-pulse">
                                    ⏳ In Progress
                                  </span>
                                )}
                              </div>

                              <div className="flex h-1.5 rounded-full overflow-hidden bg-border gap-px mb-1.5">
                                <div className="bg-success" style={{ width: `${survPct}%` }} />
                                <div className="bg-destructive" style={{ width: `${100 - survPct}%` }} />
                              </div>

                              <div className="flex gap-4 text-xs">
                                <span className="text-success">✓ {delivery.currentBoxes.toLocaleString()}</span>
                                <span className="text-destructive">✕ {lost.toLocaleString()} lost</span>
                                <span className="text-muted-foreground">/ {delivery.totalBoxes.toLocaleString()}</span>
                                <span className="text-muted-foreground">{survPct}%</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {last ? (
                                <div className="text-right">
                                  <div className="text-xs text-muted-foreground mb-1">{last.date}</div>
                                  {done ? (
                                    <div className="flex gap-1.5 justify-end text-xs font-medium">
                                      {last.succeeded > 0 && <span className="text-success">✓{last.succeeded}</span>}
                                      {last.badProxy > 0 && <span className="text-warning">⟳{last.badProxy}</span>}
                                      {last.deleted > 0 && <span className="text-destructive">✕{last.deleted}</span>}
                                      {last.untouched > 0 && <span className="text-muted-foreground">…{last.untouched}</span>}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-warning">running…</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">no sessions</span>
                              )}

                              <button
                                onClick={e => handleDelete(delivery, e)}
                                className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 kt-btn text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
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
          <div className="kt-input w-full">
            <DInput value={name} onChange={e => setName(e.target.value)} placeholder="e.g. nv-sd07-03" autoFocus />
          </div>
        </DField>

        <DField label="Total Mailboxes" required>
          <div className="kt-input w-full">
            <DInput type="number" value={total} onChange={e => setTotal(e.target.value)} placeholder="e.g. 500" min="1" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">The number of boxes on day 1. This is your starting point.</p>
        </DField>

        <DField label="RDP ID">
          <div className="kt-input w-full">
            <DInput value={rdpId} onChange={e => setRdpId(e.target.value)} list="rdpList" placeholder="e.g. 178" />
          </div>
          <datalist id="rdpList">
            {knownRDPs.map(rdp => <option key={rdp} value={rdp} />)}
          </datalist>
          <p className="text-xs text-muted-foreground mt-1">
            The RDP machine running this delivery, for example `178`
          </p>
        </DField>

        {knownRDPs.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 -mt-2">
            {knownRDPs.map(rdp => (
              <button
                key={rdp}
                onClick={() => setRdpId(rdp)}
                className={`text-xs px-2.5 py-1 rounded border transition-all ${
                  rdpId === rdp
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-accent border-border text-muted-foreground hover:border-primary hover:text-primary'
                }`}
              >
                RDP {rdp}
              </button>
            ))}
          </div>
        )}

        <DField label="Notes (optional)">
          <div className="kt-input w-full">
            <DInput value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Provider X accounts, batch C…" />
          </div>
        </DField>

        {name && total && (
          <div className="mt-2 mb-4 kt-card bg-accent/30 p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Preview</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-foreground text-sm">{name}</span>
              {rdpId && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                  RDP {rdpId}
                </span>
              )}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Starting with <span className="text-success">{Number(total).toLocaleString()}</span> mailboxes
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
