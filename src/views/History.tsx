import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../App';
import { DEFAULT_ACTIONS, n2s, todayStr } from '../lib/constants';

type Range = '7' | '30' | '90' | '365' | 'all' | 'custom';
type AnalyticsTab = 'tasks' | 'deliveries';

type DeliveryDay = {
  date: string;
  sessions: number;
  succeeded: number;
  badProxy: number;
  deleted: number;
  untouched: number;
};

export default function History() {
  const { tasks, actions, deliverySessions, deliveries } = useAppContext();
  const [tab, setTab] = useState<AnalyticsTab>('tasks');
  const [range, setRange] = useState<Range>('30');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const resolvedActions = actions.length ? actions : DEFAULT_ACTIONS;
  const getAction = (code: string) => resolvedActions.find(a => a.code === code);

  const filterByDateRange = <T extends { date: string }>(items: T[]) => {
    if (range === 'all') return items;
    if (range === 'custom') {
      const f = from ? new Date(from + 'T00:00:00') : null;
      const t = to ? new Date(to + 'T23:59:59') : null;
      return items.filter(item => {
        const day = new Date(item.date + 'T00:00:00');
        if (f && day < f) return false;
        if (t && day > t) return false;
        return true;
      });
    }
    const days = Number(range);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days + 1);
    cutoff.setHours(0, 0, 0, 0);
    return items.filter(item => new Date(item.date + 'T00:00:00') >= cutoff);
  };

  const filteredTasks = useMemo(() => filterByDateRange(tasks), [tasks, range, from, to]);
  const filteredSessions = useMemo(() => filterByDateRange(deliverySessions), [deliverySessions, range, from, to]);

  const tasksByDay = useMemo(() => {
    const map: Record<string, typeof tasks> = {};
    filteredTasks.forEach(task => { (map[task.date] = map[task.date] ?? []).push(task); });
    return map;
  }, [filteredTasks, tasks]);

  const taskDays = useMemo(() => Object.keys(tasksByDay).sort(), [tasksByDay]);
  const totalSeeds = filteredTasks.reduce((sum, task) => sum + task.seedCount, 0);
  const doneTasks = filteredTasks.filter(task => task.status === 'Done').length;
  const avgTaskDay = taskDays.length ? Math.round(totalSeeds / taskDays.length) : 0;
  const maxSeedsDay = Math.max(...taskDays.map(day => tasksByDay[day].reduce((sum, task) => sum + task.seedCount, 0)), 1);

  const topTaskDeliveries = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTasks.forEach(task => { map[task.deliveryName] = (map[task.deliveryName] ?? 0) + task.seedCount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filteredTasks]);

  const topTaskActions = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTasks.forEach(task => { map[task.actionCode] = (map[task.actionCode] ?? 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filteredTasks]);

  const deliveryByDay = useMemo(() => {
    const map: Record<string, DeliveryDay> = {};
    filteredSessions.forEach(session => {
      const current = map[session.date] ?? {
        date: session.date,
        sessions: 0,
        succeeded: 0,
        badProxy: 0,
        deleted: 0,
        untouched: 0,
      };
      current.sessions += 1;
      current.succeeded += session.succeeded;
      current.badProxy += session.badProxy;
      current.deleted += session.deleted;
      current.untouched += session.untouched;
      map[session.date] = current;
    });
    return map;
  }, [filteredSessions]);

  const deliveryDays = useMemo(() => Object.keys(deliveryByDay).sort(), [deliveryByDay]);
  const totalDeliveryProcessed = filteredSessions.reduce(
    (sum, session) => sum + session.succeeded + session.badProxy + session.deleted + session.untouched,
    0
  );
  const totalDeliveryDeleted = filteredSessions.reduce((sum, session) => sum + session.deleted, 0);
  const avgSessionsDay = deliveryDays.length ? Math.round(filteredSessions.length / deliveryDays.length) : 0;
  const maxDeliveryDay = Math.max(...deliveryDays.map(day => deliveryByDay[day].sessions), 1);

  const topSessionActions = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSessions.forEach(session => { map[session.actionCode] = (map[session.actionCode] ?? 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filteredSessions]);

  const topSessionRdp = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSessions.forEach(session => {
      const key = session.serverId?.trim() || 'No RDP';
      map[key] = (map[key] ?? 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filteredSessions]);

  const RANGES: { label: string; val: Range }[] = [
    { label: '7d', val: '7' },
    { label: '30d', val: '30' },
    { label: '90d', val: '90' },
    { label: '1yr', val: '365' },
    { label: 'All', val: 'all' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="font-['Syne',sans-serif] font-bold text-[#e2e8f0] text-base flex-1">History & Analytics</h1>
        {(['tasks', 'deliveries'] as const).map(item => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`text-xs font-mono px-3 py-1.5 rounded border transition-all ${
              tab === item
                ? 'bg-[#0d1e3e] border-[#4d8ff0] text-[#4d8ff0] font-bold'
                : 'bg-[#1a1e22] border-[#252b32] text-[#5a6478] hover:border-[#4d8ff0] hover:text-[#4d8ff0]'
            }`}
          >
            {item === 'tasks' ? 'Tasks History' : 'Deliveries Analytics'}
          </button>
        ))}
        {RANGES.map(item => (
          <button
            key={item.val}
            onClick={() => { setRange(item.val); setFrom(''); setTo(''); }}
            className={`text-xs font-mono px-3 py-1.5 rounded border transition-all ${
              range === item.val
                ? 'bg-[#0d2e1e] border-[#4df0a0] text-[#4df0a0] font-bold'
                : 'bg-[#1a1e22] border-[#252b32] text-[#5a6478] hover:border-[#4df0a0] hover:text-[#4df0a0]'
            }`}
          >
            {item.label}
          </button>
        ))}
        <input
          type="date"
          value={from}
          onChange={e => { setFrom(e.target.value); setRange('custom'); }}
          className="text-xs font-mono bg-[#1a1e22] border border-[#252b32] rounded px-2 py-1.5 text-[#e2e8f0] outline-none focus:border-[#4df0a0]"
        />
        <span className="text-[#5a6478] text-xs">→</span>
        <input
          type="date"
          value={to}
          onChange={e => { setTo(e.target.value); setRange('custom'); }}
          className="text-xs font-mono bg-[#1a1e22] border border-[#252b32] rounded px-2 py-1.5 text-[#e2e8f0] outline-none focus:border-[#4df0a0]"
        />
      </div>

      {tab === 'tasks' ? (
        <TaskAnalyticsView
          filteredTasks={filteredTasks}
          tasksByDay={tasksByDay}
          taskDays={taskDays}
          totalSeeds={totalSeeds}
          avgTaskDay={avgTaskDay}
          doneTasks={doneTasks}
          maxSeedsDay={maxSeedsDay}
          topTaskDeliveries={topTaskDeliveries}
          topTaskActions={topTaskActions}
          getAction={getAction}
          allTasks={tasks}
        />
      ) : (
        <DeliveryAnalyticsView
          filteredSessions={filteredSessions}
          deliveryByDay={deliveryByDay}
          deliveryDays={deliveryDays}
          totalDeliveryProcessed={totalDeliveryProcessed}
          totalDeliveryDeleted={totalDeliveryDeleted}
          avgSessionsDay={avgSessionsDay}
          maxDeliveryDay={maxDeliveryDay}
          topSessionActions={topSessionActions}
          topSessionRdp={topSessionRdp}
          getAction={getAction}
          allSessions={deliverySessions}
          deliveries={deliveries}
        />
      )}
    </div>
  );
}

function TaskAnalyticsView({
  filteredTasks,
  tasksByDay,
  taskDays,
  totalSeeds,
  avgTaskDay,
  doneTasks,
  maxSeedsDay,
  topTaskDeliveries,
  topTaskActions,
  getAction,
  allTasks,
}: {
  filteredTasks: any[];
  tasksByDay: Record<string, any[]>;
  taskDays: string[];
  totalSeeds: number;
  avgTaskDay: number;
  doneTasks: number;
  maxSeedsDay: number;
  topTaskDeliveries: [string, number][];
  topTaskActions: [string, number][];
  getAction: (code: string) => { label: string } | undefined;
  allTasks: { date: string; seedCount: number }[];
}) {
  if (filteredTasks.length === 0) {
    return <EmptyState icon="🭭" text="No tasks in this period. Widen the date range." />;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Seeds', val: n2s(totalSeeds), sub: 'total period' },
          { label: 'Avg / Day', val: n2s(avgTaskDay), sub: 'on active days' },
          { label: 'Tasks', val: filteredTasks.length, sub: 'total' },
          { label: 'Done', val: filteredTasks.length ? Math.round((doneTasks / filteredTasks.length) * 100) + '%' : '—', sub: `${doneTasks}/${filteredTasks.length}` },
          { label: 'Active Days', val: taskDays.length, sub: 'with activity' },
        ].map(card => (
          <KpiCard key={card.label} {...card} accent="#4df0a0" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Seeds per Day">
          <ValueBarChart
            days={taskDays.slice(-60)}
            values={taskDays.slice(-60).map(day => tasksByDay[day].reduce((sum, task) => sum + task.seedCount, 0))}
            color="#4df0a0"
            maxValue={maxSeedsDay}
          />
        </ChartCard>
        <ChartCard title="Tasks per Day">
          <StackedChart
            days={taskDays.slice(-60)}
            seriesA={taskDays.slice(-60).map(day => tasksByDay[day].filter(task => task.status === 'Done').length)}
            seriesB={taskDays.slice(-60).map(day => tasksByDay[day].filter(task => task.status !== 'Done').length)}
            colorA="#4df0a0"
            colorB="#2e1e0d"
          />
        </ChartCard>
      </div>

      <ChartCard title="Activity Heatmap — 52 weeks">
        <Heatmap
          items={allTasks.map(task => ({ date: task.date, value: task.seedCount }))}
          label="seeds"
        />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopList title="Top Deliveries" items={topTaskDeliveries} labelFn={k => k} valFn={v => n2s(v)} color="#f09a4d" />
        <TopList title="Top Actions" items={topTaskActions} labelFn={k => {
          const action = getAction(k);
          return action ? `${k} · ${action.label.slice(0, 24)}` : k;
        }} valFn={v => `${v} tasks`} color="#4d8ff0" />
      </div>

      <div className="bg-[#131619] border border-[#252b32] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#252b32] text-[11px] uppercase tracking-widest text-[#5a6478] font-medium">
          Day-by-Day Log — {taskDays.length} active days
        </div>
        <div className="overflow-auto max-h-[360px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#252b32] sticky top-0 bg-[#131619]">
                {['Date', 'Seeds', 'Tasks', 'Done', '%', 'Bar'].map((header, i) => (
                  <th key={header} className={`text-left px-4 py-2 text-[10px] uppercase tracking-widest text-[#5a6478] font-medium ${[4, 5].includes(i) ? 'hidden sm:table-cell' : ''}`}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...taskDays].reverse().map(day => {
                const dayTasks = tasksByDay[day];
                const seeds = dayTasks.reduce((sum, task) => sum + task.seedCount, 0);
                const done = dayTasks.filter(task => task.status === 'Done').length;
                const pct = Math.round((seeds / maxSeedsDay) * 100);
                const completePct = dayTasks.length ? Math.round((done / dayTasks.length) * 100) : 0;
                return (
                  <tr key={day} className="border-b border-[#252b32] last:border-0 hover:bg-[#1a1e22] transition-colors">
                    <td className="px-4 py-2.5 font-medium text-[#e2e8f0] whitespace-nowrap">{formatDay(day)}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-[#e2e8f0]">{seeds.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-[#9aa5b4]">{dayTasks.length}</td>
                    <td className="px-4 py-2.5 text-[#4df0a0]">{done}</td>
                    <td className="px-4 py-2.5 text-[#9aa5b4] text-xs hidden sm:table-cell">{completePct}%</td>
                    <td className="px-4 py-2.5 w-28 hidden sm:table-cell">
                      <ProgressBar value={pct} color="#4df0a0" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function DeliveryAnalyticsView({
  filteredSessions,
  deliveryByDay,
  deliveryDays,
  totalDeliveryProcessed,
  totalDeliveryDeleted,
  avgSessionsDay,
  maxDeliveryDay,
  topSessionActions,
  topSessionRdp,
  getAction,
  allSessions,
  deliveries,
}: {
  filteredSessions: any[];
  deliveryByDay: Record<string, DeliveryDay>;
  deliveryDays: string[];
  totalDeliveryProcessed: number;
  totalDeliveryDeleted: number;
  avgSessionsDay: number;
  maxDeliveryDay: number;
  topSessionActions: [string, number][];
  topSessionRdp: [string, number][];
  getAction: (code: string) => { label: string } | undefined;
  allSessions: { date: string; succeeded: number; badProxy: number; deleted: number; untouched: number }[];
  deliveries: { id: string; name: string }[];
}) {
  if (filteredSessions.length === 0) {
    return <EmptyState icon="📦" text="No delivery sessions in this period. Widen the date range." />;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Sessions', val: filteredSessions.length, sub: 'total period' },
          { label: 'Processed', val: n2s(totalDeliveryProcessed), sub: 'all outcomes' },
          { label: 'Deleted', val: n2s(totalDeliveryDeleted), sub: 'lost mailboxes' },
          { label: 'Avg Sessions / Day', val: avgSessionsDay, sub: 'on active days' },
          { label: 'Tracked Deliveries', val: new Set(filteredSessions.map(s => s.deliveryId)).size, sub: `${deliveries.length} total` },
        ].map(card => (
          <KpiCard key={card.label} {...card} accent="#4d8ff0" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Sessions per Day">
          <ValueBarChart
            days={deliveryDays.slice(-60)}
            values={deliveryDays.slice(-60).map(day => deliveryByDay[day].sessions)}
            color="#4d8ff0"
            maxValue={maxDeliveryDay}
          />
        </ChartCard>
        <ChartCard title="Succeeded vs Deleted">
          <StackedChart
            days={deliveryDays.slice(-60)}
            seriesA={deliveryDays.slice(-60).map(day => deliveryByDay[day].succeeded)}
            seriesB={deliveryDays.slice(-60).map(day => deliveryByDay[day].deleted)}
            colorA="#4df0a0"
            colorB="#f04d4d"
          />
        </ChartCard>
      </div>

      <ChartCard title="Delivery Activity Heatmap — 52 weeks">
        <Heatmap
          items={allSessions.map(session => ({
            date: session.date,
            value: session.succeeded + session.badProxy + session.deleted + session.untouched,
          }))}
          label="boxes"
        />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopList title="Top Session Actions" items={topSessionActions} labelFn={k => {
          const action = getAction(k);
          return action ? `${k} · ${action.label.slice(0, 24)}` : k;
        }} valFn={v => `${v} sessions`} color="#f09a4d" />
        <TopList title="Top RDPs" items={topSessionRdp} labelFn={k => k === 'No RDP' ? 'No RDP' : `RDP ${k}`} valFn={v => `${v} sessions`} color="#4d8ff0" />
      </div>

      <div className="bg-[#131619] border border-[#252b32] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#252b32] text-[11px] uppercase tracking-widest text-[#5a6478] font-medium">
          Deliveries Log — {deliveryDays.length} active days
        </div>
        <div className="overflow-auto max-h-[360px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#252b32] sticky top-0 bg-[#131619]">
                {['Date', 'Sessions', 'Succeeded', 'Deleted', 'Bad Proxy', 'Bar'].map(header => (
                  <th key={header} className="text-left px-4 py-2 text-[10px] uppercase tracking-widest text-[#5a6478] font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...deliveryDays].reverse().map(day => {
                const stats = deliveryByDay[day];
                const pct = Math.round((stats.sessions / maxDeliveryDay) * 100);
                return (
                  <tr key={day} className="border-b border-[#252b32] last:border-0 hover:bg-[#1a1e22] transition-colors">
                    <td className="px-4 py-2.5 font-medium text-[#e2e8f0] whitespace-nowrap">{formatDay(day)}</td>
                    <td className="px-4 py-2.5 text-[#9aa5b4]">{stats.sessions}</td>
                    <td className="px-4 py-2.5 text-[#4df0a0]">{stats.succeeded}</td>
                    <td className="px-4 py-2.5 text-[#f04d4d]">{stats.deleted}</td>
                    <td className="px-4 py-2.5 text-[#f09a4d]">{stats.badProxy}</td>
                    <td className="px-4 py-2.5 w-28">
                      <ProgressBar value={pct} color="#4d8ff0" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function KpiCard({ label, val, sub, accent }: { label: string; val: string | number; sub: string; accent: string }) {
  return (
    <div className="bg-[#131619] border border-[#252b32] rounded-lg px-4 py-3 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[3px] h-full" style={{ background: accent, opacity: 0.5 }} />
      <div className="text-[10px] uppercase tracking-widest text-[#5a6478] mb-1">{label}</div>
      <div className="font-['Syne',sans-serif] font-bold text-[#e2e8f0] text-xl leading-none">{val}</div>
      <div className="text-[11px] text-[#5a6478] mt-1">{sub}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#131619] border border-[#252b32] rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-widest text-[#5a6478] mb-3 font-medium">{title}</div>
      {children}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="border border-dashed border-[#252b32] rounded-lg p-12 text-center">
      <div className="text-3xl mb-3">{icon}</div>
      <p className="text-[#5a6478] font-mono text-sm">{text}</p>
    </div>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 bg-[#252b32] rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

function ValueBarChart({ days, values, color, maxValue }: { days: string[]; values: number[]; color: string; maxValue: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || days.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement!.clientWidth;
    const height = 150;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const padding = { t: 8, r: 8, b: 20, l: 40 };
    const chartW = width - padding.l - padding.r;
    const chartH = height - padding.t - padding.b;
    const count = days.length;
    const barW = Math.max(2, Math.min(16, chartW / Math.max(count, 1) - 2));

    [0.5, 1].forEach(fraction => {
      const y = padding.t + chartH * (1 - fraction);
      ctx.strokeStyle = '#252b32';
      ctx.beginPath();
      ctx.moveTo(padding.l, y);
      ctx.lineTo(width - padding.r, y);
      ctx.stroke();
      ctx.fillStyle = '#5a6478';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(n2s(Math.round(maxValue * fraction)), padding.l - 4, y + 3);
    });

    days.forEach((day, index) => {
      const x = padding.l + (index / Math.max(count - 1, 1)) * chartW - barW / 2;
      const barH = Math.max(2, (values[index] / Math.max(maxValue, 1)) * chartH);
      ctx.fillStyle = day === todayStr() ? '#4df0a0' : color;
      ctx.beginPath();
      ctx.roundRect(x, padding.t + chartH - barH, barW, barH, 2);
      ctx.fill();
    });

    const step = Math.max(1, Math.floor(count / 5));
    ctx.fillStyle = '#5a6478';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    days.forEach((day, index) => {
      if (index % step === 0 || index === count - 1) {
        const x = padding.l + (index / Math.max(count - 1, 1)) * chartW;
        ctx.fillText(new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), x, height - 3);
      }
    });
  }, [days, values, color, maxValue]);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} height={150} />;
}

function StackedChart({
  days,
  seriesA,
  seriesB,
  colorA,
  colorB,
}: {
  days: string[];
  seriesA: number[];
  seriesB: number[];
  colorA: string;
  colorB: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || days.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement!.clientWidth;
    const height = 150;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const totals = days.map((_, index) => seriesA[index] + seriesB[index]);
    const maxValue = Math.max(...totals, 1);
    const padding = { t: 8, r: 8, b: 20, l: 28 };
    const chartW = width - padding.l - padding.r;
    const chartH = height - padding.t - padding.b;
    const count = days.length;
    const barW = Math.max(2, Math.min(16, chartW / Math.max(count, 1) - 2));

    days.forEach((day, index) => {
      const x = padding.l + (index / Math.max(count - 1, 1)) * chartW - barW / 2;
      const aH = (seriesA[index] / maxValue) * chartH;
      const bH = (seriesB[index] / maxValue) * chartH;
      if (bH > 0) {
        ctx.fillStyle = colorB;
        ctx.beginPath();
        ctx.roundRect(x, padding.t + chartH - aH - bH, barW, Math.max(bH, 2), 2);
        ctx.fill();
      }
      if (aH > 0) {
        ctx.fillStyle = day === todayStr() ? '#4df0a0' : colorA;
        ctx.beginPath();
        ctx.roundRect(x, padding.t + chartH - aH, barW, Math.max(aH, 2), 2);
        ctx.fill();
      }
    });

    const step = Math.max(1, Math.floor(count / 5));
    ctx.fillStyle = '#5a6478';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    days.forEach((day, index) => {
      if (index % step === 0 || index === count - 1) {
        const x = padding.l + (index / Math.max(count - 1, 1)) * chartW;
        ctx.fillText(new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), x, height - 3);
      }
    });
  }, [days, seriesA, seriesB, colorA, colorB]);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} height={150} />;
}

function Heatmap({ items, label }: { items: { date: string; value: number }[]; label: string }) {
  const valueByDay: Record<string, number> = {};
  items.forEach(item => { valueByDay[item.date] = (valueByDay[item.date] ?? 0) + item.value; });
  const maxValue = Math.max(...Object.values(valueByDay), 1);

  const cells: { date: string; value: number }[] = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  for (let i = 363; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const ds = day.toISOString().slice(0, 10);
    cells.push({ date: ds, value: valueByDay[ds] ?? 0 });
  }

  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const colors = ['#1a1e22', '#1a3d2e', '#1f5c3e', '#27824f', '#33b368', '#4df0a0'];

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-[3px]">
        {weeks.map((week, index) => (
          <div key={index} className="flex flex-col gap-[3px]">
            {week.map(cell => {
              const level = cell.value === 0 ? 0 : Math.min(5, Math.ceil((cell.value / maxValue) * 5));
              return (
                <div
                  key={cell.date}
                  title={`${cell.date}: ${cell.value.toLocaleString()} ${label}`}
                  style={{ background: colors[level] }}
                  className="w-[13px] h-[13px] rounded-[2px] cursor-default"
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-[#5a6478]">
        Less {colors.map((color, index) => <div key={index} style={{ background: color }} className="w-[11px] h-[11px] rounded-[2px]" />)} More
      </div>
    </div>
  );
}

function TopList({
  title,
  items,
  labelFn,
  valFn,
  color,
}: {
  title: string;
  items: [string, number][];
  labelFn: (key: string) => string;
  valFn: (value: number) => string;
  color: string;
}) {
  const max = Math.max(...items.map(([, value]) => value), 1);
  return (
    <div className="bg-[#131619] border border-[#252b32] rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-widest text-[#5a6478] mb-3 font-medium">{title}</div>
      <ul className="space-y-2">
        {items.map(([key, value], index) => (
          <li key={key} className="flex items-center gap-2">
            <span className="text-[10px] text-[#5a6478] w-4 text-right">{index + 1}</span>
            <span className="flex-1 text-xs text-[#9aa5b4] font-mono truncate">{labelFn(key)}</span>
            <div className="w-16 h-1 bg-[#252b32] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
            </div>
            <span className="text-xs font-mono font-bold" style={{ color }}>{valFn(value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDay(day: string) {
  const weekday = new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
  const date = new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  return `${date} ${weekday}`;
}
