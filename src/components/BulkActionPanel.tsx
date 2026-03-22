import { useState } from 'react';
import Modal, { Field, Input } from './Modal';
import { apiBulkServerAction, apiBulkWarmup } from '../lib/api';
import { validateServerBulkAction } from '../lib/serverBulkActions';

const INPUT_CLS =
  'w-28 h-9 rounded-xl border border-border bg-background px-3 py-1 text-xs font-bold font-mono text-foreground outline-none transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/30';

const LABEL_CLS = 'text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap opacity-60';

const DIVIDER = <div className="h-8 w-px bg-border/50 mx-2" />;

function StatusBtn({
  label,
  variant,
  onClick,
  disabled,
}: {
  label: string;
  variant: 'success' | 'destructive' | 'warning' | 'info';
  onClick: () => void;
  disabled: boolean;
}) {
  const themes = {
    success: 'kt-btn-success shadow-success/10',
    destructive: 'kt-btn-destructive shadow-destructive/10',
    warning: 'kt-btn-warning shadow-warning/10',
    info: 'kt-btn-info shadow-info/10',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`kt-btn kt-btn-xs h-9 px-4 rounded-xl font-bold uppercase tracking-tight shadow-lg transition-transform active:scale-95 disabled:opacity-40 ${themes[variant]}`}
    >
      {label}
    </button>
  );
}

export default function BulkActionPanel({
  selectedIds,
  userId,
  onSuccess,
  onError,
  onClear,
  rdpValue,
  onRdpChange,
  dailyLimitValue,
  onDailyLimitChange,
  warmupValue,
  onWarmupChange,
  warmupDate,
  onWarmupDateChange,
  tagValue,
  onTagChange,
  removeTagValue,
  onRemoveTagChange,
}: {
  selectedIds: string[];
  userId?: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onClear: () => void;
  rdpValue: string;
  onRdpChange: (v: string) => void;
  dailyLimitValue: string;
  onDailyLimitChange: (v: string) => void;
  warmupValue: string;
  onWarmupChange: (v: string) => void;
  warmupDate: string;
  onWarmupDateChange: (v: string) => void;
  tagValue: string;
  onTagChange: (v: string) => void;
  removeTagValue: string;
  onRemoveTagChange: (v: string) => void;
}) {
  const count = selectedIds.length;
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState('');

  if (count === 0) return null;

  async function dispatch(action: string, value?: unknown) {
    try {
      await apiBulkServerAction(
        {
          action,
          serverIds: selectedIds,
          ...(value !== undefined ? { value } : {}),
        },
        userId
      );
      onSuccess(`${action} applied to ${count} server${count > 1 ? 's' : ''}`);
      if (action === 'removeTag') onRemoveTagChange('');
    } catch (err: any) {
      onError(err?.message || 'Bulk action failed');
    }
  }

  async function handleApply() {
    const tasks: Array<() => Promise<void>> = [];

    if (rdpValue.trim()) {
      const err = validateServerBulkAction('change_rdp', rdpValue);
      if (err) { onError(err); return; }
      tasks.push(() => dispatch('change_rdp', rdpValue.trim()));
    }

    if (dailyLimitValue.trim()) {
      const err = validateServerBulkAction('change_daily_limit', dailyLimitValue);
      if (err) { onError(err); return; }
      tasks.push(() => dispatch('change_daily_limit', Number(dailyLimitValue.trim())));
    }

    if (tagValue.trim()) {
      const err = validateServerBulkAction('assignTag', tagValue);
      if (err) { onError(err); return; }
      tasks.push(() => dispatch('assignTag', tagValue.trim()));
    }

    if (warmupValue.trim() && warmupDate.trim()) {
      const parsed = Number(warmupValue.trim());
      if (!Number.isInteger(parsed) || parsed < 0) {
        onError('Warmup count must be a positive integer');
        return;
      }
      tasks.push(async () => {
        try {
          await apiBulkWarmup({ serverIds: selectedIds, count: parsed, date: warmupDate.trim() }, userId);
          onSuccess(`Warmup logged for ${count} server${count > 1 ? 's' : ''}`);
        } catch (err: any) {
          onError(err?.message || 'Warmup logging failed');
          throw err;
        }
      });
    }

    if (tasks.length === 0) {
      onError('Enter a value in at least one field before clicking Execute Changes');
      return;
    }

    for (const task of tasks) {
      await task();
    }

    onRdpChange('');
    onDailyLimitChange('');
    onWarmupChange('');
    onTagChange('');
    onRemoveTagChange('');
    onClear();
  }

  return (
    <section className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[40] w-full max-w-[95%] xl:max-w-fit animate-in slide-in-from-bottom-8 duration-500">
      <div className="bg-background/80 backdrop-blur-2xl border border-primary/20 rounded-[2rem] px-8 py-5 shadow-2xl shadow-primary/10 flex flex-wrap items-center gap-y-4">
        {/* Selection Info */}
        <div className="flex items-center gap-4 pr-2">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-xl shadow-lg shadow-primary/20">
            {count}
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Servers Selecting</div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Bulk Control Layer Active</div>
          </div>
        </div>

        {DIVIDER}

        {/* Inputs Group */}
        <div className="flex flex-wrap items-center gap-6 px-2">
          <div className="flex flex-col gap-1.5">
            <span className={LABEL_CLS}>Transfer RDP</span>
            <input
              type="number"
              min={0}
              value={rdpValue}
              onChange={e => onRdpChange(e.target.value)}
              placeholder="000"
              className={INPUT_CLS}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={LABEL_CLS}>Daily Limit</span>
            <div className="flex items-center gap-2">
               <input
                 type="number"
                 min={0}
                 value={dailyLimitValue}
                 onChange={e => onDailyLimitChange(e.target.value)}
                 placeholder="500"
                 className={INPUT_CLS}
               />
               <span className="text-[10px] font-bold text-muted-foreground">/DAY</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={LABEL_CLS}>Add Tag</span>
            <input
              type="text"
              value={tagValue}
              onChange={e => onTagChange(e.target.value)}
              placeholder="tag..."
              className={INPUT_CLS}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={LABEL_CLS}>Remove Tag</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={removeTagValue}
                onChange={e => onRemoveTagChange(e.target.value)}
                placeholder="tag..."
                className={INPUT_CLS}
              />
              <button
                onClick={() => {
                  if (!removeTagValue.trim()) return;
                  dispatch('removeTag', removeTagValue.trim());
                }}
                className="rounded-md bg-destructive px-3 py-2 text-[10px] font-bold font-mono text-white transition-opacity hover:opacity-85 whitespace-nowrap"
              >
                Remove
              </button>
            </div>
          </div>
        </div>

        {DIVIDER}

        {/* Status Actions */}
        <div className="flex items-center gap-2 px-2">
          <StatusBtn label="Stop" variant="destructive" disabled={count === 0} onClick={() => dispatch('stop')} />
          <StatusBtn label="Start" variant="success" disabled={count === 0} onClick={() => dispatch('start')} />
          <StatusBtn label="Pause" variant="warning" disabled={count === 0} onClick={() => setShowPauseModal(true)} />
          <StatusBtn label="Resume" variant="info" disabled={count === 0} onClick={() => dispatch('resume')} />
          <button
            onClick={() => {
              if (window.confirm(`Permanently destroy ${count} server nodes? This cannot be undone.`)) {
                dispatch('deleteServers');
                onClear();
              }
            }}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete Servers"
          >
            🗑️
          </button>
        </div>

        {DIVIDER}

        {/* Execution Group */}
        <div className="flex items-center gap-3 ml-auto pl-2">
          <button
            onClick={() => { onRdpChange(''); onDailyLimitChange(''); onWarmupChange(''); onTagChange(''); onRemoveTagChange(''); onClear(); }}
            className="kt-btn kt-btn-light h-11 px-6 rounded-2xl text-xs font-bold uppercase tracking-wider"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="kt-btn kt-btn-primary h-11 px-8 rounded-2xl text-xs font-bold uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all"
          >
            Execute Changes
          </button>
        </div>
      </div>

      {showPauseModal && (
        <Modal title="Set Suspension Reason" onClose={() => setShowPauseModal(false)} size="sm">
          <div className="space-y-6">
            <div className="bg-warning/5 border border-warning/20 p-4 rounded-2xl flex gap-3 italic">
              <span className="text-warning">⚠️</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                You are about to suspend operation for {count} infrastructure nodes. Providing a clear reason helps in system recovery and log analysis.
              </p>
            </div>
            
            <Field label="Suspension Reason" required>
              <Input
                value={pauseReason}
                onChange={e => setPauseReason(e.target.value)}
                placeholder="e.g. 421 Rate Limiting, IP Blacklisted, Maintenance..."
                autoFocus
              />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowPauseModal(false)}
                className="kt-btn kt-btn-light h-11 px-6 rounded-xl font-bold text-xs uppercase"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  dispatch('pause', pauseReason);
                  setShowPauseModal(false);
                  setPauseReason('');
                }}
                disabled={!pauseReason.trim()}
                className="kt-btn kt-btn-warning h-11 px-8 rounded-xl font-bold text-xs uppercase shadow-lg shadow-warning/20 active:scale-95 transition-all disabled:opacity-40"
              >
                Confirm Suspension
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
