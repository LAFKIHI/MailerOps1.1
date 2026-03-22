import { type ReactNode } from 'react';

export default function Modal({ title, onClose, children, size = 'md' }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 transition-all duration-300"
      style={{ background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(12px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`w-full ${widths[size]} max-h-[90vh] overflow-y-auto rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-200`}
        style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text1)' }}>
            {title}
          </h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base transition-colors"
            style={{ background: 'var(--surface2)', color: 'var(--text3)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}>
            ✕
          </button>
        </div>

        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, required, children }: {
  label: string; required?: boolean; children: ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="block text-[12px] font-semibold mb-1.5 uppercase tracking-wide"
        style={{ color: 'var(--text3)' }}>
        {label}{required && <span style={{ color: 'var(--danger)' }} className="ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="field-input"
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg text-[13px] px-3 py-2 outline-none transition-all ${props.className ?? ''}`}
      style={{
        background:   'var(--surface2)',
        border:       '1.5px solid var(--border)',
        color:        'var(--text1)',
        fontFamily:   'JetBrains Mono, monospace',
        ...((props as Record<string,unknown>).style as React.CSSProperties),
      }}
    />
  );
}

export function ModalFooter({ onCancel, onSave, saving }: {
  onCancel: () => void; onSave: () => void; saving?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 pt-4" style={{ borderTop: '1px solid var(--border)', marginTop: 8 }}>
      <button onClick={onCancel} className="btn-secondary">Cancel</button>
      <button onClick={onSave} disabled={saving} className="btn-primary">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
