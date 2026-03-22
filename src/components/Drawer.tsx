import { type ReactNode, useEffect } from 'react';

export default function Drawer({ open, onClose, title, subtitle, children, width = '420px' }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[150] transition-all duration-300"
        style={{
          background: 'rgba(0,0,0,.65)',
          backdropFilter: 'blur(12px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />

      {/* panel */}
      <div
        className="fixed top-0 right-0 z-[160] h-full flex flex-col transition-transform duration-250 ease-out"
        style={{
          width,
          maxWidth: '100%',
          background: 'var(--surface)',
          borderLeft: '1.5px solid var(--border)',
          boxShadow: '-12px 0 60px rgba(0,0,0,.3)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        {/* header */}
        <div className="flex items-start justify-between px-6 py-5 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text1)' }}>{title}</h3>
            {subtitle && (
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text3)' }}>{subtitle}</p>
            )}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base mt-0.5 transition-colors"
            style={{ background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}>
            ✕
          </button>
        </div>

        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </>
  );
}

export function DField({ label, required, children }: {
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

export function DInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="field-input" />;
}

export function DSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="field-input"
    />
  );
}

export function DFooter({ onCancel, onSave, saveLabel = 'Save', saving, disabled }: {
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  saving?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 pt-4 mt-4"
      style={{ borderTop: '1px solid var(--border)' }}>
      <button onClick={onCancel} className="btn-secondary">Cancel</button>
      <button onClick={onSave} disabled={saving || disabled} className="btn-primary">
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  );
}
