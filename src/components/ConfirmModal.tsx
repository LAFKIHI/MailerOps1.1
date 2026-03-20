import { useEffect } from 'react';

interface Props {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = true,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, onConfirm]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div 
        className="w-full max-w-sm rounded-lg bg-[#111418] border border-[#252b32] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-[#e2e8f0] font-['Syne',sans-serif]">{title}</h3>
        <p className="mt-2 text-sm text-[#9aa5b4] leading-relaxed mb-6 font-mono">{message}</p>
        
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded bg-[#1a1e22] border border-[#252b32] text-[#e2e8f0] hover:bg-[#252b32] transition-colors font-mono"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded text-[#111418] font-bold transition-colors font-mono ${
               danger ? 'bg-[#f04d4d] hover:bg-[#d43d3d]' : 'bg-[#4df0a0] hover:opacity-85'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
