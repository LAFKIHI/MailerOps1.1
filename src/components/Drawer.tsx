import { type ReactNode, useEffect } from 'react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: string;
}

export default function Drawer({
  open, onClose, title, subtitle, children, width = 'w-[420px]'
}: DrawerProps) {
  // close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {/* dim backdrop — click to close */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[150] bg-black/40 transition-opacity duration-200
          ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      />

      {/* panel */}
      <div className={`
        fixed top-0 right-0 z-[160] h-full ${width} max-w-full
        bg-[#131619] border-l border-[#252b32] shadow-2xl
        flex flex-col
        transition-transform duration-200 ease-out
        ${open ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#252b32] shrink-0">
          <div>
            <h3 className="font-['Syne',sans-serif] font-bold text-[#e2e8f0] text-[15px]">{title}</h3>
            {subtitle && <p className="text-[11px] text-[#5a6478] font-mono mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-[#5a6478] hover:text-[#f04d4d] text-xl leading-none px-1 transition-colors mt-0.5"
          >✕</button>
        </div>

        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </>
  );
}

// ── Reusable drawer field components ─────────────────────────────

export function DField({ label, required, children }: {
  label: string; required?: boolean; children: ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-medium text-[#9aa5b4] mb-1.5 uppercase tracking-wide">
        {label}{required && <span className="text-[#f04d4d] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export function DInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-[#1a1e22] border border-[#252b32] rounded-md text-[#e2e8f0] text-sm
        px-3 py-2 font-mono outline-none focus:border-[#4df0a0] transition-colors
        placeholder:text-[#5a6478] ${props.className ?? ''}`}
    />
  );
}

export function DSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full bg-[#1a1e22] border border-[#252b32] rounded-md text-[#e2e8f0] text-sm
        px-3 py-2 font-mono outline-none focus:border-[#4df0a0] transition-colors ${props.className ?? ''}`}
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
    <div className="flex justify-end gap-2 pt-4 border-t border-[#252b32] mt-4">
      <button onClick={onCancel}
        className="text-sm font-mono px-4 py-2 rounded-md bg-[#1a1e22] border border-[#252b32] text-[#9aa5b4] hover:text-[#e2e8f0] transition-colors">
        Cancel
      </button>
      <button onClick={onSave} disabled={saving || disabled}
        className="text-sm font-mono font-bold px-5 py-2 rounded-md bg-[#4df0a0] text-black hover:opacity-85 transition-opacity disabled:opacity-40">
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  );
}
