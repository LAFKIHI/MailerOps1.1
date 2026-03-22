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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div 
        className="w-full max-w-[400px] rounded-[2rem] bg-background border border-border shadow-2xl animate-in zoom-in-95 duration-300 shadow-black/20 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`h-1.5 w-full ${danger ? 'bg-destructive' : 'bg-primary'}`} />
        
        <div className="p-8">
          <h3 className="text-xl font-bold text-foreground leading-tight">{title}</h3>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed mb-8">{message}</p>
          
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="kt-btn kt-btn-light px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`kt-btn px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-transform active:scale-95 ${
                 danger ? 'kt-btn-destructive shadow-destructive/20' : 'kt-btn-primary shadow-primary/20'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
