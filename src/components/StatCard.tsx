type Color = '' | 'blue' | 'orange' | 'red' | 'purple';

const ACCENT: Record<Color, string> = {
  '':       'bg-[#4df0a0]',
  blue:     'bg-[#4d8ff0]',
  orange:   'bg-[#f09a4d]',
  red:      'bg-[#f04d4d]',
  purple:   'bg-[#a855f7]',
};

export default function StatCard({ label, value, sub, color = '' }: {
  label: string; value: string | number; sub: string; color?: Color;
}) {
  return (
    <div className="relative bg-[#131619] border border-[#252b32] rounded-md px-4 py-3 overflow-hidden">
      <div className={`absolute top-0 left-0 w-[3px] h-full opacity-60 ${ACCENT[color]}`} />
      <div className="text-[10px] uppercase tracking-widest text-[#5a6478] mb-1">{label}</div>
      <div className="font-['Syne',sans-serif] text-2xl font-bold leading-none text-[#e2e8f0]">{value}</div>
      <div className="text-[11px] text-[#5a6478] mt-1">{sub}</div>
    </div>
  );
}
