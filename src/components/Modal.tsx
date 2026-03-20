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
      className="fixed inset-0 z-[200] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`w-full ${widths[size]} bg-[#131619] border border-[#2e3540] rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252b32]">
          <h3 className="font-['Syne',sans-serif] font-bold text-[#e2e8f0] text-[15px]">{title}</h3>
          <button
            onClick={onClose}
            className="text-[#5a6478] hover:text-[#f04d4d] text-lg leading-none px-1 transition-colors"
          >✕</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// Reusable form field
export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-medium text-[#9aa5b4] mb-1.5 uppercase tracking-wide">
        {label}{required && <span className="text-[#f04d4d] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// Reusable input
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-[#1a1e22] border border-[#252b32] rounded-md text-[#e2e8f0] text-sm px-3 py-2 font-mono outline-none
        focus:border-[#4df0a0] transition-colors placeholder:text-[#5a6478] ${props.className ?? ''}`}
    />
  );
}

// Reusable select
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full bg-[#1a1e22] border border-[#252b32] rounded-md text-[#e2e8f0] text-sm px-3 py-2 font-mono outline-none
        focus:border-[#4df0a0] transition-colors ${props.className ?? ''}`}
    />
  );
}

// Footer row
export function ModalFooter({ onCancel, onSave, saving }: { onCancel: () => void; onSave: () => void; saving?: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button onClick={onCancel} className="text-sm font-mono px-4 py-2 rounded-md bg-[#1a1e22] border border-[#252b32] text-[#9aa5b4] hover:text-[#e2e8f0] transition-colors">
        Cancel
      </button>
      <button onClick={onSave} disabled={saving} className="text-sm font-mono font-bold px-4 py-2 rounded-md bg-[#4df0a0] text-black hover:opacity-85 transition-opacity disabled:opacity-50">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
