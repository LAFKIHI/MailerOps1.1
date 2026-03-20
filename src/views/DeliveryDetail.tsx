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
      <div className="flex items-center gap-2 text-xs font-mono text-[#5a6478]">
        <button onClick={() => navigate('/deliveries')}
          className="hover:text-[#4df0a0] transition-colors">Deliveries</button>
        <span>/</span>
        <span className="text-[#e2e8f0]">{delivery.name}</span>
      </div>

      {/* header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-['Syne',sans-serif] font-bold text-[#e2e8f0] text-lg">{delivery.name}</h1>
            <button
              onClick={() => { setNewName(delivery.name); setNewTotal(String(delivery.totalBoxes)); setEditMeta(true); }}
              className="text-[11px] font-mono px-2 py-0.5 rounded border border-[#252b32] text-[#5a6478] hover:text-[#4df0a0] hover:border-[#4df0a0] transition-all">
              Edit
            </button>
            {inProgress > 0 && (
              <span className="text-[10px] bg-[#2e1e0d] text-[#f09a4d] border border-[#f09a4d]/30 px-2 py-0.5 rounded font-mono animate-pulse">
                ⏳ {inProgress} in progress
              </span>
            )}
          </div>
          {delivery.notes && (
            <p className="text-xs text-[#5a6478] font-mono mt-1">{delivery.notes}</p>
          )}
        </div>
        <button onClick={openNew}
          className="bg-[#4df0a0] text-black text-sm font-bold font-mono px-4 py-2 rounded hover:opacity-85 transition-opacity">
          + Start Session
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Started With', val: delivery.totalBoxes.toLocaleString(),    color: '#e2e8f0' },
          { label: 'Active Now',   val: delivery.currentBoxes.toLocaleString(),  color: '#4df0a0' },
          { label: 'Total Lost',   val: totalLost.toLocaleString(),              color: '#f04d4d' },
          { label: 'Survival',     val: survPct + '%',
            color: survPct >= 90 ? '#4df0a0' : survPct >= 70 ? '#f09a4d' : '#f04d4d' },
          { label: 'Sessions',     val: sessions.length,                         color: '#4d8ff0' },
          { label: 'Proxy Swaps',  val: totalBadProxy.toLocaleString(),          color: '#f09a4d' },
        ].map(k => (
          <div key={k.label} className="bg-[#131619] border border-[#252b32] rounded-lg px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-[#5a6478] mb-1">{k.label}</div>
            <div className="text-xl font-bold font-mono" style={{ color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* --- BEGIN SHADOW UI INJECTION --- */}
      {FEATURES.SMART_STATS && (
        <div className="bg-[#131619] border border-[#252b32] rounded-lg p-4">
          <div className="text-[11px] uppercase tracking-widest text-[#5a6478] mb-3 font-medium">Health</div>
          <div className="flex gap-6 text-[12px] font-mono flex-wrap">
            <span className="text-[#4df0a0]">Active Accounts: {delivery.currentBoxes.toLocaleString()}</span>
            <span className="text-[#f04d4d]">Disabled: {totalLost.toLocaleString()}</span>
            <span className="text-[#4d8ff0]">Health Score: {survPct}%</span>
          </div>
        </div>
      )}
      {/* --- END SHADOW UI INJECTION --- */}

      {/* lifetime health bar */}
      <div className="bg-[#131619] border border-[#252b32] rounded-lg p-4">
        <div className="text-[11px] uppercase tracking-widest text-[#5a6478] mb-3 font-medium">
          Mailbox Lifetime — {delivery.totalBoxes} total
        </div>
        <div className="flex h-5 rounded-lg overflow-hidden gap-px">
          <div className="bg-[#4df0a0] flex items-center justify-center"
            style={{ width: `${survPct}%` }}
            title={`Active: ${delivery.currentBoxes}`}>
            {survPct > 12 && (
              <span className="text-[10px] font-bold text-black">{delivery.currentBoxes}</span>
            )}
          </div>
          <div className="bg-[#f04d4d] flex items-center justify-center"
            style={{ width: `${100 - survPct}%` }}
            title={`Lost: ${totalLost}`}>
            {(100 - survPct) > 8 && (
              <span className="text-[10px] font-bold text-white">{totalLost}</span>
            )}
          </div>
        </div>
        <div className="flex gap-6 mt-2 text-[11px] font-mono flex-wrap">
          <span className="text-[#4df0a0]">■ {delivery.currentBoxes.toLocaleString()} active ({survPct}%)</span>
          <span className="text-[#f04d4d]">■ {totalLost.toLocaleString()} lost ({100 - survPct}%)</span>
          <span className="text-[#f09a4d]">⟳ {totalBadProxy.toLocaleString()} proxy swaps total</span>
        </div>
      </div>

      {/* session timeline */}
      <div>
        <h2 className="text-[11px] uppercase tracking-widest text-[#5a6478] font-medium mb-3">
          Sessions — {sessions.length}
        </h2>

        {sessions.length === 0 ? (
          <div className="border border-dashed border-[#252b32] rounded-lg p-10 text-center">
            <p className="text-[#5a6478] font-mono text-sm">
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
                  className={`bg-[#131619] border rounded-lg p-4 transition-all group
                    ${i === 0 && done ? 'border-[#4df0a0]/25' :
                      i === 0 && !done ? 'border-[#f09a4d]/40' : 'border-[#252b32]'}`}
                >
                  {/* session header */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* status pill */}
                      {done ? (
                        <span className="text-[10px] bg-[#0d2e1e] text-[#4df0a0] border border-[#1f5c3e] px-2 py-0.5 rounded font-mono">
                          ✓ Done
                        </span>
                      ) : (
                        <span className="text-[10px] bg-[#2e1e0d] text-[#f09a4d] border border-[#f09a4d]/30 px-2 py-0.5 rounded font-mono animate-pulse">
                          ⏳ In Progress
                        </span>
                      )}
                      <span className="font-mono font-bold text-[#e2e8f0] text-sm">{fmtDate(s.date)}</span>
                      <span className="text-[10px] bg-[#1a1e22] text-[#9aa5b4] border border-[#252b32] px-2 py-0.5 rounded font-mono max-w-[260px] truncate">
                        {s.actionCode} — {act?.label.slice(0, 35) ?? '—'}
                      </span>
                      {s.serverId && (
                        <span className="text-[10px] bg-[#0d1e3e] text-[#4d8ff0] px-2 py-0.5 rounded font-mono">
                          RDP {s.serverId}
                        </span>
                      )}
                    </div>

                    {/* action buttons */}
                    <div className="flex gap-1.5 shrink-0">
                      {/* Main CTA: Enter Results (if in progress) */}
                      {!done && (
                        <button onClick={() => openResults(s)}
                          className="text-xs font-mono font-bold px-3 py-1 rounded bg-[#4df0a0] text-black hover:opacity-85 transition-opacity">
                          Enter Results
                        </button>
                      )}
                      {/* Edit results (if done) */}
                      {done && (
                        <button onClick={() => openResults(s)}
                          className="text-[11px] font-mono px-2 py-0.5 rounded border border-[#252b32] text-[#5a6478] hover:text-[#4df0a0] hover:border-[#4df0a0] transition-all opacity-0 group-hover:opacity-100">
                          Edit Results
                        </button>
                      )}
                      <button onClick={() => openEdit(s)}
                        className="text-[11px] font-mono px-2 py-0.5 rounded border border-[#252b32] text-[#5a6478] hover:text-[#9aa5b4] hover:border-[#9aa5b4] transition-all opacity-0 group-hover:opacity-100">
                        Edit Info
                      </button>
                      <button onClick={() => handleDeleteSession(s)}
                        className="text-[11px] font-mono px-2 py-0.5 rounded border border-[#252b32] text-[#5a6478] hover:text-[#f04d4d] hover:border-[#f04d4d] transition-all opacity-0 group-hover:opacity-100">
                        Del
                      </button>
                    </div>
                  </div>

                  {/* results (only shown when done) */}
                  {done && total > 0 && (
                    <>
                      <div className="mt-3 mb-2">
                        <div className="flex h-3 rounded-full overflow-hidden gap-px bg-[#252b32]">
                          {sPct > 0 && <div className="bg-[#4df0a0]" style={{ width: `${sPct}%` }} title={`Succeeded: ${s.succeeded}`} />}
                          {bPct > 0 && <div className="bg-[#f09a4d]" style={{ width: `${bPct}%` }} title={`Bad proxy: ${s.badProxy}`} />}
                          {dPct > 0 && <div className="bg-[#f04d4d]" style={{ width: `${dPct}%` }} title={`Deleted: ${s.deleted}`} />}
                          {uPct > 0 && <div className="bg-[#252b32]" style={{ width: `${uPct}%` }} />}
                        </div>
                      </div>
                      <div className="flex gap-5 text-[12px] font-mono flex-wrap">
                        {s.succeeded > 0 && <span className="text-[#4df0a0]">✓ <strong>{s.succeeded}</strong> ok</span>}
                        {s.badProxy  > 0 && <span className="text-[#f09a4d]">⟳ <strong>{s.badProxy}</strong> proxy replaced</span>}
                        {s.deleted   > 0 && <span className="text-[#f04d4d]">✗ <strong>{s.deleted}</strong> deleted (lost)</span>}
                        {s.untouched > 0 && <span className="text-[#5a6478]">… <strong>{s.untouched}</strong> untouched</span>}
                        <span className="text-[#5a6478]">= {total} checked</span>
                      </div>
                    </>
                  )}

                  {/* not done hint */}
                  {!done && (
                    <p className="mt-2 text-[11px] text-[#5a6478] font-mono">
                      Action running… click <strong className="text-[#f09a4d]">Enter Results</strong> when it finishes.
                    </p>
                  )}

                  {userNote && (
                    <p className="mt-2 text-xs text-[#5a6478] font-mono border-t border-[#252b32] pt-2">{userNote}</p>
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
          <p className="text-[#5a6478] text-xs font-mono mb-4 bg-[#1a1e22] border border-[#252b32] rounded px-3 py-2">
            Record that you started an action. You'll enter the results later when it finishes.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <DField label="Date Started" required>
              <DInput type="date" value={date} onChange={e => setDate(e.target.value)} autoFocus />
            </DField>
            <DField label="RDP ID">
              <input value={serverId} onChange={e => setServerId(e.target.value)}
                list="rdpListNew" placeholder="e.g. 178" className="field-input" />
              <datalist id="rdpListNew">
                {[...new Set(deliveries.map(d => d.serverId).filter(Boolean))].map(r => <option key={r} value={r} />)}
              </datalist>
            </DField>
          </div>
          <DField label="Action" required>
            <DSelect value={actionCode} onChange={e => setActionCode(e.target.value)}>
              <option value="">— select action —</option>
              {resolvedActions.map(a => (
                <option key={a.code} value={a.code}>{a.code} — {a.label}</option>
              ))}
            </DSelect>
          </DField>
          <DField label="Notes (optional)">
            <DInput value={phase1Notes} onChange={e => setPhase1Notes(e.target.value)}
              placeholder="e.g. Using proxy batch C, 500 boxes…" />
          </DField>
          <div className="mt-2 mb-1 text-[11px] font-mono text-[#5a6478] bg-[#2e1e0d]/40 border border-[#f09a4d]/20 rounded px-3 py-2">
            ⏳ This session will be marked <strong className="text-[#f09a4d]">In Progress</strong> until you enter results.
          </div>
          <DFooter onCancel={() => setModal('none')} onSave={handleSaveNew} saving={saving} />
        </Drawer>
      )}

      {/* ── MODAL: Edit session info (Phase 1 fields only) ──────── */}
      {modal === 'edit' && target && (
        <Drawer open={modal === 'edit' && !!target} title="Edit Session Info" onClose={() => setModal('none')}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <DField label="Date" required>
              <DInput type="date" value={date} onChange={e => setDate(e.target.value)} autoFocus />
            </DField>
            <DField label="RDP ID">
              <input value={serverId} onChange={e => setServerId(e.target.value)}
                list="rdpListEdit" placeholder="e.g. 178" className="field-input" />
              <datalist id="rdpListEdit">
                {[...new Set(deliveries.map(d => d.serverId).filter(Boolean))].map(r => <option key={r} value={r} />)}
              </datalist>
            </DField>
          </div>
          <DField label="Action" required>
            <DSelect value={actionCode} onChange={e => setActionCode(e.target.value)}>
              <option value="">— select action —</option>
              {resolvedActions.map(a => (
                <option key={a.code} value={a.code}>{a.code} — {a.label}</option>
              ))}
            </DSelect>
          </DField>
          <DField label="Notes">
            <DInput value={phase1Notes} onChange={e => setPhase1Notes(e.target.value)} />
          </DField>
          <DFooter onCancel={() => setModal('none')} onSave={handleSaveEdit} saving={saving} />
        </Drawer>
      )}

      {/* ── MODAL: Enter Results (Phase 2 — marks Done) ─────────── */}
      {modal === 'results' && target && (
        <Drawer open={modal === 'results' && !!target} title="Enter Results" onClose={() => setModal('none')}>
          {/* session recap */}
          <div className="bg-[#1a1e22] border border-[#252b32] rounded px-3 py-2 mb-4 text-xs font-mono">
            <div className="flex gap-4 flex-wrap text-[#9aa5b4]">
              <span>{fmtDate(target.date)}</span>
              <span>{target.actionCode} — {getAction(target.actionCode)?.label.slice(0, 30)}</span>
              {target.serverId && <span>RDP {target.serverId}</span>}
            </div>
          </div>

          <p className="text-[#5a6478] text-xs font-mono mb-1">
            Active boxes: <strong className="text-[#4df0a0]">{delivery.currentBoxes}</strong>.
            Enter what happened to each box you worked on.
          </p>

          <div className="grid grid-cols-2 gap-3 mt-3">
            {/* Succeeded */}
            <div className="bg-[#0d2e1e]/40 border border-[#4df0a0]/20 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-widest text-[#4df0a0] mb-2 font-medium">
                ✓ Succeeded
              </div>
              <p className="text-[10px] text-[#5a6478] font-mono mb-2">
                OK — kept as-is, working fine
              </p>
              <DInput type="number" value={succeeded} onChange={e => setSucceeded(e.target.value)}
                placeholder="0" min="0" autoFocus />
            </div>

            {/* Bad proxy */}
            <div className="bg-[#2e1e0d]/40 border border-[#f09a4d]/20 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-widest text-[#f09a4d] mb-2 font-medium">
                ⟳ Bad Proxy
              </div>
              <p className="text-[10px] text-[#5a6478] font-mono mb-2">
                Proxy replaced — box stays in the list
              </p>
              <DInput type="number" value={badProxy} onChange={e => setBadProxy(e.target.value)}
                placeholder="0" min="0" />
            </div>

            {/* Deleted */}
            <div className="bg-[#2e0d0d]/40 border border-[#f04d4d]/20 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-widest text-[#f04d4d] mb-2 font-medium">
                ✗ Deleted
              </div>
              <p className="text-[10px] text-[#5a6478] font-mono mb-2">
                Disabled / restricted / mail error — removed forever
              </p>
              <DInput type="number" value={deleted} onChange={e => setDeleted(e.target.value)}
                placeholder="0" min="0" />
            </div>

            {/* Untouched */}
            <div className="bg-[#1a1e22] border border-[#252b32] rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-widest text-[#5a6478] mb-2 font-medium">
                … Untouched
              </div>
              <p className="text-[10px] text-[#5a6478] font-mono mb-2">
                Not processed this session
              </p>
              <DInput type="number" value={untouched} onChange={e => setUntouched(e.target.value)}
                placeholder="0" min="0" />
            </div>
          </div>

          {/* live counter */}
          {sessionSum() > 0 && (
            <div className="mt-3 text-xs font-mono px-3 py-2 rounded bg-[#131619] border border-[#252b32]">
              <div className="flex gap-4 flex-wrap">
                <span className="text-[#e2e8f0]">Total this session: <strong>{sessionSum()}</strong></span>
                {Number(deleted) > 0 && (
                  <span className="text-[#f04d4d]">
                    Active after: {Math.max(0, delivery.currentBoxes - (Number(deleted) - (target.deleted ?? 0)))}
                    {' '}(−{Number(deleted) - (target.deleted ?? 0)} new deletions)
                  </span>
                )}
              </div>
              {/* mini result bar preview */}
              <div className="flex h-2 rounded-full overflow-hidden gap-px mt-2 bg-[#252b32]">
                {sessionSum() > 0 && <>
                  <div className="bg-[#4df0a0]" style={{ width: `${Math.round(((Number(succeeded)||0)/sessionSum())*100)}%` }} />
                  <div className="bg-[#f09a4d]" style={{ width: `${Math.round(((Number(badProxy)||0)/sessionSum())*100)}%` }} />
                  <div className="bg-[#f04d4d]" style={{ width: `${Math.round(((Number(deleted)||0)/sessionSum())*100)}%` }} />
                  <div className="bg-[#252b32]" style={{ width: `${Math.round(((Number(untouched)||0)/sessionSum())*100)}%` }} />
                </>}
              </div>
            </div>
          )}

          <div className="mt-3">
            <DField label="Notes (optional)">
              <DInput value={resultNotes} onChange={e => setResultNotes(e.target.value)}
                placeholder="e.g. Provider X proxies failing, switched to Y for next session…" />
            </DField>
          </div>

          <DFooter onCancel={() => setModal('none')} onSave={handleSaveResults} saving={saving} />
        </Drawer>
      )}

      {/* ── MODAL: Edit delivery meta ────────────────────────────── */}
      {editMeta && (
        <Drawer open={editMeta} title="Edit Delivery" onClose={() => setEditMeta(false)}>
          <DField label="Delivery Name" required>
            <DInput value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
          </DField>
          <DField label="Initial Total Mailboxes">
            <DInput type="number" value={newTotal} onChange={e => setNewTotal(e.target.value)} min="1" />
          </DField>
          <p className="text-[10px] text-[#5a6478] font-mono mt-1 mb-2">
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
