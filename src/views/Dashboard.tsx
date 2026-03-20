import { useMemo, useState } from 'react';
import { useAppContext } from '../App';
import Drawer, { DField, DFooter, DInput, DSelect } from '../components/Drawer';
import { DEFAULT_ACTIONS, todayStr } from '../lib/constants';
import ActionMenu from '../components/ActionMenu';
import { useConfirm } from '../hooks/useConfirm';

export default function Dashboard() {
  const ctx = useAppContext();
  const {
    tasks,
    servers,
    folders,
    actions,
    deliveryPresets,
    showToast,
    createTask,
    updateTask,
    deleteTask,
    duplicateTask,
  } = ctx;

  const { confirm } = useConfirm();
  const resolvedActions = actions.length ? actions : DEFAULT_ACTIONS;

  const [date, setDate] = useState(todayStr());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Optimistic UI + Syncing Status
  const [optimisticTasks, setOptimisticTasks] = useState<Record<string, any>>({});
  const [syncingIds, setSyncingIds] = useState<Record<string, boolean>>({});

  const [deliveryName, setDeliveryName] = useState('');
  const [serverRef, setServerRef] = useState('');
  const [seedCount, setSeedCount] = useState('');
  const [actionCode, setActionCode] = useState('');
  const [folderName, setFolderName] = useState('');
  const [notes, setNotes] = useState('');

  const rawFiltered = useMemo(
    () => tasks
      .filter(t => t.date === date && !t.archived)
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [tasks, date],
  );

  const filtered = useMemo(() => {
    return rawFiltered.map(t => ({ ...t, ...optimisticTasks[t.id] })).filter(t => !t.archived);
  }, [rawFiltered, optimisticTasks]);

  const totals = useMemo(() => {
    const totalSeeds = filtered.reduce((s, t) => s + (t.seedCount || 0), 0);
    const done = filtered.filter(t => t.status === 'Done').length;
    return { totalSeeds, done, total: filtered.length };
  }, [filtered]);

  const openNew = () => {
    setDeliveryName(deliveryPresets[0]?.name ?? '');
    setServerRef('');
    setSeedCount('');
    setActionCode(resolvedActions[0]?.code ?? '');
    setFolderName(folders[0]?.name ?? '');
    setNotes('');
    setDrawerOpen(true);
  };

  const handleCreate = async () => {
    if (!deliveryName.trim()) { showToast('Delivery name required', true); return; }
    if (!seedCount || Number(seedCount) <= 0) { showToast('Seed count required', true); return; }
    if (!actionCode) { showToast('Action required', true); return; }
    if (!folderName) { showToast('Folder required', true); return; }

    setSaving(true);
    try {
      await createTask({
        deliveryName: deliveryName.trim(),
        serverId: serverRef.trim(),
        seedCount: Number(seedCount),
        actionCode,
        folderName,
        date,
        status: 'In Progress',
        boxesOpened: null,
        boxesTotal: null,
        notes: notes.trim() ? notes.trim() : null,
        reminderTime: null,
        reminderSent: false,
        createdAt: new Date().toISOString(),
        archived: false,
      });
      showToast('Task created ✓');
      setDrawerOpen(false);
    } catch {
      showToast('Create failed', true);
    }
    setSaving(false);
  };

  const toggleDone = async (id: string, status: string) => {
    const newStatus = status === 'Done' ? 'In Progress' : 'Done';
    
    setOptimisticTasks(prev => ({ ...prev, [id]: { status: newStatus } }));
    setSyncingIds(prev => ({ ...prev, [id]: true }));

    try {
      await updateTask(id, { status: newStatus });
    } catch {
      showToast('Update failed', true);
      setOptimisticTasks(prev => { const next = { ...prev }; delete next[id]; return next; });
    } finally {
      setSyncingIds(prev => { const next = { ...prev }; delete next[id]; return next; });
    }
  };

  const handleArchive = async (id: string) => {
    if (!await confirm({ title: 'Archive Task', message: 'Are you sure you want to archive this task?' })) return;
    
    setOptimisticTasks(prev => ({ ...prev, [id]: { archived: true } }));
    setSyncingIds(prev => ({ ...prev, [id]: true }));

    try {
      await updateTask(id, { archived: true });
      showToast('Archived');
    } catch {
      showToast('Archive failed', true);
      setOptimisticTasks(prev => { const next = { ...prev }; delete next[id]; return next; });
    } finally {
      setSyncingIds(prev => { const next = { ...prev }; delete next[id]; return next; });
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirm({ title: 'Delete Task', message: 'Are you sure you want to delete this task?', danger: true })) return;
    
    setOptimisticTasks(prev => ({ ...prev, [id]: { archived: true } })); // hiding optimistically
    setSyncingIds(prev => ({ ...prev, [id]: true }));

    try {
      await deleteTask(id);
      showToast('Deleted');
    } catch {
      showToast('Delete failed', true);
      setOptimisticTasks(prev => { const next = { ...prev }; delete next[id]; return next; });
    } finally {
      setSyncingIds(prev => { const next = { ...prev }; delete next[id]; return next; });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-['Syne',sans-serif] font-bold text-[#e2e8f0] text-base flex-1">Seed Tasks</h1>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="text-xs font-mono bg-[#1a1e22] border border-[#252b32] rounded px-2 py-1.5 text-[#e2e8f0] outline-none focus:border-[#4df0a0]"
        />
        <button
          onClick={openNew}
          className="bg-[#4df0a0] text-black text-sm font-bold font-mono px-4 py-1.5 rounded hover:opacity-85 transition-opacity"
        >
          + New Task
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tasks', val: totals.total, sub: 'selected day', trend: '↑', color: 'text-[#4df0a0]' },
          { label: 'Done', val: totals.done, sub: `${totals.total ? Math.round((totals.done / totals.total) * 100) : 0}%`, trend: '↑', color: 'text-[#4df0a0]' },
          { label: 'Seeds', val: totals.totalSeeds.toLocaleString(), sub: 'total', trend: '↑', color: 'text-[#4d8ff0]' },
          { label: 'Deliveries', val: new Set(filtered.map(t => t.deliveryName)).size, sub: 'unique', trend: '-', color: 'text-[#9aa5b4]' },
        ].map(k => (
          <div key={k.label} className="bg-[#131619] border border-[#252b32] rounded-lg px-4 py-3 relative overflow-hidden">
            <div className="text-[10px] uppercase tracking-widest text-[#5a6478] mb-1">{k.label}</div>
            <div className="flex items-center gap-2">
              <div className="font-['Syne',sans-serif] text-2xl font-bold leading-none text-[#e2e8f0]">{k.val}</div>
              <span className={`text-[10px] ${k.color} font-mono ml-auto`}>{k.trend}</span>
            </div>
            <div className={`text-[11px] mt-1 ${k.color}`}>{k.sub}</div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-[#252b32] rounded-lg p-12 text-center">
          <div className="text-3xl mb-3">📋</div>
          <p className="text-[#5a6478] text-sm font-mono">No tasks for this day.</p>
        </div>
      ) : (
        <div className="bg-[#131619] border border-[#252b32] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#252b32]">
                {['Delivery', 'Server', 'Seeds', 'Action', 'Folder', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-[#5a6478] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-[#252b32] last:border-0 hover:bg-[#1a1e22] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#e2e8f0]">{t.deliveryName}</td>
                  <td className="px-4 py-3 text-[#9aa5b4] font-mono text-xs">{t.serverId || '—'}</td>
                  <td className="px-4 py-3 text-[#9aa5b4] font-mono text-xs">{t.seedCount}</td>
                  <td className="px-4 py-3 text-[#9aa5b4] text-xs">
                    <span className="font-mono">{t.actionCode}</span>
                    <span className="text-[#5a6478]"> · </span>
                    <span className="hidden md:inline">{resolvedActions.find(a => a.code === t.actionCode)?.label ?? ''}</span>
                  </td>
                  <td className="px-4 py-3 text-[#9aa5b4] font-mono text-xs">{t.folderName}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleDone(t.id, t.status)}
                        className={`text-[11px] font-mono px-2 py-1 rounded border transition-all flex items-center gap-1.5 ${
                          t.status === 'Done'
                            ? 'bg-[#0d2e1e] border-[#4df0a0] text-[#4df0a0]'
                            : 'bg-[#2e1e0d] border-[#f09a4d] text-[#f09a4d]'
                        }`}
                      >
                        {t.status === 'Done' ? '✔' : '⟳'} {t.status}
                      </button>
                      {syncingIds[t.id] && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#4df0a0] animate-pulse" title="Syncing..." />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <ActionMenu
                      actions={[
                        { label: 'Duplicate', icon: '◫', onClick: () => duplicateTask(t) },
                        { label: 'Archive', icon: '📥', onClick: () => handleArchive(t.id) },
                        { label: 'Delete', icon: '🗑', onClick: () => handleDelete(t.id), danger: true },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="New Seed Task"
        subtitle="Track a seed action run for a delivery"
      >
        <DField label="Date" required>
          <DInput type="date" value={date} onChange={e => setDate(e.target.value)} />
        </DField>

        <DField label="Delivery" required>
          <DInput value={deliveryName} onChange={e => setDeliveryName(e.target.value)} list="deliveryPresets" autoFocus />
          <datalist id="deliveryPresets">
            {deliveryPresets.map(p => <option key={p.id} value={p.name} />)}
          </datalist>
        </DField>

        <DField label="Server (optional)">
          <DInput value={serverRef} onChange={e => setServerRef(e.target.value)} list="serverNames" placeholder="e.g. 178" />
          <datalist id="serverNames">
            {servers.filter(s => !s.archived).map(s => <option key={s.id} value={s.name} />)}
          </datalist>
        </DField>

        <DField label="Seeds" required>
          <DInput type="number" min="1" value={seedCount} onChange={e => setSeedCount(e.target.value)} placeholder="e.g. 30" />
        </DField>

        <DField label="Action" required>
          <DSelect value={actionCode} onChange={e => setActionCode(e.target.value)}>
            {resolvedActions.map(a => (
              <option key={a.code} value={a.code}>
                {a.code} · {a.label.slice(0, 60)}
              </option>
            ))}
          </DSelect>
        </DField>

        <DField label="Folder" required>
          <DSelect value={folderName} onChange={e => setFolderName(e.target.value)}>
            {folders.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
          </DSelect>
        </DField>

        <DField label="Notes (optional)">
          <DInput value={notes} onChange={e => setNotes(e.target.value)} />
        </DField>

        <DFooter onCancel={() => setDrawerOpen(false)} onSave={handleCreate} saving={saving} />
      </Drawer>
    </div>
  );
}
