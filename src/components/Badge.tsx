type Variant = 'done' | 'progress' | 'pending' | 'high' | 'medium' | 'low' | 'bad' | 'inbox' | 'spam' | 'blocked';

const MAP: Record<Variant, string> = {
  done:     'bg-[#0d2e1e] text-[#4df0a0]',
  progress: 'bg-[#2e1e0d] text-[#f09a4d]',
  pending:  'bg-[#20252b] text-[#5a6478]',
  high:     'bg-[#0d2e1e] text-[#4df0a0]',
  medium:   'bg-[#0d1e3e] text-[#4d8ff0]',
  low:      'bg-[#2e1e0d] text-[#f09a4d]',
  bad:      'bg-[#2e0d0d] text-[#f04d4d]',
  inbox:    'bg-[#0d2e1e] text-[#4df0a0]',
  spam:     'bg-[#2e1e0d] text-[#f09a4d]',
  blocked:  'bg-[#2e0d0d] text-[#f04d4d]',
};

function statusVariant(s: string): Variant {
  if (s === 'Done') return 'done';
  if (s === 'In Progress') return 'progress';
  if (s === 'High' || s === 'inbox') return s === 'inbox' ? 'inbox' : 'high';
  if (s === 'Medium') return 'medium';
  if (s === 'Low')    return 'low';
  if (s === 'Bad' || s === 'blocked') return s === 'blocked' ? 'blocked' : 'bad';
  if (s === 'spam')   return 'spam';
  return 'pending';
}

export default function Badge({ label, onClick }: { label: string; onClick?: () => void }) {
  const cls = MAP[statusVariant(label)] ?? MAP.pending;
  return (
    <span
      onClick={onClick}
      className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded ${cls} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
    >
      {label}
    </span>
  );
}
