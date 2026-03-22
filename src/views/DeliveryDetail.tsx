import {
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import { useAppContext } from '../App';
import Drawer, {
  DField,
  DFooter,
  DInput,
  DSelect,
} from '../components/Drawer';
import {
  DEFAULT_ACTIONS,
  fmtDate,
  todayStr,
} from '../lib/constants';
import type { DeliverySession } from '../lib/types';
import { FEATURES } from '../lib/features';
import { useConfirm } from '../hooks/useConfirm';

// ─────────────────────────────────────────────────────────────────
// A session has two phases:
//   status = 'in_progress'  → action is running, results locked
//   status = 'done'         → action finished, results entered
// ─────────────────────────────────────────────────────────────────

export default function DeliveryDetail() {
  const { id: deliveryId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ctx = useAppContext();
  const { confirm } = useConfirm();
  const { deliveries, deliverySessions, actions, showToast } = ctx;

  const delivery = deliveries.find(d => d.id === deliveryId);
  const sessions = useMemo(() =>
    [...deliverySessions]
      .filter(s => s.deliveryId === deliveryId)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [deliverySessions, deliveryId]
  );

  const resolvedActions = actions.length ? actions : DEFAULT_ACTIONS;
  const getAction = (code: string) => resolvedActions.find(a => a.code === code);

  // ── Modal state ───────────────────────────────────────────────
  const [modal,      setModal]      = useState<'none'|'new'|'edit'|'results'>('none');
  const [target,     setTarget]     = useState<DeliverySession | null>(null);

  // Phase 1 fields (always editable)
  const [date,       setDate]       = useState(todayStr());
  const [actionCode, setActionCode] = useState('');
  const [serverId,   setServerId]   = useState('');
  const [phase1Notes,setPhase1Notes]= useState('');

  // Phase 2 fields (results — only when done)
  const [succeeded,  setSucceeded]  = useState('');
  const [badProxy,   setBadProxy]   = useState('');
  const [deleted,    setDeleted]    = useState('');
  const [untouched,  setUntouched]  = useState('');
  const [resultNotes,setResultNotes]= useState('');

  const [saving,     setSaving]     = useState(false);
  const [editMeta,   setEditMeta]   = useState(false);
  const [newName,    setNewName]    = useState('');
  const [newTotal,   setNewTotal]   = useState('');

  if (!delivery) return (
    <div className="text-center py-20">
      <p className="text-[#5a6478] font-mono text-sm">Delivery not found.</p>
      <button onClick={() => navigate('/deliveries')}
        className="mt-4 text-[#4df0a0] text-sm font-mono hover:underline">← Back</button>
    </div>
  );

  // ── Computed ──────────────────────────────────────────────────
  const totalLost   = delivery.totalBoxes - delivery.currentBoxes;
  const survPct     = delivery.totalBoxes > 0
    ? Math.round((delivery.currentBoxes / delivery.totalBoxes) * 100) : 0;
  const inProgress  = sessions.filter(s => s.notes?.startsWith('__status:in_progress')).length;
  const totalDeleted= sessions.reduce((s, x) => s + (x.deleted ?? 0), 0);
  const totalBadProxy=sessions.reduce((s, x) => s + (x.badProxy ?? 0), 0);

  // ── Open new session (Phase 1 only) ──────────────────────────
  const openNew = () => {
    setTarget(null);
    setDate(todayStr());
    setActionCode('');
    setServerId(delivery.serverId ?? '');
    setPhase1Notes('');
    setModal('new');
  };

  // ── Open edit for Phase 1 fields ─────────────────────────────
  const openEdit = (s: DeliverySession) => {
    setTarget(s);
    setDate(s.date);
    setActionCode(s.actionCode);
    setServerId(s.serverId);
    // extract user notes (strip the status prefix)
    setPhase1Notes(s.notes?.replace(/^__status:(in_progress|done)\n?/, '') ?? '');
    setModal('edit');
  };

  // ── Open results form (Phase 2) ───────────────────────────────
  const openResults = (s: DeliverySession) => {
    setTarget(s);
    setSucceeded(s.succeeded > 0 ? String(s.succeeded) : '');
    setBadProxy( s.badProxy  > 0 ? String(s.badProxy)  : '');
    setDeleted(  s.deleted   > 0 ? String(s.deleted)   : '');
    setUntouched(s.untouched > 0 ? String(s.untouched) : '');
    // extract result notes
    setResultNotes(s.notes?.replace(/^__status:(in_progress|done)\n?/, '') ?? '');
    setModal('results');
  };

  const isSessionDone = (s: DeliverySession) =>
    s.notes?.startsWith('__status:done') || s.succeeded > 0 || s.deleted > 0 || s.badProxy > 0;

  const sessionSum = () =>
    (Number(succeeded)||0) + (Number(badProxy)||0) +
    (Number(deleted)||0)   + (Number(untouched)||0);

  // ── Save Phase 1 (new session — In Progress) ─────────────────
  const handleSaveNew = async () => {
    if (!actionCode) { showToast('Select an action', true); return; }
    setSaving(true);
    try {
      await ctx.addDeliverySession(delivery.id, {
        date, actionCode, serverId,
        succeeded: 0, badProxy: 0, deleted: 0, untouched: 0,
        notes: `__status:in_progress\n${phase1Notes}`.trim(),
      });
      showToast('Session started ✓');
      setModal('none');
    } catch { showToast('Error', true); }
    setSaving(false);
  };

  // ── Save edit Phase 1 (date/action/server only) ───────────────
  const handleSaveEdit = async () => {
    if (!target || !actionCode) return;
    setSaving(true);
    try {
      // preserve status prefix
      const statusPfx = isSessionDone(target) ? '__status:done' : '__status:in_progress';
      await ctx.updateDeliverySession(target.id, {
        date, actionCode, serverId,
        notes: `${statusPfx}\n${phase1Notes}`.trim(),
      });
      showToast('Session updated ✓');
      setModal('none');
    } catch { showToast('Error', true); }
    setSaving(false);
  };

  // ── Save Phase 2 (results — mark Done) ───────────────────────
  const handleSaveResults = async () => {
    if (!target) return;
    if (sessionSum() === 0) { showToast('Enter at least one count', true); return; }
    setSaving(true);
    try {
      const prevDeleted = target.deleted ?? 0;
      const newDeleted  = Number(deleted) || 0;
      const diff        = newDeleted - prevDeleted;   // net change in lost boxes

      await ctx.updateDeliverySession(target.id, {
        succeeded: Number(succeeded) || 0,
        badProxy:  Number(badProxy)  || 0,
        deleted:   newDeleted,
        untouched: Number(untouched) || 0,
        notes: `__status:done\n${resultNotes}`.trim(),
      });

      // Adjust currentBoxes only for the net new deletions
      if (diff !== 0) {
        await ctx.updateDelivery(delivery.id, {
          currentBoxes: Math.max(0, delivery.currentBoxes - diff),
          lastActivityAt: new Date().toISOString(),
        });
      }

      showToast('Results saved ✓');
      setModal('none');
    } catch { showToast('Error', true); }
    setSaving(false);
  };

  const handleDeleteSession = async (s: DeliverySession) => {
    if (!await confirm({ title: 'Delete Session', message: 'Delete this session? Deleted boxes will be restored to active count.', danger: true })) return;
    try { await ctx.deleteDeliverySession(s.id); showToast('Session deleted'); }
    catch { showToast('Error', true); }
  };

  return (
    <div className="space-y-5">
      {/* breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button onClick={() => navigate('/deliveries')}
          className="hover:text-primary transition-colors">Deliveries</button>
        <span>/</span>
        <span className="text-foreground">{delivery.name}</span>
      </div>

      {/* header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{delivery.name}</h1>
            <button
              onClick={() => { setNewName(delivery.name); setNewTotal(String(delivery.totalBoxes)); setEditMeta(true); }}
              className="kt-btn kt-btn-outline px-2 py-0.5 text-xs">
              Edit
            </button>
            {inProgress > 0 && (
              <span className="text-xs bg-warning/10 text-warning border border-warning/30 px-2 py-0.5 rounded animate-pulse">
                ⏳ {inProgress} in progress
              </span>
            )}
          </div>
          {delivery.notes && (
            <p className="text-sm text-muted-foreground mt-1">{delivery.notes}</p>
          )}
        </div>
        <button onClick={openNew}
          className="kt-btn kt-btn-primary">
          + Start Session
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Started With', val: delivery.totalBoxes.toLocaleString(),    color: 'text-foreground' },
          { label: 'Active Now',   val: delivery.currentBoxes.toLocaleString(),  color: 'text-success' },
          { label: 'Total Lost',   val: totalLost.toLocaleString(),              color: 'text-destructive' },
          { label: 'Survival',     val: survPct + '%',
            color: survPct >= 90 ? 'text-success' : survPct >= 70 ? 'text-warning' : 'text-destructive' },
          { label: 'Sessions',     val: sessions.length,                         color: 'text-primary' },
          { label: 'Proxy Swaps',  val: totalBadProxy.toLocaleString(),          color: 'text-warning' },
        ].map(k => (
          <div key={k.label} className="kt-card px-4 py-3">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{k.label}</div>
            <div className={`text-xl font-bold ${k.color}`}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* --- BEGIN SHADOW UI INJECTION --- */}
      {FEATURES.SMART_STATS && (
        <div className="kt-card p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium">Health</div>
          <div className="flex gap-6 text-sm flex-wrap">
            <span className="text-success">Active Accounts: {delivery.currentBoxes.toLocaleString()}</span>
            <span className="text-destructive">Disabled: {totalLost.toLocaleString()}</span>
            <span className="text-primary">Health Score: {survPct}%</span>
          </div>
        </div>
      )}
      {/* --- END SHADOW UI INJECTION --- */}

      {/* lifetime health bar */}
      <div className="kt-card p-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium">
          Mailbox Lifetime — {delivery.totalBoxes} total
        </div>
        <div className="flex h-5 rounded-lg overflow-hidden gap-px">
          <div className="bg-success flex items-center justify-center"
            style={{ width: `${survPct}%` }}
            title={`Active: ${delivery.currentBoxes}`}>
            {survPct > 12 && (
              <span className="text-xs font-bold text-white">{delivery.currentBoxes}</span>
            )}
          </div>
          <div className="bg-destructive flex items-center justify-center"
            style={{ width: `${100 - survPct}%` }}
            title={`Lost: ${totalLost}`}>
            {(100 - survPct) > 8 && (
              <span className="text-xs font-bold text-white">{totalLost}</span>
            )}
          </div>
        </div>
        <div className="flex gap-6 mt-2 text-xs flex-wrap">
          <span className="text-success">■ {delivery.currentBoxes.toLocaleString()} active ({survPct}%)</span>
          <span className="text-destructive">■ {totalLost.toLocaleString()} lost ({100 - survPct}%)</span>
          <span className="text-warning">⟳ {totalBadProxy.toLocaleString()} proxy swaps total</span>
        </div>
      </div>

      {/* session timeline */}
      <div>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3">
          Sessions — {sessions.length}
        </h2>

        {sessions.length === 0 ? (
          <div className="kt-card border-dashed p-10 text-center">
            <p className="text-muted-foreground text-sm">
              No sessions yet.<br />Click "+ Start Session" when you begin running an action.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s, i) => {
              const done    = isSessionDone(s);
              const act     = getAction(s.actionCode);
              const total   = s.succeeded + s.badProxy + s.deleted + s.untouched;
              const sPct    = total > 0 ? Math.round((s.succeeded / total) * 100) : 0;
              const bPct    = total > 0 ? Math.round((s.badProxy  / total) * 100) : 0;
              const dPct    = total > 0 ? Math.round((s.deleted   / total) * 100) : 0;
              const uPct    = total > 0 ? Math.round((s.untouched / total) * 100) : 0;
              const userNote= s.notes?.replace(/^__status:(in_progress|done)\n?/, '') ?? '';

              return (
                <div key={s.id}
                  className={`kt-card p-4 transition-all group
                    ${i === 0 && done ? 'border-success/30' :
                      i === 0 && !done ? 'border-warning/50' : ''}`}
                >
                  {/* session header */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* status pill */}
                      {done ? (
                        <span className="text-xs bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded">
                          ✓ Done
                        </span>
                      ) : (
                        <span className="text-xs bg-warning/10 text-warning border border-warning/30 px-2 py-0.5 rounded animate-pulse">
                          ⏳ In Progress
                        </span>
                      )}
                      <span className="font-bold text-foreground text-sm">{fmtDate(s.date)}</span>
                      <span className="text-xs bg-accent text-muted-foreground border border-border px-2 py-0.5 rounded max-w-[260px] truncate">
                        {s.actionCode} — {act?.label.slice(0, 35) ?? '—'}
                      </span>
                      {s.serverId && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          RDP {s.serverId}
                        </span>
                      )}
                    </div>

                    {/* action buttons */}
                    <div className="flex gap-1.5 shrink-0">
                      {/* Main CTA: Enter Results (if in progress) */}
                      {!done && (
                        <button onClick={() => openResults(s)}
                          className="kt-btn kt-btn-primary px-3 py-1 text-xs">
                          Enter Results
                        </button>
                      )}
                      {/* Edit results (if done) */}
                      {done && (
                        <button onClick={() => openResults(s)}
                          className="kt-btn kt-btn-outline px-2 py-0.5 text-xs opacity-0 group-hover:opacity-100">
                          Edit Results
                        </button>
                      )}
                      <button onClick={() => openEdit(s)}
                        className="kt-btn kt-btn-outline px-2 py-0.5 text-xs opacity-0 group-hover:opacity-100">
                        Edit Info
                      </button>
                      <button onClick={() => handleDeleteSession(s)}
                        className="kt-btn kt-btn-outline px-2 py-0.5 text-xs text-muted-foreground hover:border-destructive hover:text-destructive opacity-0 group-hover:opacity-100">
                        Del
                      </button>
                    </div>
                  </div>

                  {/* results (only shown when done) */}
                  {done && total > 0 && (
                    <>
                      <div className="mt-3 mb-2">
                        <div className="flex h-3 rounded-full overflow-hidden gap-px bg-border">
                          {sPct > 0 && <div className="bg-success" style={{ width: `${sPct}%` }} title={`Succeeded: ${s.succeeded}`} />}
                          {bPct > 0 && <div className="bg-warning" style={{ width: `${bPct}%` }} title={`Bad proxy: ${s.badProxy}`} />}
                          {dPct > 0 && <div className="bg-destructive" style={{ width: `${dPct}%` }} title={`Deleted: ${s.deleted}`} />}
                          {uPct > 0 && <div className="bg-border" style={{ width: `${uPct}%` }} />}
                        </div>
                      </div>
                      <div className="flex gap-5 text-sm flex-wrap">
                        {s.succeeded > 0 && <span className="text-success">✓ <strong>{s.succeeded}</strong> ok</span>}
                        {s.badProxy  > 0 && <span className="text-warning">⟳ <strong>{s.badProxy}</strong> proxy replaced</span>}
                        {s.deleted   > 0 && <span className="text-destructive">✗ <strong>{s.deleted}</strong> deleted (lost)</span>}
                        {s.untouched > 0 && <span className="text-muted-foreground">… <strong>{s.untouched}</strong> untouched</span>}
                        <span className="text-muted-foreground">= {total} checked</span>
                      </div>
                    </>
                  )}

                  {/* not done hint */}
                  {!done && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Action running… click <strong className="text-warning">Enter Results</strong> when it finishes.
                    </p>
                  )}

                  {userNote && (
                    <p className="mt-2 text-sm text-muted-foreground border-t border-border pt-2">{userNote}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL: New session (Phase 1 — In Progress) ──────────── */}
      {modal === 'new' && (
        <Drawer open={modal === 'new'} title="Start Session" onClose={() => setModal('none')}>
          <p className="text-muted-foreground text-xs mb-4 bg-accent border border-border rounded px-3 py-2">
            Record that you started an action. You'll enter the results later when it finishes.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <DField label="Date Started" required>
              <div className="kt-input w-full">
                <DInput type="date" value={date} onChange={e => setDate(e.target.value)} autoFocus />
              </div>
            </DField>
            <DField label="RDP ID">
              <div className="kt-input w-full">
                <input value={serverId} onChange={e => setServerId(e.target.value)}
                  list="rdpListNew" placeholder="e.g. 178" className="w-full bg-transparent outline-none" />
              </div>
              <datalist id="rdpListNew">
                {[...new Set(deliveries.map(d => d.serverId).filter(Boolean))].map(r => <option key={r} value={r} />)}
              </datalist>
            </DField>
          </div>
          <DField label="Action" required>
            <div className="kt-input w-full">
              <DSelect value={actionCode} onChange={e => setActionCode(e.target.value)}>
                <option value="">— select action —</option>
                {resolvedActions.map(a => (
                  <option key={a.code} value={a.code}>{a.code} — {a.label}</option>
                ))}
              </DSelect>
            </div>
          </DField>
          <DField label="Notes (optional)">
            <div className="kt-input w-full">
              <DInput value={phase1Notes} onChange={e => setPhase1Notes(e.target.value)}
                placeholder="e.g. Using proxy batch C, 500 boxes…" />
            </div>
          </DField>
          <div className="mt-2 mb-1 text-xs text-muted-foreground bg-warning/10 border border-warning/20 rounded px-3 py-2">
            ⏳ This session will be marked <strong className="text-warning">In Progress</strong> until you enter results.
          </div>
          <DFooter onCancel={() => setModal('none')} onSave={handleSaveNew} saving={saving} />
        </Drawer>
      )}

      {/* ── MODAL: Edit session info (Phase 1 fields only) ──────── */}
      {modal === 'edit' && target && (
        <Drawer open={modal === 'edit' && !!target} title="Edit Session Info" onClose={() => setModal('none')}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <DField label="Date" required>
              <div className="kt-input w-full">
                <DInput type="date" value={date} onChange={e => setDate(e.target.value)} autoFocus />
              </div>
            </DField>
            <DField label="RDP ID">
              <div className="kt-input w-full">
                <input value={serverId} onChange={e => setServerId(e.target.value)}
                  list="rdpListEdit" placeholder="e.g. 178" className="w-full bg-transparent outline-none" />
              </div>
              <datalist id="rdpListEdit">
                {[...new Set(deliveries.map(d => d.serverId).filter(Boolean))].map(r => <option key={r} value={r} />)}
              </datalist>
            </DField>
          </div>
          <DField label="Action" required>
            <div className="kt-input w-full">
              <DSelect value={actionCode} onChange={e => setActionCode(e.target.value)}>
                <option value="">— select action —</option>
                {resolvedActions.map(a => (
                  <option key={a.code} value={a.code}>{a.code} — {a.label}</option>
                ))}
              </DSelect>
            </div>
          </DField>
          <DField label="Notes">
            <div className="kt-input w-full">
              <DInput value={phase1Notes} onChange={e => setPhase1Notes(e.target.value)} />
            </div>
          </DField>
          <DFooter onCancel={() => setModal('none')} onSave={handleSaveEdit} saving={saving} />
        </Drawer>
      )}

      {/* ── MODAL: Enter Results (Phase 2 — marks Done) ─────────── */}
      {modal === 'results' && target && (
        <Drawer open={modal === 'results' && !!target} title="Enter Results" onClose={() => setModal('none')}>
          {/* session recap */}
          <div className="bg-accent border border-border rounded px-3 py-2 mb-4 text-xs">
            <div className="flex gap-4 flex-wrap text-muted-foreground">
              <span>{fmtDate(target.date)}</span>
              <span>{target.actionCode} — {getAction(target.actionCode)?.label.slice(0, 30)}</span>
              {target.serverId && <span>RDP {target.serverId}</span>}
            </div>
          </div>

          <p className="text-muted-foreground text-xs mb-1">
            Active boxes: <strong className="text-success">{delivery.currentBoxes}</strong>.
            Enter what happened to each box you worked on.
          </p>

          <div className="grid grid-cols-2 gap-3 mt-3">
            {/* Succeeded */}
            <div className="bg-success/10 border border-success/20 rounded-lg p-3">
              <div className="text-xs uppercase tracking-widest text-success mb-2 font-medium">
                ✓ Succeeded
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                OK — kept as-is, working fine
              </p>
              <div className="kt-input w-full bg-background border-success/30">
                <DInput type="number" value={succeeded} onChange={e => setSucceeded(e.target.value)}
                  placeholder="0" min="0" autoFocus />
              </div>
            </div>

            {/* Bad proxy */}
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
              <div className="text-xs uppercase tracking-widest text-warning mb-2 font-medium">
                ⟳ Bad Proxy
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Proxy replaced — box stays in the list
              </p>
              <div className="kt-input w-full bg-background border-warning/30">
                <DInput type="number" value={badProxy} onChange={e => setBadProxy(e.target.value)}
                  placeholder="0" min="0" />
              </div>
            </div>

            {/* Deleted */}
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <div className="text-xs uppercase tracking-widest text-destructive mb-2 font-medium">
                ✗ Deleted
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Disabled / restricted / mail error — removed forever
              </p>
              <div className="kt-input w-full bg-background border-destructive/30">
                <DInput type="number" value={deleted} onChange={e => setDeleted(e.target.value)}
                  placeholder="0" min="0" />
              </div>
            </div>

            {/* Untouched */}
            <div className="bg-accent border border-border rounded-lg p-3">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 font-medium">
                … Untouched
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Not processed this session
              </p>
              <div className="kt-input w-full bg-background">
                <DInput type="number" value={untouched} onChange={e => setUntouched(e.target.value)}
                  placeholder="0" min="0" />
              </div>
            </div>
          </div>

          {/* live counter */}
          {sessionSum() > 0 && (
            <div className="mt-3 text-xs px-3 py-2 rounded kt-card">
              <div className="flex gap-4 flex-wrap">
                <span className="text-foreground">Total this session: <strong>{sessionSum()}</strong></span>
                {Number(deleted) > 0 && (
                  <span className="text-destructive">
                    Active after: {Math.max(0, delivery.currentBoxes - (Number(deleted) - (target.deleted ?? 0)))}
                    {' '}(−{Number(deleted) - (target.deleted ?? 0)} new deletions)
                  </span>
                )}
              </div>
              {/* mini result bar preview */}
              <div className="flex h-2 rounded-full overflow-hidden gap-px mt-2 bg-border">
                {sessionSum() > 0 && <>
                  <div className="bg-success" style={{ width: `${Math.round(((Number(succeeded)||0)/sessionSum())*100)}%` }} />
                  <div className="bg-warning" style={{ width: `${Math.round(((Number(badProxy)||0)/sessionSum())*100)}%` }} />
                  <div className="bg-destructive" style={{ width: `${Math.round(((Number(deleted)||0)/sessionSum())*100)}%` }} />
                  <div className="bg-border" style={{ width: `${Math.round(((Number(untouched)||0)/sessionSum())*100)}%` }} />
                </>}
              </div>
            </div>
          )}

          <div className="mt-3">
            <DField label="Notes (optional)">
              <div className="kt-input w-full">
                <DInput value={resultNotes} onChange={e => setResultNotes(e.target.value)}
                  placeholder="e.g. Provider X proxies failing, switched to Y for next session…" />
              </div>
            </DField>
          </div>

          <DFooter onCancel={() => setModal('none')} onSave={handleSaveResults} saving={saving} />
        </Drawer>
      )}

      {/* ── MODAL: Edit delivery meta ────────────────────────────── */}
      {editMeta && (
        <Drawer open={editMeta} title="Edit Delivery" onClose={() => setEditMeta(false)}>
          <DField label="Delivery Name" required>
            <div className="kt-input w-full">
              <DInput value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
            </div>
          </DField>
          <DField label="Initial Total Mailboxes">
            <div className="kt-input w-full">
              <DInput type="number" value={newTotal} onChange={e => setNewTotal(e.target.value)} min="1" />
            </div>
          </DField>
          <p className="text-xs text-muted-foreground mt-1 mb-2">
            Changing the total only affects percentage display.
          </p>
          <DFooter
            onCancel={() => setEditMeta(false)}
            onSave={async () => {
              if (!newName.trim()) return;
              setSaving(true);
              try {
                await ctx.updateDelivery(delivery.id, {
                  name: newName.trim(),
                  totalBoxes: Number(newTotal) || delivery.totalBoxes,
                });
                showToast('Updated ✓');
                setEditMeta(false);
              } catch { showToast('Error', true); }
              setSaving(false);
            }}
            saving={saving}
          />
        </Drawer>
      )}
    </div>
  );
}
