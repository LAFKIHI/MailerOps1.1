import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../App';
import { DEFAULT_ACTIONS, n2s, todayStr, parseSafeDate, fmtDate } from '../lib/constants';
import StatCard, { Color } from '../components/StatCard';

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
    <div className="space-y-6 md:space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-bold text-foreground text-2xl flex items-center gap-3">
             📡 History & Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Insightful metrics and activity logs for your mailing operations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-muted rounded-xl border border-border">
            {(['tasks', 'deliveries'] as const).map(item => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`text-xs font-bold px-4 py-2 rounded-lg transition-all ${
                  tab === item
                    ? 'bg-background text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {item === 'tasks' ? 'Tasks' : 'Deliveries'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="kt-card p-4 flex items-center gap-3 flex-wrap border-dashed">
        <div className="flex items-center gap-1.5 mr-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Range:</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {RANGES.map(item => (
            <button
              key={item.val}
              onClick={() => { setRange(item.val); setFrom(''); setTo(''); }}
              className={`kt-btn kt-btn-xs px-3 py-1.5 whitespace-nowrap ${
                range === item.val ? 'kt-btn-primary' : 'kt-btn-outline'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-border mx-2 hidden sm:block" />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={e => { setFrom(e.target.value); setRange('custom'); }}
            className="kt-input px-3 py-1.5 text-xs w-36"
          />
          <span className="text-muted-foreground">→</span>
          <input
            type="date"
            value={to}
            onChange={e => { setTo(e.target.value); setRange('custom'); }}
            className="kt-input px-3 py-1.5 text-xs w-36"
          />
        </div>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Seeds', val: n2s(totalSeeds), sub: 'Period total', color: 'success' as Color },
          { label: 'Avg / Day', val: n2s(avgTaskDay), sub: 'Active average', color: '' as Color },
          { label: 'Total Tasks', val: filteredTasks.length, sub: 'Filtered count', color: 'blue' as Color },
          { label: 'Success Rate', val: filteredTasks.length ? Math.round((doneTasks / filteredTasks.length) * 100) + '%' : '—', sub: `${doneTasks}/${filteredTasks.length} done`, color: (doneTasks/filteredTasks.length > 0.8 ? 'success' : 'orange') as Color },
          { label: 'Active Days', val: taskDays.length, sub: 'Days with load', color: '' as Color },
        ].map(card => (
          <StatCard key={card.label} {...card} value={String(card.val)} />
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

      <div className="kt-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Daily Activity Log
          </div>
          <div className="text-[10px] font-bold text-muted-foreground px-2 py-1 bg-background rounded-lg border border-border">
            {taskDays.length} Active Days
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="kt-table">
            <thead>
              <tr>
                {['Date', 'Seeds', 'Tasks', 'Done', 'Rate', 'Activity'].map((header, i) => (
                  <th key={header} className={`px-5 py-3 ${[4, 5].includes(i) ? 'hidden sm:table-cell' : ''}`}>
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
                  <tr key={day} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-bold text-foreground whitespace-nowrap">{formatDay(day)}</td>
                    <td className="px-5 py-3 font-mono font-bold text-primary">{seeds.toLocaleString()}</td>
                    <td className="px-5 py-3 text-muted-foreground font-medium">{dayTasks.length}</td>
                    <td className="px-5 py-3 text-success font-bold">{done}</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs hidden sm:table-cell font-bold">{completePct}%</td>
                    <td className="px-5 py-3 w-40 hidden sm:table-cell">
                      <ProgressBar value={pct} color="var(--primary)" />
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
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Sessions', val: filteredSessions.length, sub: 'Total period', color: 'blue' as Color },
          { label: 'Processed', val: n2s(totalDeliveryProcessed), sub: 'Mailbox items', color: '' as Color },
          { label: 'Deleted', val: n2s(totalDeliveryDeleted), sub: 'Lost boxes', color: 'red' as Color },
          { label: 'Avg Load', val: avgSessionsDay, sub: 'Sessions/day', color: '' as Color },
          { label: 'Deliveries', val: new Set(filteredSessions.map(s => s.deliveryId)).size, sub: 'Active objects', color: 'orange' as Color },
        ].map(card => (
          <StatCard key={card.label} {...card} value={String(card.val)} />
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

      <div className="kt-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Deliveries History Log
          </div>
          <div className="text-[10px] font-bold text-muted-foreground px-2 py-1 bg-background rounded-lg border border-border">
            {deliveryDays.length} Active Days
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="kt-table">
            <thead>
              <tr>
                {['Date', 'Sessions', 'Succeeded', 'Deleted', 'Issues', 'Load'].map(header => (
                  <th key={header} className="px-5 py-3">
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
                  <tr key={day} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-bold text-foreground whitespace-nowrap">{formatDay(day)}</td>
                    <td className="px-5 py-3 text-primary font-bold">{stats.sessions}</td>
                    <td className="px-5 py-3 text-success font-bold">{stats.succeeded}</td>
                    <td className="px-5 py-3 text-destructive font-bold">{stats.deleted}</td>
                    <td className="px-5 py-3 text-warning font-bold">{stats.badProxy}</td>
                    <td className="px-5 py-3 w-40">
                      <ProgressBar value={pct} color="var(--info)" />
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
    <div className="kt-card p-6">
      <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
        <span className="w-1.5 h-4 bg-primary rounded-full" />
        {title}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="kt-card border-dashed p-16 text-center">
      <div className="text-5xl mb-4 opacity-30 grayscale">{icon}</div>
      <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">{text}</p>
    </div>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 bg-muted rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color }} />
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
    const barW = Math.max(2, Math.min(16, chartW / Math.max(count, 1) - 4));

    [0.5, 1].forEach(fraction => {
      const y = padding.t + chartH * (1 - fraction);
      ctx.strokeStyle = 'var(--border)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padding.l, y);
      ctx.lineTo(width - padding.r, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'var(--muted-foreground)';
      ctx.font = 'bold 10px Inter';
      ctx.textAlign = 'right';
      ctx.fillText(n2s(Math.round(maxValue * fraction)), padding.l - 8, y + 3);
    });

    days.forEach((day, index) => {
      const x = padding.l + (index / Math.max(count - 1, 1)) * chartW - barW / 2;
      const barH = Math.max(2, (values[index] / Math.max(maxValue, 1)) * chartH);
      ctx.fillStyle = day === todayStr() ? 'var(--primary)' : color;
      ctx.beginPath();
      ctx.roundRect(x, padding.t + chartH - barH, barW, barH, 3);
      ctx.fill();
    });

    const step = Math.max(1, Math.floor(count / 5));
    ctx.fillStyle = 'var(--muted-foreground)';
    ctx.font = 'bold 9px Inter';
    ctx.textAlign = 'center';
    days.forEach((day, index) => {
      if (index % step === 0 || index === count - 1) {
        const x = padding.l + (index / Math.max(count - 1, 1)) * chartW;
        ctx.fillText(fmtDate(day).toUpperCase(), x, height - 3);
      }
    });
  }, [days, values, color, maxValue]);

  return (
    <div className="w-full overflow-hidden">
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} height={150} />
    </div>
  );
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
    const barW = Math.max(2, Math.min(16, chartW / Math.max(count, 1) - 4));

    days.forEach((day, index) => {
      const x = padding.l + (index / Math.max(count - 1, 1)) * chartW - barW / 2;
      const aH = (seriesA[index] / maxValue) * chartH;
      const bH = (seriesB[index] / maxValue) * chartH;
      if (bH > 0) {
        ctx.fillStyle = colorB;
        ctx.beginPath();
        ctx.roundRect(x, padding.t + chartH - aH - bH, barW, Math.max(bH, 2), 3);
        ctx.fill();
      }
      if (aH > 0) {
        ctx.fillStyle = day === todayStr() ? 'var(--primary)' : colorA;
        ctx.beginPath();
        ctx.roundRect(x, padding.t + chartH - aH, barW, Math.max(aH, 2), 3);
        ctx.fill();
      }
    });

    const step = Math.max(1, Math.floor(count / 5));
    ctx.fillStyle = 'var(--muted-foreground)';
    ctx.font = 'bold 9px Inter';
    ctx.textAlign = 'center';
    days.forEach((day, index) => {
      if (index % step === 0 || index === count - 1) {
        const x = padding.l + (index / Math.max(count - 1, 1)) * chartW;
        ctx.fillText(fmtDate(day).toUpperCase(), x, height - 3);
      }
    });
  }, [days, seriesA, seriesB, colorA, colorB]);

  return (
    <div className="w-full overflow-hidden">
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} height={150} />
    </div>
  );
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
  const colors = ['var(--muted)', '#1a3d2e', '#1f5c3e', '#27824f', '#33b368', 'var(--success)'];

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-[4px]">
        {weeks.map((week, index) => (
          <div key={index} className="flex flex-col gap-[4px]">
            {week.map(cell => {
              const level = cell.value === 0 ? 0 : Math.min(5, Math.ceil((cell.value / maxValue) * 5));
              return (
                <div
                  key={cell.date}
                  title={`${cell.date}: ${cell.value.toLocaleString()} ${label}`}
                  style={{ background: colors[level] }}
                  className="w-[14px] h-[14px] rounded-[3px] cursor-default hover:ring-2 hover:ring-primary/50 transition-all"
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
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
    <div className="kt-card p-6">
      <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
        <span className="w-1.5 h-4 bg-primary rounded-full" />
        {title}
      </div>
      <ul className="space-y-4">
        {items.map(([key, value], index) => (
          <li key={key} className="group">
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-[10px] font-bold text-muted-foreground w-4">{index + 1}</span>
              <span className="flex-1 text-xs text-foreground font-bold truncate group-hover:text-primary transition-colors">{labelFn(key)}</span>
              <span className="text-xs font-bold font-mono" style={{ color }}>{valFn(value)}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(value / max) * 100}%`, background: color }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDay(day: string) {
  const weekday = parseSafeDate(day)?.toLocaleDateString('en-GB', { weekday: 'short' }) || '—';
  const date = parseSafeDate(day)?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) || '—';
  return `${date} ${weekday}`;
}
