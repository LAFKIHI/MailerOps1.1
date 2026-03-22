export type Color = '' | 'blue' | 'orange' | 'red' | 'purple' | 'green';

const COLORS: Record<Color, { bg: string; icon: string; bar: string }> = {
  '':      { bg: 'var(--primary-bg)',  icon: 'var(--primary)',  bar: 'var(--primary)' },
  blue:    { bg: 'var(--primary-bg)',  icon: 'var(--primary)',  bar: 'var(--primary)' },
  green:   { bg: 'var(--success-bg)',  icon: 'var(--success)',  bar: 'var(--success)' },
  orange:  { bg: 'var(--warning-bg)',  icon: 'var(--warning)',  bar: 'var(--warning)' },
  red:     { bg: 'var(--danger-bg)',   icon: 'var(--danger)',   bar: 'var(--danger)'  },
  purple:  { bg: 'rgba(139,92,246,.1)',icon: '#8B5CF6',         bar: '#8B5CF6'        },
};

export default function StatCard({ label, value, sub, color = '', trend }: {
  label:  string;
  value:  string | number;
  sub:    string;
  color?: Color;
  trend?: { val: string; up: boolean };
}) {
  const c = COLORS[color] ?? COLORS[''];

  return (
    <div className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ background: c.bg, color: c.icon }}>
          ◈
        </div>
        {trend && (
          <span className="text-xs font-semibold px-2 py-1 rounded-lg"
            style={{
              background: trend.up ? 'var(--success-bg)' : 'var(--danger-bg)',
              color:      trend.up ? 'var(--success)'    : 'var(--danger)',
            }}>
            {trend.up ? '↑' : '↓'} {trend.val}
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text1)' }}>
          {value}
        </div>
        <div className="text-[13px] font-medium mt-0.5" style={{ color: 'var(--text2)' }}>
          {label}
        </div>
        <div className="text-[12px] mt-0.5" style={{ color: 'var(--text3)' }}>
          {sub}
        </div>
      </div>
      {/* accent bar */}
      <div className="h-1 rounded-full mt-auto" style={{ background: 'var(--border)' }}>
        <div className="h-full w-1/2 rounded-full" style={{ background: c.bar }} />
      </div>
    </div>
  );
}
