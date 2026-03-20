import { apiBulkServerAction } from '../lib/api';
import { validateServerBulkAction } from '../lib/serverBulkActions';

const INPUT_CLS =
  'w-24 rounded-md border border-[#252b32] bg-[#1a1e22] px-2 py-2 text-sm font-mono text-[#e2e8f0] outline-none transition-colors focus:border-[#4df0a0] placeholder:text-[#5a6478]';

const LABEL_CLS = 'text-xs font-mono text-[#9aa5b4] whitespace-nowrap';

const DIVIDER = <span className="h-5 w-px bg-[#2a313b] mx-1" />;

function StatusBtn({
  label,
  color,
  onClick,
  disabled,
}: {
  label: string;
  color: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-2 text-xs font-bold font-mono transition-opacity disabled:opacity-40 ${color}`}
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
}) {
  const count = selectedIds.length;
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

    if (tasks.length === 0) {
      onError('Enter a value in at least one field before clicking Apply');
      return;
    }

    for (const task of tasks) {
      await task();
    }

    onRdpChange('');
    onDailyLimitChange('');
    onSuccess(`Bulk update applied to ${count} server${count > 1 ? 's' : ''}`);
  }

  return (
    <section className="rounded-2xl border border-[#2a313b] bg-[linear-gradient(135deg,#131619,#111928)] px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Server count */}
        <div className="shrink-0">
          <div className="font-['Syne',sans-serif] text-sm font-bold text-[#e2e8f0]">Bulk Actions</div>
          <div className="text-[11px] font-mono text-[#7d8aa0]">
            {count} server{count > 1 ? 's' : ''} selected
          </div>
        </div>

        {DIVIDER}

        {/* Change RDP */}
        <div className="flex items-center gap-2">
          <span className={LABEL_CLS}>Change RDP:</span>
          <input
            type="number"
            min={0}
            step={1}
            value={rdpValue}
            onChange={e => onRdpChange(e.target.value)}
            placeholder="e.g. 144"
            className={INPUT_CLS}
          />
        </div>

        {DIVIDER}

        {/* Daily Limit */}
        <div className="flex items-center gap-2">
          <span className={LABEL_CLS}>Daily Limit:</span>
          <input
            type="number"
            min={0}
            step={1}
            value={dailyLimitValue}
            onChange={e => onDailyLimitChange(e.target.value)}
            placeholder="e.g. 500"
            className={INPUT_CLS}
          />
          <span className={LABEL_CLS}>/day</span>
        </div>

        {DIVIDER}

        {/* Immediate status buttons */}
        <div className="flex items-center gap-2">
          <StatusBtn
            label="Stop"
            color="bg-[#f04d4d]/10 text-[#f04d4d] border border-[#f04d4d]/30 hover:bg-[#f04d4d]/20"
            disabled={count === 0}
            onClick={() => dispatch('stop')}
          />
          <StatusBtn
            label="Start"
            color="bg-[#4df0a0]/10 text-[#4df0a0] border border-[#4df0a0]/30 hover:bg-[#4df0a0]/20"
            disabled={count === 0}
            onClick={() => dispatch('start')}
          />
          <StatusBtn
            label="Pause"
            color="bg-[#f0c44d]/10 text-[#f0c44d] border border-[#f0c44d]/30 hover:bg-[#f0c44d]/20"
            disabled={count === 0}
            onClick={() => dispatch('pause')}
          />
          <StatusBtn
            label="Resume"
            color="bg-[#4d8ff0]/10 text-[#4d8ff0] border border-[#4d8ff0]/30 hover:bg-[#4d8ff0]/20"
            disabled={count === 0}
            onClick={() => dispatch('resume')}
          />
        </div>

        {DIVIDER}

        {/* Apply + Clear */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleApply}
            className="rounded-md bg-[#4df0a0] px-4 py-2 text-sm font-bold font-mono text-black transition-opacity hover:opacity-85"
          >
            Apply
          </button>
          <button
            onClick={() => { onRdpChange(''); onDailyLimitChange(''); onClear(); }}
            className="rounded-md border border-[#252b32] bg-[#1a1e22] px-3 py-2 text-sm font-mono text-[#9aa5b4] transition-all hover:border-[#f04d4d] hover:text-[#f04d4d]"
          >
            Clear
          </button>
        </div>
      </div>
    </section>
  );
}
