type Variant = 'done' | 'progress' | 'pending' | 'high' | 'medium' | 'low' | 'bad' | 'inbox' | 'spam' | 'blocked';

const MAP: Record<Variant, { bg: string; color: string }> = {
  done:     { bg: 'var(--success-bg)', color: 'var(--success)' },
  inbox:    { bg: 'var(--success-bg)', color: 'var(--success)' },
  high:     { bg: 'var(--success-bg)', color: 'var(--success)' },
  progress: { bg: 'var(--warning-bg)', color: 'var(--warning)' },
  spam:     { bg: 'var(--warning-bg)', color: 'var(--warning)' },
  low:      { bg: 'var(--warning-bg)', color: 'var(--warning)' },
  bad:      { bg: 'var(--danger-bg)',  color: 'var(--danger)'  },
  blocked:  { bg: 'var(--danger-bg)',  color: 'var(--danger)'  },
  medium:   { bg: 'var(--primary-bg)', color: 'var(--primary)' },
  pending:  { bg: 'var(--border)',     color: 'var(--text3)'   },
};

function toVariant(s: string): Variant {
  const v = s?.toLowerCase();
  if (v === 'done')        return 'done';
  if (v === 'in progress') return 'progress';
  if (v === 'high')        return 'high';
  if (v === 'medium')      return 'medium';
  if (v === 'low')         return 'low';
  if (v === 'bad')         return 'bad';
  if (v === 'inbox')       return 'inbox';
  if (v === 'spam')        return 'spam';
  if (v === 'blocked')     return 'blocked';
  return 'pending';
}

export default function Badge({ label, onClick }: { label: string; onClick?: () => void }) {
  const { bg, color } = MAP[toVariant(label)] ?? MAP.pending;
  return (
    <span
      onClick={onClick}
      className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-lg"
      style={{ background: bg, color, cursor: onClick ? 'pointer' : 'default' }}>
      {label}
    </span>
  );
}
