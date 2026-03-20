import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import Modal, { Field, Input, ModalFooter } from '../components/Modal';
import { DEFAULT_ACTIONS } from '../lib/constants';
import { useConfirm } from '../hooks/useConfirm';

export default function Settings() {
  const ctx = useAppContext();
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const { actions, folders, deliveryPresets, servers, showToast, initDefaultData } = ctx;

  const resolvedActions = actions.length ? actions : DEFAULT_ACTIONS;

  const [actionSearch, setActionSearch] = useState('');
  const [addActionOpen, setAddActionOpen] = useState(false);
  const [editAction,   setEditAction]    = useState<{ id?: string; code: string; label: string; special: boolean } | null>(null);

  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [folderName,    setFolderName]    = useState('');

  const [addPresetOpen, setAddPresetOpen] = useState(false);
  const [presetName,    setPresetName]    = useState('');

  const [saving, setSaving] = useState(false);

  const filteredActions = resolvedActions.filter(a =>
    !actionSearch || a.code.includes(actionSearch) || a.label.toLowerCase().includes(actionSearch.toLowerCase())
  );

  // ── Actions ────────────────────────────────────────────────────
  const handleSaveAction = async () => {
    if (!editAction?.code || !editAction.label) { showToast('Code and label required', true); return; }
    setSaving(true);
    try {
      if (editAction.id) {
        await ctx.updateAction(editAction.id, { code: editAction.code, label: editAction.label, special: editAction.special });
        showToast('Action updated ✓');
      } else {
        await ctx.addAction(editAction.code, editAction.label, editAction.special);
        showToast('Action added ✓');
      }
      setEditAction(null); setAddActionOpen(false);
    } catch { showToast('Error saving action', true); }
    setSaving(false);
  };

  const handleDeleteAction = async (id: string, code: string) => {
    if (!await confirm({ title: 'Delete Action', message: `Delete action ${code}?`, danger: true })) return;
    try { await ctx.deleteAction(id); showToast('Action deleted'); }
    catch { showToast('Error', true); }
  };

  // ── Folders ────────────────────────────────────────────────────
  const handleAddFolder = async () => {
    if (!folderName.trim()) return;
    setSaving(true);
    try {
      await ctx.addFolder(folderName.trim());
      showToast('Folder added ✓');
      setAddFolderOpen(false); setFolderName('');
    } catch { showToast('Error', true); }
    setSaving(false);
  };

  const handleDeleteFolder = async (id: string, name: string) => {
    if (!await confirm({ title: 'Delete Folder', message: `Delete folder "${name}"?`, danger: true })) return;
    try { await ctx.deleteFolder(id); showToast('Folder deleted'); }
    catch { showToast('Error', true); }
  };

  // ── Delivery presets ───────────────────────────────────────────
  const handleAddPreset = async () => {
    if (!presetName.trim()) return;
    setSaving(true);
    try {
      await ctx.addDeliveryPreset(presetName.trim());
      showToast('Preset added ✓');
      setAddPresetOpen(false); setPresetName('');
    } catch { showToast('Error', true); }
    setSaving(false);
  };

  const handleDeletePreset = async (id: string, name: string) => {
    if (!await confirm({ title: 'Delete Preset', message: `Delete preset "${name}"?`, danger: true })) return;
    try { await ctx.deleteDeliveryPreset(id); showToast('Preset deleted'); }
    catch { showToast('Error', true); }
  };

  // ── Init defaults ──────────────────────────────────────────────
  const handleInitDefaults = async () => {
    if (!await confirm({ title: 'Load Defaults', message: 'Seed Firestore with 115 default actions + folders + delivery presets?', danger: false })) return;
    try { await initDefaultData(); showToast('Default data loaded ✓'); }
    catch { showToast('Error', true); }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-['Syne',sans-serif] font-bold text-[#e2e8f0] text-base">Settings</h1>

      {/* Bulk domains */}
      <div className="bg-[#131619] border border-[#252b32] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-4 flex-wrap">
          <div>
            <div className="text-sm font-medium text-[#e2e8f0]">Bulk Domain Upload</div>
            <div className="text-xs text-[#5a6478] mt-0.5">Import many domains with IPs, then optionally sync Postmaster.</div>
          </div>
          <button
            onClick={() => navigate('/bulk-domains')}
            className="text-sm font-mono font-bold px-4 py-2 rounded border border-[#252b32] text-[#4df0a0] hover:bg-[#0d2e1e] transition-all"
          >
            Open
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* ── Actions card ──────────────────────────────────── */}
        <div className="lg:col-span-2 xl:col-span-2 bg-[#131619] border border-[#252b32] rounded-lg overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#252b32]">
            <span className="font-['Syne',sans-serif] font-bold text-[#e2e8f0] text-sm flex-1">Actions</span>
            <span className="text-[11px] text-[#5a6478] bg-[#1a1e22] border border-[#252b32] rounded-full px-2 py-0.5">{resolvedActions.length}</span>
            <button onClick={() => { setEditAction({ code: '', label: '', special: false }); setAddActionOpen(true); }}
              className="text-[11px] font-mono px-3 py-1 rounded border border-[#252b32] text-[#4df0a0] hover:bg-[#0d2e1e] transition-all">
              + New
            </button>
          </div>
          <div className="px-4 py-2 border-b border-[#252b32]">
            <input value={actionSearch} onChange={e => setActionSearch(e.target.value)}
              placeholder="Search actions…"
              className="w-full bg-[#1a1e22] border border-[#252b32] rounded px-3 py-1.5 text-xs font-mono text-[#e2e8f0] outline-none focus:border-[#4df0a0] placeholder:text-[#5a6478]"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filteredActions.length === 0 && (
              <div className="text-center py-6 text-[#5a6478] text-xs font-mono">No results</div>
            )}
            {filteredActions.map(a => {
              const dbAction = actions.find(x => x.code === a.code);
              return (
                <div key={a.code} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#252b32] last:border-0 hover:bg-[#1a1e22] transition-colors group">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded font-mono min-w-[32px] text-center
                    ${a.special ? 'bg-[#2e1e0d] text-[#f09a4d]' : 'bg-[#0d2e1e] text-[#4df0a0]'}`}>
                    {a.code}
                  </span>
                  <span className="flex-1 text-xs text-[#9aa5b4] truncate">
                    {a.label}
                    {a.special && <span className="ml-2 text-[#f09a4d]">★</span>}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {dbAction && (
                      <>
                        <button onClick={() => { setEditAction({ id: dbAction.id, code: dbAction.code, label: dbAction.label, special: dbAction.special }); setAddActionOpen(true); }}
                          className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#252b32] text-[#5a6478] hover:text-[#4df0a0] hover:border-[#4df0a0] transition-all">Edit</button>
                        <button onClick={() => handleDeleteAction(dbAction.id, dbAction.code)}
                          className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#252b32] text-[#5a6478] hover:text-[#f04d4d] hover:border-[#f04d4d] transition-all">Del</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right column: folders + presets ───────────────── */}
        <div className="space-y-4">
          {/* Folders */}
          <SettingsCard
            title="Folders" count={folders.length}
            onAdd={() => setAddFolderOpen(true)}
          >
            {folders.map(f => (
              <SettingsItem key={f.id} label={f.name}
                onDelete={() => handleDeleteFolder(f.id, f.name)} />
            ))}
            {folders.length === 0 && <EmptyMsg msg="No folders" />}
          </SettingsCard>

          {/* Delivery presets */}
          <SettingsCard
            title="Delivery Presets" count={deliveryPresets.length}
            onAdd={() => setAddPresetOpen(true)}
          >
            {deliveryPresets.map(p => (
              <SettingsItem key={p.id} label={p.name}
                onDelete={() => handleDeletePreset(p.id, p.name)} />
            ))}
            {deliveryPresets.length === 0 && <EmptyMsg msg="No presets" />}
          </SettingsCard>
        </div>
      </div>

      {/* Danger zone */}
      <div className="border border-[#2e0d0d] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2e0d0d] text-sm font-bold text-[#f04d4d]">⚠ Danger Zone</div>
        <div className="divide-y divide-[#2e0d0d]">
          <DangerRow
            label="Load default data"
            sub="Seed Firestore with 115 actions, default folders and delivery presets (only runs if empty)"
            btnLabel="Load Defaults"
            btnClass="bg-[#1a1e22] border-[#252b32] text-[#9aa5b4] hover:border-[#4df0a0] hover:text-[#4df0a0]"
            onClick={handleInitDefaults}
          />
          <DangerRow
            label="Export all data"
            sub="Download a JSON snapshot of all your tasks"
            btnLabel="Export JSON"
            btnClass="bg-[#1a1e22] border-[#252b32] text-[#9aa5b4] hover:border-[#4df0a0] hover:text-[#4df0a0]"
            onClick={() => {
              const blob = new Blob([JSON.stringify({ tasks: ctx.tasks, actions: ctx.actions, folders: ctx.folders, deliveryPresets: ctx.deliveryPresets, servers: ctx.servers }, null, 2)], { type: 'application/json' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
              a.download = `mailerops-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
              showToast('Exported ✓');
            }}
          />
        </div>
      </div>

      {/* Action modal */}
      {addActionOpen && editAction && (
        <Modal title={editAction.id ? 'Edit Action' : 'New Action'} onClose={() => { setAddActionOpen(false); setEditAction(null); }} size="sm">
          <Field label="Action Code" required>
            <Input type="text" value={editAction.code} onChange={e => setEditAction(p => p && ({ ...p, code: e.target.value }))} placeholder="116" autoFocus />
          </Field>
          <Field label="Label" required>
            <Input value={editAction.label} onChange={e => setEditAction(p => p && ({ ...p, label: e.target.value }))} placeholder="Action description…" />
          </Field>
          <Field label="">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editAction.special} onChange={e => setEditAction(p => p && ({ ...p, special: e.target.checked }))}
                className="accent-[#f09a4d]" />
              <span className="text-sm text-[#9aa5b4]">Special (shows Boxes Opened/Total field)</span>
            </label>
          </Field>
          <ModalFooter onCancel={() => { setAddActionOpen(false); setEditAction(null); }} onSave={handleSaveAction} saving={saving} />
        </Modal>
      )}

      {/* Folder modal */}
      {addFolderOpen && (
        <Modal title="New Folder" onClose={() => setAddFolderOpen(false)} size="sm">
          <Field label="Folder Name" required>
            <Input value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="e.g. reporting" autoFocus />
          </Field>
          <ModalFooter onCancel={() => setAddFolderOpen(false)} onSave={handleAddFolder} saving={saving} />
        </Modal>
      )}

      {/* Preset modal */}
      {addPresetOpen && (
        <Modal title="New Delivery Preset" onClose={() => setAddPresetOpen(false)} size="sm">
          <Field label="Delivery Name" required>
            <Input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="e.g. nv-sd07-03" autoFocus />
          </Field>
          <ModalFooter onCancel={() => setAddPresetOpen(false)} onSave={handleAddPreset} saving={saving} />
        </Modal>
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────
function SettingsCard({ title, count, onAdd, children }: { title: string; count: number; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-[#131619] border border-[#252b32] rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#252b32]">
        <span className="font-['Syne',sans-serif] font-bold text-[#e2e8f0] text-sm flex-1">{title}</span>
        <span className="text-[11px] text-[#5a6478] bg-[#1a1e22] border border-[#252b32] rounded-full px-2 py-0.5">{count}</span>
        <button onClick={onAdd} className="text-[11px] font-mono px-3 py-1 rounded border border-[#252b32] text-[#4df0a0] hover:bg-[#0d2e1e] transition-all">+ New</button>
      </div>
      <div className="max-h-48 overflow-y-auto">{children}</div>
    </div>
  );
}

function SettingsItem({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#252b32] last:border-0 hover:bg-[#1a1e22] transition-colors group">
      <span className="w-1.5 h-1.5 rounded-full bg-[#4df0a0] shrink-0" />
      <span className="flex-1 text-xs text-[#9aa5b4] font-mono">{label}</span>
      <button onClick={onDelete}
        className="text-[10px] font-mono px-2 py-0.5 rounded border border-transparent text-[#5a6478] opacity-0 group-hover:opacity-100 hover:border-[#f04d4d] hover:text-[#f04d4d] transition-all">
        Del
      </button>
    </div>
  );
}

function EmptyMsg({ msg }: { msg: string }) {
  return <div className="text-center py-5 text-[#5a6478] text-xs font-mono">{msg}</div>;
}

function DangerRow({ label, sub, btnLabel, btnClass, onClick }: { label: string; sub: string; btnLabel: string; btnClass: string; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-4 flex-wrap">
      <div>
        <div className="text-sm font-medium text-[#e2e8f0]">{label}</div>
        <div className="text-xs text-[#5a6478] mt-0.5">{sub}</div>
      </div>
      <button onClick={onClick} className={`text-sm font-mono font-bold px-4 py-2 rounded border transition-all ${btnClass}`}>
        {btnLabel}
      </button>
    </div>
  );
}
