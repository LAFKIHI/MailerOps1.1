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
  const [editAction, setEditAction] = useState<{ id?: string; code: string; label: string; special: boolean } | null>(null);

  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');

  const [addPresetOpen, setAddPresetOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

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
    <div className="space-y-6 md:space-y-8">
      <div>
        <h2 className="font-bold text-foreground text-2xl flex items-center gap-3">
          ⚙️ Application Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage actions, folders, presets and system utility tasks.
        </p>
      </div>

      {/* Bulk domains */}
      <div className="kt-card p-6 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer group"
        onClick={() => navigate('/bulk-domains')}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
              📂
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">Bulk Domain Upload</div>
              <div className="text-sm text-muted-foreground mt-0.5">Import large amounts of domains with IPs and sync Postmaster metrics.</div>
            </div>
          </div>
          <button
            className="kt-btn kt-btn-primary px-6"
          >
            Launch Importer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* ── Actions card ──────────────────────────────────── */}
        <div className="lg:col-span-2 xl:col-span-2 kt-card overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/30">
            <span className="font-bold text-foreground text-sm flex-1 uppercase tracking-widest">Custom Actions</span>
            <span className="kt-badge kt-badge-info px-2 py-0.5 font-bold">{resolvedActions.length}</span>
            <button onClick={() => { setEditAction({ code: '', label: '', special: false }); setAddActionOpen(true); }}
              className="kt-btn kt-btn-xs kt-btn-primary px-4">
              + New Action
            </button>
          </div>
          <div className="px-6 py-4 border-b border-border bg-muted/10">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
              <input value={actionSearch} onChange={e => setActionSearch(e.target.value)}
                placeholder="Search actions by code or description…"
                className="kt-input pl-10 w-full py-2 text-sm"
              />
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {filteredActions.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-xs font-bold uppercase tracking-widest">No matching actions found</div>
            )}
            {filteredActions.map(a => {
              const dbAction = actions.find(x => x.code === a.code);
              return (
                <div key={a.code} className="flex items-center gap-4 px-6 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                  <span className={`text-[11px] font-bold px-3 py-1 rounded-lg font-mono min-w-[36px] text-center shadow-sm
                    ${a.special ? 'bg-warning/10 text-warning border border-warning/20' : 'bg-success/10 text-success border border-success/20'}`}>
                    {a.code}
                  </span>
                  <div className="flex-1 flex flex-col min-w-0">
                    <span className="text-sm font-bold text-foreground truncate">{a.label}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                      {a.special ? 'Special Tracking enabled' : 'Standard outcome'}
                    </span>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {dbAction && (
                      <>
                        <button onClick={() => { setEditAction({ id: dbAction.id, code: dbAction.code, label: dbAction.label, special: dbAction.special }); setAddActionOpen(true); }}
                          className="kt-btn kt-btn-xs kt-btn-outline px-3 transition-all hover:bg-primary/5 hover:text-primary border-border">Edit</button>
                        <button onClick={() => handleDeleteAction(dbAction.id, dbAction.code)}
                          className="kt-btn kt-btn-xs kt-btn-outline px-3 border-border text-destructive hover:bg-destructive/5 hover:text-destructive transition-all">Del</button>
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
      <div className="kt-card border-destructive/20 overflow-hidden bg-destructive/5">
        <div className="px-6 py-4 border-b border-destructive/20 bg-destructive/10">
          <h3 className="text-sm font-bold text-destructive flex items-center gap-2 uppercase tracking-widest">
            System Maintenance
          </h3>
        </div>
        <div className="divide-y divide-destructive/10">
          <DangerRow
            label="Restore Default Settings"
            sub="Seed Firestore with 115 default actions, folders and delivery presets. Only adds missing items."
            btnLabel="Load Defaults"
            btnClass="kt-btn-outline border-destructive/20 text-destructive hover:bg-destructive/10"
            onClick={handleInitDefaults}
          />
          <DangerRow
            label="Database Snapshot Export"
            sub="Download a full JSON backup of your current database state (Tasks, Actions, Folders, Presets)."
            btnLabel="Export JSON"
            btnClass="kt-btn-outline border-border hover:bg-muted"
            onClick={() => {
              const blob = new Blob([JSON.stringify({ tasks: ctx.tasks, actions: ctx.actions, folders: ctx.folders, deliveryPresets: ctx.deliveryPresets, servers: ctx.servers }, null, 2)], { type: 'application/json' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
              a.download = `mailerops-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
              showToast('System data exported ✓');
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
    <div className="kt-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
        <span className="font-bold text-foreground text-sm flex-1 uppercase tracking-widest">{title}</span>
        <span className="kt-badge kt-badge-light px-2 py-0.5 font-bold">{count}</span>
        <button onClick={onAdd} className="kt-btn kt-btn-xs kt-btn-primary px-3">+ New</button>
      </div>
      <div className="max-h-72 overflow-y-auto">{children}</div>
    </div>
  );
}

function SettingsItem({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
      <div className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
      <span className="flex-1 text-sm text-foreground font-medium">{label}</span>
      <button onClick={onDelete}
        className="kt-btn kt-btn-xs kt-btn-outline px-2 border-border text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive/5 transition-all">
        Del
      </button>
    </div>
  );
}

function EmptyMsg({ msg }: { msg: string }) {
  return <div className="text-center py-8 text-muted-foreground text-xs font-bold uppercase tracking-widest">{msg}</div>;
}

function DangerRow({ label, sub, btnLabel, btnClass, onClick }: { label: string; sub: string; btnLabel: string; btnClass: string; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-5 flex-wrap">
      <div className="max-w-md">
        <div className="text-sm font-bold text-foreground">{label}</div>
        <div className="text-[11px] text-muted-foreground mt-1 font-medium leading-relaxed">{sub}</div>
      </div>
      <button onClick={onClick} className={`kt-btn kt-btn-xs font-bold px-5 py-2.5 transition-all ${btnClass}`}>
        {btnLabel}
      </button>
    </div>
  );
}
